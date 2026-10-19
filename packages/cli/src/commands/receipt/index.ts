import { execFile } from 'node:child_process';
import { constants as fsConstants, promises as fs } from 'node:fs';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { readBridgeConfig } from '../../config/managed.js';
import type { CliIo, ScopePaths } from '../../types.js';
import { normalizeReceipt, receiptMarkdown, renderReceipt } from './render.js';
import { refreshMapForReceipt, RECEIPT_MAP_TIMEOUT_MS } from '../map.js';
import { MAP_FILE } from '../../map/write.js';
import { beforeWorkNote } from './before.js';
import { matchRequests, readMapSections } from './match.js';

const RECEIPT_INPUT_EXAMPLE = `표준 입력으로 전달하는 방식을 권장합니다:
... | jutell receipt --file -

입력 예시:
{"asked":["요청한 것"],"done":["한 일"],"checked":["직접 확인한 것"],"unchecked":["확인 못 한 것 (이유)"],"next":["다음 추천"]}`;

type ReceiptSource = { kind: 'default' } | { kind: 'file'; file: string };
type LimitedInput = { text: string; tooLong: boolean };
type ChangedFiles = { files: string[]; unknownReason?: string };
const MAX_INPUT_BYTES = 64 * 1024;
const MAX_READ_BYTES = MAX_INPUT_BYTES + 1;
const UNSAFE_REPORT_PATH = '.jutell-local 또는 reports가 링크라서 영수증을 저장하지 않았어요.';

function parseArgs(args: string[]): ReceiptSource {
  if (args.length === 0) return { kind: 'default' };
  if (args.length === 2 && args[0] === '--file' && args[1].length > 0) {
    return { kind: 'file', file: args[1] };
  }
  throw new Error('사용법: jutell receipt [--file <경로>|--file -]');
}

async function readStdin(input: Readable): Promise<LimitedInput> {
  const chunks: Buffer[] = [];
  let total = 0;
  let tooLong = false;
  for await (const chunk of input) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const remaining = MAX_READ_BYTES - total;
    if (remaining <= 0) {
      tooLong = true;
      break;
    }
    const part = bytes.subarray(0, remaining);
    chunks.push(part);
    total += part.length;
    if (bytes.length > part.length || total > MAX_INPUT_BYTES) {
      tooLong = true;
      break;
    }
  }
  return { text: Buffer.concat(chunks).subarray(0, MAX_INPUT_BYTES).toString('utf8'), tooLong };
}

class UnsafeReceiptInput extends Error {}

function isInside(root: string, target: string) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

// B5: `.jutell-local` must be a real directory inside the project (not a link).
async function assertSafeDataRoot(paths: ScopePaths) {
  const stats = await fs.lstat(paths.dataRoot);
  if (stats.isSymbolicLink() || !stats.isDirectory()) throw new UnsafeReceiptInput('.jutell-local이 링크이거나 폴더가 아니라서 읽지 않았어요');
  const [realRoot, realData] = await Promise.all([fs.realpath(paths.targetRoot), fs.realpath(paths.dataRoot)]);
  if (!isInside(realRoot, realData)) throw new UnsafeReceiptInput('.jutell-local이 프로젝트 밖을 가리켜서 읽지 않았어요');
}

async function readLimitedFile(file: string, noFollow = false): Promise<LimitedInput> {
  // Only regular files: never follow a link, never block on a FIFO/device, and re-check after opening.
  const before = await fs.lstat(file);
  if ((noFollow && before.isSymbolicLink()) || (!before.isFile() && !before.isSymbolicLink())) {
    throw new UnsafeReceiptInput('receipt.json이 일반 파일이 아니라서 읽지도 지우지도 않았어요');
  }
  const flags = fsConstants.O_RDONLY | (fsConstants.O_NONBLOCK ?? 0) | (noFollow ? (fsConstants.O_NOFOLLOW ?? 0) : 0);
  const handle = await fs.open(file, flags);
  const opened = await handle.stat();
  if (!opened.isFile()) {
    await handle.close();
    throw new UnsafeReceiptInput('receipt.json이 일반 파일이 아니라서 읽지도 지우지도 않았어요');
  }
  // A hard link would let receipt.json expose (and the cleanup unlink) another file's contents.
  if (noFollow && opened.nlink > 1) {
    await handle.close();
    throw new UnsafeReceiptInput('receipt.json이 다른 파일과 연결되어 있어서 읽지도 지우지도 않았어요');
  }
  const buffer = Buffer.alloc(MAX_READ_BYTES);
  let total = 0;
  try {
    while (total < MAX_READ_BYTES) {
      const { bytesRead } = await handle.read(buffer, total, MAX_READ_BYTES - total, total);
      if (bytesRead === 0) break;
      total += bytesRead;
    }
  } finally {
    await handle.close();
  }
  return {
    text: buffer.subarray(0, Math.min(total, MAX_INPUT_BYTES)).toString('utf8'),
    tooLong: total > MAX_INPUT_BYTES,
  };
}

