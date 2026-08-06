import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { CliIo, CliOptions } from '../../types.js';
import { resolveWorkspace } from '../../workspace/resolver.js';
import { formatWorkspaceIssues } from '../../workspace/validation.js';
import { dirKeyLabel, resolveWorkspaceDirs } from '../../workspace/paths.js';
import type { WorkspaceDirKey } from '../../workspace/types.js';

async function exists(target: string) {
  try { await fs.access(target); return true; } catch { return false; }
}

async function dirState(root: string, relative: string) {
  return (await exists(path.join(root, relative))) ? '사용 가능' : '없음';
}

async function v1CandidateCount(root: string) {
  const names = ['.jutell.json', '.jutell-local', '.jutell-operator.local.json', '.beginner-bridge.json', '.beginner-bridge-local'];
  let count = 0;
  for (const name of names) if (await exists(path.join(root, name))) count += 1;
  return count;
}

export async function workspaceStatusCommand(options: CliOptions, io: CliIo) {
  const resolved = await resolveWorkspace({ explicitPath: options.workspacePath, envPath: process.env.JUTELL_WORKSPACE, cwd: process.cwd() });
  if (resolved.state === 'error') {
    io.error(formatWorkspaceIssues(resolved.issues));
    return 1;
  }
  if (resolved.state === 'project') {
    io.write(`JuTell Workspace 상태\n\n모드: Project\nWorkspace 설정이 없습니다.\n운영자·고급 사용자는 \`jutell workspace init\`으로 시작할 수 있습니다.\n일반 사용자는 기존 Project 방식 그대로 사용합니다.`);
    return 0;
  }
  const { mode } = resolved;
  const dirs = resolveWorkspaceDirs(mode.workspaceRoot, mode.dirs);
  const publicDir = dirs.public;
  const privateDir = dirs.private;

  const publicAgentDir = await exists(path.join(mode.workspaceRoot, mode.dirs.public));
  const privateAgentDir = await exists(path.join(mode.workspaceRoot, mode.dirs.private));
  const rootGit = await exists(path.join(mode.workspaceRoot, '.git'));
  const publicGit = await exists(path.join(publicDir, '.git'));
  const privateGit = await exists(path.join(privateDir, '.git'));
  const migrationCount = await v1CandidateCount(mode.workspaceRoot);

  if (options.json) {
    const workspace = {
      root: mode.workspaceRoot,
      version: mode.config.version,
      mode: 'workspace',
    };
    io.write(JSON.stringify({ workspace, dirs: mode.dirs, resolved: { public: publicAgentDir, private: privateAgentDir } }, null, 2));
    return 0;
  }

  io.write('JuTell Workspace 상태\n');
  io.write(`모드: Workspace`);
  io.write(`설정: 정상`);
  io.write(`공개 프로젝트: ${publicAgentDir ? '발견' : '아직 없음'}`);
  io.write(`비공개 작업 공간: ${privateAgentDir ? '발견' : '아직 없음'}`);
  for (const key of ['session', 'review', 'backup'] as WorkspaceDirKey[]) {
    io.write(`${dirKeyLabel(key)}: ${await dirState(mode.workspaceRoot, mode.dirs[key])}`);
  }
  const gitStructure = rootGit ? '경고: Workspace Root에 Git이 있습니다' : (publicGit && privateGit) ? '분리됨' : publicGit ? '공개만 Git' : privateGit ? '비공개만 Git' : '둘 다 Git 없음';
  io.write(`Git 구조: ${gitStructure}`);
  io.write(`이동 필요 항목: ${migrationCount}개`);
  if (migrationCount > 0) io.write('(이전 버전 설정은 자동으로 이동·삭제하지 않습니다.)');
  return 0;
}