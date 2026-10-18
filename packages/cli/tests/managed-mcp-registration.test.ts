import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildMcpBlock, readCodexRegistration, registerMcp, removeMcp } from '../src/config/managed.js';
import type { ScopePaths } from '../src/types.js';

// JUTELL-V1.0.1-CODEX-STALE-MCP-PATH-REPAIR-01
//
// registerMcp() must repair a JuTell-recognized canonical Codex MCP registration whose
// command/args are stale (wrong machine, wrong OS, old install) even when the key is already
// registered and `enabled` already matches - it must not treat "key present + enabled matches"
// alone as "nothing to do". It must still refuse to touch an unrelated, unrecognized custom
// `[mcp_servers.jutell]` entry, and must leave legacy `beginner_bridge` registrations untouched.

const temporaryRoots: string[] = [];

async function mkdtemp() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-managed-mcp-'));
  temporaryRoots.push(dir);
  return dir;
}

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) await fs.rm(root, { recursive: true, force: true });
});

async function scopePaths(dir: string): Promise<ScopePaths> {
  const codexConfigFile = path.join(dir, 'config.toml');
  return {
    scope: 'global',
    targetRoot: dir,
    skillRoot: dir,
    configFile: path.join(dir, '.jutell.json'),
    legacyConfigFile: path.join(dir, '.beginner-bridge.json'),
    codexConfigFile,
    opencodeConfigFile: path.join(dir, 'opencode.json'),
    claudeConfigFile: path.join(dir, 'claude.json'),
    dataRoot: dir,
    legacyDataRoot: dir,
  };
}

const FAKE_PACKAGE_ROOT = '/opt/fake-jutell-package';
const READ_ONLY_MCP_TOOLS = [
  'get_bridge_status',
  'get_active_features',
  'get_report_preferences',
  'get_beginner_report_rules',
  'get_safe_report_requirements',
];
const USER_PROJECT_TABLE = '[projects."X"]\ntrust_level = "trusted"\n';
const OTHER_MCP_TABLE = '[mcp_servers.other]\ncommand = "/usr/bin/other-mcp"\nargs = ["--keep"]\nenabled = true\n';

async function writeConfig(dir: string, content: string) {
  await fs.writeFile(path.join(dir, 'config.toml'), content, 'utf8');
}

async function readConfig(dir: string) {
  return fs.readFile(path.join(dir, 'config.toml'), 'utf8');
}

async function writeConfigWithUserTables(dir: string, paths: ScopePaths, packageRoot: string, enabled: boolean) {
  const block = buildMcpBlock(paths, packageRoot, enabled).replace(
    '# JUTELL_CLI_MCP_END',
    `${USER_PROJECT_TABLE}\n${OTHER_MCP_TABLE}# JUTELL_CLI_MCP_END`,
  );
  await writeConfig(dir, `${block}\n`);
}

async function expectUserTablesPreserved(dir: string) {
  const content = await readConfig(dir);
  expect(content).toContain(USER_PROJECT_TABLE);
  expect(content).toContain(OTHER_MCP_TABLE);
  return content;
}

