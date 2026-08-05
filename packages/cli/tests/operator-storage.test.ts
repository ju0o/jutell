import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(import.meta.dirname, '..');
const entry = path.join(packageRoot, 'dist', 'index.js');
const temporaryRoots: string[] = [];

const CONFIG_FILE = '.jutell-operator.local.json';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function todayStamp(now = new Date()) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-ostorage-'));
  temporaryRoots.push(root);
  const project = path.join(root, 'project');
  const home = path.join(root, 'home');
  await fs.mkdir(project, { recursive: true });
  await fs.mkdir(home, { recursive: true });
  return { root, project, home, env: { ...process.env, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex') } };
}

async function runCli(args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  try {
    const result = await execFileAsync(process.execPath, [entry, ...args], { cwd, env, windowsHide: true, maxBuffer: 1024 * 1024 });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    return { code: failure.code ?? 1, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' };
  }
}

function defaultSessionsDir(project: string) {
  return path.join(project, '.jutell-local', 'collaboration-sessions', todayStamp());
}

function configFile(project: string) {
  return path.join(project, CONFIG_FILE);
}

async function writeOperatorConfig(project: string, sessionStoragePath: string) {
  await fs.writeFile(configFile(project), `${JSON.stringify({ sessionStoragePath }, null, 2)}\n`, 'utf8');
}

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) await fs.rm(root, { recursive: true, force: true });
});

describe('OPERATOR SESSION STORAGE (운영자 저장 위치 설정)', () => {
  it('1. 설정 없으면 기본 사용자와 동일하게 .jutell-local에 저장하고 storage가 기본을 표시한다', async () => {
    const { project, env } = await fixture();
    const status = await runCli(['session', 'storage'], project, env);
    expect(status.code).toBe(0);
    expect(status.stdout).toContain('기본 저장');
    const result = await runCli(['session', 'new'], project, env);
    expect(result.code).toBe(0);
    await expect(fs.readFile(path.join(defaultSessionsDir(project), 'session.json'), 'utf8')).resolves.toContain(todayStamp());
  });

  it('2. storage set으로 지정한 경로에만 저장되고 공개 프로젝트 안에 Session 원본이 생기지 않는다', async () => {
    const { root, project, env } = await fixture();
    const custom = path.join(root, 'private-workspace');
    const setResult = await runCli(['session', 'storage', 'set', custom, '--yes'], project, env);
    expect(setResult.code).toBe(0);
    expect(setResult.stdout).toContain('운영자 Session 저장 위치를 설정했습니다');
    expect(setResult.stdout).not.toContain(custom);

    const status = await runCli(['session', 'storage'], project, env);
    expect(status.stdout).toContain('운영자 지정 저장');
    expect(status.stdout).not.toContain(custom);

    const created = await runCli(['session', 'new'], project, env);
    expect(created.code).toBe(0);
    await runCli(['session', 'page', '--agent', 'OpenCode', '--role', 'role', '--title', 'Page A'], project, env);

    const customDir = path.join(custom, todayStamp());
    expect(await fs.readdir(customDir)).toEqual(expect.arrayContaining(['session.json', 'page-01-opencode-page-a.md']));
    await expect(fs.access(path.join(project, '.jutell-local'))).rejects.toThrow();
  });

  it('3. 설정된 경로가 폴더가 아니면 안전하게 중단하고 절대 경로를 출력하지 않는다', async () => {
    const { root, project, env } = await fixture();
    const blocked = path.join(root, 'blocked-file.txt');
    await fs.writeFile(blocked, 'file', 'utf8');
    await writeOperatorConfig(project, blocked);

    const result = await runCli(['session', 'new'], project, env);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('운영자 Session 저장 위치를 사용할 수 없습니다');
    expect(result.stderr).not.toContain(blocked);
    await expect(fs.access(path.join(project, '.jutell-local'))).rejects.toThrow();
  });

  it('4. 상대 경로 설정은 중단하고 기본 위치로 조용히 대체하지 않는다', async () => {
    const { project, env } = await fixture();
    await writeOperatorConfig(project, 'relative-folder');
    const result = await runCli(['session', 'new'], project, env);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('운영자 Session 저장 위치를 사용할 수 없습니다');
    await expect(fs.access(path.join(project, '.jutell-local'))).rejects.toThrow();
  });

  it('5. JSON이 손상된 설정 파일은 중단하고 안내한다', async () => {
    const { project, env } = await fixture();
    await fs.writeFile(configFile(project), '{broken', 'utf8');
    const result = await runCli(['session', 'new'], project, env);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('운영자 Session 저장 위치를 사용할 수 없습니다');
    await expect(fs.access(path.join(project, '.jutell-local'))).rejects.toThrow();
  });

  it('6. reset은 설정만 제거하고 Session 기록은 지우지 않으며 기본 위치로 돌아간다', async () => {
    const { root, project, env } = await fixture();
    const custom = path.join(root, 'custom-workspace');
    await runCli(['session', 'storage', 'set', custom, '--yes'], project, env);
    await runCli(['session', 'new'], project, env);
    const keepFile = path.join(custom, todayStamp(), 'keep-me.md');
    await fs.writeFile(keepFile, '기록 유지', 'utf8');

    const reset = await runCli(['session', 'storage', 'reset', '--yes'], project, env);
    expect(reset.code).toBe(0);
    expect(reset.stdout).toContain('설정을 제거했습니다');
    await expect(fs.access(configFile(project))).rejects.toThrow();
    expect(await fs.readFile(keepFile, 'utf8')).toBe('기록 유지');

    const status = await runCli(['session', 'storage'], project, env);
    expect(status.stdout).toContain('기본 저장');
    const created = await runCli(['session', 'new'], project, env);
    expect(created.code).toBe(0);
    await expect(fs.readFile(path.join(defaultSessionsDir(project), 'session.json'), 'utf8')).resolves.toContain(todayStamp());
  });

  it('7. set은 확인 없이(비대화형, --yes 없이) 실행하면 안내하고 진행하지 않는다', async () => {
    const { root, project, env } = await fixture();
    const custom = path.join(root, 'no-confirm');
    const result = await runCli(['session', 'storage', 'set', custom], project, env);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('--yes');
    await expect(fs.access(configFile(project))).rejects.toThrow();
  });

  it('8. reset은 설정이 없으면 안내만 하고 종료한다', async () => {
    const { project, env } = await fixture();
    const result = await runCli(['session', 'storage', 'reset', '--yes'], project, env);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('설정된 운영자 Session 저장 위치가 없습니다');
  });

  it('9. 설정 파일은 .gitignore에 포함된다 (공개 Git 제외)', async () => {
    const repoRoot = path.resolve(packageRoot, '..', '..');
    const gitignore = await fs.readFile(path.join(repoRoot, '.gitignore'), 'utf8');
    expect(gitignore).toContain('.jutell-operator.local.json');
  });
});
