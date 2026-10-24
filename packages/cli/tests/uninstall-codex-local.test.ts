import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveScope } from '../src/config/paths.js';
import { buildMcpBlock } from '../src/config/managed.js';
import { uninstallCommand } from '../src/commands/lifecycle.js';
import type { CliIo } from '../src/types.js';

const saved = { CODEX_HOME: process.env.CODEX_HOME, HOME: process.env.HOME };
const roots: string[] = [];
afterEach(async () => {
  process.env.CODEX_HOME = saved.CODEX_HOME; process.env.HOME = saved.HOME;
  if (saved.CODEX_HOME === undefined) delete process.env.CODEX_HOME;
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function setup(serverRoot: (project: string, root: string) => string) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-unin-')));
  roots.push(root);
  const project = path.join(root, 'proj');
  await fs.mkdir(project, { recursive: true });
  process.env.HOME = path.join(root, 'home');
  process.env.CODEX_HOME = path.join(root, 'codex');
  await fs.mkdir(process.env.CODEX_HOME, { recursive: true });
  const paths = resolveScope('project', project);
  const global = resolveScope('global', project);
  const config = path.join(process.env.CODEX_HOME, 'config.toml');
  await fs.writeFile(config, `[mcp_servers.other]\ncommand = "other"\n\n${buildMcpBlock(global, serverRoot(project, root), true)}\n`);
  const out: string[] = [];
  const io = { write: (m: string) => out.push(m), error: (m: string) => out.push(m), ask: async () => true } as unknown as CliIo;
  return { paths, config, out, io };
}

describe('project uninstall and the shared Codex entry (temp CODEX_HOME)', () => {
  it('removes ONLY JuTell\'s entry when it runs this project\'s local node_modules, and says so', async () => {
    const { paths, config, out, io } = await setup((project) => path.join(project, 'node_modules', 'jutell'));
    await uninstallCommand(paths, { yes: true, removeData: false } as never, io);
    const after = await fs.readFile(config, 'utf8');
    expect(after).toContain('[mcp_servers.other]');
    expect(after).not.toContain('mcp_servers.jutell');
    expect(out.join('\n')).toContain('이 프로젝트용 JuTell 연결');
    expect(out.join('\n')).not.toContain('공유되어 제거하지 않았습니다');
  });

  it('keeps a global-install entry (shared by other projects) and tells the user', async () => {
    const { paths, config, out, io } = await setup((_project, root) => path.join(root, 'global', 'lib', 'node_modules', 'jutell'));
    const before = await fs.readFile(config, 'utf8');
    await uninstallCommand(paths, { yes: true, removeData: false } as never, io);
    expect(await fs.readFile(config, 'utf8')).toBe(before);
    expect(out.join('\n')).toContain('공유되어 제거하지 않았습니다');
  });
});
