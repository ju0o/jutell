import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const roots: string[] = [];
let lastStatus: number | null = null;
afterAll(async () => { await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))); });

async function runDoctor(withJutellOnLoginPath: boolean, shell?: string) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jutell-doctor-login-'));
  roots.push(root);
  const home = path.join(root, 'home');
  const project = path.join(root, 'project');
  const bin = path.join(root, 'bin');
  const npmBin = path.join(root, 'npm-bin');
  await Promise.all([home, project, bin, npmBin].map((dir) => mkdir(dir, { recursive: true })));
  // A fake npm whose global prefix is known, so the PATH line doctor prints can be checked exactly.
  await writeFile(path.join(npmBin, 'npm'), `#!/bin/sh\necho ${path.join(root, 'npm-global')}\n`, 'utf8');
  await chmod(path.join(npmBin, 'npm'), 0o755);
  if (withJutellOnLoginPath) {
    await writeFile(path.join(bin, 'jutell'), '#!/bin/sh\nexit 0\n', 'utf8');
    await chmod(path.join(bin, 'jutell'), 0o755);
    await writeFile(path.join(home, '.profile'), `export PATH=${bin}:$PATH\n`, 'utf8');
  }
  const result = spawnSync(process.execPath, [cliEntry, 'doctor'], {
    cwd: project,
    env: { HOME: home, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: home, PATH: `${npmBin}:/usr/bin:/bin`, NO_COLOR: '1', ...(shell ? { SHELL: shell } : {}) },
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

  it('points zsh users at ~/.zprofile', async () => {
    const { output } = await runDoctorFull('/nonexistent/zsh');
    expect(output).toContain('~/.zprofile 파일 맨 아래에 이 한 줄을 넣고');
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
