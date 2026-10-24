import { createHash } from 'node:crypto';
import { constants as fsConstants, promises as fs } from 'node:fs';
import path from 'node:path';
import type { ScopePaths } from '../../types.js';
import { writeViaTemp } from '../../map/write.js';

// W7: remember which files were already changed at the previous receipt (paths and hashes only).
export const RECEIPT_STATE_FILE = 'receipt-state.json';
const MAX_HASH_BYTES = 8 * 1024 * 1024;
const MAX_STATE_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 5000;
export const FIRST_RUN_NOTE = ' ⓘ 첫 영수증이라 위 파일 중 일부는 작업 전부터 바뀌어 있었을 수도 있어요  [Git 기준]';
// The note names the real baseline: the JuTell setup run (first receipt) or the previous receipt.
export const beforeNote = (count: number, source: BaselineSource = 'receipt') => ` ⓘ 작업 전부터 바뀌어 있던 파일 ${count}개 (${source === 'setup' ? 'JuTell 설치·연결 때' : '지난 영수증'} 기준)  [Git 기준]`;
export type BaselineSource = 'setup' | 'receipt';

type State = { version: 1; files: Record<string, string>; source?: BaselineSource };

async function hashFile(root: string, file: string): Promise<string> {
  const full = path.join(root, file);
  try {
    const stats = await fs.lstat(full);
    if (stats.isSymbolicLink()) return `link:${createHash('sha256').update(await fs.readlink(full)).digest('hex')}`;
    if (!stats.isFile()) return 'other';
    if (stats.size > MAX_HASH_BYTES) return `size:${stats.size}:${stats.mtimeMs}`;
    const handle = await fs.open(full, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0) | (fsConstants.O_NONBLOCK ?? 0));
    try {
      if (!(await handle.stat()).isFile()) return 'other';
      return createHash('sha256').update(await handle.readFile()).digest('hex');
    } finally { await handle.close(); }
  } catch {
    return 'missing';
  }
}

async function safeDataRoot(paths: ScopePaths): Promise<boolean> {
  try {
    const stats = await fs.lstat(paths.dataRoot);
    if (stats.isSymbolicLink() || !stats.isDirectory()) return false;
    const [root, data] = await Promise.all([fs.realpath(paths.targetRoot), fs.realpath(paths.dataRoot)]);
    const relative = path.relative(root, data);
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
  } catch {
    return false;
  }
}

async function readState(file: string): Promise<State | undefined> {
  try {
    const stats = await fs.lstat(file);
    if (!stats.isFile() || stats.nlink > 1 || stats.size > MAX_STATE_BYTES) return undefined;
    const handle = await fs.open(file, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0) | (fsConstants.O_NONBLOCK ?? 0));
    let text: string;
    try { text = await handle.readFile('utf8'); } finally { await handle.close(); }
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== 'object' || (value as State).version !== 1) return undefined;
    const files = (value as State).files;
    if (!files || typeof files !== 'object' || Array.isArray(files)) return undefined;
    const clean: Record<string, string> = {};
    for (const [key, hash] of Object.entries(files)) if (typeof hash === 'string') clean[key] = hash;
    return { version: 1, files: clean, source: (value as State).source === 'setup' ? 'setup' : 'receipt' };
  } catch {
    return undefined;
  }
}

/** Same rule as receipt.json: only a missing file or a plain, single-link regular file is (re)written. */
export async function canWriteState(file: string): Promise<boolean> {
  const existing = await fs.lstat(file).catch((error: NodeJS.ErrnoException) => (error.code === 'ENOENT' ? null : undefined));
  if (existing === null) return true;
  return existing !== undefined && existing.isFile() && existing.nlink <= 1;
}

export type BeforeWork = { note?: string; before: string[] };

/** Returns the ⓘ line for this receipt and records the current changed files for the next one. */
export async function beforeWorkNote(paths: ScopePaths, files: string[]): Promise<string | undefined> {
  return (await checkBeforeWork(paths, files)).note;
}

/** Like beforeWorkNote, plus the files that were already changed (same hash) at the previous receipt. */
/** Time cap for hashing the changed files: files left when it runs out are not compared (never marked 'before'). */
export const RECEIPT_HASH_TIME_MS = 2000;
const NOT_HASHED = 'not-hashed';
export const hashCutNote = (count: number) => ` (시간 제한으로 ${count}개는 비교 못 함)`;

export async function checkBeforeWork(paths: ScopePaths, files: string[], timeLimitMs = RECEIPT_HASH_TIME_MS, source: BaselineSource = 'receipt'): Promise<BeforeWork> {
  const listed = files.slice(0, MAX_FILES);
  const hashes: Record<string, string> = {};
  const deadline = Date.now() + timeLimitMs;
  let cut = 0;
  for (const file of listed) {
    if (Date.now() >= deadline) { hashes[file] = NOT_HASHED; cut += 1; continue; }
    hashes[file] = await hashFile(paths.targetRoot, file);
  }
  const withCut = (note: string) => (cut ? note.replace(/  \[Git 기준\]$/, `${hashCutNote(cut)}  [Git 기준]`) : note);
  const safe = await safeDataRoot(paths);
  const stateFile = path.join(paths.dataRoot, RECEIPT_STATE_FILE);
  const previous = safe ? await readState(stateFile) : undefined;
  if (safe) {
    if (await canWriteState(stateFile)) {
      await writeViaTemp(stateFile, `${JSON.stringify({ version: 1, files: hashes, source } satisfies State)}\n`).catch(() => undefined);
    }
  }
  if (listed.length === 0) return { before: [] };
  if (!previous) return { note: withCut(FIRST_RUN_NOTE), before: [] };
  const before = listed.filter((file) => hashes[file] !== NOT_HASHED && previous.files[file] === hashes[file]);
  if (before.length > 0) return { note: withCut(beforeNote(before.length, previous.source)), before };
  return cut ? { note: ` ⓘ 시간 제한으로 파일 ${cut}개는 작업 전과 비교 못 함  [Git 기준]`, before: [] } : { before: [] };
}
