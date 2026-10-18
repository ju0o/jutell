import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it, vi } from 'vitest';
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

async function installed() {
  const t = await tempProject();
  const run = (args: string[]) => spawnSync(process.execPath, [cliEntry, ...args], { cwd: t.project, env: t.env, encoding: 'utf8', timeout: 30000 });
  expect(run(['use', 'codex', '--yes']).status).toBe(0);
  const skillDir = path.join(t.project, '.agents', 'skills', 'beginner-bridge');
  const current = await fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf8');
  return { ...t, run, skillDir, current, old: await fs.readFile(oldSkill, 'utf8') };
}

async function backupsOf(project: string) {
  const root = path.join(project, '.jutell-local', 'backups');
  const dirs = await fs.readdir(root).catch(() => [] as string[]);
  return Promise.all(dirs.map(async (dir) => ({ dir: path.join(root, dir), skill: await fs.readFile(path.join(root, dir, 'SKILL.md'), 'utf8').catch(() => undefined) })));
}

describe('upgrading over an old (32 KB) SKILL.md', () => {
  it('plain `jutell --yes` after a #28-style install replaces the unmodified old SKILL.md directly and adds references', async () => {
    const { project, run, skillDir, current, old } = await installed();
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), old);
    await fs.rm(path.join(skillDir, 'references', 'procedure.md'));
    await fs.rm(path.join(skillDir, 'references', 'intent-bridge.md'));

    const result = run(['--yes']);
    expect(result.status).toBe(0);
    expect(await fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf8')).toBe(current);
    await expect(fs.stat(path.join(skillDir, 'references', 'procedure.md'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(skillDir, 'references', 'intent-bridge.md'))).resolves.toBeTruthy();
    // Unmodified shipped content: nothing of the user's to keep, so no backup.
    expect(result.stdout).toContain('안내 파일을 새 버전으로 바꿨어요.');
    expect(result.stdout).not.toContain('보관한 곳');
    expect(await backupsOf(project)).toHaveLength(0);
    // Nothing old stays where agents read the Skill.
    expect((await fs.readdir(skillDir)).filter((name) => name !== 'SKILL.md' && name !== 'references')).toEqual([]);
    const again = run(['--yes']);
    expect(again.stdout).not.toContain('안내 파일을 새 버전으로');
  });

  it.each([
    ['--yes', ['--yes']],
    ['use codex', ['use', 'codex', '--yes']],
    ['upgrade', ['upgrade', '--yes']],
    ['setup', ['setup', '--yes']],
    ['enable', ['enable', '--yes']],
  ])('a user-modified JuTell-installed SKILL.md is backed up outside the skill folder, then replaced (%s)', async (_label, args) => {
    const { project, run, skillDir, current } = await installed();
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), `${current}\n내가 덧붙인 메모\n`);
    const result = run(args);
    expect(result.status).toBe(0);
    expect(await fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf8')).toBe(current);
    const backups = await backupsOf(project);
    expect(backups).toHaveLength(1);
    expect(backups[0].skill).toContain('내가 덧붙인 메모');
    expect(path.relative(skillDir, backups[0].dir).startsWith('..')).toBe(true);
    expect(result.stdout).toContain(`직접 고친 내용이 있어서 예전 것을 보관하고 새 버전으로 바꿨어요. 보관한 파일: SKILL.md. 보관한 곳: ${path.relative(project, backups[0].dir)}`);
    expect(result.stdout).not.toContain('예전 안내 파일을 보관하고');
    expect(path.basename(backups[0].dir)).toMatch(/^skill-\d{4}-\d{2}-\d{2}-\d{4}(-\d+)?$/);
    expect(await fs.readFile(path.join(project, '.jutell-local', '.gitignore'), 'utf8')).toBe('*\n');
  });

  it('old install that recorded files but no hashes: says it kept the old guide file (not "you edited it") and names it', async () => {
    const { project, run, skillDir, current } = await installed();
    const manifestFile = path.join(project, '.jutell-local', 'cli-install.json');
    const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
    delete manifest.skillHashes;
    await fs.writeFile(manifestFile, JSON.stringify(manifest));
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), `${current}\n예전 버전 내용\n`);
    const result = run(['--yes']);
    expect(result.status).toBe(0);
    expect(await fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf8')).toBe(current);
    const backups = await backupsOf(project);
    expect(backups).toHaveLength(1);
    expect(result.stdout).toContain(`예전 안내 파일을 보관하고 새 버전으로 바꿨어요(직접 고친 내용이 있었다면 그것도 보관한 파일에 그대로 있어요). 보관한 파일: SKILL.md. 보관한 곳: ${path.relative(project, backups[0].dir)}`);
    expect(result.stdout).not.toContain('직접 고친 내용이 있어서');
  });

  it('2.0.1-style install (no manifest): a known shipped SKILL.md is replaced, an unknown one is left alone', async () => {
    const { project, run, skillDir, current, old } = await installed();
    await fs.rm(path.join(project, '.jutell-local', 'cli-install.json'));
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), old);
    expect(run(['--yes']).status).toBe(0);
    expect(await fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf8')).toBe(current);

    await fs.rm(path.join(project, '.jutell-local', 'cli-install.json'));
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '사용자가 직접 쓴 Skill\n');
    const result = run(['--yes']);
    expect(result.stdout).not.toContain('안내 파일을 새 버전으로');
    expect(await fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf8')).toBe('사용자가 직접 쓴 Skill\n');
  });

  describe.skipIf(process.platform === 'win32')('never follows links or hard links (B2)', () => {
    async function outsideCopy(root: string, old: string) {
      const outside = path.join(root, 'outside');
      await fs.mkdir(outside, { recursive: true });
      await fs.writeFile(path.join(outside, 'SKILL.md'), old);
      await fs.writeFile(path.join(outside, 'procedure.md'), old);
      return outside;
    }

    it('SKILL.md as a symlink', async () => {
      const { root, run, skillDir, old } = await installed();
      const outside = await outsideCopy(root, old);
      await fs.rm(path.join(skillDir, 'SKILL.md'));
      await fs.symlink(path.join(outside, 'SKILL.md'), path.join(skillDir, 'SKILL.md'));
      const result = run(['--yes']);
      expect(result.status).toBe(0);
      expect((await fs.lstat(path.join(skillDir, 'SKILL.md'))).isSymbolicLink()).toBe(true);
      expect(await fs.readFile(path.join(outside, 'SKILL.md'), 'utf8')).toBe(old);
    });

    it('references/ directory as a symlink', async () => {
      const { root, run, skillDir, old } = await installed();
      const outside = await outsideCopy(root, old);
      await fs.rm(path.join(skillDir, 'references'), { recursive: true });
      await fs.symlink(outside, path.join(skillDir, 'references'));
      run(['--yes']);
      expect(await fs.readFile(path.join(outside, 'procedure.md'), 'utf8')).toBe(old);
      expect((await fs.readdir(outside)).sort()).toEqual(['SKILL.md', 'procedure.md']);
    });

    it('a file inside references/ as a symlink', async () => {
      const { root, run, skillDir, old } = await installed();
      const outside = await outsideCopy(root, old);
      await fs.rm(path.join(skillDir, 'references', 'procedure.md'));
      await fs.symlink(path.join(outside, 'procedure.md'), path.join(skillDir, 'references', 'procedure.md'));
      run(['--yes']);
      expect(await fs.readFile(path.join(outside, 'procedure.md'), 'utf8')).toBe(old);
    });

    it('SKILL.md hard-linked to another file (nlink > 1)', async () => {
      const { root, run, skillDir, old } = await installed();
      const outside = await outsideCopy(root, old);
      await fs.rm(path.join(skillDir, 'SKILL.md'));
      await fs.link(path.join(outside, 'SKILL.md'), path.join(skillDir, 'SKILL.md'));
      const result = run(['--yes']);
      expect(result.stdout).toContain('직접 만든 파일이거나 링크라서 바꾸지 않은 안내 파일이 있어요: SKILL.md');
      expect(await fs.readFile(path.join(outside, 'SKILL.md'), 'utf8')).toBe(old);
      expect((await fs.stat(path.join(skillDir, 'SKILL.md'))).nlink).toBe(2);
    });

    it('a repo-planted cli-install.json (with a forged hash) plus a symlinked SKILL.md', async () => {
      const { root, project, run, skillDir, old } = await installed();
      const outside = await outsideCopy(root, old);
      const { createHash } = await import('node:crypto');
      await fs.writeFile(path.join(project, '.jutell-local', 'cli-install.json'), JSON.stringify({ skillFiles: ['SKILL.md'], skillHashes: { 'SKILL.md': createHash('sha256').update(old).digest('hex') } }));
      await fs.rm(path.join(skillDir, 'SKILL.md'));
      await fs.symlink(path.join(outside, 'SKILL.md'), path.join(skillDir, 'SKILL.md'));
      run(['--yes']);
      expect((await fs.lstat(path.join(skillDir, 'SKILL.md'))).isSymbolicLink()).toBe(true);
      expect(await fs.readFile(path.join(outside, 'SKILL.md'), 'utf8')).toBe(old);
    });

    it('backupFile replaces a planted .previous symlink instead of writing through it', async () => {
      const { root } = await tempProject();
      const { backupFile } = await import('../src/config/managed.js');
      const file = path.join(root, 'config.toml');
      const victim = path.join(root, 'victim.txt');
      await fs.writeFile(file, 'config');
      await fs.writeFile(victim, 'victim');
      await fs.symlink(victim, `${file}.previous`);
      await fs.symlink(victim, `${file}.jutell-original`);
      await backupFile(file);
      expect(await fs.readFile(victim, 'utf8')).toBe('victim');
      expect((await fs.lstat(`${file}.previous`)).isSymbolicLink()).toBe(false);
      expect(await fs.readFile(`${file}.previous`, 'utf8')).toBe('config');
    });
  });

  it('a second user-modified upgrade in the same minute gets a -2 suffix, not a clash (clock frozen)', async () => {
    const { project } = await tempProject();
    const paths = resolveScope('project', project);
    const source = path.join(project, 'src-skill');
    await fs.mkdir(source, { recursive: true });
    await fs.writeFile(path.join(source, 'SKILL.md'), 'new');
    await fs.mkdir(paths.skillRoot, { recursive: true });
    const target = path.join(paths.skillRoot, 'SKILL.md');
    await fs.writeFile(target, 'new');
    await recordSkillFiles(paths, ['SKILL.md']);
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date(2026, 9, 18, 22, 30, 59));
      await fs.writeFile(target, 'new\n첫 메모\n');
      expect(await installSkill(source, paths.skillRoot, paths)).toMatchObject({ backedUp: ['SKILL.md'] });
      await fs.writeFile(target, 'new\n둘째 메모\n');
      expect(await installSkill(source, paths.skillRoot, paths)).toMatchObject({ backedUp: ['SKILL.md'] });
    } finally {
      vi.useRealTimers();
    }
    const backups = (await backupsOf(project)).sort((a, b) => a.dir.localeCompare(b.dir));
    expect(backups.map((backup) => path.basename(backup.dir))).toEqual(['skill-2026-10-18-2230', 'skill-2026-10-18-2230-2']);
    expect(backups.map((backup) => backup.skill)).toEqual(['new\n첫 메모\n', 'new\n둘째 메모\n']);
  });

  it('doctor names the differing files and the fix command', async () => {
    const { run, skillDir, old } = await installed();
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), old);
    await fs.rm(path.join(skillDir, 'references', 'procedure.md'));
    const doctor = run(['doctor', '--no-funding']);
    expect(doctor.stdout).toContain('설치된 안내 파일이 이 버전과 달라요: SKILL.md, references/procedure.md.');
    expect(doctor.stdout).toContain('프로젝트 폴더에서 `jutell`을 실행하면 새 버전으로 바꿔요');
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
