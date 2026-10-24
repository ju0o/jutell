import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { writeViaTemp } from '../src/fs/atomic.js';
import { friendlyError, hideAbsolutePaths } from '../src/output/friendly.js';
import { run } from '../src/cli.js';
import type { CliIo } from '../src/types.js';

const roots: string[] = [];
afterAll(async () => { await Promise.all(roots.map((root) => fs.rm(root, { recursive: true, force: true }))); });
const tmp = async () => { const dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-friendly-'))); roots.push(dir); return dir; };

describe('plain Korean errors, relative paths', () => {
  it('system error codes become plain Korean; paths inside the project become relative, others [경로]', () => {
    const root = path.join(path.sep, 'home', 'me', 'proj');
    const denied = Object.assign(new Error(`EACCES: permission denied, open '${path.join(root, 'JuTellMap.md')}'`), { code: 'EACCES', path: path.join(root, 'JuTellMap.md') });
    expect(friendlyError(denied, root)).toBe('권한이 없어 읽거나 쓸 수 없어요 (JuTellMap.md)');
    const dir = Object.assign(new Error('EISDIR: illegal operation on a directory, read'), { code: 'EISDIR' });
    expect(friendlyError(dir, root)).toBe('파일이 있어야 할 자리에 폴더가 있어요');
    expect(friendlyError(new Error('spawn git ENOENT'))).toBe('파일이나 폴더가 없어요');
    expect(friendlyError(new Error('Unexpected token } in JSON'))).toContain('알 수 없는 오류');
    expect(friendlyError(new Error(`지도를 읽지 못했어요: ${path.join(root, 'a', 'b.ts')}`), root)).toBe('지도를 읽지 못했어요: a/b.ts');
    expect(hideAbsolutePaths('열 수 없음: /etc/passwd', root)).toBe('열 수 없음: [경로]');
  });

  it('the CLI never prints EACCES/EISDIR or an absolute path (without --verbose)', async () => {
    const dir = await tmp();
    const errors: string[] = [];
    const io = { write: () => {}, error: (m: string) => errors.push(m), ask: async () => false, choose: async () => undefined } as unknown as CliIo;
    // `receipt --file` pointing at a folder: the read fails with EISDIR.
    const code = await run(['receipt', '--file', dir], io);
    const text = errors.join('\n');
    if (code !== 0) {
      expect(text).not.toMatch(/E[A-Z]{3,}/);
      expect(text).not.toContain(dir);
    }
  });
});

describe('writeViaTemp (one shared temp-then-rename write)', () => {
  it('replaces a link at the target instead of writing through it, keeps the mode, leaves no temp file', async () => {
    const dir = await tmp();
    const outside = path.join(dir, 'outside.txt');
    await fs.writeFile(outside, 'keep');
    const target = path.join(dir, 'target.txt');
    await fs.symlink(outside, target);
    await writeViaTemp(target, 'new');
    expect(await fs.readFile(outside, 'utf8')).toBe('keep');
    expect((await fs.lstat(target)).isFile()).toBe(true);
    if (process.platform !== 'win32') {
      await fs.chmod(target, 0o600);
      await writeViaTemp(target, 'again');
      expect((await fs.stat(target)).mode & 0o777).toBe(0o600);
    }
    expect((await fs.readdir(dir)).sort()).toEqual(['outside.txt', 'target.txt']);
  });

  it('removes the temp file when the rename fails', async () => {
    const dir = await tmp();
    await fs.mkdir(path.join(dir, 'busy'));
    await fs.writeFile(path.join(dir, 'busy', 'x'), 'x');
    await expect(writeViaTemp(path.join(dir, 'busy'), 'text')).rejects.toThrow();
    expect(await fs.readdir(dir)).toEqual(['busy']);
  });
});
