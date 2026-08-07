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
  return { root, project, home, env: { ...process.env, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex') } };
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
    const { project, env } = await fixture();
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
      expect(await fs.readFile(path.join(project, '.codex', 'config.toml'), 'utf8')).toContain('enabled = true');
    } finally {
      child.kill();
      await new Promise<void>((resolve) => child.once('exit', () => resolve()));
    }

    const statusOnly = await runCli(['--status-only'], project, env);
      expect(statusOnly.stdout).toContain('JuTell 연결 정책: 켜짐');
      expect(statusOnly.stdout).toContain('Codex MCP: 활성화됨');
    expect(statusOnly.stdout).toContain('MCP 서버 응답: 확인하지 않음');
    expect((await fs.readFile(path.join(project, 'AGENTS.md'), 'utf8')).match(/BEGIN JUTELL MANAGED BLOCK/g)).toHaveLength(1);
    expect((await fs.readFile(path.join(project, '.codex', 'config.toml'), 'utf8')).match(/BEGINNER_BRIDGE_CLI_MCP_BEGIN/g)).toHaveLength(1);
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
    const { project, env } = await fixture();
    const codexConfig = path.join(project, '.codex', 'config.toml');
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
    expect(firstCodex.match(/BEGINNER_BRIDGE_CLI_MCP_BEGIN/g)).toHaveLength(1);

    await runCli(['setup', '--project', '--profile', 'learning', '--yes'], project, env);
    const repeatedCodex = await fs.readFile(codexConfig, 'utf8');
    expect(repeatedCodex.match(/BEGINNER_BRIDGE_CLI_MCP_BEGIN/g)).toHaveLength(1);
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

    await runCli(['enable', '--mcp-only', '--yes'], project, env);
    expect(JSON.parse(await fs.readFile(configFile, 'utf8')).mcp.enabled).toBe(true);
    expect(await fs.readFile(codexConfig, 'utf8')).toContain('enabled = true');
    await runCli(['disable', '--mcp', '--yes'], project, env);
    expect(JSON.parse(await fs.readFile(configFile, 'utf8')).mcp.enabled).toBe(false);
    expect(await fs.readFile(codexConfig, 'utf8')).toContain('enabled = false');

    await runCli(['disable', '--skill', '--yes'], project, env);
    await expect(fs.stat(skillFile)).rejects.toThrow();
    await runCli(['enable', '--skill-only', '--yes'], project, env);
    expect(await fs.stat(skillFile)).toBeTruthy();

    await runCli(['uninstall', '--keep-data', '--yes'], project, env);
    expect(await fs.stat(configFile)).toBeTruthy();
    await expect(fs.stat(skillFile)).rejects.toThrow();
    expect((await fs.readFile(codexConfig, 'utf8'))).toContain('[mcp_servers.other]');
  }, 20000);

  it('global 범위도 격리된 사용자 홈에서 동작한다', async () => {
    const { project, home, env } = await fixture();
    await runCli(['setup', '--global', '--yes'], project, env);
    expect(await fs.stat(path.join(home, '.agents', 'skills', 'beginner-bridge', 'SKILL.md'))).toBeTruthy();
    expect(JSON.parse(await fs.readFile(path.join(home, '.jutell.json'), 'utf8')).mcp.enabled).toBe(false);
    expect((await fs.readFile(path.join(home, '.codex', 'config.toml'), 'utf8'))).toContain('[mcp_servers.beginner_bridge]');
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
    expect(first).toContain('"beginner_bridge"');
    expect(first).toContain('"jira"');
    expect(first).toContain('"deepseek/deepseek-chat"');
    expect(first.match(/BEGIN JUTELL MANAGED BLOCK/g)).toHaveLength(1);

    await runCli(['provider', 'setup', 'opencode', '--yes'], project, env);
    const repeated = await fs.readFile(opencodeFile, 'utf8');
    expect(repeated.match(/BEGIN JUTELL MANAGED BLOCK/g)).toHaveLength(1);
    expect(repeated.match(/"beginner_bridge"/g)).toHaveLength(1);
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
    expect(after).not.toContain('beginner_bridge');
    expect(after).toContain('deepseek-chat');
  });

  it('jutell use opencode가 연결·활성화·Skill·AGENTS.md를 한 번에 준비하고 반복 실행을 방지한다', async () => {
    const { project, env } = await fixture();
    const opencodeFile = path.join(project, 'opencode.json');
    await fs.writeFile(opencodeFile, JSON.stringify({ model: 'deepseek/deepseek-chat', mcp: { jira: { type: 'remote', url: 'https://example.com/mcp' } } }, null, 2), 'utf8');

    const first = await runCli(['use', 'opencode'], project, env);
    expect(first.stdout).toContain('OpenCode 연결 완료');
    expect(first.stdout).toContain('✓ 설정 백업');
    expect(first.stdout).toContain('✓ JuTell MCP 등록');
    expect(first.stdout).toContain('✓ MCP 활성화');
    expect(first.stdout).toContain('✓ 기존 OpenCode 설정 보존');
    expect(first.stdout).toContain('새 OpenCode 세션에서 바로 사용할 수 있습니다.');
    const text = await fs.readFile(opencodeFile, 'utf8');
    expect(text.match(/BEGIN JUTELL MANAGED BLOCK/g)).toHaveLength(1);
    expect(text).toContain('"enabled": true');
    expect(text).toContain('"jira"');
    expect(text).toContain('"deepseek/deepseek-chat"');
    expect(JSON.parse(await fs.readFile(path.join(project, '.jutell.json'), 'utf8')).mcp.enabled).toBe(true);
    expect(await fs.stat(path.join(project, '.agents', 'skills', 'beginner-bridge', 'SKILL.md'))).toBeTruthy();
    expect(await fs.readFile(path.join(project, 'AGENTS.md'), 'utf8')).toContain('BEGIN JUTELL MANAGED BLOCK');

    const repeated = await runCli(['use', 'opencode'], project, env);
    expect(repeated.stdout).toContain('OpenCode 연결 완료');
    expect((await fs.readFile(opencodeFile, 'utf8')).match(/BEGIN JUTELL MANAGED BLOCK/g)).toHaveLength(1);
    expect((await fs.readFile(opencodeFile, 'utf8')).match(/"beginner_bridge"/g)).toHaveLength(1);
  });

  it('jutell use codex가 Codex 연결을 켜고 기존 OpenCode 연결을 유지한다', async () => {
    const { project, env } = await fixture();
    await runCli(['use', 'opencode'], project, env);
    const useCodex = await runCli(['use', 'codex'], project, env);
    expect(useCodex.stdout).toContain('Codex 연결 완료');
    expect(useCodex.stdout).toContain('기존 다른 Agent 연결은 유지했습니다.');
    const codexText = await fs.readFile(path.join(project, '.codex', 'config.toml'), 'utf8');
    expect(codexText).toContain('[mcp_servers.beginner_bridge]');
    expect(codexText).toContain('enabled = true');
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
    const { project, env } = await fixture();
    await runCli(['use', 'codex'], project, env);
    await runCli(['connect', 'opencode'], project, env);
    expect(await fs.readFile(path.join(project, 'opencode.json'), 'utf8')).toContain('"enabled": true');
    expect(await fs.readFile(path.join(project, '.codex', 'config.toml'), 'utf8')).toContain('enabled = true');

    await runCli(['disconnect', 'opencode'], project, env);
    expect(await fs.readFile(path.join(project, 'opencode.json'), 'utf8')).toContain('"enabled": false');
    expect(await fs.readFile(path.join(project, '.codex', 'config.toml'), 'utf8')).toContain('enabled = true');
    expect(JSON.parse(await fs.readFile(path.join(project, '.jutell.json'), 'utf8')).mcp.enabled).toBe(true);
  });

  it('jutell switch opencode가 Codex를 비활성화하고 OpenCode만 활성화한다', async () => {
    const { project, env } = await fixture();
    await runCli(['use', 'codex'], project, env);
    const switched = await runCli(['switch', 'opencode'], project, env);
    expect(switched.stdout).toContain('다른 Agent의 JuTell 연결은 비활성화했습니다.');
    expect(await fs.readFile(path.join(project, '.codex', 'config.toml'), 'utf8')).toContain('enabled = false');
    expect(await fs.readFile(path.join(project, 'opencode.json'), 'utf8')).toContain('"enabled": true');
    const summary = await runCli(['provider'], project, env);
    expect(summary.stdout).toMatch(/Codex\s+연결됨 · 비활성/);
    expect(summary.stdout).toMatch(/OpenCode\s+연결됨 · 활성/);
  });

  it('미지원 Agent는 안내만 출력하고 설정 파일을 만들지 않는다', async () => {
    const { project, env } = await fixture();
    const claude = await runCli(['use', 'claude'], project, env);
    expect(claude.stdout).toContain('Claude Code 연결은 아직 준비 중입니다.');
    expect(claude.stdout).toContain('현재 사용할 수 있는 Agent는 Codex와 OpenCode입니다.');
    const cline = await runCli(['use', 'cline'], project, env);
    expect(cline.stdout).toContain('Cline 연결은 아직 준비 중입니다.');
    await expect(fs.stat(path.join(project, 'opencode.json'))).rejects.toThrow();
    const summary = await runCli(['provider'], project, env);
    expect(summary.stdout).toMatch(/Claude Code\s+준비 중/);
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
    expect(status.opencodePreparation).toBe('enabled');
    expect(status.anyProviderRegistered).toBe(true);
    expect(status.anyProviderEnabled).toBe(true);
    expect(status.mcpRegistered).toBe(true);
    expect(status.mcpEnabled).toBe(true);
    expect(status.warnings).not.toContain(expect.stringContaining('어느 Provider에도 JuTell MCP가 등록되지'));
    const human = (await runCli(['status'], project, env)).stdout;
    expect(human).toContain('JuTell 연결 정책: 켜짐');
    expect(human).toContain('OpenCode MCP: 활성화됨');
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
    expect(version.stdout.trim()).toBe('0.2.1');
    const help = await execFileAsync(jutellBin, ['--help'], { cwd: project, env: installedEnv, shell: true, windowsHide: true });
    expect(help.stdout).toContain('JuTell CLI 0.2.1');
    const legacy = await execFileAsync(legacyBin, ['--version'], { cwd: project, env: installedEnv, shell: true, windowsHide: true });
    expect(legacy.stdout).toContain('0.2.1');
    expect(legacy.stdout).toContain('이전 명령입니다');
  }, 30000);
});
