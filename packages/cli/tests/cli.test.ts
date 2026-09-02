import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(import.meta.dirname, '..');
const entry = path.join(packageRoot, 'dist', 'index.js');
const temporaryRoots: string[] = [];

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'beginner-bridge-cli-'));
  temporaryRoots.push(root);
  const project = path.join(root, 'project');
  const home = path.join(root, 'home');
  await fs.mkdir(project, { recursive: true });
  await fs.mkdir(home, { recursive: true });
  return { root, project, home, env: { ...process.env, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: home } };
}

async function runCli(args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  return execFileAsync(process.execPath, [entry, ...args], { cwd, env, windowsHide: true, maxBuffer: 1024 * 1024 });
}

async function runNpm(args: string[], cwd: string) {
  return execFileAsync(npmCommand, args, { cwd, shell: true, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
}

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) await fs.rm(root, { recursive: true, force: true });
});

describe('Distribution CLI V0.1', () => {
  it('처음 jutell 한 번으로 기본 연결과 대시보드를 준비한다', async () => {
    const { project, home, env } = await fixture();
    const child = spawn(process.execPath, [entry, '--yes', '--no-open'], { cwd: project, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let output = '';
    const url = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('기본 jutell 대시보드 시작 시간 초과')), 10000);
      child.stdout.on('data', (chunk) => {
        output += chunk.toString();
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) { clearTimeout(timer); resolve(match[0]); }
      });
      child.once('error', reject);
    });
    try {
      expect(output).toContain('JuTell 준비 완료');
      expect(output).toContain('✓ 설정 연결됨');
      expect(output).toContain('✓ Skill 연결됨');
      expect(output).toContain('✓ AI Agent 연결 준비 완료');
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      const config = JSON.parse(await fs.readFile(path.join(project, '.jutell.json'), 'utf8'));
      expect(config.profile).toBe('balanced');
      expect(config.mcp.enabled).toBe(true);
      expect(await fs.readFile(path.join(project, 'AGENTS.md'), 'utf8')).toContain('BEGIN JUTELL MANAGED BLOCK');
      expect(await fs.stat(path.join(project, '.agents', 'skills', 'beginner-bridge', 'SKILL.md'))).toBeTruthy();
      // Codex MCP registration always lands in the global Codex config
      // (see codexScopedPaths), never in the project — Codex itself never
      // reads a project-scoped .codex/config.toml.
      expect(await fs.readFile(path.join(home, '.codex', 'config.toml'), 'utf8')).toContain('enabled = true');
      await expect(fs.stat(path.join(project, '.codex', 'config.toml'))).rejects.toThrow();
    } finally {
      child.kill();
      await new Promise<void>((resolve) => child.once('exit', () => resolve()));
    }

    const statusOnly = await runCli(['--status-only'], project, env);
      expect(statusOnly.stdout).toContain('JuTell 연결 정책: 켜짐');
      expect(statusOnly.stdout).toContain('Codex MCP (전역, Codex는 프로젝트 설정을 읽지 않음): 활성화됨');
    expect(statusOnly.stdout).toContain('MCP 서버 응답: 확인하지 않음');
    expect((await fs.readFile(path.join(project, 'AGENTS.md'), 'utf8')).match(/BEGIN JUTELL MANAGED BLOCK/g)).toHaveLength(1);
    expect((await fs.readFile(path.join(home, '.codex', 'config.toml'), 'utf8')).match(/JUTELL_CLI_MCP_BEGIN/g)).toHaveLength(1);
  });

  it('on과 off가 연결만 바꾸고 설정과 Beta Journal을 보존한다', async () => {
    const { project, env } = await fixture();
    await fs.writeFile(path.join(project, 'AGENTS.md'), '# 사용자 규칙\n', 'utf8');
    await runCli(['setup', '--project', '--yes'], project, env);
    const dataRoot = path.join(project, '.jutell-local');
    await fs.mkdir(dataRoot, { recursive: true });
    const journal = path.join(dataRoot, 'beta-feedback.json');
    await fs.writeFile(journal, '[{"status":"noted"}]\n', 'utf8');

    await runCli(['on', '--yes'], project, env);
    expect(JSON.parse(await fs.readFile(path.join(project, '.jutell.json'), 'utf8')).mcp.enabled).toBe(true);
    expect(await fs.stat(path.join(project, '.agents', 'skills', 'beginner-bridge', 'SKILL.md'))).toBeTruthy();
    expect(await fs.readFile(path.join(project, 'AGENTS.md'), 'utf8')).toContain('BEGIN JUTELL MANAGED BLOCK');

    await runCli(['off', '--yes'], project, env);
    expect(JSON.parse(await fs.readFile(path.join(project, '.jutell.json'), 'utf8')).mcp.enabled).toBe(false);
    expect(await fs.readFile(journal, 'utf8')).toBe('[{"status":"noted"}]\n');
    await expect(fs.stat(path.join(project, '.agents', 'skills', 'beginner-bridge', 'SKILL.md'))).rejects.toThrow();
    expect(await fs.readFile(path.join(project, 'AGENTS.md'), 'utf8')).toBe('# 사용자 규칙\n');

    await runCli(['on', '--yes'], project, env);
    expect(JSON.parse(await fs.readFile(path.join(project, '.jutell.json'), 'utf8')).mcp.enabled).toBe(true);
    expect(await fs.stat(path.join(project, '.agents', 'skills', 'beginner-bridge', 'SKILL.md'))).toBeTruthy();
  });

  it('설치·반복 설치·상태·활성화·비활성화·제거를 안전하게 처리한다', async () => {
    const { project, home, env } = await fixture();
    // Codex MCP registration always lands in the global Codex config (see
    // codexScopedPaths) regardless of --project/--global, so the seeded
    // "unrelated" entry and every codex-related assertion below target the
    // global file, not the project.
    const codexConfig = path.join(home, '.codex', 'config.toml');
    await fs.mkdir(path.dirname(codexConfig), { recursive: true });
    await fs.writeFile(codexConfig, '[mcp_servers.other]\ncommand = "other"\n', 'utf8');

    const first = await runCli(['setup', '--project', '--profile', 'learning', '--yes'], project, env);
    expect(first.stdout).toContain('설치가 완료되었습니다');
    const configFile = path.join(project, '.jutell.json');
    const skillFile = path.join(project, '.agents', 'skills', 'beginner-bridge', 'SKILL.md');
    expect(await fs.stat(skillFile)).toBeTruthy();
    expect(JSON.parse(await fs.readFile(configFile, 'utf8')).profile).toBe('learning');
    const firstCodex = await fs.readFile(codexConfig, 'utf8');
    expect(firstCodex).toContain('[mcp_servers.other]');
    expect(firstCodex.match(/JUTELL_CLI_MCP_BEGIN/g)).toHaveLength(1);
    await expect(fs.stat(path.join(project, '.codex', 'config.toml'))).rejects.toThrow();

    await runCli(['setup', '--project', '--profile', 'learning', '--yes'], project, env);
    const repeatedCodex = await fs.readFile(codexConfig, 'utf8');
    expect(repeatedCodex.match(/JUTELL_CLI_MCP_BEGIN/g)).toHaveLength(1);
    expect(repeatedCodex.match(/\[mcp_servers\.other\]/g)).toHaveLength(1);

    const status = JSON.parse((await runCli(['status', '--json'], project, env)).stdout);
    expect(status.skillInstalled).toBe(true);
    expect(status.mcpRegistered).toBe(true);
    expect(status.mcpEnabled).toBe(false);
    expect(status.profile).toBe('learning');
    const doctor = JSON.parse((await runCli(['doctor', '--json'], project, env)).stdout) as Array<{ name: string; status: string }>;
    expect(doctor.find((check) => check.name === 'Skill 파일')?.status).toBe('정상');
    expect(doctor.find((check) => check.name === 'MCP 빌드 파일')?.status).toBe('정상');
    expect(doctor.find((check) => check.name === 'OpenCode MCP')?.status).toBe('주의');
    expect(doctor.find((check) => check.name === 'MCP 서버 실제 연결 (Stdio)')?.status).toBe('정상');

    // "enable" is a connect-intent command: it always reaches the real
    // (global) Codex file, same as `use`/`connect`, or it wouldn't work.
    await runCli(['enable', '--mcp-only', '--yes'], project, env);
    expect(JSON.parse(await fs.readFile(configFile, 'utf8')).mcp.enabled).toBe(true);
    expect(await fs.readFile(codexConfig, 'utf8')).toContain('enabled = true');
    // "disable" in project scope (no --global) must NOT reach into that
    // shared global entry - other projects on this machine may still rely
    // on it. Only .jutell.json's own connection policy flips.
    const disabled = await runCli(['disable', '--mcp', '--yes'], project, env);
    expect(JSON.parse(await fs.readFile(configFile, 'utf8')).mcp.enabled).toBe(false);
    expect(await fs.readFile(codexConfig, 'utf8')).toContain('enabled = true');
    expect(disabled.stdout).toContain('다른 프로젝트와 공유되어 그대로 두었습니다');

    await runCli(['disable', '--skill', '--yes'], project, env);
    await expect(fs.stat(skillFile)).rejects.toThrow();
    await runCli(['enable', '--skill-only', '--yes'], project, env);
    expect(await fs.stat(skillFile)).toBeTruthy();

    // Likewise, a project-scoped uninstall must not remove the shared
    // global Codex registration or the unrelated entry beside it.
    const uninstalled = await runCli(['uninstall', '--keep-data', '--yes'], project, env);
    expect(await fs.stat(configFile)).toBeTruthy();
    await expect(fs.stat(skillFile)).rejects.toThrow();
    const afterUninstall = await fs.readFile(codexConfig, 'utf8');
    expect(afterUninstall).toContain('[mcp_servers.other]');
    expect(afterUninstall).toContain('[mcp_servers.jutell]');
    expect(uninstalled.stdout).toContain('다른 프로젝트와 공유되어 제거하지 않았습니다');
  }, 20000);

  it('uninstall --global은 공유되는 전역 Codex MCP 등록을 실제로 제거한다', async () => {
    const { project, home, env } = await fixture();
    await runCli(['use', 'codex'], project, env);
    const codexConfig = path.join(home, '.codex', 'config.toml');
    expect(await fs.readFile(codexConfig, 'utf8')).toContain('[mcp_servers.jutell]');

    const uninstalled = await runCli(['uninstall', '--global', '--keep-data', '--yes'], project, env);
    expect(uninstalled.stdout).not.toContain('다른 프로젝트와 공유되어 제거하지 않았습니다');
    expect(await fs.readFile(codexConfig, 'utf8')).not.toContain('[mcp_servers.jutell]');
  });

  it('global 범위도 격리된 사용자 홈에서 동작한다', async () => {
    const { project, home, env } = await fixture();
    await runCli(['setup', '--global', '--yes'], project, env);
    expect(await fs.stat(path.join(home, '.agents', 'skills', 'beginner-bridge', 'SKILL.md'))).toBeTruthy();
    expect(JSON.parse(await fs.readFile(path.join(home, '.jutell.json'), 'utf8')).mcp.enabled).toBe(false);
    expect((await fs.readFile(path.join(home, '.codex', 'config.toml'), 'utf8'))).toContain('[mcp_servers.jutell]');
  });

  it('provider list와 provider status가 Provider를 구분해 보여준다', async () => {
    const { project, env } = await fixture();
    const list = await runCli(['provider', 'list'], project, env);
    expect(list.stdout).toContain('Codex');
    expect(list.stdout).toContain('OpenCode');
    const status = await runCli(['provider', 'status'], project, env);
    expect(status.stdout).toContain('Codex (현재 지원)');
    expect(status.stdout).toContain('OpenCode (베타)');
    expect(status.stdout).toContain('MCP 등록: 등록되지 않음');
  });

  it('provider setup opencode가 기존 설정을 보존하고 반복 설치를 방지한다', async () => {
    const { project, env } = await fixture();
    const opencodeFile = path.join(project, 'opencode.json');
    await fs.writeFile(opencodeFile, JSON.stringify({ model: 'deepseek/deepseek-chat', mcp: { jira: { type: 'remote', url: 'https://example.com/mcp' } } }, null, 2), 'utf8');

    await runCli(['provider', 'setup', 'opencode', '--yes'], project, env);
    const first = await fs.readFile(opencodeFile, 'utf8');
    expect(first).toContain('BEGIN JUTELL MANAGED BLOCK');
    expect(first).toContain('"jutell"');
    expect(first).not.toContain('"beginner_bridge"');
    expect(first).toContain('"jira"');
    expect(first).toContain('"deepseek/deepseek-chat"');
    expect(first.match(/BEGIN JUTELL MANAGED BLOCK/g)).toHaveLength(1);

    await runCli(['provider', 'setup', 'opencode', '--yes'], project, env);
    const repeated = await fs.readFile(opencodeFile, 'utf8');
    expect(repeated.match(/BEGIN JUTELL MANAGED BLOCK/g)).toHaveLength(1);
    expect(repeated.match(/"jutell"/g)).toHaveLength(1);
    expect(repeated).toContain('"jira"');
    expect(await fs.readFile(`${opencodeFile}.previous`, 'utf8')).toContain('"deepseek/deepseek-chat"');
  });

  it('provider enable과 disable이 OpenCode 항목의 enabled만 바꾼다', async () => {
    const { project, env } = await fixture();
    await runCli(['provider', 'setup', 'opencode', '--yes'], project, env);
    let text = await fs.readFile(path.join(project, 'opencode.json'), 'utf8');
    expect(text).toContain('"enabled": false');

    await runCli(['provider', 'enable', 'opencode'], project, env);
    text = await fs.readFile(path.join(project, 'opencode.json'), 'utf8');
    expect(text).toContain('"enabled": true');
    expect(text).toContain('"type": "local"');
    expect(text).toContain('"cwd": "."');
    expect(JSON.parse(await fs.readFile(path.join(project, '.jutell.json'), 'utf8')).mcp.enabled).toBe(true);

    await runCli(['provider', 'disable', 'opencode'], project, env);
    text = await fs.readFile(path.join(project, 'opencode.json'), 'utf8');
    expect(text).toContain('"enabled": false');
    expect(text).toContain('BEGIN JUTELL MANAGED BLOCK');
    expect(JSON.parse(await fs.readFile(path.join(project, '.jutell.json'), 'utf8')).mcp.enabled).toBe(false);
  });

  it('관리되지 않는 beginner_bridge 항목은 자동 변경하지 않는다', async () => {
    const { project, env } = await fixture();
    const opencodeFile = path.join(project, 'opencode.json');
    await fs.writeFile(opencodeFile, JSON.stringify({ mcp: { beginner_bridge: { type: 'remote', url: 'https://example.com/mcp' } } }, null, 2), 'utf8');
    const before = await fs.readFile(opencodeFile, 'utf8');
    let failure: { stdout?: string; stderr?: string } | undefined;
    try {
      await runCli(['provider', 'setup', 'opencode', '--yes'], project, env);
    } catch (error) {
      failure = error as { stdout?: string; stderr?: string };
    }
    expect(failure?.stderr).toContain('관리되지 않는 MCP 항목');
    expect(await fs.readFile(opencodeFile, 'utf8')).toBe(before);
    const status = JSON.parse((await runCli(['status', '--json'], project, env)).stdout);
    expect(status.opencode.conflict).toBe(true);
  });

  it('uninstall이 OpenCode JuTell 관리 블록만 제거하고 기존 설정은 보존한다', async () => {
    const { project, env } = await fixture();
    const opencodeFile = path.join(project, 'opencode.json');
    await fs.writeFile(opencodeFile, JSON.stringify({ model: 'deepseek/deepseek-chat' }, null, 2), 'utf8');
    await runCli(['provider', 'setup', 'opencode', '--yes'], project, env);
    await runCli(['uninstall', '--keep-data', '--yes'], project, env);
    const after = await fs.readFile(opencodeFile, 'utf8');
    expect(after).not.toContain('BEGIN JUTELL MANAGED BLOCK');
    expect(after).not.toContain('"jutell"');
    expect(after).toContain('deepseek-chat');
  });

  it('jutell use opencode가 연결·활성화·Skill·AGENTS.md를 한 번에 준비하고 반복 실행을 방지한다', async () => {
    const { project, env } = await fixture();
    const opencodeFile = path.join(project, 'opencode.json');
    await fs.writeFile(opencodeFile, JSON.stringify({ model: 'deepseek/deepseek-chat', mcp: { jira: { type: 'remote', url: 'https://example.com/mcp' } } }, null, 2), 'utf8');

    const first = await runCli(['use', 'opencode'], project, env);
    expect(first.stdout).toContain('OpenCode 연결이 끝났습니다');
    expect(first.stdout).toContain('새 대화를 열면');
    expect(first.stdout).toContain('JuTell이 자동으로 적용됩니다');
    expect(first.stdout).toContain('AI 연결 설정');
    expect(first.stdout).toContain('JuTell 규칙 연결');
    expect(first.stdout).toContain('기존 OpenCode 설정 보존');
    expect(first.stdout).toContain('실제 적용 여부는 새 대화에서 확인할 수 있습니다');
    const text = await fs.readFile(opencodeFile, 'utf8');
    expect(text.match(/BEGIN JUTELL MANAGED BLOCK/g)).toHaveLength(1);
    expect(text).toContain('"enabled": true');
    expect(text).toContain('"jira"');
    expect(text).toContain('"deepseek/deepseek-chat"');
    expect(JSON.parse(await fs.readFile(path.join(project, '.jutell.json'), 'utf8')).mcp.enabled).toBe(true);
    expect(await fs.stat(path.join(project, '.agents', 'skills', 'beginner-bridge', 'SKILL.md'))).toBeTruthy();
    expect(await fs.readFile(path.join(project, 'AGENTS.md'), 'utf8')).toContain('BEGIN JUTELL MANAGED BLOCK');

    const repeated = await runCli(['use', 'opencode'], project, env);
    expect(repeated.stdout).toContain('OpenCode 연결이 끝났습니다');
    expect((await fs.readFile(opencodeFile, 'utf8')).match(/BEGIN JUTELL MANAGED BLOCK/g)).toHaveLength(1);
    expect((await fs.readFile(opencodeFile, 'utf8')).match(/"jutell"/g)).toHaveLength(1);
  });

  it('jutell use codex가 Codex 연결을 켜고 기존 OpenCode 연결을 유지한다', async () => {
    const { project, home, env } = await fixture();
    await runCli(['use', 'opencode'], project, env);
    const useCodex = await runCli(['use', 'codex'], project, env);
    expect(useCodex.stdout).toContain('Codex 연결이 끝났습니다');
    expect(useCodex.stdout).toContain('기존 다른 Agent 연결은 유지했습니다.');
    expect(useCodex.stdout).toContain('Codex는 MCP 서버 목록을 사용자 전역 설정에서만 읽습니다');
    const codexText = await fs.readFile(path.join(home, '.codex', 'config.toml'), 'utf8');
    expect(codexText).toContain('[mcp_servers.jutell]');
    expect(codexText).toContain('enabled = true');
    await expect(fs.stat(path.join(project, '.codex', 'config.toml'))).rejects.toThrow();
    expect(await fs.readFile(path.join(project, 'opencode.json'), 'utf8')).toContain('"enabled": true');

    const summary = await runCli(['provider'], project, env);
    expect(summary.stdout).toMatch(/Codex\s+연결됨 · 활성/);
    expect(summary.stdout).toMatch(/OpenCode\s+연결됨 · 활성/);
    expect(summary.stdout).toContain('현재 권장 Agent: Codex, OpenCode');
    expect(summary.stdout).toContain('JuTell 자동 적용: 켜짐');
  });

  it('jutell on이 등록된 OpenCode 자동 시작을 켜진 상태로 복원한다', async () => {
    const { project, env } = await fixture();
    await runCli(['use', 'opencode'], project, env);
    await runCli(['off', '--yes'], project, env);
    expect(await fs.readFile(path.join(project, 'opencode.json'), 'utf8')).toContain('"enabled": false');
    await runCli(['on', '--yes'], project, env);
    expect(await fs.readFile(path.join(project, 'opencode.json'), 'utf8')).toContain('"enabled": true');
    expect(JSON.parse(await fs.readFile(path.join(project, '.jutell.json'), 'utf8')).mcp.enabled).toBe(true);
  });

  it('jutell connect와 disconnect가 해당 Provider만 바꾼다', async () => {
    const { project, home, env } = await fixture();
    await runCli(['use', 'codex'], project, env);
    await runCli(['connect', 'opencode'], project, env);
    expect(await fs.readFile(path.join(project, 'opencode.json'), 'utf8')).toContain('"enabled": true');
    expect(await fs.readFile(path.join(home, '.codex', 'config.toml'), 'utf8')).toContain('enabled = true');

    await runCli(['disconnect', 'opencode'], project, env);
    expect(await fs.readFile(path.join(project, 'opencode.json'), 'utf8')).toContain('"enabled": false');
    expect(await fs.readFile(path.join(home, '.codex', 'config.toml'), 'utf8')).toContain('enabled = true');
    expect(JSON.parse(await fs.readFile(path.join(project, '.jutell.json'), 'utf8')).mcp.enabled).toBe(true);
  });

  it('jutell disconnect codex는 --project로 실행해도 공유되는 전역 Codex 등록을 실제로 끊는다', async () => {
    const { project, home, env } = await fixture();
    await runCli(['use', 'codex'], project, env);
    const codexConfig = path.join(home, '.codex', 'config.toml');
    expect(await fs.readFile(codexConfig, 'utf8')).toContain('enabled = true');

    // disconnect (unlike disable/uninstall) is a dedicated, single-provider
    // connection command - like `use`, it always targets the real (global)
    // Codex file, or it would silently do nothing.
    const disconnected = await runCli(['disconnect', 'codex'], project, env);
    expect(disconnected.stdout).toContain('Codex 연결을 끊었습니다');
    const after = await fs.readFile(codexConfig, 'utf8');
    expect(after).toContain('[mcp_servers.jutell]');
    expect(after).toContain('enabled = false');
  });

  it('use codex 실패 시 이미 등록한 전역 Codex MCP도 롤백된다', async () => {
    const { project, home, env } = await fixture();
    const codexFile = path.join(home, '.codex', 'config.toml');
    await fs.mkdir(path.dirname(codexFile), { recursive: true });
    const before = '[mcp_servers.other]\ncommand = "other"\n';
    await fs.writeFile(codexFile, before, 'utf8');
    // Force a failure *after* the Codex MCP registration write by blocking
    // the skill-manifest directory `use codex` writes to right afterwards
    // (see registerProviderEnabled -> recordSkillFiles in commands/use.ts).
    await fs.writeFile(path.join(project, '.jutell-local'), 'blocked', 'utf8');

    let failure: { stderr?: string } | undefined;
    try {
      await runCli(['use', 'codex'], project, env);
    } catch (error) {
      failure = error as { stderr?: string };
    }
    expect(failure).toBeTruthy();
    // The global Codex file must be restored to exactly its pre-run state -
    // the unrelated entry preserved and no half-applied jutell block left behind.
    expect(await fs.readFile(codexFile, 'utf8')).toBe(before);
  });

  it('jutell switch opencode가 Codex를 비활성화하고 OpenCode만 활성화한다', async () => {
    const { project, home, env } = await fixture();
    await runCli(['use', 'codex'], project, env);
    const switched = await runCli(['switch', 'opencode'], project, env);
    expect(switched.stdout).toContain('다른 Agent의 JuTell 연결은 비활성화했습니다.');
    expect(await fs.readFile(path.join(home, '.codex', 'config.toml'), 'utf8')).toContain('enabled = false');
    expect(await fs.readFile(path.join(project, 'opencode.json'), 'utf8')).toContain('"enabled": true');
    const summary = await runCli(['provider'], project, env);
    expect(summary.stdout).toMatch(/Codex\s+연결됨 · 비활성/);
    expect(summary.stdout).toMatch(/OpenCode\s+연결됨 · 활성/);
  });

  it('여전히 준비 중인 Agent(Cline)는 안내만 출력하고 설정 파일을 만들지 않는다', async () => {
    const { project, env } = await fixture();
    const cline = await runCli(['use', 'cline'], project, env);
    expect(cline.stdout).toContain('Cline 연결은 아직 준비 중입니다.');
    await expect(fs.stat(path.join(project, 'opencode.json'))).rejects.toThrow();
    const summary = await runCli(['provider'], project, env);
    expect(summary.stdout).toMatch(/Cline\s+준비 중/);
  });

  it('관리되지 않는 OpenCode 항목이 있으면 use가 실패하고 아무것도 바꾸지 않는다', async () => {
    const { project, env } = await fixture();
    const opencodeFile = path.join(project, 'opencode.json');
    await fs.writeFile(opencodeFile, JSON.stringify({ mcp: { beginner_bridge: { type: 'remote', url: 'https://example.com/mcp' } } }, null, 2), 'utf8');
    const before = await fs.readFile(opencodeFile, 'utf8');
    let failure: { stderr?: string } | undefined;
    try {
      await runCli(['use', 'opencode'], project, env);
    } catch (error) {
      failure = error as { stderr?: string };
    }
    expect(failure?.stderr).toContain('관리되지 않는 MCP 항목');
    expect(await fs.readFile(opencodeFile, 'utf8')).toBe(before);
  });

  it('연결 정책과 Provider 자동 시작이 불일치하면 status가 경고한다', async () => {
    const { project, env } = await fixture();
    await runCli(['provider', 'setup', 'opencode', '--yes'], project, env);
    await runCli(['provider', 'enable', 'opencode'], project, env);
    await fs.writeFile(path.join(project, '.jutell.json'), JSON.stringify({ version: 1, profile: 'balanced', mcp: { enabled: false } }, null, 2), 'utf8');
    const drift = JSON.parse((await runCli(['status', '--json'], project, env)).stdout);
    expect(drift.opencode.enabled).toBe(true);
    expect(drift.warnings).toEqual(expect.arrayContaining([expect.stringContaining('Provider 자동 시작')]));
    const summary = await runCli(['provider'], project, env);
    expect(summary.stdout).toContain('연결 정책은 꺼져 있지만 Provider 자동 시작');
    await runCli(['provider', 'disable', 'opencode'], project, env);
    await fs.writeFile(path.join(project, '.jutell.json'), JSON.stringify({ version: 1, profile: 'balanced', mcp: { enabled: true } }, null, 2), 'utf8');
    const missing = JSON.parse((await runCli(['status', '--json'], project, env)).stdout);
    expect(missing.opencode.enabled).toBe(false);
    expect(missing.warnings).toEqual(expect.arrayContaining([expect.stringContaining('자동 시작할 활성 Provider 항목')]));
  });

  it('기존 설정을 읽고 승인된 setup에서 새 설정으로 복사하며 기존 파일을 보존한다', async () => {
    const { project, env } = await fixture();
    const legacyFile = path.join(project, '.beginner-bridge.json');
    await fs.writeFile(legacyFile, JSON.stringify({ version: 1, profile: 'learning', features: {}, limits: {}, mcp: { enabled: false } }), 'utf8');
    const status = JSON.parse((await runCli(['status', '--json'], project, env)).stdout);
    expect(status.profile).toBe('learning');
    await runCli(['setup', '--project', '--yes'], project, env);
    expect(JSON.parse(await fs.readFile(path.join(project, '.jutell.json'), 'utf8')).profile).toBe('learning');
    expect(await fs.stat(legacyFile)).toBeTruthy();
  });

  it('dashboard를 localhost에서 실행하고 API를 제공한다', async () => {
    const { project, env } = await fixture();
    await runCli(['setup', '--project', '--yes'], project, env);
    await runCli(['enable', '--mcp-only', '--yes'], project, env);
    const child = spawn(process.execPath, [entry, 'dashboard', '--no-open'], { cwd: project, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let output = '';
    const url = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('dashboard 시작 시간 초과')), 10000);
      child.stdout.on('data', (chunk) => { output += chunk.toString(); const match = output.match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timer); resolve(match[0]); } });
      child.once('error', reject);
    });
    const response = await fetch(`${url}/api/mcp/status`);
    expect(response.status).toBe(200);
    expect((await response.json()).skillFallback.available).toBe(true);
    const started = await fetch(`${url}/api/mcp/start`, { method: 'POST', body: '{}' });
    expect((await started.json()).server.state).toBe('running');
    const stopped = await fetch(`${url}/api/mcp/stop`, { method: 'POST', body: '{}' });
    expect((await stopped.json()).server.state).toBe('stopped');
    await new Promise<void>((resolve) => { child.once('exit', () => resolve()); child.kill(); });
  });

  it('OpenCode만 등록되고 정책이 켜진 상태에서 Codex 미등록 경고가 나지 않는다', async () => {
    const { project, env } = await fixture();
    const opencodeFile = path.join(project, 'opencode.json');
    await fs.writeFile(opencodeFile, '{\n  "$schema": "https://opencode.ai/config.json",\n  "mcp": {\n    // BEGIN JUTELL MANAGED BLOCK\n    "beginner_bridge": { "type": "local", "command": ["node", "server.js"], "enabled": true, "cwd": "." },\n    // END JUTELL MANAGED BLOCK\n  }\n}\n', 'utf8');
    await fs.writeFile(path.join(project, '.jutell.json'), JSON.stringify({ version: 1, profile: 'balanced', features: {}, limits: { maxMainFiles: 5, maxGlossaryTerms: 3, compactReportMaxSentences: 12 }, mcp: { enabled: true } }, null, 2), 'utf8');
    const status = JSON.parse((await runCli(['status', '--json'], project, env)).stdout);
    expect(status.codexPreparation).toBe('not_registered');
    expect(status.opencodePreparation).toBe('registered');
    expect(status.anyProviderRegistered).toBe(true);
    expect(status.anyProviderEnabled).toBe(false);
    expect(status.mcpRegistered).toBe(true);
    expect(status.mcpEnabled).toBe(true);
    expect(status.warnings).not.toContain(expect.stringContaining('어느 Provider에도 JuTell MCP가 등록되지'));
    const human = (await runCli(['status'], project, env)).stdout;
    expect(human).toContain('JuTell 연결 정책: 켜짐');
    expect(human).toContain('OpenCode MCP: 등록됨');
    expect(human).not.toContain('MCP: 등록되지 않음');
    expect(human).not.toContain('AI Agent Provider 설정 미등록');
  });

  it('Codex·OpenCode 모두 미등록인데 정책만 켜진 경우 경고가 나온다 (regression)', async () => {
    const { project, env } = await fixture();
    await fs.writeFile(path.join(project, '.jutell.json'), JSON.stringify({ version: 1, profile: 'balanced', features: {}, limits: { maxMainFiles: 5, maxGlossaryTerms: 3, compactReportMaxSentences: 12 }, mcp: { enabled: true } }, null, 2), 'utf8');
    const status = JSON.parse((await runCli(['status', '--json'], project, env)).stdout);
    expect(status.anyProviderRegistered).toBe(false);
    expect(status.warnings).toEqual(expect.arrayContaining([expect.stringContaining('어느 Provider에도 JuTell MCP가 등록되지')]));
  });

  it('CASE A: 아무 등록도 없으면 use codex가 canonical jutell을 전역 Codex 설정에 만든다', async () => {
    const { project, home, env } = await fixture();
    const codexFile = path.join(home, '.codex', 'config.toml');
    await fs.mkdir(path.dirname(codexFile), { recursive: true });
    await fs.writeFile(codexFile, '# 빈 설정\n', 'utf8');
    await fs.writeFile(path.join(project, '.jutell.json'), JSON.stringify({ version: 1, profile: 'balanced', mcp: { enabled: true } }), 'utf8');

    await runCli(['use', 'codex'], project, env);
    const after = await fs.readFile(codexFile, 'utf8');
    expect(after).toContain('[mcp_servers.jutell]');
    expect(after).not.toContain('beginner_bridge');
    expect(after.match(/\[mcp_servers\.jutell\]/g)).toHaveLength(1);
    // A project-scope .codex/config.toml is never written - Codex would
    // never read it anyway.
    await expect(fs.stat(path.join(project, '.codex', 'config.toml'))).rejects.toThrow();
  });

  it('CASE B: canonical만 있으면 use codex가 중복을 만들지 않는다', async () => {
    const { project, home, env } = await fixture();
    const codexFile = path.join(home, '.codex', 'config.toml');
    await fs.mkdir(path.dirname(codexFile), { recursive: true });
    await fs.writeFile(codexFile, '# JUTELL_CLI_MCP_BEGIN\n[mcp_servers.jutell]\ncommand = "node"\nargs = ["server.js"]\nenabled = true\n# JUTELL_CLI_MCP_END\n', 'utf8');
    await fs.writeFile(path.join(project, '.jutell.json'), JSON.stringify({ version: 1, profile: 'balanced', mcp: { enabled: true } }), 'utf8');

    await runCli(['use', 'codex'], project, env);
    const after = await fs.readFile(codexFile, 'utf8');
    expect(after.match(/\[mcp_servers\.jutell\]/g)).toHaveLength(1);
    expect(after).not.toContain('beginner_bridge');
    expect(after).toContain('enabled = true');
  });

  it('CASE E: legacy-only에서 use를 두 번 실행해도 both 상태에서 멈추고 중복이 없다', async () => {
    const { project, home, env } = await fixture();
    const codexFile = path.join(home, '.codex', 'config.toml');
    await fs.mkdir(path.dirname(codexFile), { recursive: true });
    const legacy = '# BEGINNER_BRIDGE_CLI_MCP_BEGIN\n[mcp_servers.beginner_bridge]\ncommand = "node"\nargs = ["server.js"]\nenabled = true\n# BEGINNER_BRIDGE_CLI_MCP_END\n';
    await fs.writeFile(codexFile, legacy, 'utf8');
    await fs.writeFile(path.join(project, '.jutell.json'), JSON.stringify({ version: 1, profile: 'balanced', mcp: { enabled: true } }), 'utf8');

    await runCli(['use', 'codex'], project, env);
    const first = await fs.readFile(codexFile, 'utf8');
    expect(first.match(/\[mcp_servers\.jutell\]/g)).toHaveLength(1);
    expect(first.match(/\[mcp_servers\.beginner_bridge\]/g)).toHaveLength(1);

    await runCli(['use', 'codex'], project, env);
    const second = await fs.readFile(codexFile, 'utf8');
    expect(second).toBe(first);
    expect(second.match(/\[mcp_servers\.jutell\]/g)).toHaveLength(1);
    expect(second.match(/\[mcp_servers\.beginner_bridge\]/g)).toHaveLength(1);
  });

  it('C4-002: doctor가 실제로 읽은 설정 source를 표시한다', async () => {
    const { project, env } = await fixture();
    await fs.writeFile(path.join(project, '.beginner-bridge.json'), JSON.stringify({ version: 1, profile: 'learning', mcp: { enabled: false } }), 'utf8');
    const doctor = JSON.parse((await runCli(['doctor', '--json'], project, env)).stdout) as Array<{ name: string; status: string; detail: string }>;
    const configCheck = doctor.find((check) => check.name === '.beginner-bridge.json');
    expect(configCheck).toBeTruthy();
    expect(configCheck?.detail).toContain('이전 설정 파일을 읽었습니다');
    const status = JSON.parse((await runCli(['status', '--json'], project, env)).stdout);
    expect(status.configLocation).toContain('.beginner-bridge.json');
  });

  it('CASE C: legacy Codex registration만 있으면 status/doctor가 인식하고 use가 보존하면서 canonical jutell을 만든다', async () => {
    const { project, home, env } = await fixture();
    // Codex only reads its global config, so status/doctor/use for codex
    // all check/write there (see codexScopedPaths), regardless of this
    // invocation's --project (default) scope.
    const codexFile = path.join(home, '.codex', 'config.toml');
    await fs.mkdir(path.dirname(codexFile), { recursive: true });
    const legacy = '# BEGINNER_BRIDGE_CLI_MCP_BEGIN\n[mcp_servers.beginner_bridge]\ncommand = "node"\nargs = ["server.js"]\nenabled = true\n# BEGINNER_BRIDGE_CLI_MCP_END\n';
    await fs.writeFile(codexFile, legacy, 'utf8');
    await fs.writeFile(path.join(project, '.jutell.json'), JSON.stringify({ version: 1, profile: 'balanced', mcp: { enabled: true } }), 'utf8');

    const status = JSON.parse((await runCli(['status', '--json'], project, env)).stdout);
    expect(status.codexPreparation).toBe('registered');
    expect(status.warnings).toEqual(expect.arrayContaining([expect.stringContaining('이전 beginner_bridge 항목만 있습니다')]));
    const doctor = JSON.parse((await runCli(['doctor', '--json'], project, env)).stdout);
    expect(doctor.find((check: { name: string }) => check.name === 'Codex MCP')?.status).toBe('정상');

    const used = await runCli(['use', 'codex'], project, env);
    expect(used.stdout).toContain('이전 beginner_bridge 항목을 그대로 두고');
    const after = await fs.readFile(codexFile, 'utf8');
    expect(after).toContain('[mcp_servers.jutell]');
    expect(after).toContain('[mcp_servers.beginner_bridge]');
    expect(after.match(/\[mcp_servers\.jutell\]/g)).toHaveLength(1);
    expect(after.match(/\[mcp_servers\.beginner_bridge\]/g)).toHaveLength(1);
    const afterStatus = JSON.parse((await runCli(['status', '--json'], project, env)).stdout);
    expect(afterStatus.warnings).toEqual(expect.arrayContaining([expect.stringContaining('모두 있습니다')]));
  });

  it('CASE D: canonical과 legacy Codex key가 모두 있으면 경고하고 자동 정리하지 않는다', async () => {
    const { project, home, env } = await fixture();
    const codexFile = path.join(home, '.codex', 'config.toml');
    await fs.mkdir(path.dirname(codexFile), { recursive: true });
    const both = '# JUTELL_CLI_MCP_BEGIN\n[mcp_servers.jutell]\ncommand = "node"\nargs = ["server.js"]\nenabled = true\n# JUTELL_CLI_MCP_END\n\n[mcp_servers.beginner_bridge]\ncommand = "node"\nargs = ["legacy.js"]\nenabled = true\n';
    await fs.writeFile(codexFile, both, 'utf8');
    const status = JSON.parse((await runCli(['status', '--json'], project, env)).stdout);
    expect(status.warnings).toEqual(expect.arrayContaining([expect.stringContaining('모두 있습니다')]));

    await runCli(['use', 'codex'], project, env);
    expect(await fs.readFile(codexFile, 'utf8')).toBe(both);
  });

  it('CASE C: legacy OpenCode registration을 감지하고 use가 보존하면서 canonical jutell을 만든다', async () => {
    const { project, env } = await fixture();
    const opencodeFile = path.join(project, 'opencode.json');
    const legacy = '{\n  "mcp": {\n    // BEGIN JUTELL MANAGED BLOCK\n    "beginner_bridge": { "type": "local", "command": ["node", "legacy.js"], "enabled": true, "cwd": "." },\n    // END JUTELL MANAGED BLOCK\n  }\n}\n';
    await fs.writeFile(opencodeFile, legacy, 'utf8');
    await fs.writeFile(path.join(project, '.jutell.json'), JSON.stringify({ version: 1, profile: 'balanced', mcp: { enabled: true } }), 'utf8');
    const status = JSON.parse((await runCli(['status', '--json'], project, env)).stdout);
    expect(status.opencodePreparation).toBe('registered');
    expect(status.warnings).toEqual(expect.arrayContaining([expect.stringContaining('이전 beginner_bridge 항목만 있습니다')]));

    const used = await runCli(['use', 'opencode'], project, env);
    expect(used.stdout).toContain('이전 beginner_bridge 항목을 그대로 두고');
    const after = await fs.readFile(opencodeFile, 'utf8');
    expect(after).toContain('"jutell"');
    expect(after).toContain('"beginner_bridge"');
    expect(after.match(/"jutell"/g)).toHaveLength(1);
    expect(after.match(/"beginner_bridge"/g)).toHaveLength(1);
  });

  it('CASE D: canonical과 legacy OpenCode key가 모두 있으면 경고하고 자동 정리하지 않는다', async () => {
    const { project, env } = await fixture();
    const opencodeFile = path.join(project, 'opencode.json');
    const both = '{\n  "mcp": {\n    "beginner_bridge": { "type": "local", "command": ["node", "legacy.js"], "enabled": true },\n    // BEGIN JUTELL MANAGED BLOCK\n    "jutell": { "type": "local", "command": ["node", "server.js"], "enabled": true, "cwd": "." },\n    // END JUTELL MANAGED BLOCK\n  }\n}\n';
    await fs.writeFile(opencodeFile, both, 'utf8');
    const status = JSON.parse((await runCli(['status', '--json'], project, env)).stdout);
    expect(status.warnings).toEqual(expect.arrayContaining([expect.stringContaining('OpenCode에 canonical jutell')]));

    await runCli(['use', 'opencode'], project, env);
    expect(await fs.readFile(opencodeFile, 'utf8')).toBe(both);
  });

  it('명시적 uninstall --global은 managed legacy Codex block을 제거하고 다른 설정은 보존한다', async () => {
    const { project, home, env } = await fixture();
    const codexFile = path.join(home, '.codex', 'config.toml');
    await fs.mkdir(path.dirname(codexFile), { recursive: true });
    await fs.writeFile(codexFile, '[mcp_servers.other]\ncommand = "other"\n\n# BEGINNER_BRIDGE_CLI_MCP_BEGIN\n[mcp_servers.beginner_bridge]\ncommand = "node"\nenabled = false\n# BEGINNER_BRIDGE_CLI_MCP_END\n', 'utf8');
    await runCli(['uninstall', '--global', '--keep-data', '--yes'], project, env);
    const after = await fs.readFile(codexFile, 'utf8');
    expect(after).toContain('[mcp_servers.other]');
    expect(after).not.toContain('beginner_bridge');
  });

  it('uninstall (기본 --project)은 공유되는 전역 Codex 설정을 건드리지 않는다', async () => {
    const { project, home, env } = await fixture();
    const codexFile = path.join(home, '.codex', 'config.toml');
    await fs.mkdir(path.dirname(codexFile), { recursive: true });
    const seeded = '[mcp_servers.other]\ncommand = "other"\n\n# BEGINNER_BRIDGE_CLI_MCP_BEGIN\n[mcp_servers.beginner_bridge]\ncommand = "node"\nenabled = false\n# BEGINNER_BRIDGE_CLI_MCP_END\n';
    await fs.writeFile(codexFile, seeded, 'utf8');
    const uninstalled = await runCli(['uninstall', '--keep-data', '--yes'], project, env);
    expect(await fs.readFile(codexFile, 'utf8')).toBe(seeded);
    expect(uninstalled.stdout).toContain('다른 프로젝트와 공유되어 제거하지 않았습니다');
  });

  it('실제 tarball을 임시 npm prefix에 설치한 뒤 두 CLI bin이 실행된다', async () => {
    const { root, project, env } = await fixture();
    const packRoot = path.join(root, 'pack');
    const prefix = path.join(root, 'prefix');
    await fs.mkdir(packRoot, { recursive: true });

    await runNpm(['pack', '--ignore-scripts', '--pack-destination', packRoot, '--json'], packageRoot);
    const tarball = (await fs.readdir(packRoot)).find((file) => file.endsWith('.tgz'));
    expect(tarball).toBeTruthy();
    await runNpm(['install', '--prefix', prefix, path.join(packRoot, tarball as string), '--no-audit', '--no-fund', '--ignore-scripts'], project);

    const binDirectory = path.join(prefix, 'node_modules', '.bin');
    const jutellBin = path.join(binDirectory, process.platform === 'win32' ? 'jutell.cmd' : 'jutell');
    const legacyBin = path.join(binDirectory, process.platform === 'win32' ? 'beginner-bridge.cmd' : 'beginner-bridge');
    const installedEnv = { ...env, PATH: `${binDirectory}${path.delimiter}${env.PATH ?? ''}` };
    const version = await execFileAsync(jutellBin, ['--version'], { cwd: project, env: installedEnv, shell: true, windowsHide: true });
    expect(version.stdout.trim()).toBe('1.0.0');
    const help = await execFileAsync(jutellBin, ['--help'], { cwd: project, env: installedEnv, shell: true, windowsHide: true });
    expect(help.stdout).toContain('JuTell CLI 1.0.0');
    const legacy = await execFileAsync(legacyBin, ['--version'], { cwd: project, env: installedEnv, shell: true, windowsHide: true });
    expect(legacy.stdout).toContain('1.0.0');
    expect(legacy.stdout).toContain('이전 명령입니다');
  }, 30000);

  it('도움말에서 핵심 명령만 강조하고 session storage는 하위 도움말로 안내한다', async () => {
    const { project, env } = await fixture();
    const help = await runCli(['--help'], project, env);
    expect(help.stdout).toContain('jutell use opencode');
    expect(help.stdout).toContain('jutell use claude');
    expect(help.stdout).toContain('공개 설치: npm install -g jutell');
    expect(help.stdout).not.toContain('실제 배포 전에는 로컬 패키지 검증만 지원합니다');
    expect(help.stdout).toContain('session help');
    expect(help.stdout).not.toContain('session storage set');
    expect(help.stdout).not.toContain('session storage reset');
    const sessionHelp = await runCli(['session', 'help'], project, env);
    expect(sessionHelp.stdout).toContain('session storage set <절대 경로>');
    expect(sessionHelp.stdout).toContain('session storage reset');
  });

  // V1.2: Claude Code provider adapter. Real Claude Code (verified via an
  // isolated CLAUDE_CONFIG_DIR) has no per-project file the way Codex was
  // found to need one - `local`/`user` MCP scope both live inside the same
  // `.claude.json`, keyed by project path or top-level respectively. These
  // tests shell out to the real `claude` binary (via `claude mcp add/remove`,
  // matching how JuTell registers Claude - see installer/claude.ts), so they
  // require Claude Code to be installed on the machine running the suite.
  it('jutell use claude가 canonical jutell을 local(프로젝트) 범위에 등록하고 프로젝트 규칙을 적용한다', async () => {
    const { project, home, env } = await fixture();
    const used = await runCli(['use', 'claude'], project, env);
    expect(used.stdout).toContain('Claude Code 연결이 끝났습니다');
    expect(used.stdout).toContain('기존 Claude Code 설정 보존');

    const claudeJson = JSON.parse(await fs.readFile(path.join(home, '.claude.json'), 'utf8'));
    expect(claudeJson.mcpServers).toBeUndefined(); // nothing at user/global scope
    const projectEntry = claudeJson.projects?.[project.replace(/\\/g, '/')] ?? claudeJson.projects?.[project];
    expect(projectEntry?.mcpServers?.jutell).toBeTruthy();
    expect(projectEntry.mcpServers.jutell.command).toBe(process.execPath);

    // Same project-scope rules as Codex/OpenCode: AGENTS.md + Skill installed.
    expect(await fs.readFile(path.join(project, 'AGENTS.md'), 'utf8')).toContain('BEGIN JUTELL MANAGED BLOCK');
    expect(await fs.stat(path.join(project, '.agents', 'skills', 'beginner-bridge', 'SKILL.md'))).toBeTruthy();
  }, 20000);

  it('jutell use claude를 반복 실행해도 중복 없이 idempotent하다', async () => {
    const { project, home, env } = await fixture();
    await runCli(['use', 'claude'], project, env);
    const first = await fs.readFile(path.join(home, '.claude.json'), 'utf8');
    await runCli(['use', 'claude'], project, env);
    const second = await fs.readFile(path.join(home, '.claude.json'), 'utf8');
    const firstParsed = JSON.parse(first);
    const secondParsed = JSON.parse(second);
    const key = Object.keys(firstParsed.projects)[0];
    expect(Object.keys(secondParsed.projects[key].mcpServers)).toEqual(['jutell']);
  }, 20000);

  it('jutell use claude는 같은 파일의 무관한 Claude 설정(다른 프로젝트, 다른 MCP 서버)을 보존한다', async () => {
    const { project, home, env } = await fixture();
    const otherProject = path.join(home, 'unrelated-other-project');
    const claudeJsonFile = path.join(home, '.claude.json');
    await fs.writeFile(claudeJsonFile, JSON.stringify({
      mcpServers: { 'some-user-tool': { type: 'stdio', command: 'node', args: ['other.js'] } },
      projects: { [otherProject.replace(/\\/g, '/')]: { mcpServers: { 'other-project-tool': { type: 'stdio', command: 'node', args: ['x.js'] } } } },
    }, null, 2), 'utf8');

    await runCli(['use', 'claude'], project, env);

    const after = JSON.parse(await fs.readFile(claudeJsonFile, 'utf8'));
    expect(after.mcpServers['some-user-tool']).toBeTruthy();
    const otherKey = Object.keys(after.projects).find((k) => k !== project && k !== project.replace(/\\/g, '/'));
    expect(after.projects[otherKey as string].mcpServers['other-project-tool']).toBeTruthy();
  }, 20000);

  it('jutell use claude --global은 user 범위(최상위 mcpServers)에 등록한다', async () => {
    const { project, home, env } = await fixture();
    await runCli(['use', 'claude', '--global'], project, env);
    const claudeJson = JSON.parse(await fs.readFile(path.join(home, '.claude.json'), 'utf8'));
    expect(claudeJson.mcpServers?.jutell).toBeTruthy();
    expect(claudeJson.projects?.[project]).toBeUndefined();
  }, 20000);

  it('status/doctor가 Claude Code MCP 상태를 정확히 보여준다', async () => {
    const { project, env } = await fixture();
    const before = JSON.parse((await runCli(['status', '--json'], project, env)).stdout);
    expect(before.claudePreparation).toBe('not_registered');
    expect(before.claude.registered).toBe(false);

    await runCli(['use', 'claude'], project, env);

    const after = JSON.parse((await runCli(['status', '--json'], project, env)).stdout);
    expect(after.claudePreparation).toBe('enabled');
    expect(after.claude.registered).toBe(true);
    const doctor = JSON.parse((await runCli(['doctor', '--json'], project, env)).stdout) as Array<{ name: string; status: string; detail: string }>;
    const check = doctor.find((c) => c.name === 'Claude Code MCP');
    expect(check?.status).toBe('정상');
    expect(check?.detail).toContain('local');
  }, 20000);

  it('jutell disconnect claude가 등록을 실제로 제거하고 무관한 설정은 보존한다', async () => {
    const { project, home, env } = await fixture();
    await runCli(['use', 'claude'], project, env);
    const claudeJsonFile = path.join(home, '.claude.json');
    const before = JSON.parse(await fs.readFile(claudeJsonFile, 'utf8'));
    const key = Object.keys(before.projects)[0];
    // seed an unrelated sibling entry in the same project's mcpServers map
    before.projects[key].mcpServers['sibling-tool'] = { type: 'stdio', command: 'node', args: ['sibling.js'] };
    await fs.writeFile(claudeJsonFile, JSON.stringify(before, null, 2), 'utf8');

    const disconnected = await runCli(['disconnect', 'claude'], project, env);
    expect(disconnected.stdout).toContain('Claude Code 연결을 끊었습니다');

    const after = JSON.parse(await fs.readFile(claudeJsonFile, 'utf8'));
    expect(after.projects[key].mcpServers.jutell).toBeUndefined();
    expect(after.projects[key].mcpServers['sibling-tool']).toBeTruthy();

    const second = await runCli(['disconnect', 'claude'], project, env);
    expect(second.stdout).toContain('연결된 Claude Code JuTell MCP가 없습니다');
  }, 20000);

  it('use claude 실패 시 이미 등록한 Claude MCP도 롤백된다', async () => {
    const { project, home, env } = await fixture();
    // Force a failure *after* the Claude MCP registration write, the same
    // way the Codex rollback test does (block the skill-manifest directory
    // `use` writes to right after registerProviderEnabled).
    await fs.writeFile(path.join(project, '.jutell-local'), 'blocked', 'utf8');

    let failure: { stderr?: string } | undefined;
    try {
      await runCli(['use', 'claude'], project, env);
    } catch (error) {
      failure = error as { stderr?: string };
    }
    expect(failure).toBeTruthy();

    const claudeJsonFile = path.join(home, '.claude.json');
    const stillClean = !(await fs.access(claudeJsonFile).then(() => true, () => false))
      || !JSON.parse(await fs.readFile(claudeJsonFile, 'utf8')).projects?.[project]?.mcpServers?.jutell;
    expect(stillClean).toBe(true);
  }, 20000);
});
