import { createHash } from 'node:crypto';
import { constants as fsConstants, promises as fs } from 'node:fs';
import path from 'node:path';
import { ensureDataRoot, exists, readText, writeTextSafely } from '../config/managed.js';
import { assets } from '../config/paths.js';
import type { ScopePaths } from '../types.js';
import { KNOWN_SHIPPED_SKILL_HASHES } from './known-skill-hashes.js';

async function filesUnder(root: string, current = root): Promise<string[]> {
  if (!(await exists(current))) return [];
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const file = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(root, file));
    else files.push(path.relative(root, file));
  }
  return files;
}

const sha256 = (content: Buffer) => createHash('sha256').update(content).digest('hex');
const NO_FOLLOW = fsConstants.O_NOFOLLOW ?? 0;

/** lstat every path component below `root` (and root itself): only real directories and, at the end, a
 * single-link regular file (or nothing) are safe to write. Links, devices, FIFOs and hard links are not. */
async function safeTarget(root: string, relative: string): Promise<'missing' | 'file' | 'unsafe'> {
  let current = root;
  for (const part of ['', ...path.dirname(relative).split(path.sep).filter((item) => item && item !== '.')]) {
    current = part ? path.join(current, part) : current;
    try {
      const stats = await fs.lstat(current);
      if (!stats.isDirectory()) return 'unsafe';
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'missing';
      throw error;
    }
  }
  try {
    const stats = await fs.lstat(path.join(root, relative));
    return stats.isFile() && stats.nlink === 1 ? 'file' : 'unsafe';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'missing';
    throw error;
  }
}

/** Create a new file without following a link at that path (fails if anything is already there). */
async function writeNewFile(file: string, content: Buffer) {
  const handle = await fs.open(file, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | NO_FOLLOW, 0o644);
  try { await handle.writeFile(content); } finally { await handle.close(); }
}

/** Replace a file by writing a temp file next to it and renaming over it: rename replaces the
 * directory entry itself, so a link swapped in at the last moment is replaced, never followed. */
async function replaceFile(file: string, content: Buffer) {
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.jutell-${process.pid}-${Date.now()}`);
  await writeNewFile(temp, content);
  try { await fs.rename(temp, file); } catch (error) { await fs.rm(temp, { force: true }); throw error; }
}

/** backups/skill-2026-10-18-2137 (local time), then -2, -3 … only when that name is taken. */
async function makeBackupDir(backupsRoot: string) {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const base = `skill-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  for (let attempt = 1; ; attempt += 1) {
    const dir = path.join(backupsRoot, attempt === 1 ? base : `${base}-${attempt}`);
    try {
      await fs.mkdir(dir);
      return dir;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || attempt > 999) throw error;
    }
  }
}

// A differing skill file is replaced only when JuTell installed it:
// - unmodified (content hash equals the hash JuTell recorded in cli-install.json, or a file an earlier
//   JuTell shipped, e.g. 2.0.x installs without a manifest): replaced directly, nothing to keep;
// - listed in the manifest but changed by the user: copied to .jutell-local/backups/skill-<time>/
//   (outside the skill folder, git-ignored) and then replaced.
// Unknown files, links, special files and hard links anywhere on the path are conflicts: never touched.
export async function installSkill(source: string, destination: string, paths?: ScopePaths) {
  const conflicts: string[] = [];
  const changed: string[] = [];
  const replaced: string[] = [];
  const backedUp: string[] = [];
  // Backups of files from an old install that never recorded a hash (we cannot tell an edit from an old version).
  const backedUpLegacy: string[] = [];
  let backupDir: string | undefined;
  const manifest = paths ? await readManifest(paths) : { skillFiles: [] as string[], skillHashes: {} as Record<string, string> };
  const managed = new Set(manifest.skillFiles);
  for (const relative of await filesUnder(source)) {
    const sourceFile = path.join(source, relative);
    const targetFile = path.join(destination, relative);
    const sourceContent = await fs.readFile(sourceFile);
    const state = await safeTarget(destination, relative);
    if (state === 'unsafe') { conflicts.push(relative); continue; }
    if (state === 'missing') {
      await fs.mkdir(path.dirname(targetFile), { recursive: true });
      if (await safeTarget(destination, relative) !== 'missing') { conflicts.push(relative); continue; }
      await writeNewFile(targetFile, sourceContent);
      changed.push(relative);
      continue;
    }
    const targetContent = await fs.readFile(targetFile, { flag: fsConstants.O_RDONLY | NO_FOLLOW });
    if (targetContent.equals(sourceContent)) continue;
    const targetHash = sha256(targetContent);
    const unmodified = manifest.skillHashes[relative] === targetHash || KNOWN_SHIPPED_SKILL_HASHES.has(targetHash);
    if (!paths || (!unmodified && !managed.has(relative))) { conflicts.push(relative); continue; }
    if (!unmodified) {
      if (!backupDir) {
        await ensureDataRoot(paths);
        const backupsRoot = path.join(paths.dataRoot, 'backups');
        // Neither .jutell-local nor backups/ may be a link (the backup must not land outside).
        if (!(await fs.lstat(paths.dataRoot)).isDirectory()) { conflicts.push(relative); continue; }
        await fs.mkdir(backupsRoot).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'EEXIST') throw error; });
        if (!(await fs.lstat(backupsRoot)).isDirectory()) { conflicts.push(relative); continue; }
        backupDir = await makeBackupDir(backupsRoot);
      }
      const backupFile = path.join(backupDir, relative);
      await fs.mkdir(path.dirname(backupFile), { recursive: true });
      await writeNewFile(backupFile, targetContent);
      backedUp.push(relative);
      if (!manifest.skillHashes[relative]) backedUpLegacy.push(relative);
    }
    await replaceFile(targetFile, sourceContent);
    replaced.push(relative);
  }
  return { conflicts, changed, replaced, backedUp, backedUpLegacy, backupDir };
}

