import { promises as fs } from 'node:fs';
import path from 'node:path';
import { defaultConfig as buildDefaultConfig, WORKSPACE_CONFIG_FILE } from './schema.js';
import type { WorkspaceConfig } from './types.js';

export async function workspaceConfigExists(root: string) {
  try {
    await fs.access(path.join(root, WORKSPACE_CONFIG_FILE));
    return true;
  } catch {
    return false;
  }
}

export interface ScaffoldWorkspaceResult {
  ok: boolean;
  configPath: string;
  created: string[];
  preserved: string[];
  code?: 'exists' | 'denied' | 'error';
  reason?: string;
}

export async function scaffoldWorkspace(root: string, config?: WorkspaceConfig): Promise<ScaffoldWorkspaceResult> {
  const dirs = (config ?? buildDefaultConfig()).dirs;
  const created: string[] = [];
  const preserved: string[] = [];
  for (const relative of Object.values(dirs)) {
    if (relative.split(/[\\/]/).includes('..')) {
      return { ok: false, configPath: '', created: [], preserved: [], code: 'denied', reason: `폴더 이름이 Workspace 밖으로 나갈 수 없습니다: ${relative}` };
    }
    const absolute = path.join(root, relative);
    try {
      await fs.access(absolute);
      if (!(await isDirectory(absolute))) {
        return { ok: false, configPath: '', created: [], preserved: [], code: 'denied', reason: `같은 이름의 파일이 있습니다: ${relative}` };
      }
      preserved.push(relative);
    } catch {
      await fs.mkdir(absolute, { recursive: true });
      created.push(relative);
    }
  }
  const configPath = path.join(root, WORKSPACE_CONFIG_FILE);
  if (await workspaceConfigExists(root)) {
    return { ok: false, configPath, created: [], preserved: [], code: 'exists', reason: '이미 Workspace 설정이 있어 덮어쓰지 않았습니다. 삭제하거나 다른 위치를 선택하세요.' };
  }
  await fs.writeFile(configPath, `${JSON.stringify(config ?? buildDefaultConfig(), null, 2)}\n`, 'utf8');
  return { ok: true, configPath, created, preserved };
}

async function isDirectory(target: string) {
  try {
    const stat = await fs.stat(target);
    return stat.isDirectory();
  } catch {
    return false;
  }
}