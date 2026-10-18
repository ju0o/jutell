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

describe('migrate --clean Codex subtables', () => {
  it('comments orphaned legacy subtables, backs up the file, and is idempotent', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'jutell-migrate-clean-subtables-'));
    temporaryRoots.push(root);

    const home = path.join(root, 'home');
    const bin = path.join(root, 'bin');
    const project = path.join(root, 'project');
    await Promise.all([
      mkdir(home, { recursive: true }),
      mkdir(bin, { recursive: true }),
      mkdir(project, { recursive: true }),
    ]);

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

    const runCli = (args: string[]) => spawnSync(process.execPath, [cliEntry, ...args], {
      cwd: project,
      env,
      encoding: 'utf8',
      timeout: 20000,
    });

    const install = runCli(['use', 'codex', '--yes']);
    expect(install.status, `${install.stdout}\n${install.stderr}`).toBe(0);

    const configFile = path.join(home, '.codex', 'config.toml');
    const canonicalConfig = await readFile(configFile, 'utf8');
    await writeFile(configFile, `${canonicalConfig}\n[mcp_servers.beginner_bridge]\ncommand = "node"\nargs = ["apps/mcp-server"]\n\n[mcp_servers.beginner_bridge.tools.get_beginner_report_rules]\napproval_mode = "approve"\n\n[mcp_servers.beginner_bridge.env]\nJU_TEST_VALUE = "local"\n`, 'utf8');

    const clean = runCli(['migrate', '--clean']);
    const cleanOutput = `${clean.stdout}\n${clean.stderr}`;
    expect(clean.status, cleanOutput).toBe(0);

    const cleanedConfig = await readFile(configFile, 'utf8');
    expect(() => parse(cleanedConfig)).not.toThrow();
    expect(cleanedConfig).not.toMatch(/^[ \t]*\[mcp_servers\.beginner_bridge(?:\.|\])/m);
    expect(cleanedConfig).toContain('# jutell 제거로 주석 처리됨');
    let backupPath: string | undefined;
    if (clean.error) {
      // The sandbox can execute the child but deny Node's captured stdout pipe.
      expect(clean.error.message).toContain('EPERM');
      backupPath = `${configFile}.previous`;
    } else {
      expect(cleanOutput).toContain('백업:');
      const backupLine = cleanOutput.match(/^- 백업: (.+)$/m);
      expect(backupLine).not.toBeNull();
      backupPath = backupLine?.[1]?.trim();
    }
    expect(backupPath).toBeTruthy();
    expect(existsSync(backupPath!)).toBe(true);

    const cleanAgain = runCli(['migrate', '--clean']);
    expect(cleanAgain.status, `${cleanAgain.stdout}\n${cleanAgain.stderr}`).toBe(0);
    expect(await readFile(configFile, 'utf8')).toBe(cleanedConfig);
  });
});
