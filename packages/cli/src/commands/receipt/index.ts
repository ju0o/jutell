import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { readBridgeConfig } from '../../config/managed.js';
import type { CliIo, ScopePaths } from '../../types.js';
import { normalizeReceipt, receiptMarkdown, renderReceipt } from './render.js';

const RECEIPT_INPUT_EXAMPLE = `표준 입력으로 전달하는 방식을 권장합니다:
... | jutell receipt --file -

입력 예시:
{"asked":["요청한 것"],"done":["한 일"],"checked":["직접 확인한 것"],"unchecked":["확인 못 한 것 (이유)"],"next":["다음 추천"]}`;

type ReceiptSource = { kind: 'default' } | { kind: 'file'; file: string };

function parseArgs(args: string[]): ReceiptSource {
  if (args.length === 0) return { kind: 'default' };
  if (args.length === 2 && args[0] === '--file' && args[1].length > 0) {
    return { kind: 'file', file: args[1] };
  }
  throw new Error('사용법: jutell receipt [--file <경로>|--file -]');
}

async function readStdin(input: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of input) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readReceipt(source: ReceiptSource, paths: ScopePaths, input: Readable): Promise<string> {
  if (source.kind === 'file' && source.file === '-') return readStdin(input);
  const file = source.kind === 'default'
    ? path.join(paths.dataRoot, 'receipt.json')
    : path.resolve(source.file);
  const contents = await fs.readFile(file, 'utf8');
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
  try {
    await fs.writeFile(file, '*\n', { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
}

function relativePath(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join('/');
}

function pathsFromStatus(stdout: string): string[] {
  const files: string[] = [];
  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line.length < 4) continue;
    const statusPath = line.slice(3);
    const renameAt = statusPath.lastIndexOf(' -> ');
    const file = (renameAt >= 0 ? statusPath.slice(renameAt + 4) : statusPath).replace(/^\.\//, '');
    // JuTell's own setup files are not the user's work; an untracked AGENTS.md/CLAUDE.md was created by JuTell.
    if (file === '.jutell-local' || file.startsWith('.jutell-local/') || file === '.jutell.json') continue;
    if (file.startsWith('.agents/skills/beginner-bridge/') || file.startsWith('.claude/skills/beginner-bridge/')) continue;
    if (line.startsWith('??') && (file === 'AGENTS.md' || file === 'CLAUDE.md')) continue;
    files.push(file);
  }
  return files;
}

async function readChangedFiles(cwd: string): Promise<string[]> {
  return new Promise((resolve) => {
    execFile(
      'git',
      ['-c', 'core.quotepath=false', 'status', '--porcelain', '--untracked-files=all'],
      { cwd },
      (error, stdout) => resolve(error ? [] : pathsFromStatus(stdout)),
    );
  });
}

async function saveReceipt(
  paths: ScopePaths,
  input: unknown,
  timestamp: string,
  filename: string,
): Promise<string> {
  await fs.mkdir(paths.dataRoot, { recursive: true });
  await ensureLocalGitignore(paths.dataRoot);
  const reportsDir = path.join(paths.dataRoot, 'reports');
  await fs.mkdir(reportsDir, { recursive: true });

  const extension = '.md';
  let suffix = 1;
  while (true) {
    const name = `${filename}${suffix === 1 ? '' : `-${suffix}`}${extension}`;
    const file = path.join(reportsDir, name);
    let handle;
    try {
      handle = await fs.open(file, 'wx');
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
  try {
    raw = await readReceipt(source, paths, input);
  } catch {
    problems.push('입력을 읽지 못했습니다.');
  }
  let parsed: unknown = {};
  if (raw.trim().length === 0) {
    problems.push('입력이 비어 있습니다.');
  } else if (problems.length === 0) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      problems.push('영수증 입력을 JSON으로 읽지 못했습니다.');
    }
  }

  const receipt = normalizeReceipt(parsed, problems);
  receipt.files = await readChangedFiles(paths.targetRoot);
  const time = receiptTimestamp(now);
  const output = await saveReceipt(paths, receipt, time.display, time.filename);
  io.write(output);
  return 0;
}
