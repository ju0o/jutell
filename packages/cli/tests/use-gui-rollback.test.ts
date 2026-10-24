import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

// PR-D follow-up: a failure after the app file was written must take the JuTell entry back out.
vi.mock('../src/installer/skill.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/installer/skill.js')>()),
  recordSkillFiles: async () => { throw new Error('injected failure after the app file was written'); },
}));

const { useCommand } = await import('../src/commands/use.js');
const { resolveScope } = await import('../src/config/paths.js');

const saved = { ...process.env };
const roots: string[] = [];
afterEach(async () => {
  process.env = { ...saved };
  for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true, maxRetries: 5 });
});

async function sandbox() {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-use-rb-')));
  roots.push(root);
  const home = path.join(root, 'home'); const project = path.join(root, 'proj');
  for (const dir of [home, project]) await fs.mkdir(dir, { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: project });
  Object.assign(process.env, { HOME: home, USERPROFILE: home, JUTELL_HOME: home, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: path.join(home, '.claude') });
  const io = { write: () => undefined, error: () => undefined, ask: async () => true } as never;
  return { project, io };
}

describe('jutell use <GUI app> rollback', () => {
  it('a new app file (and the folder JuTell made for it) is removed when a later step fails', async () => {
    const { project, io } = await sandbox();
    await expect(useCommand(resolveScope('project', project), { yes: true } as never, io, ['use', 'cursor'])).rejects.toThrow('injected');
    for (const leftover of ['.cursor/mcp.json', '.cursor/mcp.json.jutell-created', '.cursor']) {
      expect(await fs.lstat(path.join(project, leftover)).then(() => true, () => false), leftover).toBe(false);
    }
  });

  it('the person\'s existing app file comes back byte-identical, with no JuTell backups left behind', async () => {
    const { project, io } = await sandbox();
    const file = path.join(project, '.vscode', 'mcp.json');
    const original = '{\n  // mine\n  "servers": { "other": { "command": "x" } }\n}\n';
    await fs.mkdir(path.dirname(file));
    await fs.writeFile(file, original);
    await expect(useCommand(resolveScope('project', project), { yes: true } as never, io, ['use', 'vscode'])).rejects.toThrow('injected');
    expect(await fs.readFile(file, 'utf8')).toBe(original);
    expect((await fs.readdir(path.dirname(file))).sort()).toEqual(['mcp.json']);
  });
});
