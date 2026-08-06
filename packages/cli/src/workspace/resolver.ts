import { promises as fs } from 'node:fs';
import path from 'node:path';
import { WORKSPACE_CONFIG_FILE } from './schema.js';
import { validateWorkspaceConfig } from './validation.js';
import type { ResolveWorkspaceResult, WorkspaceConfig, WorkspaceIssue, WorkspaceValidationResult } from './types.js';

interface WorkspaceOptions {
  explicitPath?: string;
  envPath?: string;
  cwd?: string;
}

async function pathExists(target: string) {
  try { await fs.access(target); return true; } catch { return false; }
}

type ReadWorkspaceResult = { exists: boolean; result: WorkspaceValidationResult };

export async function readWorkspaceConfigFile(configPath: string): Promise<ReadWorkspaceResult> {
  let raw: string;
  try {
    raw = await fs.readFile(configPath, 'utf8');
  } catch {
    return { exists: false, result: { valid: false, issues: [] } };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { exists: true, result: { valid: false, issues: [{ level: '최상위', path: '', message: '설정을 읽지 못했습니다(손상). JSON 형식인지 확인해주세요.', allowed: ['version', 'dirs', 'settings'] }] } };
  }
  const result = validateWorkspaceConfig(parsed);
  return { exists: true, result };
}

async function findWorkspaceRootUpward(cwd: string): Promise<string | null> {
  let current = cwd;
  while (true) {
    if (await pathExists(path.join(current, WORKSPACE_CONFIG_FILE))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export async function resolveWorkspace(options: WorkspaceOptions = {}): Promise<ResolveWorkspaceResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const explicit = options.explicitPath ?? options.envPath;
  if (explicit && explicit.trim()) {
    const root = path.resolve(explicit.trim());
    const configPath = path.join(root, WORKSPACE_CONFIG_FILE);
    const { exists, result } = await readWorkspaceConfigFile(configPath);
    if (!exists) {
      return { state: 'error', issues: [{ level: '최상위', path: '', message: '지정한 위치에 Workspace 설정이 없습니다. 먼저 `jutell workspace init`을 실행해주세요.', allowed: [] }] };
    }
    if (!result.valid) return { state: 'error', issues: result.issues };
    return { state: 'workspace', mode: { kind: 'workspace', workspaceRoot: root, configPath, dirs: result.config!.dirs, config: result.config! } };
  }
  const found = await findWorkspaceRootUpward(cwd);
  if (!found) {
    return { state: 'project', mode: { kind: 'project', projectRoot: cwd }, reason: 'workspace 설정 없음' };
  }
  const configPath = path.join(found, WORKSPACE_CONFIG_FILE);
  const { exists, result } = await readWorkspaceConfigFile(configPath);
  if (!exists) {
    return { state: 'project', mode: { kind: 'project', projectRoot: cwd }, reason: 'workspace 설정 없음' };
  }
  if (!result.valid) return { state: 'error', issues: result.issues };
  return { state: 'workspace', mode: { kind: 'workspace', workspaceRoot: found, configPath, dirs: result.config!.dirs, config: result.config! } };
}