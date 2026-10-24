import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { readText, withReadOnlyReads } from '../src/config/managed.js';

// cycle-3: read-only commands (status/doctor) warn about a file they cannot read instead of
// exiting 1; write commands keep rethrowing (PR-D B1).
const execFileAsync = promisify(execFile);
const entry = path.resolve(import.meta.dirname, '..', 'dist', 'index.js');
const roots: string[] = [];
const canChmod = process.platform !== 'win32' && process.getuid?.() !== 0;

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await fs.chmod(path.join(root, 'project', 'AGENTS.md'), 0o644).catch(() => undefined);
    await fs.chmod(path.join(root, 'project', '.jutell.json'), 0o644).catch(() => undefined);
    await fs.rm(root, { recursive: true, force: true });
  }
});

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-unreadable-'));
  roots.push(root);
  const project = path.join(root, 'project');
  const home = path.join(root, 'home');
  await fs.mkdir(project, { recursive: true });
  await fs.mkdir(home, { recursive: true });
  const env = { ...process.env, JUTELL_HOME: home, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: home, HOME: home, USERPROFILE: home };
  const run = (args: string[]) => execFileAsync(process.execPath, [entry, ...args], { cwd: project, env, windowsHide: true, maxBuffer: 1024 * 1024 })
    .then((r) => ({ code: 0, stdout: r.stdout, stderr: r.stderr }))
    .catch((e: { code: number; stdout: string; stderr: string }) => ({ code: e.code, stdout: e.stdout, stderr: e.stderr }));
  await run(['setup', '--yes']);
  return { project, run };
}

describe('read-only commands with an unreadable file', () => {
  it.skipIf(!canChmod)('status exits 0 and warns when AGENTS.md is chmod 000; the file is not changed', async () => {
    const { project, run } = await fixture();
    const agents = path.join(project, 'AGENTS.md');
    const before = await fs.readFile(agents);
    await fs.chmod(agents, 0o000);
    const status = await run(['status']);
    expect(status.stderr).not.toContain('권한이 없어');
    expect(status.code).toBe(0);
    expect(status.stdout).toMatch(/주의: AGENTS\.md 파일을 읽을 수 없어\(EACCES\)/);
    const json = await run(['status', '--json']);
    expect(json.code).toBe(0);
    expect(JSON.parse(json.stdout).warnings.some((w: string) => w.includes('AGENTS.md') && w.includes('EACCES'))).toBe(true);
    await fs.chmod(agents, 0o644);
    expect(await fs.readFile(agents)).toEqual(before);
  }, 30000);

  it.skipIf(!canChmod)('doctor reports the unreadable file as 주의 (not 오류) and does not crash', async () => {
    const { project, run } = await fixture();
    await fs.chmod(path.join(project, 'AGENTS.md'), 0o000);
    const doctor = await run(['doctor', '--json']);
    expect(doctor.stderr).not.toContain('권한이 없어');
    const checks = JSON.parse(doctor.stdout) as Array<{ name: string; status: string }>;
    const unreadable = checks.find((c) => c.name === '읽을 수 없는 파일: AGENTS.md');
    expect(unreadable?.status).toBe('주의');
    expect(checks.filter((c) => c.status === '오류' && c.name.includes('AGENTS'))).toEqual([]);
    // Exit 1 only if some other check is 오류 (e.g. jutell not on the login-shell PATH here), never because of the unreadable file.
    expect(doctor.code).toBe(checks.some((c) => c.status === '오류') ? 1 : 0);
  }, 30000);

  it.skipIf(!canChmod)('status also survives an unreadable .jutell.json', async () => {
    const { project, run } = await fixture();
    await fs.chmod(path.join(project, '.jutell.json'), 0o000);
    const status = await run(['status']);
    expect(status.code).toBe(0);
    expect(status.stdout).toMatch(/\.jutell\.json 파일을 읽을 수 없어\(EACCES\)/);
  }, 30000);

  it('readText stays strict outside the read-only scope and is lenient only inside it', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-readtext-'));
    roots.push(dir);
    // A directory gives EISDIR on every OS, so this case also runs on Windows and as root.
    await expect(readText(dir)).rejects.toMatchObject({ code: 'EISDIR' });
    const { result, unreadable } = await withReadOnlyReads(() => readText(dir));
    expect(result).toBeUndefined();
    expect(unreadable).toEqual([{ file: dir, code: 'EISDIR' }]);
    await expect(readText(dir)).rejects.toMatchObject({ code: 'EISDIR' });
  });
});
