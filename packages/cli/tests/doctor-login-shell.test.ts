import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { loginShellJutellCheck } from '../src/commands/status.js';

const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const roots: string[] = [];
let lastStatus: number | null = null;
afterAll(async () => { await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))); });

async function runDoctor(withJutellOnLoginPath: boolean, shell?: string, receiptReport?: boolean, withLocalJutell = false) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'jutell-doctor-login-')));
  roots.push(root);
  const home = path.join(root, 'home');
  const project = path.join(root, 'project with spaces');
  const bin = path.join(root, 'bin');
  const npmBin = path.join(root, 'npm-bin');
  await Promise.all([home, project, bin, npmBin].map((dir) => mkdir(dir, { recursive: true })));
  // Fake npm keeps global-prefix advice deterministic and accepts only a real
  // local-bin fixture for the project-aware invocation.
  await writeFile(path.join(npmBin, 'npm'), `#!/bin/sh
if [ "$1" = "prefix" ] && [ "$2" = "-g" ]; then
  echo "${path.join(root, 'npm-global')}"
  exit 0
fi
if [ "$1" = "exec" ]; then
  [ "$2" = "--offline" ] && [ "$3" = "--no" ] && [ "$4" = "--prefix" ] || exit 2
  [ "$5" = "$JUTELL_TEST_EXPECTED_ROOT" ] || exit 3
  [ "$6" = "--" ] && [ "$7" = "jutell" ] && [ "$8" = "--version" ] || exit 4
  [ -x "$5/node_modules/.bin/jutell" ] || exit 5
  echo 2.1.0
  exit 0
fi
exit 1
`, 'utf8');
  await chmod(path.join(npmBin, 'npm'), 0o755);
  if (withLocalJutell) {
    const localBin = path.join(project, 'node_modules', '.bin');
    await mkdir(localBin, { recursive: true });
    await writeFile(path.join(localBin, 'jutell'), '#!/bin/sh\necho 2.1.0\n', 'utf8');
    await chmod(path.join(localBin, 'jutell'), 0o755);
    await writeFile(path.join(home, '.profile'), `export PATH="${npmBin}:$PATH"\n`, 'utf8');
  }
  if (receiptReport !== undefined) await writeFile(path.join(project, '.jutell.json'), JSON.stringify({ version: 1, profile: 'balanced', features: { receiptReport } }), 'utf8');
  if (withJutellOnLoginPath) {
    await writeFile(path.join(bin, 'jutell'), '#!/bin/sh\nexit 0\n', 'utf8');
    await chmod(path.join(bin, 'jutell'), 0o755);
    await writeFile(path.join(home, '.profile'), `export PATH=${bin}:$PATH\n`, 'utf8');
  }
  const result = spawnSync(process.execPath, [cliEntry, 'doctor'], {
    cwd: project,
    env: { HOME: home, USERPROFILE: home, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: home, PATH: `${npmBin}:/usr/bin:/bin`, JUTELL_TEST_EXPECTED_ROOT: project, NO_COLOR: '1', ...(shell ? { SHELL: shell } : {}) },
    encoding: 'utf8',
    timeout: 20000,
  });
  lastStatus = result.status;
  return `${result.stdout}\n${result.stderr}`;
}

async function runDoctorFull(shell?: string) {
  return { root: roots.at(-1), output: await runDoctor(false, shell) };
}

