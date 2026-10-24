import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, describe, expect, it } from 'vitest';
import { resolveScope } from '../src/config/paths.js';
import { receiptCommand } from '../src/commands/receipt/index.js';
import { canWriteState, checkBeforeWork } from '../src/commands/receipt/before.js';
import type { CliIo } from '../src/types.js';

const roots: string[] = [];
afterAll(async () => { await Promise.all(roots.map((root) => fs.rm(root, { recursive: true, force: true }))); });
const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, stdio: 'ignore' });
const sample = { asked: [], done: ['고쳤어요'], checked: [], unchecked: [], next: [] };
const FIRST = '첫 영수증이라 위 파일 중 일부는 작업 전부터 바뀌어 있었을 수도 있어요';

async function project() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-before-'));
  roots.push(root);
  const dir = path.join(root, 'proj');
  await fs.mkdir(path.join(dir, 'src'), { recursive: true });
  await fs.writeFile(path.join(dir, 'src', 'a.ts'), 'a');
  await fs.writeFile(path.join(dir, 'src', 'b.ts'), 'b');
  git(dir, 'init', '-q');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'init');
  const paths = resolveScope('project', dir);
  const output: string[] = [];
  const io = { write: (m: string) => output.push(m), error: () => {}, ask: async () => false, choose: async () => undefined } as unknown as CliIo;
  const receipt = async () => {
    const stdin = new PassThrough();
    stdin.end(JSON.stringify(sample));
    output.length = 0;
    expect(await receiptCommand(paths, ['--file', '-'], io, stdin, new Date(), 3000)).toBe(0);
    return output.join('\n');
  };
  const state = path.join(dir, '.jutell-local', 'receipt-state.json');
  return { root, dir, receipt, state };
}