/** Skill files whose installed content differs from this package (missing files included). */
export async function differingSkillFiles(source: string, destination: string) {
  const differing: string[] = [];
  for (const relative of await filesUnder(source)) {
    const [want, have] = await Promise.all([fs.readFile(path.join(source, relative)), fs.readFile(path.join(destination, relative)).catch(() => undefined)]);
    if (!have || !have.equals(want)) differing.push(relative);
  }
  return differing;
}

/** Plain lines for the user about refreshed guide files (empty when nothing was replaced). */
export function skillRefreshMessage(result: { replaced?: string[]; backedUp?: string[]; backedUpLegacy?: string[]; backupDir?: string }, paths: ScopePaths) {
  if (!result.replaced?.length) return undefined;
  if (!result.backupDir) return '안내 파일을 새 버전으로 바꿨어요.';
  const shown = paths.scope === 'project' ? path.relative(paths.targetRoot, result.backupDir) : result.backupDir;
  const files = result.backedUp ?? [];
  const legacy = new Set(result.backedUpLegacy ?? []);
  const lead = files.length > 0 && files.every((file) => legacy.has(file))
    ? '예전 안내 파일을 보관하고 새 버전으로 바꿨어요(직접 고친 내용이 있었다면 그것도 보관한 파일에 그대로 있어요).'
    : '직접 고친 내용이 있어서 예전 것을 보관하고 새 버전으로 바꿨어요.';
  return `${lead} 보관한 파일: ${files.join(', ')}. 보관한 곳: ${shown}`;
}

/** One plain line for skill files left alone, or undefined. */
export function skillConflictMessage(result: { conflicts?: string[] }) {
  if (!result.conflicts?.length) return undefined;
  return `직접 만든 파일이거나 링크라서 바꾸지 않은 안내 파일이 있어요: ${result.conflicts.join(', ')}`;
}

function manifestFile(paths: ScopePaths) {
  return path.join(paths.dataRoot, 'cli-install.json');
}

async function readManifest(paths: ScopePaths) {
  const empty = { skillFiles: [] as string[], skillHashes: {} as Record<string, string> };
  const raw = await readText(manifestFile(paths));
  if (!raw) return empty;
  try {
    const value = JSON.parse(raw) as { skillFiles?: unknown; skillHashes?: unknown };
    const hashes = value.skillHashes && typeof value.skillHashes === 'object' ? Object.fromEntries(Object.entries(value.skillHashes as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && /^[0-9a-f]{64}$/.test(entry[1]))) : {};
    return { skillFiles: Array.isArray(value.skillFiles) ? value.skillFiles.filter((item): item is string => typeof item === 'string') : [], skillHashes: hashes };
  } catch { return empty; }
}

async function writeManifest(paths: ScopePaths, manifest: { skillFiles: string[]; skillHashes: Record<string, string> }) {
  await ensureDataRoot(paths);
  await writeTextSafely(manifestFile(paths), `${JSON.stringify(manifest, null, 2)}\n`);
}

/** Record files JuTell wrote, with the sha256 of what it wrote (the current package content). */
export async function recordSkillFiles(paths: ScopePaths, relativeFiles: string[], source = assets().skill) {
  if (relativeFiles.length === 0) return;
  const current = await readManifest(paths);
  const skillHashes = { ...current.skillHashes };
  for (const relative of relativeFiles) {
    try { skillHashes[relative] = sha256(await fs.readFile(path.join(source, relative))); } catch { /* not in this package */ }
  }
  await writeManifest(paths, { skillFiles: [...new Set([...current.skillFiles, ...relativeFiles])], skillHashes });
}

export async function removeManagedSkillFiles(source: string, destination: string, paths: ScopePaths) {
  const manifest = await readManifest(paths);
  const removed: string[] = [];
  for (const relative of manifest.skillFiles) {
    const sourceFile = path.join(source, relative);
    const targetFile = path.join(destination, relative);
    try {
      const [sourceContent, targetContent] = await Promise.all([fs.readFile(sourceFile), fs.readFile(targetFile)]);
      if (!sourceContent.equals(targetContent)) continue;
      await fs.rm(targetFile, { force: true });
      removed.push(relative);
    } catch { /* already absent or user file differs */ }
  }
  for (const relative of [...manifest.skillFiles].reverse()) {
    const directory = path.dirname(path.join(destination, relative));
    try { if ((await fs.readdir(directory)).length === 0) await fs.rmdir(directory); } catch { /* keep non-empty directories */ }
  }
  if (removed.length > 0) await writeManifest(paths, { skillFiles: manifest.skillFiles.filter((item) => !removed.includes(item)), skillHashes: Object.fromEntries(Object.entries(manifest.skillHashes).filter(([item]) => !removed.includes(item))) });
  return removed;
}

export async function removeAddedSkillFiles(destination: string, relativeFiles: string[]) {
  for (const relative of relativeFiles) await fs.rm(path.join(destination, relative), { force: true });
}
