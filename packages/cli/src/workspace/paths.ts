import path from 'node:path';
import type { WorkspaceDirKey, WorkspaceDirs } from './types.js';

export function resolveWorkspaceDir(root: string, relative: string) {
  return path.resolve(root, relative);
}

export function resolveWorkspaceDirs(root: string, dirs: WorkspaceDirs) {
  return Object.fromEntries(
    (Object.keys(dirs) as WorkspaceDirKey[]).map((key) => [key, resolveWorkspaceDir(root, dirs[key])]),
  ) as Record<WorkspaceDirKey, string>;
}

export function dirKeyLabel(key: WorkspaceDirKey) {
  const labels: Record<WorkspaceDirKey, string> = {
    public: '공개 프로젝트',
    private: '비공개 작업 공간',
    session: 'Session 공간',
    review: 'Review 공간',
    archive: 'Archive 공간',
    export: 'Export 공간',
    backup: 'Backup 공간',
    operator: 'Operator 공간',
  };
  return labels[key];
}