describe('files changed before the work (W7)', () => {
  it('first receipt says files may have been changed before the work', async () => {
    const { dir, receipt } = await project();
    await fs.writeFile(path.join(dir, 'src', 'a.ts'), 'a2');
    const text = await receipt();
    expect(text).toContain(`ⓘ ${FIRST}  [Git 기준]`);
  });

  it('counts files still unchanged since the previous receipt, not ones edited again', async () => {
    const { dir, receipt } = await project();
    await fs.writeFile(path.join(dir, 'src', 'a.ts'), 'a2');
    await fs.writeFile(path.join(dir, 'src', 'b.ts'), 'b2');
    await receipt();
    await fs.writeFile(path.join(dir, 'src', 'b.ts'), 'b3');
    await fs.writeFile(path.join(dir, 'src', 'c.ts'), 'c');
    const text = await receipt();
    expect(text).toContain(' ⓘ 작업 전부터 바뀌어 있던 파일 1개 (지난 영수증 기준)  [Git 기준]');
    expect(text).not.toContain(FIRST);
  });

  it('says nothing when every changed file is new since the previous receipt', async () => {
    const { dir, receipt } = await project();
    await receipt();
    await fs.writeFile(path.join(dir, 'src', 'a.ts'), 'a2');
    const text = await receipt();
    expect(text).not.toContain('작업 전부터');
  });

  it('stores only paths and hashes', async () => {
    const { dir, receipt, state } = await project();
    await fs.writeFile(path.join(dir, 'src', 'a.ts'), 'SECRET-CONTENT');
    await receipt();
    const raw = await fs.readFile(state, 'utf8');
    expect(raw).not.toContain('SECRET-CONTENT');
    const value = JSON.parse(raw);
    expect(Object.keys(value).sort()).toEqual(['files', 'version']);
    expect(Object.keys(value.files)).toContain('src/a.ts');
    for (const hash of Object.values(value.files)) expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('a corrupted state is treated as a first receipt and replaced', async () => {
    const { dir, receipt, state } = await project();
    await fs.mkdir(path.dirname(state), { recursive: true });
    await fs.writeFile(state, '{not json');
    await fs.writeFile(path.join(dir, 'src', 'a.ts'), 'a2');
    expect(await receipt()).toContain(FIRST);
    expect(JSON.parse(await fs.readFile(state, 'utf8')).version).toBe(1);
  });

  it('never follows a linked state file or a linked .jutell-local', async () => {
    const { root, dir, receipt, state } = await project();
    const outside = path.join(root, 'outside.json');
    await fs.writeFile(outside, JSON.stringify({ version: 1, files: { 'src/a.ts': 'x' } }));
    await fs.mkdir(path.dirname(state), { recursive: true });
    await fs.symlink(outside, state);
    await fs.writeFile(path.join(dir, 'src', 'a.ts'), 'a2');
    expect(await receipt()).toContain(FIRST);
    expect((await fs.lstat(state)).isSymbolicLink()).toBe(true);
    expect(JSON.parse(await fs.readFile(outside, 'utf8')).files['src/a.ts']).toBe('x');

    const second = await project();
    const elsewhere = path.join(second.root, 'elsewhere');
    await fs.mkdir(elsewhere);
    await fs.symlink(elsewhere, path.join(second.dir, '.jutell-local'));
    await fs.writeFile(path.join(second.dir, 'src', 'a.ts'), 'a2');
    // The receipt itself refuses a linked .jutell-local; the state must not land there either.
    await second.receipt().catch(() => undefined);
    await expect(fs.readdir(elsewhere)).resolves.toEqual([]);
  });
});

// Supervisor (d): receipt-state.json is written only as a plain, single-link regular file.
describe('receipt-state.json write safety', () => {
  it.skipIf(process.platform === 'win32')('refuses a hardlinked state file (nlink > 1): neither read nor written', async () => {
    const { root, dir, receipt, state } = await project();
    const outside = path.join(root, 'outside-state.json');
    const planted = JSON.stringify({ version: 1, files: { 'src/a.ts': 'x' } });
    await fs.writeFile(outside, planted);
    await fs.mkdir(path.dirname(state), { recursive: true });
    await fs.link(outside, state);
    await fs.writeFile(path.join(dir, 'src', 'a.ts'), 'a2');
    expect(await receipt()).toContain(FIRST);
    expect((await fs.stat(state)).nlink).toBe(2);
    expect(await fs.readFile(outside, 'utf8')).toBe(planted);
    expect(await fs.readFile(state, 'utf8')).toBe(planted);
  });

  it('refuses a state path that is not a regular file (a folder)', async () => {
    const { dir, receipt, state } = await project();
    await fs.mkdir(state, { recursive: true });
    await fs.writeFile(path.join(dir, 'src', 'a.ts'), 'a2');
    expect(await receipt()).toContain(FIRST);
    expect((await fs.lstat(state)).isDirectory()).toBe(true);
    await expect(fs.readdir(state)).resolves.toEqual([]);
  });

  it('canWriteState: missing or plain file yes; hardlink, folder, link no', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-canwrite-'));
    roots.push(root);
    const plain = path.join(root, 'plain.json');
    await fs.writeFile(plain, '{}');
    expect(await canWriteState(path.join(root, 'missing.json'))).toBe(true);
    expect(await canWriteState(plain)).toBe(true);
    expect(await canWriteState(root)).toBe(false);
    if (process.platform !== 'win32') {
      await fs.link(plain, path.join(root, 'hard.json'));
      expect(await canWriteState(plain)).toBe(false);
      await fs.symlink(path.join(root, 'missing.json'), path.join(root, 'link.json'));
      expect(await canWriteState(path.join(root, 'link.json'))).toBe(false);
    }
  });

  it('the hash step has a time cap: files left over are not compared and the note says so', async () => {
    const { dir } = await project();
    const paths = resolveScope('project', dir);
    await fs.mkdir(path.join(dir, '.jutell-local'), { recursive: true });
    await fs.writeFile(path.join(dir, 'src', 'a.ts'), 'a2');
    await checkBeforeWork(paths, ['src/a.ts']);
    const result = await checkBeforeWork(paths, ['src/a.ts'], 0);
    expect(result.before).toEqual([]);
    expect(result.note).toBe(' ⓘ 시간 제한으로 파일 1개는 작업 전과 비교 못 함  [Git 기준]');
    // The cut file was saved as not compared, so the next receipt does not call it 'before the work'.
    expect((await checkBeforeWork(paths, ['src/a.ts'])).before).toEqual([]);
  });
});
