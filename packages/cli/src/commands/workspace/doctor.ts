import { promises as fs } from 'node:fs';
import path from 'node:path';
import { stdin as input } from 'node:process';
import type { CliIo, CliOptions } from '../../types.js';
import { resolveWorkspace } from '../../workspace/resolver.js';
import { formatWorkspaceIssues } from '../../workspace/validation.js';
import { WORKSPACE_CONFIG_FILE } from '../../workspace/schema.js';
import { dirKeyLabel } from '../../workspace/paths.js';
import type { WorkspaceDirKey } from '../../workspace/types.js';

type CheckStatus = '정상' | '주의' | '오류';

interface DoctorCheck {
  name: string;
  status: CheckStatus;
  detail: string;
}

async function exists(target: string) {
  try { await fs.access(target); return true; } catch { return false; }
}

async function isDirectory(target: string) {
  try { return (await fs.stat(target)).isDirectory(); } catch { return false; }
}

async function writePermissionCheck(root: string) {
  const file = path.join(root, `.doctor-write-${process.pid}.tmp`);
  try {
    await fs.writeFile(file, 'ok', 'utf8');
    await fs.rm(file, { force: true });
    return true;
  } catch {
    await fs.rm(file, { force: true });
    return false;
  }
}

async function detectV1Candidates(root: string) {
  const candidates: string[] = [];
  const names = ['.jutell.json', '.jutell-local', '.jutell-operator.local.json', '.beginner-bridge.json', '.beginner-bridge-local'];
  for (const name of names) {
    if (await exists(path.join(root, name))) candidates.push(name);
  }
  return candidates;
}

// Session·Review·Backup 등 운영 영역이 공개/비공개 Git 안에 들어갈 수 있는지 판정한다.
// 실제 Git 추적 여부가 아니라 경로 구조 위험만 검사한다 (read-only, Git 명령 실행 없음).
function isInsideRepoDir(workspaceRoot: string, candidateRelative: string, repoRelatives: string[]) {
  const candidate = path.resolve(workspaceRoot, candidateRelative);
  for (const repoRelative of repoRelatives) {
    const repoRoot = path.resolve(workspaceRoot, repoRelative);
    const relative = path.relative(repoRoot, candidate);
    if (relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)) return true;
  }
  return false;
}

