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
  });

  it('global 범위도 격리된 사용자 홈에서 동작한다', async () => {
    const { project, home, env } = await fixture();
    await runCli(['setup', '--global', '--yes'], project, env);
    expect(await fs.stat(path.join(home, '.agents', 'skills', 'beginner-bridge', 'SKILL.md'))).toBeTruthy();
    expect(JSON.parse(await fs.readFile(path.join(home, '.jutell.json'), 'utf8')).mcp.enabled).toBe(false);
    expect((await fs.readFile(path.join(home, '.codex', 'config.toml'), 'utf8'))).toContain('[mcp_servers.beginner_bridge]');
  });

  it('기존 설정을 읽고 승인된 setup에서 새 설정으로 복사하며 기존 파일을 보존한다', async () => {
    const { project, env } = await fixture();
    const legacyFile = path.join(project, '.beginner-bridge.json');
    await fs.writeFile(legacyFile, JSON.stringify({ version: 1, profile: 'learning', features: {}, limits: {}, mcp: { enabled: false, autoStart: false } }), 'utf8');
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
    expect(version.stdout.trim()).toBe('0.2.0');
    const help = await execFileAsync(jutellBin, ['--help'], { cwd: project, env: installedEnv, shell: true, windowsHide: true });
    expect(help.stdout).toContain('JuTell CLI 0.2.0');
    const legacy = await execFileAsync(legacyBin, ['--version'], { cwd: project, env: installedEnv, shell: true, windowsHide: true });
    expect(legacy.stdout).toContain('0.2.0');
    expect(legacy.stdout).toContain('이전 명령입니다');
  }, 30000);
});
