import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { installSkill, recordSkillFiles } from '../src/installer/skill.js';
import { resolveScope } from '../src/config/paths.js';

const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const oldSkill = fileURLToPath(new URL('./fixtures-skill-v2.1-old.md', import.meta.url));
const roots: string[] = [];
afterAll(async () => { await Promise.all(roots.map((root) => fs.rm(root, { recursive: true, force: true }))); });

async function tempProject() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-skill-upgrade-'));
  roots.push(root);
  const home = path.join(root, 'home');
  const project = path.join(root, 'project');
  await Promise.all([home, project].map((dir) => fs.mkdir(dir, { recursive: true })));
  const env = { ...process.env, HOME: home, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: home, JUTELL_NO_FUNDING: '1' };
  return { root, home, project, env };
}

describe('upgrading over an old (32 KB) SKILL.md', () => {
  it('re-running setup replaces the JuTell-installed SKILL.md, keeps a backup, and adds the new references', async () => {
    const { project, env } = await tempProject();
    const run = (args: string[]) => spawnSync(process.execPath, [cliEntry, ...args], { cwd: project, env, encoding: 'utf8', timeout: 30000 });
    expect(run(['use', 'codex', '--yes']).status).toBe(0);
    const skillDir = path.join(project, '.agents', 'skills', 'beginner-bridge');
    const current = await fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf8');
    // Simulate an install made by the previous release: old SKILL.md, new reference files absent.
    const old = await fs.readFile(oldSkill, 'utf8');
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), old);
    await fs.rm(path.join(skillDir, 'references', 'procedure.md'));
    await fs.rm(path.join(skillDir, 'references', 'intent-bridge.md'));

    const second = run(['use', 'codex', '--yes']);
    expect(second.status).toBe(0);
    expect(`${second.stdout}${second.stderr}`).not.toContain('덮어쓰지 않았습니다');
    expect(await fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf8')).toBe(current);
    expect(Buffer.byteLength(current)).toBeLessThan(8192);
    expect(await fs.readFile(path.join(skillDir, 'SKILL.md.jutell-original'), 'utf8')).toBe(old);
    await expect(fs.stat(path.join(skillDir, 'references', 'procedure.md'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(skillDir, 'references', 'intent-bridge.md'))).resolves.toBeTruthy();
  });

  it('never overwrites a differing skill file JuTell did not install (kept as a conflict)', async () => {
    const { project } = await tempProject();
    const paths = resolveScope('project', project);
    const source = path.join(project, 'src-skill');
    await fs.mkdir(source, { recursive: true });
    await fs.writeFile(path.join(source, 'SKILL.md'), 'new');
    await fs.mkdir(paths.skillRoot, { recursive: true });
    await fs.writeFile(path.join(paths.skillRoot, 'SKILL.md'), 'user file');
    expect(await installSkill(source, paths.skillRoot, paths)).toMatchObject({ conflicts: ['SKILL.md'], replaced: [] });
    expect(await fs.readFile(path.join(paths.skillRoot, 'SKILL.md'), 'utf8')).toBe('user file');

    await recordSkillFiles(paths, ['SKILL.md']);
    expect(await installSkill(source, paths.skillRoot, paths)).toMatchObject({ conflicts: [], replaced: ['SKILL.md'] });
    expect(await fs.readFile(path.join(paths.skillRoot, 'SKILL.md'), 'utf8')).toBe('new');
  });
});
