import { execFileSync, spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { normalizeConfig } from '../src/config/managed.js';
import { addGitExclude, EXCLUDE_COMMENT, EXCLUDE_LINE, excludeFile, excludeLineFor, gitExcludeMessage, removeGitExclude } from '../src/map/git-exclude.js';

const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const roots: string[] = [];
afterAll(async () => { await Promise.all(roots.map((root) => fs.rm(root, { recursive: true, force: true }))); });
const PAIR = `${EXCLUDE_COMMENT}\n${EXCLUDE_LINE}\n`;
const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'protocol.file.allow=always', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

async function repo(name = 'proj', init = true) {
  // realpath: macOS tmpdir is a symlink (/var → /private/var) and git prints the real path.
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-gx-')));
  roots.push(root);
  const dir = path.join(root, name);
  const home = path.join(root, 'home');
  await fs.mkdir(dir, { recursive: true });
  await fs.mkdir(home, { recursive: true });
  if (init) git(dir, 'init', '-q');
  await fs.writeFile(path.join(dir, 'JuTellMap.md'), '# 지도\n');
  const env = { ...process.env, HOME: home, USERPROFILE: home, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: home, JUTELL_NO_FUNDING: '1' };
  const run = (...args: string[]) => spawnSync(process.execPath, [cliEntry, ...args], { cwd: dir, env, encoding: 'utf8', timeout: 30000 });
  return { root, dir, run, exclude: path.join(dir, '.git', 'info', 'exclude') };
}
const ignored = (dir: string) => { try { git(dir, 'check-ignore', '-q', 'JuTellMap.md'); return true; } catch { return false; } };

describe('map git exclude (W4)', () => {
  it('appends the two lines once, keeps existing bytes (CRLF, no final newline), and git then ignores the map', async () => {
    const { dir, exclude } = await repo();
    const original = '# my rules\r\n*.log\r\nbuild/';
    await fs.writeFile(exclude, original);
    expect((await addGitExclude(dir)).status).toBe('added');
    expect((await addGitExclude(dir)).status).toBe('already');
    const text = await fs.readFile(exclude, 'utf8');
    expect(text).toBe(`${original}\r\n${EXCLUDE_COMMENT}\r\n${EXCLUDE_LINE}\r\n`);
    expect(text.split(EXCLUDE_COMMENT)).toHaveLength(2);
    expect(ignored(dir)).toBe(true);
  });

  it('creates info/exclude when it is missing', async () => {
    const { dir, exclude } = await repo();
    await fs.rm(path.join(dir, '.git', 'info'), { recursive: true, force: true });
    expect((await addGitExclude(dir)).status).toBe('added');
    expect(await fs.readFile(exclude, 'utf8')).toBe(PAIR);
  });

  it('--git-include removes only the two lines; a user line "/JuTellMap.md" on its own and everything else stay byte for byte', async () => {
    const { dir, exclude } = await repo();
    const before = `a\n${EXCLUDE_LINE}\nb\r\n`;
    await fs.writeFile(exclude, before);
    await addGitExclude(dir);
    expect((await removeGitExclude(dir)).status).toBe('removed');
    expect(await fs.readFile(exclude, 'utf8')).toBe(before);
    expect((await removeGitExclude(dir)).status).toBe('absent');
  });

  it('never writes through a link', async () => {
    const { root, dir, exclude } = await repo();
    const target = path.join(root, 'target');
    await fs.writeFile(target, 'mine\n');
    await fs.rm(exclude, { force: true });
    await fs.symlink(target, exclude);
    expect((await addGitExclude(dir)).status).toBe('link');
    expect((await removeGitExclude(dir)).status).toBe('link');
    expect(await fs.readFile(target, 'utf8')).toBe('mine\n');
  });

  it('a committed map: changes nothing and tells the user to run `git rm --cached JuTellMap.md`', async () => {
    const { dir, exclude, run } = await repo();
    git(dir, 'add', 'JuTellMap.md');
    git(dir, 'commit', '-qm', 'map');
    const before = await fs.readFile(exclude, 'utf8');
    const result = run('map', '--git-exclude');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('`git rm --cached JuTellMap.md`를 직접 실행하세요');
    expect(await fs.readFile(exclude, 'utf8')).toBe(before);
  });

  it('not a git repository: says there is nothing to do and exits 0', async () => {
    const { run } = await repo('plain', false);
    for (const flag of ['--git-exclude', '--git-include']) {
      const result = run('map', flag);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('git 저장소가 아니라 할 일이 없어요');
    }
  });

  it('the user .gitignore is never changed', async () => {
    const { dir, run } = await repo();
    await fs.writeFile(path.join(dir, '.gitignore'), 'node_modules\n');
    run('map', '--git-exclude');
    run('map', '--git-include');
    expect(await fs.readFile(path.join(dir, '.gitignore'), 'utf8')).toBe('node_modules\n');
  });

  it('worktree: finds the shared info/exclude via `git rev-parse --git-path`', async () => {
    const { root, dir } = await repo();
    await fs.writeFile(path.join(dir, 'a.txt'), 'x');
    git(dir, 'add', 'a.txt');
    git(dir, 'commit', '-qm', 'a');
    const wt = path.join(root, 'wt');
    git(dir, 'worktree', 'add', '-q', wt);
    await fs.writeFile(path.join(wt, 'JuTellMap.md'), '# 지도\n');
    const file = await excludeFile(wt);
    expect(file).toBe(path.resolve(dir, '.git', 'info', 'exclude'));
    const added = await addGitExclude(wt);
    expect(added.status).toBe('added');
    expect(ignored(wt)).toBe(true);
    // The message names the real file (shared one, outside the worktree), relative to the project.
    expect(gitExcludeMessage(added, wt)).toContain(`(${path.relative(await fs.realpath(wt), await fs.realpath(file!)).split(path.sep).join('/')})`);
    expect(gitExcludeMessage(added, wt)).not.toContain('(.git/info/exclude)');
  });

  it('submodule: writes the submodule\'s own info/exclude', async () => {
    const { root, dir } = await repo();
    const sub = path.join(root, 'subsrc');
    await fs.mkdir(sub);
    git(sub, 'init', '-q');
    await fs.writeFile(path.join(sub, 'x.txt'), 'x');
    git(sub, 'add', 'x.txt');
    git(sub, 'commit', '-qm', 'x');
    git(dir, 'submodule', '-q', 'add', sub, 'mod');
    const inner = path.join(dir, 'mod');
    await fs.writeFile(path.join(inner, 'JuTellMap.md'), '# 지도\n');
    expect(await excludeFile(inner)).toBe(path.resolve(dir, '.git', 'modules', 'mod', 'info', 'exclude'));
    const added = await addGitExclude(inner);
    expect(added.status).toBe('added');
    expect(gitExcludeMessage(added, inner)).toContain('(../.git/modules/mod/info/exclude)');
    expect(ignored(inner)).toBe(true);
    expect(ignored(dir)).toBe(false);
  });

  // Reviewer C2: a project in a subfolder of a bigger repository gets /<prefix>JuTellMap.md (glob characters escaped).
  it('project in a subfolder of a parent repo: prefixed, escaped line; check-ignore reported; remove/uninstall use the same line', async () => {
    const { dir: parent, root } = await repo('parent');
    const sub = path.join(parent, 'apps', 'we[ird]'); // * and ? are not allowed in Windows folder names; checked via excludeLineFor
    await fs.mkdir(sub, { recursive: true });
    await fs.writeFile(path.join(sub, 'JuTellMap.md'), '# 지도\n');
    expect(excludeLineFor('apps/we[ird]*?/')).toBe('/apps/we\\[ird\\]\\*\\?/JuTellMap.md');
    const added = await addGitExclude(sub);
    expect(added).toMatchObject({ status: 'added', ignored: true });
    const exclude = path.join(parent, '.git', 'info', 'exclude');
    expect(await fs.readFile(exclude, 'utf8')).toContain(`${EXCLUDE_COMMENT}\n/apps/we\\[ird\\]/JuTellMap.md\n`);
    expect(ignored(sub)).toBe(true);
    expect(ignored(parent)).toBe(false); // the parent's own map is not hidden
    expect((await addGitExclude(sub)).status).toBe('already');
    expect(await removeGitExclude(sub)).toMatchObject({ status: 'removed', ignored: false });
    expect(ignored(sub)).toBe(false);
    void root;
  });

  it('reports as is when the line is in but git still does not ignore the map', async () => {
    const { dir, exclude } = await repo();
    await fs.writeFile(exclude, '');
    await fs.writeFile(path.join(dir, '.gitignore'), '!JuTellMap.md\n');
    const result = await addGitExclude(dir);
    expect(result).toMatchObject({ status: 'added', ignored: false });
    expect(gitExcludeMessage(result)).toContain('git check-ignore');
  });

  it('CLI: --git-exclude/--git-include record map.gitExclude in .jutell.json; uninstall removes only the two lines', async () => {
    const { dir, exclude, run } = await repo('한글 폴더');
    expect(run('setup', '--yes').status).toBe(0);
    await fs.appendFile(exclude, 'keep-me\n');
    expect(run('map', '--git-exclude').stdout).toContain('git에서 뺐어요');
    expect(JSON.parse(await fs.readFile(path.join(dir, '.jutell.json'), 'utf8')).map).toEqual({ gitExclude: true });
    run('map', '--git-include');
    expect(JSON.parse(await fs.readFile(path.join(dir, '.jutell.json'), 'utf8')).map).toEqual({ gitExclude: false });
    run('map', '--git-exclude');
    const before = (await fs.readFile(exclude, 'utf8')).replace(PAIR, '');
    const uninstall = run('uninstall', '--yes');
    expect(uninstall.status).toBe(0);
    expect(await fs.readFile(exclude, 'utf8')).toBe(before);
    expect(before).toContain('keep-me\n');
    expect(run('map', '--git-exclude', '--git-include').status).not.toBe(0);
  });
});

describe('config key map.gitExclude in the CLI (hasOnlyKeys parity)', () => {
  it('normalizeConfig keeps map.gitExclude and never adds map when absent', () => {
    const base = { version: 1, profile: 'balanced', features: {}, limits: { maxMainFiles: 5, maxGlossaryTerms: 3, compactReportMaxSentences: 12 } };
    expect(normalizeConfig({ ...base, map: { gitExclude: true } }).map).toEqual({ gitExclude: true });
    expect('map' in normalizeConfig(base)).toBe(false);
  });
});
