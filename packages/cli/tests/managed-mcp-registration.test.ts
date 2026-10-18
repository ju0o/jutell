import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'smol-toml';
import { afterEach, describe, expect, it } from 'vitest';
import { buildMcpBlock, readCodexRegistration, READ_ONLY_MCP_TOOLS, registerMcp, removeManagedBlocksPreserving, removeMcp } from '../src/config/managed.js';
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
const USER_PROJECT_TABLE = '[projects."X"]\ntrust_level = "trusted"\n';
const OTHER_MCP_TABLE = '[mcp_servers.other]\ncommand = "/usr/bin/other-mcp"\nargs = ["--keep"]\nenabled = true\n';

async function writeConfig(dir: string, content: string) {
  await fs.writeFile(path.join(dir, 'config.toml'), content, 'utf8');
}

async function readConfig(dir: string) {
  return fs.readFile(path.join(dir, 'config.toml'), 'utf8');
}

function outsideCanonicalBlock(content: string) {
  return content.replace(/# JUTELL_CLI_MCP_BEGIN[\s\S]*?# JUTELL_CLI_MCP_END/, '');
}

async function setOldMtime(file: string) {
  const oldTime = new Date('2000-01-01T00:00:00.000Z');
  await fs.utimes(file, oldTime, oldTime);
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
  it('does not rewrite after moving embedded user tables and returns the same result on repeat', async () => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);
    await writeConfigWithUserTables(dir, paths, FAKE_PACKAGE_ROOT, true);

    const firstResult = await registerMcp(paths, FAKE_PACKAGE_ROOT, true);
    const firstContent = await expectUserTablesPreserved(dir);
    expectCanonicalBlockContainsOnlyJuTell(firstContent);

    await setOldMtime(paths.codexConfigFile);
    const beforeBytes = await fs.readFile(paths.codexConfigFile);
    const beforeMtime = (await fs.stat(paths.codexConfigFile)).mtimeMs;
    const secondResult = await registerMcp(paths, FAKE_PACKAGE_ROOT, true);

    expect(secondResult).toEqual(firstResult);
    expect(await fs.readFile(paths.codexConfigFile)).toEqual(beforeBytes);
    expect((await fs.stat(paths.codexConfigFile)).mtimeMs).toBe(beforeMtime);
  });

  it('preserves the exact text outside the managed block when registering', async () => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);
    const outside = [
      'model = "gpt-5.5"',
      '',
      '[projects."/workspace/one"]',
      'trust_level = "trusted"',
      '',
      '[projects."/workspace/two"]',
      'trust_level = "untrusted"',
      '',
      OTHER_MCP_TABLE.trimEnd(),
    ].join('\n');
    const staleBlock = buildMcpBlock(paths, '/opt/old-jutell-package', true);
    const original = `${outside}\n\n${staleBlock}\n`;
    await writeConfig(dir, original);

    await registerMcp(paths, FAKE_PACKAGE_ROOT, true);

    const finalContent = await readConfig(dir);
    expect(outsideCanonicalBlock(finalContent)).toBe(outsideCanonicalBlock(original));
    expect(() => parse(finalContent)).not.toThrow();
  });

  it.each(['register', 'remove'] as const)('keeps valid TOML and project tables with a missing END marker during %s', async (operation) => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);
    const incompleteBlock = [
      '# JUTELL_CLI_MCP_BEGIN',
      '[mcp_servers.jutell]',
      `command = ${JSON.stringify(process.execPath)}`,
      `args = [${JSON.stringify(path.join(FAKE_PACKAGE_ROOT, 'assets', 'mcp-server', 'index.js'))}]`,
      'enabled = true',
      USER_PROJECT_TABLE.trimEnd(),
    ].join('\n');
    await writeConfig(dir, `${incompleteBlock}\n`);

    if (operation === 'register') await registerMcp(paths, FAKE_PACKAGE_ROOT, true);
    else await removeMcp(paths, FAKE_PACKAGE_ROOT);

    const finalContent = await readConfig(dir);
    expect(() => parse(finalContent)).not.toThrow();
    expect(finalContent).toContain(USER_PROJECT_TABLE.trimEnd());
    const parsed = parse(finalContent) as { projects?: Record<string, { trust_level?: string }> };
    expect(parsed.projects?.X?.trust_level).toBe('trusted');
  });

  it('preserves CRLF user tables and does not rewrite on a second register', async () => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);
    const blockWithUserTables = buildMcpBlock(paths, FAKE_PACKAGE_ROOT, true).replace(
      '# JUTELL_CLI_MCP_END',
      `${USER_PROJECT_TABLE.trimEnd()}\n${OTHER_MCP_TABLE.trimEnd()}# JUTELL_CLI_MCP_END`,
    ).replace(/\n/g, '\r\n');
    await writeConfig(dir, `${blockWithUserTables}\r\n`);

    await registerMcp(paths, FAKE_PACKAGE_ROOT, true);

    const content = await readConfig(dir);
    expect(content).toContain(USER_PROJECT_TABLE.replace(/\n/g, '\r\n').trimEnd());
    expect(content).toContain(OTHER_MCP_TABLE.replace(/\n/g, '\r\n').trimEnd());
    expect(() => parse(content)).not.toThrow();

    await setOldMtime(paths.codexConfigFile);
    const beforeBytes = await fs.readFile(paths.codexConfigFile);
    const beforeMtime = (await fs.stat(paths.codexConfigFile)).mtimeMs;
    await registerMcp(paths, FAKE_PACKAGE_ROOT, true);

    expect(await fs.readFile(paths.codexConfigFile)).toEqual(beforeBytes);
    expect((await fs.stat(paths.codexConfigFile)).mtimeMs).toBe(beforeMtime);
  });

  it('preserves array tables and their comments from inside the managed block', async () => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);
    const userArrayTable = '[[array]]\n# Keep this user comment.\nname = "retained"\n';
    const block = buildMcpBlock(paths, FAKE_PACKAGE_ROOT, true).replace(
      '# JUTELL_CLI_MCP_END',
      `${userArrayTable}# JUTELL_CLI_MCP_END`,
    );
    await writeConfig(dir, `${block}\n`);

    await registerMcp(paths, FAKE_PACKAGE_ROOT, true);

    const finalContent = await readConfig(dir);
    expect(finalContent).toContain(userArrayTable.trimEnd());
    const parsed = parse(finalContent) as { array?: Array<{ name: string }> };
    expect(parsed.array).toEqual([{ name: 'retained' }]);
  });

  it('keeps READ_ONLY_MCP_TOOLS in parity with the MCP server registrations', async () => {
    const source = await fs.readFile(new URL('../../../apps/mcp-server/src/index.ts', import.meta.url), 'utf8');
    const registeredTools = [...source.matchAll(/registerTool\(\s*'([a-z_]+)'/g)].map((match) => match[1]);

    expect(READ_ONLY_MCP_TOOLS).toEqual(registeredTools);
  });

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

  it('does not rewrite after removing a block with embedded user tables and returns the same result on repeat', async () => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);
    await writeConfigWithUserTables(dir, paths, FAKE_PACKAGE_ROOT, true);

    const firstResult = await removeMcp(paths, FAKE_PACKAGE_ROOT);
    const firstContent = await expectUserTablesPreserved(dir);
    expect(firstContent).not.toContain('# JUTELL_CLI_MCP_BEGIN');
    expect(firstContent).not.toContain('[mcp_servers.jutell]');

    await setOldMtime(paths.codexConfigFile);
    const beforeBytes = await fs.readFile(paths.codexConfigFile);
    const beforeMtime = (await fs.stat(paths.codexConfigFile)).mtimeMs;
    const secondResult = await removeMcp(paths, FAKE_PACKAGE_ROOT);

    expect(secondResult).toEqual(firstResult);
    expect(await fs.readFile(paths.codexConfigFile)).toEqual(beforeBytes);
    expect((await fs.stat(paths.codexConfigFile)).mtimeMs).toBe(beforeMtime);
  });
});

