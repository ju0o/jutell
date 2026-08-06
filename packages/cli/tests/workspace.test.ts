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

const CONFIG_FILE = 'jutell.workspace.json';
const DIR_KEYS = ['public', 'private', 'session', 'review', 'archive', 'export', 'backup', 'operator'];

function validConfig() {
  return {
    version: 2,
    dirs: { public: 'public', private: 'private', session: 'session', review: 'review', archive: 'archive', export: 'export', backup: 'backup', operator: 'operator' },
    settings: { profile: 'balanced', features: {}, limits: {}, mcp: { enabled: false, autoStart: false } },
  };
}

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-workspace-'));
  temporaryRoots.push(root);
  return { root };
}

async function runCli(args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  const cleanEnv = { ...process.env, ...env };
  if (!env || env.JUTELL_WORKSPACE === undefined) delete cleanEnv.JUTELL_WORKSPACE;
  try {
    const result = await execFileAsync(process.execPath, [entry, ...args], { cwd, env: cleanEnv, windowsHide: true, maxBuffer: 1024 * 1024 });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    return { code: failure.code ?? 1, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' };
  }
}

async function writeConfig(root: string, config: unknown) {
  await fs.writeFile(path.join(root, CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) await fs.rm(root, { recursive: true, force: true });
});

describe('WORKSPACE FOUNDATION', () => {
  it('1. 빈 폴더에 init으로 8개 폴더와 설정 파일을 만든다', async () => {
    const { root } = await fixture();
    const result = await runCli(['workspace', 'init', '--yes', '--workspace', root], root, {});
    expect(result.code).toBe(0);
    for (const dir of DIR_KEYS) {
      expect(await fs.stat(path.join(root, dir))).toBeTruthy();
    }
    await expect(fs.access(path.join(root, CONFIG_FILE))).resolves.toBeUndefined();
    expect(JSON.parse(await fs.readFile(path.join(root, CONFIG_FILE), 'utf8')).version).toBe(2);
  });

  it('2. 기존 파일·폴더가 있는 폴더에도 init을 하면 보존하고 덮어쓰지 않는다', async () => {
    const { root } = await fixture();
    await fs.mkdir(path.join(root, 'public'), { recursive: true });
    const existing = path.join(root, 'public', 'keep.txt');
    await fs.writeFile(existing, '원본', 'utf8');
    const result = await runCli(['workspace', 'init', '--yes', '--workspace', root], root, {});
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('유지: public');
    expect(await fs.readFile(existing, 'utf8')).toBe('원본');
  });

  it('3. 이미 설정이 있으면 덮어쓰지 않고 중단한다', async () => {
    const { root } = await fixture();
    await writeConfig(root, validConfig());
    const result = await runCli(['workspace', 'init', '--yes', '--workspace', root], root, {});
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('덮어쓰지 않습니다');
  });

  it('4. init은 확인 없이(비대화형, --yes 없이) 안내하고 진행하지 않는다', async () => {
    const { root } = await fixture();
    const result = await runCli(['workspace', 'init', '--workspace', root], root, {});
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('취소했습니다');
    await expect(fs.access(path.join(root, CONFIG_FILE))).rejects.toThrow();
  });

  it('5. config가 없으면 Project Mode로 안내한다', async () => {
    const { root } = await fixture();
    const status = await runCli(['workspace', 'status'], root, {});
    expect(status.code).toBe(0);
    expect(status.stdout).toContain('모드: Project');
    const doctor = await runCli(['workspace', 'doctor'], root, {});
    expect(doctor.code).toBe(0);
    expect(doctor.stdout).toContain('Project Mode');
  });

  it('6. 손상 JSON은 fallback하지 않고 오류로 중단한다', async () => {
    const { root } = await fixture();
    await fs.writeFile(path.join(root, CONFIG_FILE), '{broken', 'utf8');
    const result = await runCli(['workspace', 'doctor'], root, {});
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('설정');
  });

  it('7. 미지의 상위 필드를 거부하고 doctor 재실행을 안내한다', async () => {
    const { root } = await fixture();
    const bad = { ...validConfig(), extra: true } as unknown;
    await writeConfig(root, bad);
    const result = await runCli(['workspace', 'status'], root, {});
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('정의되지 않은 항목');
  });

  it('8. settings 안 미지 필드(오타)를 거부하고 후보를 제안한다', async () => {
    const { root } = await fixture();
    const cfg = validConfig();
    (cfg.settings as Record<string, unknown>).profille = 'balanced';
    await writeConfig(root, cfg);
    const result = await runCli(['workspace', 'status'], root, {});
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('profile');
  });

  it('9. 절대 경로 dirs 값을 거부한다', async () => {
    const { root } = await fixture();
    const cfg = validConfig();
    cfg.dirs.public = 'C:\\Users\\someone\\public';
    await writeConfig(root, cfg);
    const result = await runCli(['workspace', 'status'], root, {});
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('절대 경로');
  });

  it('10. .. 탈출 경로를 거부한다', async () => {
    const { root } = await fixture();
    const cfg = validConfig();
    cfg.dirs.public = '..\\outside';
    await writeConfig(root, cfg);
    const result = await runCli(['workspace', 'status'], root, {});
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('거부');
  });

  it('11. 중복 dirs 값을 거부한다', async () => {
    const { root } = await fixture();
    const cfg = validConfig();
    cfg.dirs.private = cfg.dirs.public;
    await writeConfig(root, cfg);
    const result = await runCli(['workspace', 'status'], root, {});
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('중복');
  });

  it('12. 지원하지 않는 version을 거부한다', async () => {
    const { root } = await fixture();
    const cfg = { ...validConfig(), version: 1 };
    await writeConfig(root, cfg);
    const result = await runCli(['workspace', 'status'], root, {});
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('version');
  });

  it('13. 필수 8키 중 일부가 빠지면 중단한다', async () => {
    const { root } = await fixture();
    const cfg = validConfig();
    delete (cfg.dirs as Record<string, string>).backup;
    await writeConfig(root, cfg);
    const result = await runCli(['workspace', 'status'], root, {});
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('필수 폴더 항목');
  });

  it('14. JUTELL_WORKSPACE 환경변수로 Workspace를 찾는다', async () => {
    const { root } = await fixture();
    await runCli(['workspace', 'init', '--yes', '--workspace', root], root, {});
    const status = await runCli(['workspace', 'status'], path.dirname(root), { JUTELL_WORKSPACE: root });
    expect(status.code).toBe(0);
    expect(status.stdout).toContain('모드: Workspace');
  });

  it('15. cwd 상위 탐색으로 Workspace를 찾는다', async () => {
    const { root } = await fixture();
    await runCli(['workspace', 'init', '--yes', '--workspace', root], root, {});
    const subdir = path.join(root, 'public', 'sub');
    await fs.mkdir(subdir, { recursive: true });
    const status = await runCli(['workspace', 'status'], subdir, {});
    expect(status.code).toBe(0);
    expect(status.stdout).toContain('모드: Workspace');
  });

  it('16. --workspace와 env가 동시에 있으면 --workspace를 우선한다', async () => {
    const { root } = await fixture();
    const other = await fs.mkdtemp(path.join(root, 'ws-should-not'));
    temporaryRoots.push(other);
    await runCli(['workspace', 'init', '--yes', '--workspace', root], root, {});
    await runCli(['workspace', 'init', '--yes', '--workspace', other], other, {});
    const status = await runCli(['workspace', 'status', '--workspace', other], root, { JUTELL_WORKSPACE: root });
    expect(status.code).toBe(0);
    expect(status.stdout).toContain('모드: Workspace');
  });

  it('17. status --json은 root만 절대경로, dirs는 상대경로로 반환한다', async () => {
    const { root } = await fixture();
    await runCli(['workspace', 'init', '--yes', '--workspace', root], root, {});
    const status = await runCli(['workspace', 'status', '--json', '--workspace', root], root, {});
    expect(status.code).toBe(0);
    const json = JSON.parse(status.stdout) as { workspace: { root: string; version: number }; dirs: Record<string, string> };
    expect(path.isAbsolute(json.workspace.root)).toBe(true);
    expect(json.workspace.version).toBe(2);
    for (const [key, value] of Object.entries(json.dirs)) {
      expect(path.isAbsolute(value)).toBe(false);
      expect(DIR_KEYS).toContain(key);
    }
  });

  it('18. Workspace Root에 .git이 있으면 doctor가 주의로 표시한다', async () => {
    const { root } = await fixture();
    await runCli(['workspace', 'init', '--yes', '--workspace', root], root, {});
    await fs.mkdir(path.join(root, '.git'), { recursive: true });
    const doctor = await runCli(['workspace', 'doctor', '--workspace', root], root, {});
    expect(doctor.code).toBe(0);
    expect(doctor.stdout).toContain('주의');
    expect(doctor.stdout).toContain('Root가 Git');
  });

  it('19. doctor --fix는 없는 폴더만 만들고 config를 바꾸지 않는다', async () => {
    const { root } = await fixture();
    const cfg = validConfig();
    await writeConfig(root, cfg);
    await fs.rm(path.join(root, 'backup'), { recursive: true, force: true });
    const before = await fs.readFile(path.join(root, CONFIG_FILE), 'utf8');
    const doctor = await runCli(['workspace', 'doctor', '--fix', '--yes', '--workspace', root], root, {});
    expect(doctor.code).toBe(0);
    await expect(fs.stat(path.join(root, 'backup'))).toBeTruthy();
    expect(await fs.readFile(path.join(root, CONFIG_FILE), 'utf8')).toBe(before);
  });

  it('20. doctor --fix는 누락된 폴더를 만들고 config 내용은 그대로 둔다 (미지 필드 수정 금지)', async () => {
    const { root } = await fixture();
    const cfg = validConfig();
    await writeConfig(root, cfg);
    await fs.rm(path.join(root, 'backup'), { recursive: true, force: true });
    await fs.rm(path.join(root, 'operator'), { recursive: true, force: true });
    const before = await fs.readFile(path.join(root, CONFIG_FILE), 'utf8');
    const doctor = await runCli(['workspace', 'doctor', '--fix', '--yes', '--workspace', root], root, {});
    expect(doctor.code).toBe(0);
    await expect(fs.stat(path.join(root, 'backup'))).toBeTruthy();
    await expect(fs.stat(path.join(root, 'operator'))).toBeTruthy();
    expect(await fs.readFile(path.join(root, CONFIG_FILE), 'utf8')).toBe(before);
  });

  it('21. 한글·공백이 포함된 경로에서도 동작한다', async () => {
    const root = path.join(os.tmpdir(), 'ju tell workspace 테스트');
    await fs.mkdir(root, { recursive: true });
    temporaryRoots.push(root);
    const result = await runCli(['workspace', 'init', '--yes', '--workspace', root], root, {});
    expect(result.code).toBe(0);
    const status = await runCli(['workspace', 'status', '--workspace', root], root, {});
    expect(status.stdout).toContain('모드: Workspace');
  });
});