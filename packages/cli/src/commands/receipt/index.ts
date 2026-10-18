import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Readable } from 'node:stream';
import type { CliIo, ScopePaths } from '../../types.js';
import { renderReceipt } from './render.js';

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
      await handle.writeFile(`${output}\n`, 'utf8');
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
  const source = parseArgs(args);
  const raw = await readReceipt(source, paths, input);
  let receipt: unknown;
  try {
    receipt = JSON.parse(raw);
  } catch {
    throw new Error('영수증 입력을 JSON으로 읽지 못했습니다.');
  }

  const time = receiptTimestamp(now);
  renderReceipt(receipt, time.display);
  const output = await saveReceipt(paths, receipt, time.display, time.filename);
  io.write(output);
  return 0;
}
