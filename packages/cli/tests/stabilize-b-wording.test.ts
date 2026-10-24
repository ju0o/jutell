import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveScope } from '../src/config/paths.js';
import { setupCommand, uninstallCommand } from '../src/commands/lifecycle.js';
import { getDoctorResults } from '../src/commands/status.js';
import { printHelp } from '../src/output/format.js';
import type { CliIo } from '../src/types.js';

const saved = { CODEX_HOME: process.env.CODEX_HOME, HOME: process.env.HOME };
const roots: string[] = [];
afterEach(async () => {
  process.env.CODEX_HOME = saved.CODEX_HOME; process.env.HOME = saved.HOME;
  if (saved.CODEX_HOME === undefined) delete process.env.CODEX_HOME;
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

function makeIo() {
  const out: string[] = [];
  const io = { write: (m: string) => out.push(m), error: (m: string) => out.push(m), ask: async () => true } as unknown as CliIo;
  return { out, io };
}

async function project() {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-sb-')));
  roots.push(root);
  const dir = path.join(root, 'proj');
  await fs.mkdir(dir, { recursive: true });
  process.env.HOME = path.join(root, 'home');
  process.env.CODEX_HOME = path.join(root, 'codex');
  await fs.mkdir(process.env.CODEX_HOME, { recursive: true });
  return dir;
}

describe('stabilize-b: --yes in help, uninstall leftovers, plain wording', () => {
  it('help says on/off/enable/disable/uninstall need --yes and explains what uninstall keeps', () => {
    const { out, io } = makeIo();
    printHelp(io);
    const text = out.join('\n');
    for (const cmd of ['on', 'off', 'enable', 'disable', 'uninstall']) expect(text).toContain(`jutell ${cmd} --yes`);
    expect(text).toContain('Beta Journal');
    expect(text).not.toContain('canonical');
  });

  it('uninstall removes a JuTell-only AGENTS.md and empty Skill folders, and lists what stays', async () => {
    const dir = await project();
    const paths = resolveScope('project', dir);
    const { out, io } = makeIo();
    await setupCommand(paths, { yes: true, scope: 'project', openBrowser: false } as never, io).catch(() => undefined);
    await uninstallCommand(paths, { yes: true, removeData: false } as never, io);
    const text = out.join('\n');
    await expect(fs.stat(path.join(dir, 'AGENTS.md'))).rejects.toThrow();
    await expect(fs.stat(path.join(dir, '.agents'))).rejects.toThrow();
    expect(text).toContain('Beta Journal(JuTell이 남긴 하루 작업 기록)');
    expect(text).toContain('남겨 둔 것: .jutell.json(설정)');
  });

  it('uninstall keeps a user-written AGENTS.md', async () => {
    const dir = await project();
    await fs.writeFile(path.join(dir, 'AGENTS.md'), '# my rules\n');
    const paths = resolveScope('project', dir);
    const { io } = makeIo();
    await setupCommand(paths, { yes: true, scope: 'project', openBrowser: false } as never, io).catch(() => undefined);
    await uninstallCommand(paths, { yes: true, removeData: false } as never, io);
    expect(await fs.readFile(path.join(dir, 'AGENTS.md'), 'utf8')).toBe('# my rules\n');
  });

  it('doctor shows the receipt command', async () => {
    const dir = await project();
    const checks = await getDoctorResults(resolveScope('project', dir));
    expect(checks.find((c) => c.name === '영수증 명령')?.detail).toContain('jutell receipt');
  });
});

describe('doctor display names', () => {
  it('shows plain labels but keeps the stable names', async () => {
    const dir = await project();
    const checks = await getDoctorResults(resolveScope('project', dir));
    const build = checks.find((c) => c.name === 'MCP 빌드 파일');
    expect(build?.label).toBe('JuTell 도구 파일');
    expect(checks.find((c) => c.name === 'MCP 서버 실제 연결 (Stdio)')?.label).toBe('JuTell 도구 실제로 켜 보기');
  });
});
