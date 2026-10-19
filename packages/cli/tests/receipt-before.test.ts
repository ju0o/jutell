import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, describe, expect, it } from 'vitest';
import { resolveScope } from '../src/config/paths.js';
import { receiptCommand } from '../src/commands/receipt/index.js';
import type { CliIo } from '../src/types.js';

const roots: string[] = [];
afterAll(async () => { await Promise.all(roots.map((root) => fs.rm(root, { recursive: true, force: true }))); });
const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, stdio: 'ignore' });
const sample = { asked: [], done: ['고쳤어요'], checked: [], unchecked: [], next: [] };
const FIRST = '첫 영수증이라 아래 파일 중 일부는 작업 전부터 바뀌어 있었을 수도 있어요';

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