function expectCanonicalBlockContainsOnlyJuTell(content: string) {
  const block = content.match(/# JUTELL_CLI_MCP_BEGIN[\s\S]*?# JUTELL_CLI_MCP_END/)?.[0];
  expect(block).toBeTruthy();
  expect(block).toContain('[mcp_servers.jutell]');
  expect(block).not.toContain('[projects."X"]');
  expect(block).not.toContain('[mcp_servers.other]');
}

function expectReadOnlyToolApprovals(content: string) {
  const block = content.match(/# JUTELL_CLI_MCP_BEGIN[\s\S]*?# JUTELL_CLI_MCP_END/)?.[0] ?? '';
  const tables = [...block.matchAll(/^\[mcp_servers\.jutell(?:\.tools\.([^\]]+))?\]$/gm)];
  expect(tables.map((table) => table[1] ?? 'server')).toEqual(['server', ...READ_ONLY_MCP_TOOLS]);
  expect(block.match(/^default_tools_approval_mode = "prompt"$/gm)).toHaveLength(1);
  expect(block.match(/^approval_mode = "approve"$/gm)).toHaveLength(5);
  for (const tool of READ_ONLY_MCP_TOOLS) {
    expect(block).toContain(`[mcp_servers.jutell.tools.${tool}]\napproval_mode = "approve"`);
  }
}

async function backupExists(dir: string) {
  try {
    await fs.access(path.join(dir, 'config.toml.previous'));
    return true;
  } catch {
    return false;
  }
}

function countCanonicalHeaders(content: string) {
  return (content.match(/^\s*\[mcp_servers\.jutell\]\s*$/gm) ?? []).length;
}

describe('registerMcp - canonical Codex MCP registration currency (managed block)', () => {
  it('CASE 1: does not rewrite an already-correct, already-enabled managed registration', async () => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);
    const correctBlock = buildMcpBlock(paths, FAKE_PACKAGE_ROOT, true);
    await writeConfig(dir, `${correctBlock}\n`);

    const result = await registerMcp(paths, FAKE_PACKAGE_ROOT, true);

    expect(result.canonicalUpToDate).toBe(true);
    expect(await backupExists(dir)).toBe(false); // no backup => no rewrite happened
    expect(await readConfig(dir)).toBe(`${correctBlock}\n`); // byte-for-byte unchanged
    expectReadOnlyToolApprovals(await readConfig(dir));
    expect(countCanonicalHeaders(await readConfig(dir))).toBe(1);
  });

  it('registers per-tool approval for exactly the five read-only JuTell tools', async () => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);

    const result = await registerMcp(paths, FAKE_PACKAGE_ROOT, true);

    expect(result.canonicalUpToDate).toBe(true);
    expectReadOnlyToolApprovals(await readConfig(dir));
  });

  it('rewrites the old managed block to add tool approvals and preserves embedded user tables', async () => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);
    const oldBlock = [
      '# JUTELL_CLI_MCP_BEGIN',
      '[mcp_servers.jutell]',
      `command = ${JSON.stringify(process.execPath)}`,
      `args = [${JSON.stringify(path.join(FAKE_PACKAGE_ROOT, 'assets', 'mcp-server', 'index.js'))}]`,
      'enabled = true',
      'required = false',
      'default_tools_approval_mode = "prompt"',
      USER_PROJECT_TABLE.trimEnd(),
      OTHER_MCP_TABLE.trimEnd(),
      '# JUTELL_CLI_MCP_END',
    ].join('\n');
    await writeConfig(dir, `${oldBlock}\n`);

    const before = await readCodexRegistration(paths, FAKE_PACKAGE_ROOT, true);
    expect(before.canonicalUpToDate).toBe(false);

    const result = await registerMcp(paths, FAKE_PACKAGE_ROOT, true);

    const finalContent = await expectUserTablesPreserved(dir);
    expect(result.canonicalUpToDate).toBe(true);
    expectReadOnlyToolApprovals(finalContent);
    expectCanonicalBlockContainsOnlyJuTell(finalContent);
  });

  it('CASE 2/3: repairs a stale Windows-path managed registration on the current machine', async () => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);
    const staleBlock = [
      '# JUTELL_CLI_MCP_BEGIN',
      '[mcp_servers.jutell]',
      'command = "C:/Program Files/nodejs/node.exe"',
      'args = ["C:/Users/someone/AppData/Roaming/npm/node_modules/jutell/assets/mcp-server/index.js"]',
      'enabled = true',
      'required = false',
      'default_tools_approval_mode = "prompt"',
      '# JUTELL_CLI_MCP_END',
    ].join('\n');
    await writeConfig(dir, `${staleBlock}\n`);

    const before = await readCodexRegistration(paths, FAKE_PACKAGE_ROOT, true);
    expect(before.canonicalRegistered).toBe(true);
    expect(before.enabled).toBe(true); // enabled already matches - old code would have stopped here
    expect(before.canonicalUpToDate).toBe(false); // but the command/args are stale

    const result = await registerMcp(paths, FAKE_PACKAGE_ROOT, true);

    expect(await backupExists(dir)).toBe(true); // a rewrite did happen, and it was backed up first
    const finalContent = await readConfig(dir);
    expect(finalContent).toContain(`command = ${JSON.stringify(process.execPath)}`);
    expect(finalContent).not.toContain('C:/Program Files/nodejs/node.exe');
    expect(countCanonicalHeaders(finalContent)).toBe(1); // no leftover duplicate table
    expect(result.canonicalUpToDate).toBe(true);
    expect(result.enabled).toBe(true);
  });

  it('CASE 3: repairs a stale runtime path even on the same OS (different install location)', async () => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);
    const oldPackageRoot = '/opt/old-jutell-install';
    const staleBlock = buildMcpBlock(paths, oldPackageRoot, true);
    await writeConfig(dir, `${staleBlock}\n`);

    const result = await registerMcp(paths, FAKE_PACKAGE_ROOT, true);

    const finalContent = await readConfig(dir);
    expect(finalContent).toContain(FAKE_PACKAGE_ROOT);
    expect(finalContent).not.toContain(oldPackageRoot);
    expect(countCanonicalHeaders(finalContent)).toBe(1);
    expect(result.canonicalUpToDate).toBe(true);
  });

  it('CASE 2 (unmarked/heuristic variant): repairs a stale pre-marker-era entry without leaving a duplicate table', async () => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);
    // No JUTELL_CLI_MCP markers - only recognizable via the assets/mcp-server heuristic.
    const staleUnmarked = [
      '[mcp_servers.jutell]',
      'command = "C:/Program Files/nodejs/node.exe"',
      'args = ["C:/Users/someone/AppData/Roaming/npm/node_modules/jutell/assets/mcp-server/index.js"]',
      'enabled = true',
    ].join('\n');
    await writeConfig(dir, `${staleUnmarked}\n`);

    const before = await readCodexRegistration(paths, FAKE_PACKAGE_ROOT, true);
    expect(before.registered).toBe(true); // recognized via heuristic
    expect(before.conflict).toBe(false);
    expect(before.canonicalUpToDate).toBe(false);

    await registerMcp(paths, FAKE_PACKAGE_ROOT, true);

    const finalContent = await readConfig(dir);
    expect(countCanonicalHeaders(finalContent)).toBe(1); // the old bare table must not survive alongside the new managed one
    expect(finalContent).toContain(`command = ${JSON.stringify(process.execPath)}`);
    expect(finalContent).toContain('# JUTELL_CLI_MCP_BEGIN');
  });

  it('CASE 4: still repairs when only `enabled` differs (existing behavior preserved)', async () => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);
    const disabledBlock = buildMcpBlock(paths, FAKE_PACKAGE_ROOT, false);
    await writeConfig(dir, `${disabledBlock}\n`);

    const result = await registerMcp(paths, FAKE_PACKAGE_ROOT, true);

    expect(await backupExists(dir)).toBe(true);
    expect(result.enabled).toBe(true);
    expect(result.canonicalUpToDate).toBe(true);
    expect(countCanonicalHeaders(await readConfig(dir))).toBe(1);
  });

  it('CASE 5: does not touch an unrelated, unrecognized custom `jutell` MCP entry (conflict safety)', async () => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);
    const unrelated = [
      '[mcp_servers.jutell]',
      'command = "/usr/bin/some-other-tool"',
      'args = ["--serve"]',
      'enabled = true',
    ].join('\n');
    await writeConfig(dir, `${unrelated}\n`);

    const before = await readCodexRegistration(paths, FAKE_PACKAGE_ROOT, true);
    expect(before.conflict).toBe(true);

    await expect(registerMcp(paths, FAKE_PACKAGE_ROOT, true)).rejects.toThrow();

    expect(await backupExists(dir)).toBe(false);
    expect(await readConfig(dir)).toBe(`${unrelated}\n`); // completely untouched
  });

  it('CASE 6: leaves a legacy beginner_bridge registration untouched when adding/repairing canonical', async () => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);
    const legacyBlock = [
      '# BEGINNER_BRIDGE_CLI_MCP_BEGIN',
      '[mcp_servers.beginner_bridge]',
      'command = "C:/Program Files/nodejs/node.exe"',
      'args = ["C:/Users/someone/AppData/Roaming/npm/node_modules/jutell/assets/mcp-server/index.js"]',
      'enabled = true',
      '# BEGINNER_BRIDGE_CLI_MCP_END',
    ].join('\n');
    await writeConfig(dir, `${legacyBlock}\n`);

    await registerMcp(paths, FAKE_PACKAGE_ROOT, true);

    const finalContent = await readConfig(dir);
    // Legacy block's own stale Windows path must survive byte-for-byte - registerMcp only
    // manages the canonical `jutell` key, never legacy `beginner_bridge`.
    expect(finalContent).toContain(legacyBlock);
    // And the canonical key was still correctly added alongside it.
    expect(finalContent).toContain(`command = ${JSON.stringify(process.execPath)}`);
    expect(countCanonicalHeaders(finalContent)).toBe(1);
  });

  it('preserves user tables inside the canonical block while re-registering, then keeps the JuTell block clean', async () => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);
    // Even an otherwise current entry must be rewritten to move user tables out of the block.
    await writeConfigWithUserTables(dir, paths, FAKE_PACKAGE_ROOT, true);

    await registerMcp(paths, FAKE_PACKAGE_ROOT, true);

    const finalContent = await expectUserTablesPreserved(dir);
    expectCanonicalBlockContainsOnlyJuTell(finalContent);
    expect(countCanonicalHeaders(finalContent)).toBe(1);
  });

  it('preserves user tables inside the canonical block when disabling MCP', async () => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);
    await writeConfigWithUserTables(dir, paths, FAKE_PACKAGE_ROOT, true);

    await registerMcp(paths, FAKE_PACKAGE_ROOT, false);

    const finalContent = await expectUserTablesPreserved(dir);
    expectCanonicalBlockContainsOnlyJuTell(finalContent);
    expect(finalContent).toContain('enabled = false');
  });

  it('preserves user tables inside the canonical block when upgrade refreshes a stale MCP path', async () => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);
    await writeConfigWithUserTables(dir, paths, '/opt/old-jutell-install', true);

    // upgradeCommand refreshes an existing canonical registration through registerMcp().
    await registerMcp(paths, FAKE_PACKAGE_ROOT, true);

    const finalContent = await expectUserTablesPreserved(dir);
    expectCanonicalBlockContainsOnlyJuTell(finalContent);
    expect(finalContent).toContain(FAKE_PACKAGE_ROOT);
    expect(finalContent).not.toContain('/opt/old-jutell-install');
  });

  it('preserves user tables inside the canonical block when uninstall removes the JuTell MCP entry', async () => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);
    await writeConfigWithUserTables(dir, paths, FAKE_PACKAGE_ROOT, true);

    await removeMcp(paths, FAKE_PACKAGE_ROOT);

    const finalContent = await expectUserTablesPreserved(dir);
    expect(finalContent).not.toContain('# JUTELL_CLI_MCP_BEGIN');
    expect(finalContent).not.toContain('[mcp_servers.jutell]');
  });
});
