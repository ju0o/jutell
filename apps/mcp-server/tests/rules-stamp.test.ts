import { mkdtemp, mkdir, readFile, realpath, symlink, lstat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { recordRulesFetched, RULES_STAMP_FILE } from '../src/tools/rules-stamp.js';

describe('rules fetch stamp (read by jutell receipt)', () => {
  it('writes only the time into an existing .jutell-local', async () => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'jutell-stamp-')));
    await mkdir(path.join(root, '.jutell-local'));
    expect(await recordRulesFetched(root, new Date('2026-10-24T00:00:00Z'))).toBe(true);
    expect(JSON.parse(await readFile(path.join(root, '.jutell-local', RULES_STAMP_FILE), 'utf8'))).toEqual({ at: '2026-10-24T00:00:00.000Z' });
  });
  it('does nothing without .jutell-local or when it is a link', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'jutell-stamp-'));
    expect(await recordRulesFetched(root)).toBe(false);
    const outside = await mkdtemp(path.join(os.tmpdir(), 'jutell-stamp-out-'));
    await symlink(outside, path.join(root, '.jutell-local'));
    expect(await recordRulesFetched(root)).toBe(false);
    await expect(lstat(path.join(outside, RULES_STAMP_FILE))).rejects.toThrow();
  });
  it('does nothing when the project root itself is reached through a link', async () => {
    const real = await realpath(await mkdtemp(path.join(os.tmpdir(), 'jutell-stamp-real-')));
    await mkdir(path.join(real, '.jutell-local'));
    const link = path.join(await realpath(await mkdtemp(path.join(os.tmpdir(), 'jutell-stamp-link-'))), 'root');
    await symlink(real, link);
    expect(await recordRulesFetched(link)).toBe(false);
    await expect(lstat(path.join(real, '.jutell-local', RULES_STAMP_FILE))).rejects.toThrow();
  });
});