describe('removeMcp - legacy marker table preservation', () => {
  const oldMarkerKinds = [
    {
      name: 'BEGINNER_BRIDGE_CLI_MCP',
      begin: '# BEGINNER_BRIDGE_CLI_MCP_BEGIN',
      end: '# BEGINNER_BRIDGE_CLI_MCP_END',
    },
    {
      name: 'BEGINNER_BRIDGE_MCP',
      begin: '# BEGINNER_BRIDGE_MCP_BEGIN',
      end: '# BEGINNER_BRIDGE_MCP_END',
    },
  ];

  it.each(oldMarkerKinds)('preserves user tables inside the $name block', async ({ begin, end }) => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);
    const content = [
      begin,
      '[mcp_servers.beginner_bridge]',
      'command = "/opt/legacy/mcp-server"',
      '[projects."LEGACY"]',
      'trust_level = "trusted"',
      end,
      '',
    ].join('\n');
    await writeConfig(dir, content);

    await removeMcp(paths, FAKE_PACKAGE_ROOT);

    const result = await readConfig(dir);
    expect(result).toContain('[projects."LEGACY"]\ntrust_level = "trusted"');
    expect(result).not.toContain('[mcp_servers.beginner_bridge]');
  });
});

describe('removeManagedBlocksPreserving', () => {
  it('preserves project tables while removing the legacy MCP table from old marker blocks', () => {
    const content = [
      '# BEGINNER_BRIDGE_MCP_BEGIN',
      '[mcp_servers.beginner_bridge]',
      'command = "/opt/legacy/mcp-server"',
      '[projects."LEGACY"]',
      'trust_level = "trusted"',
      '# BEGINNER_BRIDGE_MCP_END',
      '',
    ].join('\n');

    const result = removeManagedBlocksPreserving(content, false);

    expect(result).toContain('[projects."LEGACY"]\ntrust_level = "trusted"');
    expect(result).not.toContain('[mcp_servers.beginner_bridge]');
  });
});