describe.skipIf(process.platform === 'win32')('doctor checks jutell on the login shell PATH Codex uses', () => {
  it('fails with one real PATH line (npm prefix -g + /bin) when bash -lc cannot find jutell', async () => {
    const { output } = await runDoctorFull();
    const root = roots.at(-1)!;
    expect(output).toContain('Codex가 명령을 실행하는 셸에서 jutell을 찾지 못했어요');
    expect(output).toContain(`~/.profile 파일 맨 아래에 이 한 줄을 넣고 터미널과 Codex를 다시 여세요: export PATH="${path.join(root, 'npm-global', 'bin')}:$PATH"`);
    expect(output).not.toContain('npm install -g');
    expect(lastStatus).toBe(1);
  });

  it('with receiptReport off, a missing jutell is only 주의 and doctor exits 0 (B7)', async () => {
    const output = await runDoctor(false, undefined, false);
    expect(output).toMatch(/주의\s+Codex에서 jutell 명령 찾기/);
    expect(output).not.toContain('작업 영수증이 저장되지 않아요');
    expect(lastStatus).toBe(0);
  });

  it('with receiptReport explicitly on, a missing jutell is 오류 and doctor exits 1 (B7)', async () => {
    const output = await runDoctor(false, undefined, true);
    expect(output).toMatch(/오류\s+Codex에서 jutell 명령 찾기/);
    expect(lastStatus).toBe(1);
  });

  it('points zsh users at ~/.zprofile', async () => {
    const { output } = await runDoctorFull('/nonexistent/zsh');
    expect(output).toContain('~/.zprofile 파일 맨 아래에 이 한 줄을 넣고');
  });

  it('reports 정상 when the login shell finds jutell', async () => {
    const output = await runDoctor(true);
    expect(output).toContain('Codex가 명령을 실행하는 셸에서 jutell을 찾았습니다.');
  });

  it('accepts a project-local npm bin when the path contains spaces', async () => {
    const output = await runDoctor(false, undefined, undefined, true);
    expect(output).toContain('Codex가 프로젝트에 설치된 JuTell을 npm으로 찾았습니다.');
    expect(output).not.toContain('Codex가 명령을 실행하는 셸에서 jutell을 찾지 못했어요');
    expect(lastStatus).toBe(0);
  });

  it('uses the supplied project root when the caller cwd has changed', async () => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'jutell-doctor-changed-cwd-')));
    roots.push(root);
    const home = path.join(root, 'home');
    const project = path.join(root, 'project with spaces');
    const npmBin = path.join(root, 'npm-bin');
    await Promise.all([home, project, npmBin].map((dir) => mkdir(dir, { recursive: true })));
    const log = path.join(root, 'npm-args.txt');
    const localBin = path.join(project, 'node_modules', '.bin');
    await mkdir(localBin, { recursive: true });
    await writeFile(path.join(localBin, 'jutell'), '#!/bin/sh\necho 2.1.0\n', 'utf8');
    await chmod(path.join(localBin, 'jutell'), 0o755);
    await writeFile(path.join(npmBin, 'npm'), `#!/bin/sh
[ "$1" = "exec" ] && [ "$2" = "--offline" ] && [ "$3" = "--no" ] && [ "$4" = "--prefix" ] || exit 2
[ "$5" = "$JUTELL_PROJECT_ROOT" ] || exit 3
[ "$5" = "$JUTELL_TEST_EXPECTED_ROOT" ] || exit 4
[ "$6" = "--" ] && [ "$7" = "jutell" ] && [ "$8" = "--version" ] || exit 5
[ -x "$5/node_modules/.bin/jutell" ] || exit 6
printf '%s\n%s\n' "$5" "$PWD" > "$JUTELL_TEST_LOG"
echo 2.1.0
`, 'utf8');
    await chmod(path.join(npmBin, 'npm'), 0o755);
    await writeFile(path.join(home, '.profile'), `export PATH="${npmBin}:$PATH"\n`, 'utf8');
    // The test process cwd is the repository, while the login shell must run
    // from the explicitly supplied project path (which contains spaces).
    const result = await loginShellJutellCheck(true, {
      HOME: home, USERPROFILE: home,
      BEGINNER_BRIDGE_HOME: home,
      PATH: `${npmBin}:/usr/bin:/bin`,
      SHELL: '/bin/bash',
      JUTELL_TEST_EXPECTED_ROOT: project,
      JUTELL_TEST_LOG: log,
    }, project);
    expect(result.status).toBe('정상');
    expect(result.detail).toContain('프로젝트에 설치된 JuTell');
    expect(await readFile(log, 'utf8')).toBe(`${project}\n${project}\n`);
  });

  it('uses the user\'s $SHELL -lc instead of hard-coded bash', async () => {
    // /bin/sh -lc reads ~/.profile too, so jutell is found through the user's own shell.
    expect(await runDoctor(true, '/bin/sh')).toContain('Codex가 명령을 실행하는 셸에서 jutell을 찾았습니다.');
    // A shell that cannot run proves $SHELL is used (bash would have found it).
    expect(await runDoctor(true, '/nonexistent/shell')).toContain('jutell을 찾지 못했어요');
  });
});
