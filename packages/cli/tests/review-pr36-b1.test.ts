import { afterAll, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureJuTellAgentsBlock, refreshStaleReceiptCommands, removeJuTellAgentsBlock, writtenReceiptCommands } from '../src/installer/agents.js';

const roots: string[] = [];
afterAll(async () => { await Promise.all(roots.map((root) => fs.rm(root, { recursive: true, force: true }))); });
const tmp = async () => { const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-pr36-')); roots.push(dir); return dir; };

describe('B1: repeat `jutell --yes` fixes a stale receipt command', () => {
  it('rewrites only blocks whose command differs from this install, keeping user text', async () => {
    const dir = await tmp();
    await ensureJuTellAgentsBlock(dir);
    const file = path.join(dir, 'AGENTS.md');
    const written = await fs.readFile(file, 'utf8');
    const stale = `내 메모\n\n${written.replaceAll('`jutell receipt`를 한 번', '`npm exec --offline --no --prefix . -- jutell receipt`를 한 번')}`;
    await fs.writeFile(file, stale);
    expect((await writtenReceiptCommands(dir))[0].command).toContain('--prefix .');
    expect(await refreshStaleReceiptCommands(dir)).toEqual(['AGENTS.md']);
    const after = await fs.readFile(file, 'utf8');
    expect(after.startsWith('내 메모')).toBe(true);
    expect((await writtenReceiptCommands(dir))[0].command).toBe('jutell receipt');
    expect(await refreshStaleReceiptCommands(dir)).toEqual([]);
  });
});

describe('uninstall keeps an AGENTS.md the user already had, even when empty', () => {
  it('empties the block but leaves the pre-existing empty file', async () => {
    const dir = await tmp();
    const file = path.join(dir, 'AGENTS.md');
    await fs.writeFile(file, '');
    await ensureJuTellAgentsBlock(dir);
    await ensureJuTellAgentsBlock(dir); // repeat setup stays stable
    expect((await fs.readFile(file, 'utf8')).match(/existed before setup/g)).toHaveLength(1);
    await removeJuTellAgentsBlock(dir);
    expect(await fs.readFile(file, 'utf8')).toBe('');
  });
  it('still removes an AGENTS.md that JuTell created', async () => {
    const dir = await tmp();
    await ensureJuTellAgentsBlock(dir);
    await removeJuTellAgentsBlock(dir);
    await expect(fs.stat(path.join(dir, 'AGENTS.md'))).rejects.toThrow();
  });
});

describe('rule 14 lives in SKILL.md for agents without a JuTell block (e.g. OpenCode)', () => {
  it('states the no-retry failure line on its own, and keeps (보이면 필수)', async () => {
    const skill = await fs.readFile(new URL('../../../.agents/skills/beginner-bridge/SKILL.md', import.meta.url), 'utf8');
    expect(skill).toMatch(/^14\. 영수증 명령이 실패하면[^\n]*재시도 없이[^\n]*jutell doctor/m);
    expect(skill).toContain('`get_beginner_report_rules` 호출(보이면 필수)');
    expect(Buffer.byteLength(skill)).toBeLessThanOrEqual(6144);
  });
});
