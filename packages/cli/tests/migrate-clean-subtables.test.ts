import { parse } from 'smol-toml';
import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const temporaryRoots: string[] = [];

afterAll(async () => {
  await Promise.all(temporaryRoots.map((root) => rm(root, { recursive: true, force: true })));
});

async function makeEnv() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jutell-migrate-clean-subtables-'));
  temporaryRoots.push(root);
  const home = path.join(root, 'home');
  const bin = path.join(root, 'bin');
  const project = path.join(root, 'project');
  await Promise.all([home, bin, project].map((dir) => mkdir(dir, { recursive: true })));
  const fakeCodex = path.join(bin, 'codex');
  await writeFile(fakeCodex, '#!/bin/sh\nprintf "codex 0.1.0\\n"\n', 'utf8');
  await chmod(fakeCodex, 0o755);
  const env = {
    ...process.env,
    HOME: home,
    BEGINNER_BRIDGE_HOME: home,
    CODEX_HOME: path.join(home, '.codex'),
    CLAUDE_CONFIG_DIR: home,
    PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
  };
  const runCli = (args: string[]) => {
    const result = spawnSync(process.execPath, [cliEntry, ...args], { cwd: project, env, encoding: 'utf8', timeout: 20000 });
    return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
  };
  return { home, runCli, configFile: path.join(home, '.codex', 'config.toml') };
}

const LEGACY_TABLES = '\n[mcp_servers.beginner_bridge]\ncommand = "node"\nargs = ["apps/mcp-server"]\n\n[mcp_servers.beginner_bridge.tools.get_beginner_report_rules]\napproval_mode = "approve"\n\n[mcp_servers.beginner_bridge.env]\nJU_TEST_VALUE = "local"\n';

describe('migrate --clean Codex subtables', () => {
  it('comments orphaned legacy subtables with the cleanup header, backs up the exact pre-clean file, and says nothing to clean the second time', async () => {
    const { runCli, configFile } = await makeEnv();
    const install = runCli(['use', 'codex', '--yes']);
    expect(install.status, install.output).toBe(0);
    const beforeClean = `${await readFile(configFile, 'utf8')}${LEGACY_TABLES}`;
    await writeFile(configFile, beforeClean, 'utf8');

    const clean = runCli(['migrate', '--clean']);
    expect(clean.status, clean.output).toBe(0);
    const cleanedConfig = await readFile(configFile, 'utf8');
    expect(() => parse(cleanedConfig)).not.toThrow();
    expect(cleanedConfig).not.toMatch(/^[ \t]*\[mcp_servers\.beginner_bridge(?:\.|\])/m);
    expect(cleanedConfig).toContain('# jutell 정리로 주석 처리됨');
    expect(cleanedConfig).not.toContain('# jutell 제거로 주석 처리됨');
    const backupPath = clean.output.match(/^- 바로 전 백업: (.+)$/m)?.[1]?.trim();
    expect(backupPath, clean.output).toBeTruthy();
    expect(await readFile(backupPath!, 'utf8')).toBe(beforeClean);
    expect(clean.output).toContain(`- 처음 원본: ${configFile}.jutell-original`);
    expect(existsSync(`${configFile}.jutell-original`)).toBe(true);

    const cleanAgain = runCli(['migrate', '--clean']);
    expect(cleanAgain.status, cleanAgain.output).toBe(0);
    expect(await readFile(configFile, 'utf8')).toBe(cleanedConfig);
    expect(cleanAgain.output).toContain('정리할 레거시가 없었어요');
    expect(cleanAgain.output).not.toContain('제거');
  });

  it('refuses to touch an already broken config.toml, says so truthfully, and exits 1', async () => {
    const { runCli, configFile } = await makeEnv();
    expect(runCli(['use', 'codex', '--yes']).status).toBe(0);
    const broken = `${await readFile(configFile, 'utf8')}${LEGACY_TABLES}\n[broken\n`;
    await writeFile(configFile, broken, 'utf8');

    const clean = runCli(['migrate', '--clean']);
    expect(clean.status, clean.output).toBe(1);
    expect(clean.output).toContain('원래부터 올바른 TOML이 아니라서 건드리지 않았어요');
    expect(clean.output).not.toContain('변경하면 유효하지 않은 TOML');
    expect(await readFile(configFile, 'utf8')).toBe(broken);
  });

  it('jutell use codex does not stop on a user-owned beginner_bridge server and leaves it untouched', async () => {
    const { runCli, configFile } = await makeEnv();
    await mkdir(path.dirname(configFile), { recursive: true });
    const userOwned = '[mcp_servers.beginner_bridge]\ncommand = "my-own-server"\n';
    await writeFile(configFile, userOwned, 'utf8');

    const install = runCli(['use', 'codex', '--yes']);
    expect(install.status, install.output).toBe(0);
    const after = await readFile(configFile, 'utf8');
    expect(after).toContain(userOwned.trim());
    expect(after).toContain('[mcp_servers.jutell]');
    expect(() => parse(after)).not.toThrow();
  });
});
