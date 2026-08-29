import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AssetPaths, InstallScope, ScopePaths } from '../types.js';

export function packageRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}export function assets(): AssetPaths {
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

export function userHome() {
  const override = process.env.JUTELL_HOME ?? process.env.BEGINNER_BRIDGE_HOME;
  return path.resolve(override && override.trim() ? override : os.homedir());
}

export function resolveScope(scope: InstallScope, cwd = process.cwd()): ScopePaths {
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
      dataRoot: path.join(home, '.jutell-local'),
      legacyDataRoot: path.join(home, '.beginner-bridge-local'),
    };
  }
  const projectRoot = path.resolve(cwd);
  return {
    scope,
    targetRoot: projectRoot,
    skillRoot: path.join(projectRoot, '.agents', 'skills', 'beginner-bridge'),
    configFile: path.join(projectRoot, '.jutell.json'),
    legacyConfigFile: path.join(projectRoot, '.beginner-bridge.json'),
    codexConfigFile: path.join(projectRoot, '.codex', 'config.toml'),
    opencodeConfigFile: path.join(projectRoot, 'opencode.json'),
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
