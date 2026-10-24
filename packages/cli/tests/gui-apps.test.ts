import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { findProvider } from '../src/installer/providers.js';
import { findGuiApp } from '../src/installer/app-specs.js';

// cycle-3 W5–W7: GUI apps end to end with the built CLI, in a temp HOME/JUTELL_HOME/XDG_CONFIG_HOME only.
const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });
const linux = process.platform === 'linux';
const exists = (file: string) => stat(file).then(() => true, () => false);

async function sandbox(homeName = 'home') {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'jutell-gui-')));
  dirs.push(root);
  const home = path.join(root, homeName); const project = path.join(root, 'proj'); const other = path.join(root, 'other');
  for (const dir of [home, project, other]) await mkdir(dir, { recursive: true });
  for (const dir of [project, other]) execFileSync('git', ['init', '-q'], { cwd: dir });
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home, BEGINNER_BRIDGE_HOME: home, JUTELL_HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: path.join(home, '.claude'), XDG_CONFIG_HOME: path.join(home, '.config'), APPDATA: path.join(home, 'AppData', 'Roaming') };
  delete env.JUTELL_PROJECT_ROOT;
  const run = (args: string[], cwd = project) => spawnSync(process.execPath, [cliEntry, ...args], { cwd, env, encoding: 'utf8', timeout: 60000 });
  const json = async (file: string) => JSON.parse(await readFile(file, 'utf8'));
  const doctorApp = (id: string, cwd = project) => {
    const result = run(['doctor', '--json'], cwd);
    return (JSON.parse(result.stdout) as { name: string; status: string; detail: string }[]).find((check) => check.name === `앱 연결: ${id}`)!;
  };
  return { root, home, project, other, run, json, doctorApp };
}

function noApprovalKeys(entry: Record<string, unknown>) {
  for (const key of ['autoApprove', 'alwaysAllow', 'trust', 'sandboxEnabled', 'disabled']) expect(entry).not.toHaveProperty(key);
}

describe('GUI app registry', () => {
  it('keeps GUI apps out of the agent providers; codex-app / codex-ide are Codex aliases', () => {
    expect(findProvider('cursor')).toBeUndefined();
    expect(findGuiApp('cursor')?.id).toBe('cursor');
    expect(findProvider('codex-app')?.id).toBe('codex');
    expect(findProvider('codex-ide')?.id).toBe('codex');
  });
});

