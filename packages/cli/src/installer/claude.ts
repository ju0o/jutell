import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { readText } from '../config/managed.js';
import { claudeHome } from '../config/paths.js';
import type { ScopePaths } from '../types.js';

export const CLAUDE_MCP_KEY = 'jutell';

export type ClaudeRegistration = {
  file: string;
  claudeScope: 'local' | 'user';
  exists: boolean;
  registered: boolean;
  conflict: boolean;
  enabled: boolean;
  canonicalRegistered: boolean;
  legacyRegistered: boolean;
  bothRegistered: boolean;
  preview: string;
};

function normalizeForCompare(value: string) {
  return value.replace(/\\/g, '/').toLowerCase();
}

/**
 * Real Claude Code has no per-project `.codex`-style file: `local` scope
 * (JuTell's `--project`, the default) and `user` scope (JuTell `--global`)
 * both live in the *same* `.claude.json`, keyed either by the exact
 * project path (`projects[path].mcpServers`) or at the top level
 * (`mcpServers`). Verified empirically with an isolated `CLAUDE_CONFIG_DIR`
 * across all three of Claude's own scopes (local/user/project); `project`
 * (`.mcp.json`, git-shared) was not chosen for JuTell because Claude leaves
 * servers registered there `⏸ Pending approval` until a human approves them
 * in an interactive session - that would violate "no manual config
 * hacking" for the very first connection.
 */
function claudeScopeFor(paths: ScopePaths): 'local' | 'user' {
  return paths.scope === 'global' ? 'user' : 'local';
}

async function readClaudeConfig(paths: ScopePaths): Promise<Record<string, unknown> | undefined> {
  const text = await readText(paths.claudeConfigFile);
  if (!text || !text.trim()) return {};
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  } catch { return undefined; }
}

function findMcpServers(config: Record<string, unknown>, paths: ScopePaths): Record<string, unknown> | undefined {
  if (claudeScopeFor(paths) === 'user') {
    const top = config.mcpServers;
    return top && typeof top === 'object' && !Array.isArray(top) ? top as Record<string, unknown> : undefined;
  }
  const projects = config.projects;
  if (!projects || typeof projects !== 'object' || Array.isArray(projects)) return undefined;
  const target = normalizeForCompare(paths.targetRoot);
  for (const [key, value] of Object.entries(projects as Record<string, unknown>)) {
    if (normalizeForCompare(key) !== target) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const mcp = (value as Record<string, unknown>).mcpServers;
    return mcp && typeof mcp === 'object' && !Array.isArray(mcp) ? mcp as Record<string, unknown> : undefined;
  }
  return undefined;
}

function expectedCommand(packageRoot: string) {
  return { command: process.execPath, args: [path.join(packageRoot, 'assets', 'mcp-server', 'index.js')] };
}

function commandMatches(entry: unknown, packageRoot: string) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
  const value = entry as Record<string, unknown>;
  const { command } = expectedCommand(packageRoot);
  if (value.command !== command) return false;
  const args = Array.isArray(value.args) ? value.args as unknown[] : [];
  return args.some((a) => typeof a === 'string' && a.includes('mcp-server'));
}

export function buildClaudePreview(claudeScope: 'local' | 'user', packageRoot: string) {
  const { command, args } = expectedCommand(packageRoot);
  return JSON.stringify({ scope: claudeScope, type: 'stdio', command, args }, null, 2);
}

export async function readClaudeRegistration(paths: ScopePaths, packageRoot: string, _enabled: boolean): Promise<ClaudeRegistration> {
  const claudeScope = claudeScopeFor(paths);
  const config = await readClaudeConfig(paths);
  const servers = config ? findMcpServers(config, paths) : undefined;
  const entry = servers?.[CLAUDE_MCP_KEY];
  const registered = entry !== undefined;
  // The `jutell` key is reserved across every JuTell provider adapter, so
  // any existing entry under that name is treated as ours to manage
  // (refreshed in place if its command/args drifted) rather than a
  // conflict - unlike Codex/OpenCode, Claude has no historical legacy key
  // to coexist with here (this is a brand-new adapter; providers.ts had it
  // marked `planned` until this cycle, so no prior Claude JuTell state
  // exists to preserve).
  return {
    file: paths.claudeConfigFile,
    claudeScope,
    exists: Boolean(config && Object.keys(config).length > 0),
    registered,
    conflict: false,
    enabled: registered,
    canonicalRegistered: registered,
    legacyRegistered: false,
    bothRegistered: false,
    preview: buildClaudePreview(claudeScope, packageRoot),
  };
}

// Windows can only launch the `claude` npm shim (a .cmd file) through a
// shell, but `execFileSync`'s shell mode does not itself quote arguments -
// it just space-joins them, so any argument containing a space (a `node.exe`
// path under "Program Files", for instance) silently gets cut at the first
// space. Quote every argument ourselves before it reaches cmd.exe.
function quoteForWindowsShell(value: string) {
  if (value === '') return '""';
  if (!/[\s"^&|<>()]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function runClaude(args: string[], paths: ScopePaths) {
  const isWindows = process.platform === 'win32';
  return execFileSync('claude', isWindows ? args.map(quoteForWindowsShell) : args, {
    cwd: paths.targetRoot,
    env: { ...process.env, CLAUDE_CONFIG_DIR: claudeHome() },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: isWindows,
    encoding: 'utf8',
  });
}

export async function registerClaudeMcp(paths: ScopePaths, packageRoot: string, enabled: boolean): Promise<ClaudeRegistration> {
  const current = await readClaudeRegistration(paths, packageRoot, enabled);
  const config = await readClaudeConfig(paths);
  if (config === undefined) throw new Error('Claude Code 설정 파일을 읽지 못해 자동 변경하지 않았습니다.');
  const servers = findMcpServers(config, paths);
  const claudeScope = current.claudeScope;
  if (current.registered && commandMatches(servers?.[CLAUDE_MCP_KEY], packageRoot)) return current; // idempotent, already correct
  if (current.registered) {
    // Existing `jutell` entry points somewhere else (stale reinstall) -
    // refresh it in place rather than leaving two inconsistent states.
    try { runClaude(['mcp', 'remove', '-s', claudeScope, CLAUDE_MCP_KEY], paths); } catch { /* fall through to add */ }
  }
  const { command, args } = expectedCommand(packageRoot);
  try {
    runClaude(['mcp', 'add', '-s', claudeScope, CLAUDE_MCP_KEY, '--', command, ...args], paths);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Claude Code MCP 등록에 실패했습니다: ${message}`);
  }
  return readClaudeRegistration(paths, packageRoot, enabled);
}

export async function removeClaudeMcp(paths: ScopePaths, packageRoot: string): Promise<ClaudeRegistration> {
  const current = await readClaudeRegistration(paths, packageRoot, false);
  if (!current.registered) return current;
  try {
    runClaude(['mcp', 'remove', '-s', current.claudeScope, CLAUDE_MCP_KEY], paths);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Claude Code MCP 제거에 실패했습니다: ${message}`);
  }
  return readClaudeRegistration(paths, packageRoot, false);
}
