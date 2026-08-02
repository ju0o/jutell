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

export function userHome() {
  const override = process.env.BEGINNER_BRIDGE_HOME;
  return path.resolve(override && override.trim() ? override : os.homedir());
}

export function resolveScope(scope: InstallScope, cwd = process.cwd()): ScopePaths {
  if (scope === 'global') {
    const home = userHome();
    return {
      scope,
      targetRoot: home,
      skillRoot: path.join(home, '.agents', 'skills', 'beginner-bridge'),
      configFile: path.join(home, '.beginner-bridge.json'),
      codexConfigFile: path.join(codexHome(), 'config.toml'),
      dataRoot: path.join(home, '.beginner-bridge-local'),
    };
  }
  const projectRoot = path.resolve(cwd);
  return {
    scope,
    targetRoot: projectRoot,
    skillRoot: path.join(projectRoot, '.agents', 'skills', 'beginner-bridge'),
    configFile: path.join(projectRoot, '.beginner-bridge.json'),
    codexConfigFile: path.join(projectRoot, '.codex', 'config.toml'),
    dataRoot: path.join(projectRoot, '.beginner-bridge-local'),
  };
}

export function safeLocation(scope: InstallScope, kind: 'config' | 'codex') {
  if (scope === 'global') return kind === 'config' ? '사용자 전역 설정' : '사용자 Codex 설정';
  return kind === 'config' ? '현재 프로젝트/.beginner-bridge.json' : '현재 프로젝트/.codex/config.toml';
}
