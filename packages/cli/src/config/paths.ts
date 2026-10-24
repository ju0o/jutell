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
 */
export function codexScopedPaths(paths: ScopePaths): ScopePaths {
  return { ...paths, scope: 'global', codexConfigFile: path.join(codexHome(), 'config.toml') };
}

export type AppConfigPaths = {
  cursor: { global: string; project: string };
  /** undefined: not confirmed by the official docs for this OS (doctor: "문서로 확인 안 됨"). */
  claudeDesktop: string | undefined;
  /** Status only (decision 15): both documented locations. */
  windsurf: { current: string | undefined; legacy: string };
  vscode: {
    workspace: string;
    /** Linux: measured in W0 (VS Code 1.143.1 `code --add-mcp`). Other OS: not confirmed → undefined. */
    userProfile: string | undefined;
  };
  /** Status only (decision 16). */
  copilot: { user: string; project: string };
};

/**
 * Pure: every GUI app config path for a platform, so tests can play any OS.
 * Only paths from the plan's doc table (cycle-3/plan.md, checked 2026-10-24) or W0 measurement.
 * `home` defaults to userHome(), so JUTELL_HOME keeps isolating tests.
 */
export function appConfigPaths(platform: NodeJS.Platform, env: NodeJS.ProcessEnv, projectRoot: string, home: string = userHome()): AppConfigPaths {
  const p = platform === 'win32' ? path.win32 : path.posix;
  const appData = platform === 'win32' && env.APPDATA?.trim() && p.isAbsolute(env.APPDATA) ? env.APPDATA : undefined;
  const xdg = env.XDG_CONFIG_HOME?.trim() && p.isAbsolute(env.XDG_CONFIG_HOME) ? env.XDG_CONFIG_HOME : p.join(home, '.config');
  return {
    cursor: { global: p.join(home, '.cursor', 'mcp.json'), project: p.join(projectRoot, '.cursor', 'mcp.json') },
    claudeDesktop: platform === 'darwin'
      ? p.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
      : platform === 'win32'
        ? (appData ? p.join(appData, 'Claude', 'claude_desktop_config.json') : undefined)
        : undefined,
    windsurf: {
      current: platform === 'win32' ? (appData ? p.join(appData, 'devin', 'mcp_config.json') : undefined) : p.join(xdg, 'devin', 'mcp_config.json'),
      legacy: p.join(home, '.codeium', 'windsurf', 'mcp_config.json'),
    },
    vscode: {
      workspace: p.join(projectRoot, '.vscode', 'mcp.json'),
      userProfile: platform === 'linux' ? p.join(xdg, 'Code', 'User', 'mcp.json') : undefined,
    },
    copilot: { user: p.join(home, '.copilot', 'mcp-config.json'), project: p.join(projectRoot, '.mcp.json') },
  };
}

export const UNVERIFIED_PATH_NOTE = '문서로 확인 안 됨';