export async function workspaceDoctorCommand(options: CliOptions, io: CliIo) {
  const resolved = await resolveWorkspace({ explicitPath: options.workspacePath, envPath: process.env.JUTELL_WORKSPACE, cwd: process.cwd() });
  if (resolved.state === 'error') {
    io.error(formatWorkspaceIssues(resolved.issues));
    return 1;
  }
  if (resolved.state === 'project') {
    io.write('현재 Project Mode입니다. Workspace 점검이 없습니다.\nWorkspace를 시작하려면 `jutell workspace init`을 실행하세요.');
    return 0;
  }
  const { mode } = resolved;
  const checks: DoctorCheck[] = [];
  const missingDirs: { key: WorkspaceDirKey; relative: string }[] = [];
  const seenValues = new Map<string, string>();

  const configText = await fs.readFile(mode.configPath, 'utf8').catch(() => null);
  checks.push({ name: '설정 파일', status: configText !== null ? '정상' : '오류', detail: configText !== null ? `${WORKSPACE_CONFIG_FILE} 파일을 읽었습니다.` : `${WORKSPACE_CONFIG_FILE} 파일을 읽지 못했습니다.` });
  checks.push({ name: '설정 형식', status: '정상', detail: 'Workspace 모드 진입 시 검증을 통과했습니다.' });

  for (const key of Object.keys(mode.dirs) as WorkspaceDirKey[]) {
    const relative = mode.dirs[key];
    if (seenValues.has(relative)) {
      checks.push({ name: `폴더 중복 (${key})`, status: '오류', detail: `${relative} 폴더 이름이 ${seenValues.get(relative)}와 중복됩니다.` });
      continue;
    }
    seenValues.set(relative, key);
    if (!(await isDirectory(path.join(mode.workspaceRoot, relative)))) {
      checks.push({ name: `폴더 존재 (${key})`, status: '오류', detail: `${relative} 폴더가 없습니다.` });
      missingDirs.push({ key, relative });
    }
  }
  if (missingDirs.length === 0) checks.push({ name: '필요한 폴더', status: '정상', detail: '설정에 있는 모든 폴더가 있습니다.' });

  const rootGit = await exists(path.join(mode.workspaceRoot, '.git'));
  checks.push({ name: 'Workspace Root Git', status: rootGit ? '주의' : '정상', detail: rootGit ? 'Root가 Git 저장소입니다. 공개·비공개 독립 구조와 다릅니다.' : 'Root는 Git 저장소가 아닙니다.' });

  const publicGit = await isDirectory(path.join(mode.workspaceRoot, mode.dirs.public, '.git'));
  const privateGit = await isDirectory(path.join(mode.workspaceRoot, mode.dirs.private, '.git'));
  checks.push({ name: '공개·비공개 Git 분리', status: (publicGit || privateGit) ? '정상' : '주의', detail: publicGit && privateGit ? '두 곳 모두 독립 Git 저장소입니다.' : publicGit ? '공개만 Git입니다. 비공개는 아직 아닙니다.' : privateGit ? '비공개만 Git입니다. 공개는 아직 아닙니다.' : '둘 다 Git 저장소가 아닙니다. 필요할 때 만들 수 있습니다.' });

  const repoRelatives = [mode.dirs.public, mode.dirs.private];
  for (const key of ['session', 'review', 'backup'] as WorkspaceDirKey[]) {
    const inside = isInsideRepoDir(mode.workspaceRoot, mode.dirs[key], repoRelatives);
    if (inside) checks.push({ name: `Git 위험 (${key})`, status: '오류', detail: `${key} 폴더가 공개·비공개 Git 경로 안에 있습니다. 밖으로 옮겨야 합니다.` });
  }
  if (!checks.some((check) => check.name.startsWith('Git 위험'))) checks.push({ name: '운영 영역 Git 위험', status: '정상', detail: 'Session·Review·Backup이 공개·비공개 Git 밖에 있습니다.' });

  const v1 = await detectV1Candidates(mode.workspaceRoot);
  checks.push({ name: '이전 버전 설정', status: v1.length > 0 ? '주의' : '정상', detail: v1.length > 0 ? `이전 설정 ${v1.length}개가 있어 자동 이동·삭제 없이 그대로 둡니다.` : '없습니다.' });

  checks.push({ name: '쓰기 권한', status: await writePermissionCheck(mode.workspaceRoot) ? '정상' : '오류', detail: 'Workspace에 임시 검사 파일을 만들고 삭제했습니다.' });

  if (options.json) {
    io.write(JSON.stringify({ mode: 'workspace', root: mode.workspaceRoot, dirs: mode.dirs, checks }, null, 2));
  } else {
    io.write('JuTell Workspace 점검 결과\n');
    for (const check of checks) io.write(`${check.status}  ${check.name}: ${check.detail}`);
  }

  if (options.fix) {
    if (missingDirs.length > 0) {
      // --fix는 누락 폴더 생성만 하므로(설정·기존 콘텐츠 무변경) 비대화형·파이프에서는 확인 없이 진행하고,
      // 대화형(TTY)일 때만 사용자 확인을 받는다. 파이프에서 확인을 기다리면 멈추는 문제를 막는다.
      if (!options.yes && input.isTTY && !(await io.ask(`없는 폴더 ${missingDirs.length}개를 만들까요?`, true))) {
        io.write('폴더 생성을 건너뛰었습니다.');
      } else {
        for (const { key, relative } of missingDirs) {
          await fs.mkdir(path.join(mode.workspaceRoot, relative), { recursive: true });
          io.write(`만듦: ${relative}`);
          const check = checks.find((entry) => entry.name === `폴더 존재 (${key})`);
          if (check) check.status = '정상';
        }
      }
    } else {
      io.write('고칠 폴더가 없습니다. config 내용은 doctor가 자동으로 바꾸지 않습니다.');
    }
  }
  return checks.some((check) => check.status === '오류') ? 1 : 0;
}