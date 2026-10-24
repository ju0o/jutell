import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AssetPaths, InstallScope, ScopePaths } from '../types.js';

export function packageRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

export function assets(): AssetPaths {
  const root = path.join(packageRoot(), 'assets');
  return {
    root,
    skill: path.join(root, 'skill'),
    mcpServer: path.join(root, 'mcp-server'),
    localAdmin: path.join(root, 'local-admin'),
    localAdminServer: path.join(root, 'local-admin-server.js'),
    defaultConfig: path.join(root, 'default-config.json'),
    version: path.join(root, 'version.json'),
  };
}

export function codexHome() {
  const override = process.env.CODEX_HOME;
  return path.resolve(override && override.trim() ? override : path.join(userHome(), '.codex'));
}

export function opencodeConfigDir() {
  return path.join(userHome(), '.config', 'opencode');
}

/**
 * Real Claude Code CLI reads its own profile (settings, credentials, and
 * `.claude.json`) from `$CLAUDE_CONFIG_DIR` when set, otherwise the user's
 * home directory directly (verified: `.claude.json` sits at
 * `<CLAUDE_CONFIG_DIR>/.claude.json`, not inside a `.claude/` subfolder).
 * `userHome()` is used as the fallback base (not raw `os.homedir()`) purely
 * so JuTell's own JUTELL_HOME/BEGINNER_BRIDGE_HOME test-isolation override
 * also isolates Claude by default; every subprocess call this CLI makes to
 * the real `claude` binary explicitly passes CLAUDE_CONFIG_DIR set to this
 * same value, so the two can never disagree about which file is meant.
 */
export function claudeHome() {
  const override = process.env.CLAUDE_CONFIG_DIR;
  return path.resolve(override && override.trim() ? override : userHome());
}

export function userHome() {
  const override = process.env.JUTELL_HOME ?? process.env.BEGINNER_BRIDGE_HOME;
  return path.resolve(override && override.trim() ? override : os.homedir());
}

export function resolveProjectRoot(
  cwd = process.cwd(),
  installedPackageRoot = packageRoot(),
  npmLocalPrefix = process.env.npm_config_local_prefix,
): string {
  const callerRoot = path.resolve(cwd);
  if (!npmLocalPrefix?.trim()) return callerRoot;

  const localPrefix = path.resolve(npmLocalPrefix);
  const packageRelativeToPrefix = path.relative(localPrefix, path.resolve(installedPackageRoot));
  if (packageRelativeToPrefix === path.join('node_modules', 'jutell')) return localPrefix;
  return callerRoot;
}

export function resolveScope(scope: InstallScope, cwd?: string): ScopePaths {
  if (scope === 'global') {
    const home = userHome();
    return {
      scope,
      targetRoot: home,
      skillRoot: path.join(home, '.agents', 'skills', 'beginner-bridge'),
      configFile: path.join(home, '.jutell.json'),
      legacyConfigFile: path.join(home, '.beginner-bridge.json'),
      codexConfigFile: path.join(codexHome(), 'config.toml'),
      opencodeConfigFile: path.join(opencodeConfigDir(), 'opencode.json'),
      claudeConfigFile: path.join(claudeHome(), '.claude.json'),
      dataRoot: path.join(home, '.jutell-local'),
      legacyDataRoot: path.join(home, '.beginner-bridge-local'),
    };
  }
  const projectRoot = path.resolve(cwd ?? resolveProjectRoot());
  return {
    scope,
    targetRoot: projectRoot,
    skillRoot: path.join(projectRoot, '.agents', 'skills', 'beginner-bridge'),
    configFile: path.join(projectRoot, '.jutell.json'),
    legacyConfigFile: path.join(projectRoot, '.beginner-bridge.json'),
    codexConfigFile: path.join(projectRoot, '.codex', 'config.toml'),
    opencodeConfigFile: path.join(projectRoot, 'opencode.json'),
    // Claude's own file location never varies by JuTell's scope choice -
    // only *which key inside it* (top-level `mcpServers` for global/user,
    // `projects[targetRoot].mcpServers` for project/local) does. See
    // installer/claude.ts.
    claudeConfigFile: path.join(claudeHome(), '.claude.json'),
    dataRoot: path.join(projectRoot, '.jutell-local'),
    legacyDataRoot: path.join(projectRoot, '.beginner-bridge-local'),
  };
}

export function safeLocation(scope: InstallScope, kind: 'config' | 'codex') {
  if (kind === 'codex') return '사용자 Codex 설정 (전역)';
  if (scope === 'global') return '사용자 전역 설정';
  return '현재 프로젝트/.jutell.json';
}

/**
 * Real Codex CLI only reads MCP server definitions from its global
 * `$CODEX_HOME/config.toml` — it never consumes a project-scoped
 * `<project>/.codex/config.toml` (verified empirically: `codex mcp list`
 * returns no servers when only a project-scope file exists). So any
 * ScopePaths used to read/write/remove a Codex MCP registration must
 * always target the real global file, regardless of the invocation's
 * `--project`/`--global` scope — otherwise JuTell would report success
 * while Codex never actually sees the server. `.jutell.json`, the Skill,
 * and the AGENTS.md block are unaffected and keep following the
 * requested scope; only the Codex MCP file location is forced.
 *
 * Official docs (https://developers.openai.com/codex/mcp, checked 2026-10-24):
 * "you can also scope MCP servers to a project with `.codex/config.toml`
 * (trusted projects only)" and "The ChatGPT desktop app, Codex CLI, and IDE
 * extension share this configuration." JuTell still never writes the
 * project file: it only works in trusted projects, so the global file is the
 * one place every Codex client (CLI, app, IDE extension) reliably reads.
 */
export function codexScopedPaths(paths: ScopePaths): ScopePaths {
  return { ...paths, scope: 'global', codexConfigFile: path.join(codexHome(), 'config.toml') };
}