describe('jutell use / disconnect <GUI app> (built dist)', () => {
  it('cursor: project file by default with type stdio and ${workspaceFolder}; disconnect removes the file JuTell made', async () => {
    const { project, run, json } = await sandbox();
    const used = run(['use', 'cursor']);
    expect(used.status, used.stderr).toBe(0);
    expect(used.stdout).toContain('Cursor를 다시 시작');
    const entry = (await json(path.join(project, '.cursor', 'mcp.json'))).mcpServers.jutell;
    expect(entry).toMatchObject({ type: 'stdio', command: process.execPath, env: { JUTELL_PROJECT_ROOT: '${workspaceFolder}' } });
    expect(entry.args[0]).toMatch(/assets[\\/]mcp-server[\\/]index\.js$/);
    noApprovalKeys(entry);
    expect(await exists(path.join(project, 'AGENTS.md'))).toBe(true);
    const off = run(['disconnect', 'cursor']);
    expect(off.status, off.stderr).toBe(0);
    expect(await exists(path.join(project, '.cursor'))).toBe(false);
  });

  it('cursor --global pins JUTELL_PROJECT_ROOT to this project and warns; another project sees "고정됨" as 주의', async () => {
    const { home, project, other, run, json, doctorApp } = await sandbox();
    const used = run(['use', 'cursor', '--global']);
    expect(used.status, used.stderr).toBe(0);
    expect(used.stdout).toContain(`모든 폴더에서 \`${project}\`의 지도·영수증을 씁니다`);
    const entry = (await json(path.join(home, '.cursor', 'mcp.json'))).mcpServers.jutell;
    expect(entry).toMatchObject({ type: 'stdio', env: { JUTELL_PROJECT_ROOT: project } });
    noApprovalKeys(entry);
    expect(doctorApp('cursor-global').status).toBe('정상');
    const elsewhere = doctorApp('cursor-global', other);
    expect(elsewhere.status).toBe('주의');
    expect(elsewhere.detail).toContain(`${project}\`에 고정됨`);
    // Following the guidance from the other project fixes it.
    expect(run(['use', 'cursor', '--global'], other).status).toBe(0);
    expect(doctorApp('cursor-global', other).status).toBe('정상');
  });

  it('vscode: .vscode/mcp.json under "servers" with cwd; the person\'s file and comments come back byte-identical after uninstall', async () => {
    const { project, run, json } = await sandbox();
    const file = path.join(project, '.vscode', 'mcp.json');
    await mkdir(path.dirname(file));
    const mine = '{\n  // my server\n  "servers": { "other": { "command": "x" } }\n}\n';
    await writeFile(file, mine);
    expect(run(['use', 'vscode']).status).toBe(0);
    const servers = JSON.parse((await readFile(file, 'utf8')).replace(/\/\/.*$/m, '')).servers;
    expect(servers.jutell).toMatchObject({ type: 'stdio', cwd: '${workspaceFolder}' });
    expect(servers.other).toEqual({ command: 'x' });
    const removed = run(['uninstall', '--yes']);
    expect(removed.status, removed.stderr).toBe(0);
    expect(removed.stdout).toContain('VS Code (이 프로젝트): JuTell 연결만 지웠어요. 백업:');
    expect(await readFile(file, 'utf8')).toBe(mine);
  });

  it('(l) uninstall deletes an emptied file only when JuTell certainly created it, and a folder only when JuTell made it and it is empty', async () => {
    const { project, run } = await sandbox();
    // JuTell created file and folder: both go.
    expect(run(['use', 'cursor']).status).toBe(0);
    expect(await exists(path.join(project, '.cursor', 'mcp.json.jutell-created'))).toBe(true);
    expect(run(['disconnect', 'cursor']).status).toBe(0);
    expect(await exists(path.join(project, '.cursor'))).toBe(false);
    // The person's (empty) folder stays even though JuTell created the file inside it.
    await mkdir(path.join(project, '.vscode'));
    expect(run(['use', 'vscode']).status).toBe(0);
    expect(run(['uninstall', '--yes']).status).toBe(0);
    expect(await exists(path.join(project, '.vscode', 'mcp.json'))).toBe(false);
    expect(await exists(path.join(project, '.vscode'))).toBe(true);
    // The person's own file (no JuTell marker) is never deleted, even when left empty.
    await mkdir(path.join(project, '.cursor'));
    await writeFile(path.join(project, '.cursor', 'mcp.json'), '{ "mcpServers": {} }\n');
    expect(run(['use', 'cursor']).status).toBe(0);
    expect(run(['disconnect', 'cursor']).status).toBe(0);
    expect(await readFile(path.join(project, '.cursor', 'mcp.json'), 'utf8')).toBe('{ "mcpServers": {} }\n');
  });

  it('W8: a home path with Korean letters and spaces — real write and clean removal (Claude Desktop under a temp %APPDATA% on Windows/macOS)', async () => {
    const { home, project, run, json } = await sandbox('홍 길동 홈');
    const cursor = path.join(home, '.cursor', 'mcp.json');
    expect(run(['use', 'cursor', '--global']).status).toBe(0);
    expect((await json(cursor)).mcpServers.jutell.env.JUTELL_PROJECT_ROOT).toBe(project);
    const desktop = process.platform === 'win32' ? path.join(home, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json')
      : process.platform === 'darwin' ? path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json') : undefined;
    if (desktop) {
      expect(run(['use', 'claude-desktop']).status).toBe(0);
      expect((await json(desktop)).mcpServers.jutell.args[0]).toMatch(/mcp-server[\\/]index\.js$/);
    }
    const removed = run(['uninstall', '--global', '--yes']);
    expect(removed.status, removed.stderr).toBe(0);
    for (const file of [cursor, ...(desktop ? [desktop] : [])]) expect(await exists(file), file).toBe(false);
  }, 60000);

  it('(l) a JuTell-created file that is kept (the person added a server) loses only the marker; when it later becomes empty it is never deleted', async () => {
    const { project, run } = await sandbox();
    const file = path.join(project, '.cursor', 'mcp.json');
    expect(run(['use', 'cursor']).status).toBe(0);
    const withMine = JSON.parse(await readFile(file, 'utf8'));
    withMine.mcpServers.mine = { command: 'x' };
    await writeFile(file, JSON.stringify(withMine, null, 2));
    expect(run(['disconnect', 'cursor']).status).toBe(0);
    expect(await exists(file)).toBe(true);
    expect(await exists(`${file}.jutell-created`)).toBe(false);
    // The person empties it; JuTell connects and disconnects again: the file stays.
    await writeFile(file, '{ "mcpServers": {} }\n');
    expect(run(['use', 'cursor']).status).toBe(0);
    expect(run(['disconnect', 'cursor']).status).toBe(0);
    expect(await exists(file)).toBe(true);
  });

  it.skipIf(!linux)('disconnect claude-desktop where its path is not documented (Linux) says so for Claude Desktop, not VS Code', async () => {
    const { run } = await sandbox();
    const out = run(['disconnect', 'claude-desktop', '--yes']);
    expect(out.status, out.stderr).toBe(0);
    expect(out.stdout).toContain('Claude Desktop 설정 파일 위치가 이 운영체제에서는 문서로 확인 안 됨');
    expect(out.stdout).not.toContain('VS Code');
  });

  it.skipIf(!linux)('vscode --global (Q10, Linux): writes $XDG_CONFIG_HOME/Code/User/mcp.json and uninstall --global removes it cleanly', async () => {
    const { home, project, run, json } = await sandbox();
    const file = path.join(home, '.config', 'Code', 'User', 'mcp.json');
    const used = run(['use', 'vscode', '--global']);
    expect(used.status, used.stderr).toBe(0);
    expect(used.stdout).toContain('MCP: List Servers');
    const entry = (await json(file)).servers.jutell;
    expect(entry).toMatchObject({ type: 'stdio', env: { JUTELL_PROJECT_ROOT: project } });
    noApprovalKeys(entry);
    const removed = run(['uninstall', '--global', '--yes']);
    expect(removed.status, removed.stderr).toBe(0);
    for (const leftover of [file, `${file}.previous`, `${file}.jutell-original`, `${file}.jutell-created`]) expect(await exists(leftover)).toBe(false);
  });

  it.skipIf(!linux)('vscode --global next to the person\'s own servers: uninstall takes out only JuTell', async () => {
    const { home, run } = await sandbox();
    const file = path.join(home, '.config', 'Code', 'User', 'mcp.json');
    await mkdir(path.dirname(file), { recursive: true });
    const mine = '{\n  "servers": {\n    "mine": { "command": "y" }\n  },\n  "inputs": []\n}\n';
    await writeFile(file, mine);
    expect(run(['use', 'vscode', '--global']).status).toBe(0);
    // Project uninstall also removes a global entry pinned to this project.
    expect(run(['uninstall', '--yes']).status).toBe(0);
    expect(await readFile(file, 'utf8')).toBe(mine);
  });

  it('windsurf is status-only: use exits 0 and writes nothing; a JuTell entry there is "직접 관리하세요"', async () => {
    const { home, run, doctorApp } = await sandbox();
    const used = run(['use', 'windsurf']);
    expect(used.status, used.stderr).toBe(0);
    expect(used.stdout).toContain('아직 읽기만 지원');
    expect(await exists(path.join(home, '.codeium'))).toBe(false);
    const file = path.join(home, '.codeium', 'windsurf', 'mcp_config.json');
    await mkdir(path.dirname(file), { recursive: true });
    const text = JSON.stringify({ mcpServers: { jutell: { command: process.execPath, args: ['/x/assets/mcp-server/index.js'] } } });
    await writeFile(file, text);
    const check = doctorApp('windsurf-legacy');
    expect(check.status).toBe('주의');
    expect(check.detail).toContain('JuTell이 만들지 않은 등록 — 직접 관리하세요');
    expect(run(['uninstall', '--global', '--yes']).status).toBe(0);
    expect(await readFile(file, 'utf8')).toBe(text);
  });
});

describe('lifecycle with GUI apps (W6/W7)', () => {
  it('setup --yes never creates GUI config files, even when the apps are installed', async () => {
    const { home, project, run } = await sandbox();
    await mkdir(path.join(home, '.cursor'), { recursive: true });
    await mkdir(path.join(home, '.config', 'Code', 'User'), { recursive: true });
    const result = run(['setup', '--yes']);
    expect(result.status, result.stderr).toBe(0);
    for (const file of [path.join(home, '.cursor', 'mcp.json'), path.join(home, '.config', 'Code', 'User', 'mcp.json'), path.join(project, '.cursor'), path.join(project, '.vscode'), path.join(project, '.mcp.json')]) {
      expect(await exists(file)).toBe(false);
    }
    expect(result.stdout).toContain('Cursor: 설치됨 — `jutell use cursor`');
  });

  it('a stale path is 주의 in doctor; following its advice (`jutell use cursor`) makes it 정상; setup refreshes only the path', async () => {
    const { project, run, json, doctorApp } = await sandbox();
    const file = path.join(project, '.cursor', 'mcp.json');
    await mkdir(path.dirname(file));
    const old = { type: 'stdio', command: process.execPath, args: [path.join(project, 'gone', 'assets', 'mcp-server', 'index.js')], env: { JUTELL_PROJECT_ROOT: '${workspaceFolder}', MINE: '1' }, disabledTools: ['x'] };
    await writeFile(file, JSON.stringify({ mcpServers: { jutell: old, other: { command: 'z' } } }, null, 2));
    const stale = doctorApp('cursor-project');
    expect(stale.status).toBe('주의');
    expect(stale.detail).toContain('`jutell use cursor`');
    expect(run(['use', 'cursor']).status).toBe(0);
    expect(doctorApp('cursor-project').status).toBe('정상');

    // Make it stale again; setup --yes only fixes the path and keeps the person's keys.
    await writeFile(file, JSON.stringify({ mcpServers: { jutell: old, other: { command: 'z' } } }, null, 2));
    const setup = run(['setup', '--yes']);
    expect(setup.status, setup.stderr).toBe(0);
    const after = (await json(file)).mcpServers;
    expect(after.jutell.args[0]).not.toContain('gone');
    expect(after.jutell.env).toEqual({ JUTELL_PROJECT_ROOT: '${workspaceFolder}', MINE: '1' });
    expect(after.jutell.disabledTools).toEqual(['x']);
    expect(after.other).toEqual({ command: 'z' });
  });

  it('only a broken config file is 오류; a conflict is 주의 and uninstall skips it with the reason', async () => {
    const { project, run, doctorApp } = await sandbox();
    await mkdir(path.join(project, '.cursor'));
    await writeFile(path.join(project, '.cursor', 'mcp.json'), '{ broken');
    expect(doctorApp('cursor-project').status).toBe('오류');
    await mkdir(path.join(project, '.vscode'));
    const conflict = JSON.stringify({ servers: { jutell: { command: 'python', args: ['x.py'] } } });
    await writeFile(path.join(project, '.vscode', 'mcp.json'), conflict);
    expect(doctorApp('vscode-project').status).toBe('주의');
    const removed = run(['uninstall', '--yes']);
    expect(removed.stdout).toContain('VS Code (이 프로젝트): JuTell이 만들지 않은 "jutell" 항목이라 건너뛰었어요.');
    expect(await readFile(path.join(project, '.vscode', 'mcp.json'), 'utf8')).toBe(conflict);
  });

  it('status --json carries the app fields with internal ids', async () => {
    const { run } = await sandbox();
    expect(run(['use', 'cursor']).status).toBe(0);
    const status = JSON.parse(run(['status', '--json']).stdout) as { apps: { id: string; registered: boolean; stale: boolean; conflict: boolean; installed: unknown }[] };
    const cursor = status.apps.find((app) => app.id === 'cursor-project')!;
    expect(cursor).toMatchObject({ registered: true, stale: false, conflict: false, installed: true });
    expect(status.apps.map((app) => app.id)).toEqual(expect.arrayContaining(['cursor-global', 'vscode-project', 'windsurf', 'copilot-user']));
  });
});
