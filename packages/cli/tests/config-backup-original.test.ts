import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { backupFile } from '../src/config/managed.js';

const roots: string[] = [];
afterEach(async () => {
  for (const r of roots.splice(0)) await fs.rm(r, { recursive: true, force: true });
});

describe('config backups', () => {
  it('creates config.toml.jutell-original once and never overwrites it, while .previous follows each write', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-backup-'));
    roots.push(root);
    const file = path.join(root, 'config.toml');
    await fs.writeFile(file, 'user = "original"\n');
    expect(await backupFile(file)).toBe(`${file}.previous`);
    await fs.writeFile(file, 'user = "second"\n');
    await backupFile(file);
    expect(await fs.readFile(`${file}.jutell-original`, 'utf8')).toBe('user = "original"\n');
    expect(await fs.readFile(`${file}.previous`, 'utf8')).toBe('user = "second"\n');
  });

  it('takes no backup when the file does not exist', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-backup-'));
    roots.push(root);
    expect(await backupFile(path.join(root, 'missing.toml'))).toBeUndefined();
    expect(await fs.readdir(root)).toEqual([]);
  });
});