async function readReceipt(source: ReceiptSource, paths: ScopePaths, input: Readable): Promise<LimitedInput> {
  if (source.kind === 'file' && source.file === '-') return readStdin(input);
  const file = source.kind === 'default'
    ? path.join(paths.dataRoot, 'receipt.json')
    : path.resolve(source.file);
  if (source.kind === 'default') await assertSafeDataRoot(paths);
  const contents = await readLimitedFile(file, source.kind === 'default');
  if (source.kind === 'default') {
    try {
      await fs.unlink(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return contents;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function receiptTimestamp(now: Date): { display: string; filename: string } {
  const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const time = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  return { display: `${date} ${time.slice(0, 2)}:${time.slice(2, 4)}`, filename: `${date}-${time}` };
}

async function ensureLocalGitignore(dataRoot: string): Promise<void> {
  const file = path.join(dataRoot, '.gitignore');
  const flags = fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | (fsConstants.O_NOFOLLOW ?? 0);
  let handle;
  try {
    handle = await fs.open(file, flags, 0o666);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    return;
  }
  try {
    await handle.writeFile('*\n', 'utf8');
  } finally {
    await handle.close();
  }
}

function relativePath(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join('/');
}

function pathsFromStatus(stdout: string, projectPrefix: string): string[] {
  const files: string[] = [];
  const fields = stdout.split('\0');
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    if (field.length < 4 || field[2] !== ' ') continue;
    const status = field.slice(0, 2);
    const repoPath = field.slice(3).replace(/^\.\//, '');
    if (status.includes('R') || status.includes('C')) index += 1;
    if (projectPrefix && !repoPath.startsWith(projectPrefix)) continue;
    const file = (projectPrefix ? repoPath.slice(projectPrefix.length) : repoPath).replace(/^\.\//, '');
    if (!file) continue;
    // JuTell's own setup files are not the user's work; an untracked AGENTS.md/CLAUDE.md was created by JuTell.
    if (file === '.jutell-local' || file.startsWith('.jutell-local/') || file === '.jutell.json') continue;
    if (file.startsWith('.agents/skills/beginner-bridge/') || file.startsWith('.claude/skills/beginner-bridge/')) continue;
    if (status === '??' && (file === 'AGENTS.md' || file === 'CLAUDE.md')) continue;
    files.push(file);
  }
  return files;
}

function runGit(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, {
      cwd,
      timeout: 5000,
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

function gitFailureReason(error: unknown): string {
  const failure = error as NodeJS.ErrnoException & { killed?: boolean };
  if (failure.code === 'ENOENT') return 'Git을 실행하지 못했어요';
  if (failure.code === 'ETIMEDOUT' || failure.killed) return 'Git 확인 시간이 초과됐어요';
  if (failure.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return '변경 목록이 너무 커요';
  if (typeof failure.code === 'number') return 'Git 저장소를 확인하지 못했어요';
  return 'Git 변경 목록을 읽지 못했어요';
}

async function ensureSafeDirectory(directory: string): Promise<void> {
  let stats;
  try {
    stats = await fs.lstat(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    try {
      await fs.mkdir(directory);
    } catch (mkdirError) {
      if ((mkdirError as NodeJS.ErrnoException).code !== 'EEXIST') throw mkdirError;
    }
    stats = await fs.lstat(directory);
  }
  if (stats.isSymbolicLink() || !stats.isDirectory()) throw new Error(UNSAFE_REPORT_PATH);
}

async function prepareSafeReportsDirectory(paths: ScopePaths): Promise<string> {
  const reportsDir = path.join(paths.dataRoot, 'reports');
  const targetRoot = await fs.realpath(paths.targetRoot);
  const lexicalDataRoot = path.relative(path.resolve(paths.targetRoot), path.resolve(paths.dataRoot));
  if (path.resolve(paths.dataRoot) !== path.join(path.resolve(paths.targetRoot), '.jutell-local')
    || !lexicalDataRoot || lexicalDataRoot.startsWith('..') || path.isAbsolute(lexicalDataRoot)) {
    throw new Error(UNSAFE_REPORT_PATH);
  }

  await ensureSafeDirectory(paths.dataRoot);
  await ensureSafeDirectory(reportsDir);
  let reportsRealPath: string;
  try {
    reportsRealPath = await fs.realpath(reportsDir);
  } catch {
    throw new Error(UNSAFE_REPORT_PATH);
  }
  const relativeReports = path.relative(targetRoot, reportsRealPath);
  if (!relativeReports || relativeReports.startsWith('..') || path.isAbsolute(relativeReports)) {
    throw new Error(UNSAFE_REPORT_PATH);
  }
  return reportsDir;
}

async function readChangedFiles(cwd: string): Promise<ChangedFiles> {
  try {
    const prefixOutput = await runGit(cwd, ['--no-optional-locks', 'rev-parse', '--show-prefix']);
    const projectPrefix = prefixOutput.replace(/\r?\n$/, '').replaceAll('\\', '/');
    const status = await runGit(cwd, [
      '--no-optional-locks', 'status', '--porcelain=v1', '-z', '--untracked-files=all', '--', '.',
    ]);
    return { files: pathsFromStatus(status, projectPrefix) };
  } catch (error) {
    return { files: [], unknownReason: gitFailureReason(error) };
  }
}

async function saveReceipt(
  paths: ScopePaths,
  input: unknown,
  timestamp: string,
  filename: string,
): Promise<string> {
  const reportsDir = await prepareSafeReportsDirectory(paths);
  await ensureLocalGitignore(paths.dataRoot);

  const extension = '.md';
  let suffix = 1;
  const flags = fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | (fsConstants.O_NOFOLLOW ?? 0);
  while (true) {
    const name = `${filename}${suffix === 1 ? '' : `-${suffix}`}${extension}`;
    const file = path.join(reportsDir, name);
    let handle;
    try {
      handle = await fs.open(file, flags, 0o666);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        suffix += 1;
        continue;
      }
      throw error;
    }

    try {
      const output = renderReceipt(input, timestamp, relativePath(paths.targetRoot, file));
      await handle.writeFile(receiptMarkdown(output), 'utf8');
      await handle.close();
      return output;
    } catch (error) {
      await handle.close().catch(() => undefined);
      await fs.rm(file, { force: true });
      throw error;
    }
  }
}

export async function receiptCommand(
  paths: ScopePaths,
  args: string[],
  io: CliIo,
  input: Readable = process.stdin,
  now = new Date(),
  mapTimeoutMs = RECEIPT_MAP_TIMEOUT_MS,
): Promise<number> {
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    io.write(RECEIPT_INPUT_EXAMPLE);
    return 0;
  }

  const { config } = await readBridgeConfig(paths);
  if (!config.features.receiptReport) {
    io.write('영수증이 꺼져 있어요');
    return 0;
  }

  const source = parseArgs(args);
  const problems: string[] = [];
  let raw = '';
  let inputTooLong = false;
  let unsafeInput: string | undefined;
  try {
    const contents = await readReceipt(source, paths, input);
    raw = contents.text;
    inputTooLong = contents.tooLong;
  } catch (error) {
    if (error instanceof UnsafeReceiptInput) unsafeInput = error.message;
    problems.push('입력을 읽지 못했습니다.');
  }
  let parsed: unknown = {};
  let parseFailed = false;
  if (raw.trim().length === 0) {
    problems.push('입력이 비어 있습니다.');
  } else if (problems.length === 0) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parseFailed = true;
      problems.push('영수증 입력을 JSON으로 읽지 못했습니다.');
    }
  }

  const receipt = normalizeReceipt(parsed, problems);
  if (inputTooLong) {
    receipt.checks = [
      ...receipt.checks.slice(0, 3),
      { what: parseFailed ? '입력이 너무 커서 읽지 못했어요' : '입력이 너무 길어 앞부분만 읽었어요', result: '안 해봄', reason: '' },
    ];
  }
  if (unsafeInput) {
    receipt.checks = [
      ...receipt.checks.slice(0, 3),
      { what: `receipt.json 확인 못 함 (${unsafeInput})`, result: '안 해봄', reason: '' },
    ];
  }
  // Refresh the map first, so the git listing below sees its final state.
  const mapStep = await refreshMapForReceipt(paths, mapTimeoutMs);
  const changedFiles = await readChangedFiles(paths.targetRoot);
  // JuTell's own map change appears only as the ⓘ line, not in [바뀐 파일].
  receipt.files = mapStep.jutellOwned ? changedFiles.files.filter((file) => file !== MAP_FILE) : changedFiles.files;
  if (mapStep.note) receipt.mapNote = mapStep.note;
  if ((receipt.asked?.length ?? 0) > 0 && !changedFiles.unknownReason) {
    const markdown = await fs.readFile(path.join(paths.targetRoot, MAP_FILE), { encoding: 'utf8', flag: fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0) }).catch(() => undefined);
    receipt.match = markdown === undefined ? { map: false } : matchRequests(receipt.asked ?? [], receipt.files, readMapSections(markdown));
  }
  receipt.filesUnknownReason = changedFiles.unknownReason;
  receipt.filesChecked = true;
  if (!changedFiles.unknownReason) {
    // Make sure `.jutell-local` exists (same link checks as the receipt) so the state can be saved.
    await prepareSafeReportsDirectory(paths).catch(() => undefined);
    const note = await beforeWorkNote(paths, receipt.files ?? []).catch(() => undefined);
    if (note) receipt.beforeNote = note;
  }
  const time = receiptTimestamp(now);
  const output = await saveReceipt(paths, receipt, time.display, time.filename);
  io.write(output);
  return 0;
}
