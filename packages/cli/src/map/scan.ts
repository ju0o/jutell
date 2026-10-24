import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// Same limits as the receipt's git calls (commands/receipt/index.ts runGit).
const GIT_TIMEOUT_MS = 5000;
const GIT_MAX_BUFFER = 16 * 1024 * 1024;
/** Upper bound on files collected when walking a folder that is not a git repository. */
export const WALK_MAX_FILES = 20000;
/**
 * Standard dependency/output folders. Never walked outside git, and in git their UNTRACKED files are left out
 * of both the map and the receipt (a project without .gitignore must not list node_modules), tracked or not.
 */
export const WALK_EXCLUDED_DIRS = new Set([
  'node_modules', 'bower_components', 'dist', 'build', 'out', 'coverage', 'target', 'vendor', '__pycache__',
  '.git', '.next', '.nuxt', '.svelte-kit', '.turbo', '.parcel-cache', '.cache', '.gradle', '.venv', 'venv',
]);

/** git pathspecs that leave UNTRACKED files in the folders above out of ls-files/status (one rule for the map and the receipt; tracked files always stay). */
export const EXCLUDED_PATHSPECS = ['--', '.', ...[...WALK_EXCLUDED_DIRS].map((dir) => `:(exclude,glob)**/${dir}/**`)];

/** True when a folder segment of the project-relative path is a standard dependency/output folder. */
export function inExcludedFolder(relative: string): boolean {
  return relative.split('/').slice(0, -1).some((part) => WALK_EXCLUDED_DIRS.has(part));
}

// C0/C1 controls, bidi controls and zero-width characters (same set as receipt/render.ts).
const controlCharacters = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069\u200e\u200f\u061c\u200b-\u200d\u2060\ufeff]/g;

export type MapScan = {
  /** Project-relative paths with "/" separators, control characters removed, sorted by code point. */
  files: string[];
  source: 'git' | 'walk';
  /** True when the walk stopped at WALK_MAX_FILES. */
  truncated: boolean;
};

export class MapScanError extends Error {}

/** Hidden folders (any folder segment starting with ".") are left out of the map. */
export function inHiddenFolder(relative: string): boolean {
  const parts = relative.split('/');
  return parts.slice(0, -1).some((part) => part.startsWith('.'));
}

export function cleanPath(relative: string): string {
  return relative.replace(controlCharacters, '');
}

function byCodePoint(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function finish(raw: string[]): string[] {
  const seen = new Set<string>();
  for (const file of raw) {
    if (!file || inHiddenFolder(file)) continue;
    const cleaned = cleanPath(file);
    if (cleaned) seen.add(cleaned);
  }
  return [...seen].sort(byCodePoint);
}

function runGit(cwd: string, args: string[], signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, timeout: GIT_TIMEOUT_MS, maxBuffer: GIT_MAX_BUFFER, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, ...(signal ? { signal } : {}) }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

async function gitFiles(root: string, signal?: AbortSignal): Promise<string[] | undefined> {
  let stdout: string;
  try {
    // Tracked files always count, even under build/ or vendor/ (someone chose to commit them).
    // The standard exclude list only leaves out untracked files there (node_modules, build output…).
    const [tracked, untracked] = await Promise.all([
      runGit(root, ['--no-optional-locks', 'ls-files', '-z', '--cached'], signal),
      runGit(root, ['--no-optional-locks', 'ls-files', '-z', '--others', '--exclude-standard', ...EXCLUDED_PATHSPECS], signal),
    ]);
    stdout = `${tracked}\0${untracked}`;
  } catch (error) {
    signal?.throwIfAborted();
    const failure = error as NodeJS.ErrnoException & { killed?: boolean };
    // No git, or not a repository: fall back to walking the folder.
    if (failure.code === 'ENOENT' || typeof failure.code === 'number') return undefined;
    if (failure.code === 'ETIMEDOUT' || failure.killed) throw new MapScanError('Git 확인 시간이 초과됐어요');
    if (failure.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') throw new MapScanError('파일 목록이 너무 커요');
    throw new MapScanError('Git 파일 목록을 읽지 못했어요');
  }
  const listed = [...new Set(stdout.split('\0').filter(Boolean))];
  // Links are not followed: drop entries that are links, folders (submodules) or already deleted.
  const kept: string[] = [];
  const batch = 256;
  for (let index = 0; index < listed.length; index += batch) {
    signal?.throwIfAborted();
    const slice = listed.slice(index, index + batch);
    const stats = await Promise.all(slice.map((file) => fs.lstat(path.join(root, file)).catch(() => undefined)));
    slice.forEach((file, i) => { if (stats[i]?.isFile()) kept.push(file); });
  }
  return kept;
}

async function walkFiles(root: string, signal?: AbortSignal): Promise<{ files: string[]; truncated: boolean }> {
  const files: string[] = [];
  const queue = [''];
  while (queue.length) {
    signal?.throwIfAborted();
    const dir = queue.shift() as string;
    let entries;
    try {
      entries = await fs.readdir(path.join(root, dir), { withFileTypes: true });
    } catch {
      continue;
    }
    entries.sort((a, b) => byCodePoint(a.name, b.name));
    for (const entry of entries) {
      const relative = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) continue; // never follow links
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && !WALK_EXCLUDED_DIRS.has(entry.name)) queue.push(relative);
      } else if (entry.isFile()) {
        if (files.length >= WALK_MAX_FILES) return { files, truncated: true };
        files.push(relative);
      }
    }
  }
  return { files, truncated: false };
}

/** Collects the project's files for JuTellMap.md. Paths are relative to `root`. Stops (throws) once `signal` aborts. */
export async function scanProject(root: string, signal?: AbortSignal): Promise<MapScan> {
  const fromGit = await gitFiles(root, signal);
  if (fromGit) return { files: finish(fromGit), source: 'git', truncated: false };
  const walked = await walkFiles(root, signal);
  return { files: finish(walked.files), source: 'walk', truncated: walked.truncated };
}
