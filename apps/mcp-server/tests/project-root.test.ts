import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveProjectRoot } from '../src/config/project-root.js';
import { DEFAULT_CONFIG, readBridgeContext } from '../src/config/bridge-config.js';

const temps: string[] = [];
async function temp() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'jutell-root-'));
  temps.push(dir);
  return dir;
}
afterEach(async () => { await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

describe('resolveProjectRoot', () => {
  it('uses cwd when JUTELL_PROJECT_ROOT is unset or empty', () => {
    expect(resolveProjectRoot({}, '/work/a')).toBe('/work/a');
    expect(resolveProjectRoot({ JUTELL_PROJECT_ROOT: '' }, '/work/a')).toBe('/work/a');
  });
  it('uses an absolute existing folder from JUTELL_PROJECT_ROOT', async () => {
    const dir = await temp();
    expect(resolveProjectRoot({ JUTELL_PROJECT_ROOT: dir }, '/work/a')).toBe(dir);
  });
  it('ignores a relative path', () => {
    expect(resolveProjectRoot({ JUTELL_PROJECT_ROOT: 'some/project' }, '/work/a')).toBe('/work/a');
  });
  it('ignores a missing path and a file path', async () => {
    const dir = await temp();
    const file = path.join(dir, 'f.txt');
    await writeFile(file, 'x');
    expect(resolveProjectRoot({ JUTELL_PROJECT_ROOT: path.join(dir, 'nope') }, '/work/a')).toBe('/work/a');
    expect(resolveProjectRoot({ JUTELL_PROJECT_ROOT: file }, '/work/a')).toBe('/work/a');
  });
  it('accepts Korean and space paths', async () => {
    const dir = path.join(await temp(), '홍 길동', '내 프로젝트');
    await mkdir(dir, { recursive: true });
    expect(resolveProjectRoot({ JUTELL_PROJECT_ROOT: dir }, '/work/a')).toBe(dir);
  });
  it('readBridgeContext defaults to JUTELL_PROJECT_ROOT', async () => {
    const dir = path.join(await temp(), '한글 폴더');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, '.jutell.json'), '{}');
    const previous = process.env.JUTELL_PROJECT_ROOT;
    process.env.JUTELL_PROJECT_ROOT = dir;
    try {
      const context = await readBridgeContext();
      expect(context.projectRoot).toBe(dir);
      expect(context.configExists).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.JUTELL_PROJECT_ROOT; else process.env.JUTELL_PROJECT_ROOT = previous;
    }
  });
});

describe('safeDataDir (W2: same rule as CLI safeDataRoot)', () => {
  it('allows a real folder inside, and a missing folder directly under the project', async () => {
    const { safeDataDir } = await import('../src/config/project-root.js');
    const root = await temp();
    expect(await safeDataDir(root, path.join(root, '.jutell-local'))).toBe(true);
    await mkdir(path.join(root, '.jutell-local'));
    expect(await safeDataDir(root, path.join(root, '.jutell-local'))).toBe(true);
  });
  it('refuses a linked .jutell-local or one that is a file', async () => {
    const { safeDataDir } = await import('../src/config/project-root.js');
    const { symlink } = await import('node:fs/promises');
    const root = await temp();
    const outside = await temp();
    await symlink(outside, path.join(root, '.jutell-local'), 'dir');
    expect(await safeDataDir(root, path.join(root, '.jutell-local'))).toBe(false);
    const other = await temp();
    await writeFile(path.join(other, '.jutell-local'), 'x');
    expect(await safeDataDir(other, path.join(other, '.jutell-local'))).toBe(false);
  });
  it('recordToolCall never writes through a linked .jutell-local under JUTELL_PROJECT_ROOT', async () => {
    const { symlink, readdir } = await import('node:fs/promises');
    const { recordToolCall } = await import('../src/tools/usage-counters.js');
    const root = path.join(await temp(), '내 프로젝트');
    await mkdir(root);
    await writeFile(path.join(root, '.jutell.json'), JSON.stringify({ ...structuredClone(DEFAULT_CONFIG), usageMeasurement: { localCountersEnabled: true } }));
    const outside = await temp();
    await symlink(outside, path.join(root, '.jutell-local'), 'dir');
    const previous = process.env.JUTELL_PROJECT_ROOT;
    process.env.JUTELL_PROJECT_ROOT = root;
    try {
      await recordToolCall('t', 1);
    } finally {
      if (previous === undefined) delete process.env.JUTELL_PROJECT_ROOT; else process.env.JUTELL_PROJECT_ROOT = previous;
    }
    expect(await readdir(outside)).toEqual([]);
    // control: same config with a real folder does write
    const real = path.join(await temp(), '실제 프로젝트');
    await mkdir(real);
    await writeFile(path.join(real, '.jutell.json'), JSON.stringify({ ...structuredClone(DEFAULT_CONFIG), usageMeasurement: { localCountersEnabled: true } }));
    await recordToolCall('t', 1, real);
    expect(await readdir(path.join(real, '.jutell-local'))).toContain('usage-counters.json');
  });
});