describe('registerMcp and removeMcp - final TOML validation', () => {
  it('removes a stray JuTell tool subtable outside the managed block before registering', async () => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);
    const staleBlock = buildMcpBlock(paths, '/opt/old-jutell-package', true);
    const strayToolTable = [
      '[mcp_servers.jutell.tools.get_bridge_status]',
      'approval_mode = "approve"',
    ].join('\n');
    await writeConfig(dir, `${staleBlock}\n${strayToolTable}\n`);

    await registerMcp(paths, FAKE_PACKAGE_ROOT, true);

    const content = await readConfig(dir);
    expect(() => parse(content)).not.toThrow();
    const toolTables = [...content.matchAll(/^\[mcp_servers\.jutell\.tools\.([^\]]+)\]$/gm)].map((match) => match[1]);
    expect(toolTables).toEqual(READ_ONLY_MCP_TOOLS);
    expect(countCanonicalHeaders(content)).toBe(1);
  });

  it('preserves a user JuTell environment table when registering', async () => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);
    const staleBlock = buildMcpBlock(paths, '/opt/old-jutell-package', true);
    const staleRootTable = staleBlock
      .slice(staleBlock.indexOf('[mcp_servers.jutell]'))
      .split(/(?=^\[)/m)[0]
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n')
      .trimEnd();
    const userEnvTable = [
      '[mcp_servers.jutell.env]',
      'FOO = "bar"',
    ].join('\n');
    await writeConfig(dir, `${staleRootTable}\n\n${userEnvTable}\n`);

    await registerMcp(paths, FAKE_PACKAGE_ROOT, true);

    const content = await readConfig(dir);
    expect(content).toContain(userEnvTable);
    expect(() => parse(content)).not.toThrow();
    expect(countCanonicalHeaders(content)).toBe(1);
  });

  it('replaces all canonical blocks while preserving user tables from each block', async () => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);
    const firstBlock = buildMcpBlock(paths, '/opt/old-jutell-package', true).replace(
      '# JUTELL_CLI_MCP_END',
      `${USER_PROJECT_TABLE.trimEnd()}\n# JUTELL_CLI_MCP_END`,
    );
    const secondBlock = buildMcpBlock(paths, '/opt/old-jutell-package', true).replace(
      '# JUTELL_CLI_MCP_END',
      '[projects."Y"]\ntrust_level = "trusted"\n# JUTELL_CLI_MCP_END',
    );
    await writeConfig(dir, `${firstBlock}\n\n${secondBlock}\n`);

    await registerMcp(paths, FAKE_PACKAGE_ROOT, true);
    await registerMcp(paths, FAKE_PACKAGE_ROOT, true);

    const content = await readConfig(dir);
    expect(() => parse(content)).not.toThrow();
    expect(countCanonicalHeaders(content)).toBe(1);
    expect(content).toContain(USER_PROJECT_TABLE.trimEnd());
    expect(content).toContain('[projects."Y"]\ntrust_level = "trusted"');
  });

  it('refuses to write an invalid register result and leaves original bytes unchanged', async () => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);
    const staleBlock = buildMcpBlock(paths, '/opt/old-jutell-package', true);
    const duplicateUnrelatedTable = [
      '[unrelated]',
      'value = 1',
      '',
      '[unrelated]',
      'value = 2',
    ].join('\n');
    const original = `${staleBlock}\n${duplicateUnrelatedTable}\n`;
    await writeConfig(dir, original);

    await expect(registerMcp(paths, FAKE_PACKAGE_ROOT, true)).rejects.toThrow('유효하지 않은 TOML');

    expect(await readConfig(dir)).toBe(original);
  });

  it('refuses to write an invalid remove result and leaves original bytes unchanged', async () => {
    const dir = await mkdtemp();
    const paths = await scopePaths(dir);
    const registeredBlock = buildMcpBlock(paths, FAKE_PACKAGE_ROOT, true);
    const duplicateUnrelatedTable = [
      '[unrelated]',
      'value = 1',
      '',
      '[unrelated]',
      'value = 2',
    ].join('\n');
    const original = `${registeredBlock}\n${duplicateUnrelatedTable}\n`;
    await writeConfig(dir, original);

    await expect(removeMcp(paths, FAKE_PACKAGE_ROOT)).rejects.toThrow('유효하지 않은 TOML');

    expect(await readConfig(dir)).toBe(original);
  });
});
