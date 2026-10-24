import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

// Cycle 3 W1: the Codex desktop app and IDE extension share ~/.codex/config.toml with the CLI
// (https://developers.openai.com/codex/mcp). Only wording changes; registration is untouched.
const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

describe('Codex app / IDE extension note (W1)', () => {
  it('status, provider status and use codex mention the shared config and how to restart', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'jutell-codex-app-'));
    dirs.push(root);
    const home = path.join(root, 'home'); const bin = path.join(root, 'bin'); const project = path.join(root, 'p');
    await mkdir(home); await mkdir(bin); await mkdir(project);
    await writeFile(path.join(bin, 'codex'), '#!/bin/sh\necho codex-cli 0.50.0\n'); await chmod(path.join(bin, 'codex'), 0o755);
    await writeFile(path.join(bin, 'codex.cmd'), '@echo codex-cli 0.50.0\r\n');
    const env = { ...process.env, HOME: home, USERPROFILE: home, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: home, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}` };
    const run = (...args: string[]) => spawnSync(process.execPath, [cliEntry, ...args], { cwd: project, env, encoding: 'utf8', timeout: 60000 });
    const use = run('use', 'codex', '--yes');
    expect(use.status, use.stderr).toBe(0);
    expect(use.stdout).toContain('ChatGPT 데스크톱 앱과 IDE 확장도 이 설정을 같이 씁니다. 앱: 설정 → MCP servers → Restart / IDE: Restart extension');
    const config = await readFile(path.join(home, '.codex', 'config.toml'), 'utf8');
    expect(config).toContain('[mcp_servers.jutell]');
    expect(run('status').stdout).toContain('Codex (CLI·앱·IDE 확장 공용 설정)');
    const provider = run('provider', 'status').stdout;
    expect(provider).toContain('적용 대상: Codex (CLI·앱·IDE 확장 공용 설정)');
    expect(provider).toContain('다시 읽기: 앱은 설정 → MCP servers → Restart / IDE는 Restart extension');
    await expect(readFile(path.join(project, '.codex', 'config.toml'), 'utf8')).rejects.toThrow();
  });
});
