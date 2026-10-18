import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const roots: string[] = [];
afterAll(async () => { await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))); });

async function runDoctor(withJutellOnLoginPath: boolean, shell?: string) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jutell-doctor-login-'));
  roots.push(root);
  const home = path.join(root, 'home');
  const project = path.join(root, 'project');
  const bin = path.join(root, 'bin');
  await Promise.all([home, project, bin].map((dir) => mkdir(dir, { recursive: true })));
  if (withJutellOnLoginPath) {
    await writeFile(path.join(bin, 'jutell'), '#!/bin/sh\nexit 0\n', 'utf8');
    await chmod(path.join(bin, 'jutell'), 0o755);
    await writeFile(path.join(home, '.profile'), `export PATH=${bin}:$PATH\n`, 'utf8');
  }
  const result = spawnSync(process.execPath, [cliEntry, 'doctor'], {
    cwd: project,
    env: { HOME: home, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: home, PATH: '/usr/bin:/bin', NO_COLOR: '1', ...(shell ? { SHELL: shell } : {}) },
    encoding: 'utf8',
    timeout: 20000,
  });
  return `${result.stdout}\n${result.stderr}`;
}

describe.skipIf(process.platform === 'win32')('doctor checks jutell on the login shell PATH Codex uses', () => {
  it('warns in plain words with the fix when bash -lc cannot find jutell', async () => {
    const output = await runDoctor(false);
    expect(output).toContain('Codex가 명령을 실행하는 셸에서 jutell을 찾지 못했어요');
    expect(output).toContain('~/.profile 의 PATH');
  });

  it('reports 정상 when the login shell finds jutell', async () => {
    const output = await runDoctor(true);
    expect(output).toContain('Codex가 명령을 실행하는 셸에서 jutell을 찾았습니다.');
  });

  it('uses the user\'s $SHELL -lc instead of hard-coded bash', async () => {
    // /bin/sh -lc reads ~/.profile too, so jutell is found through the user's own shell.
    expect(await runDoctor(true, '/bin/sh')).toContain('Codex가 명령을 실행하는 셸에서 jutell을 찾았습니다.');
    // A shell that cannot run proves $SHELL is used (bash would have found it).
    expect(await runDoctor(true, '/nonexistent/shell')).toContain('jutell을 찾지 못했어요');
  });
});
