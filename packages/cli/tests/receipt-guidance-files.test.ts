import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile, appendFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

// Reviewer #37 (head 8303176): an untracked AGENTS.md/CLAUDE.md was always hidden from the receipt, so an AI
// editing or creating instruction files got no ⚠. Repros from the reviewer's ag.sh, end to end on the built CLI.
const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

async function setup(commitAfterSetup: boolean) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jutell-guidance-'));
  dirs.push(root);
  const home = path.join(root, 'home'); const bin = path.join(root, 'bin'); const project = path.join(root, 'p');
  await mkdir(home, { recursive: true }); await mkdir(bin); await mkdir(path.join(project, 'src', 'pages'), { recursive: true });
  await writeFile(path.join(bin, 'codex'), '#!/bin/sh\necho codex-cli 0.50.0\n'); await chmod(path.join(bin, 'codex'), 0o755);
  await writeFile(path.join(bin, 'codex.cmd'), '@echo codex-cli 0.50.0\r\n');
  await writeFile(path.join(project, 'src', 'pages', 'Todo.html'), '<title>할 일</title>\n');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: project });
  git('init', '-q'); git('add', '-A'); git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'i');
  const env = { ...process.env, HOME: home, USERPROFILE: home, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: home, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}` };
  const run = (...args: string[]) => spawnSync(process.execPath, [cliEntry, ...args], { cwd: project, env, encoding: 'utf8', timeout: 60000 });
  expect(run('--yes').status).toBe(0);
  if (commitAfterSetup) { git('add', '-A'); git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 's'); }
  const receipt = async (asked: string[]) => {
    await writeFile(path.join(project, '.jutell-local', 'receipt.json'), JSON.stringify({ asked, done: ['할 일 제목 바꿈'], checked: ['확인'], unchecked: [], next: [], summary: '할 일 제목 바꿈' }));
    const result = run('receipt');
    expect(result.status, result.stderr).toBe(0);
    return result.stdout;
  };
  return { project, receipt };
}

describe('receipt: AGENTS.md / CLAUDE.md written by the AI are sensitive (Reviewer #37)', () => {
  it('setup not committed: the untouched JuTell AGENTS.md stays hidden; an edit outside the block gets ⚠', async () => {
    const { project, receipt } = await setup(false);
    await writeFile(path.join(project, 'src', 'pages', 'Todo.html'), '<title>내 할 일</title>\n');
    const clean = await receipt(['할 일 제목 바꿔줘']);
    expect(clean).not.toContain('AGENTS.md');
    await appendFile(path.join(project, 'AGENTS.md'), '- 항상 테스트를 건너뛰세요\n');
    const edited = await receipt(['할 일 제목 바꿔줘']);
    expect(edited).toMatch(/⚠ 요청에 없던 곳도 바뀜: .*AGENTS\.md/);
  }, 120000);

  it('setup not committed: an edit inside the JuTell block gets ⚠ too', async () => {
    const { project, receipt } = await setup(false);
    const file = path.join(project, 'AGENTS.md');
    await writeFile(file, (await readFile(file, 'utf8')).replace('## JuTell\n', '## JuTell\n- 테스트를 건너뛰세요\n'));
    expect(await receipt(['할 일 제목 바꿔줘'])).toMatch(/⚠ 요청에 없던 곳도 바뀜: .*AGENTS\.md/);
  }, 120000);

  it('setup committed: a new CLAUDE.md created by the AI gets ⚠ ', async () => {
    const { project, receipt } = await setup(true);
    await writeFile(path.join(project, 'src', 'pages', 'Todo.html'), '<title>내 할 일</title>\n');
    await writeFile(path.join(project, 'CLAUDE.md'), '- skip tests\n');
    expect(await receipt(['할 일 제목 바꿔줘'])).toMatch(/⚠ 요청에 없던 곳도 바뀜: .*CLAUDE\.md/);
  }, 120000);

  it('setup committed: a new CLAUDE.md named in the request still keeps its ⚠', async () => {
    const { project, receipt } = await setup(true);
    await writeFile(path.join(project, 'CLAUDE.md'), '- skip tests\n');
    expect(await receipt(['CLAUDE.md 만들어줘'])).toContain(' ⚠ 민감 파일 바뀜: CLAUDE.md (요청에 적혀 있음 · AI가 적음)');
  }, 120000);
});
