import { promises as fs } from 'node:fs';
import path from 'node:path';
import { stdin as input } from 'node:process';
import type { CliIo, CliOptions } from '../../types.js';
import { WORKSPACE_CONFIG_FILE } from '../../workspace/schema.js';
import { scaffoldWorkspace, workspaceConfigExists } from '../../workspace/scaffold.js';
import { dirKeyLabel } from '../../workspace/paths.js';
import { defaultConfig } from '../../workspace/schema.js';

async function exists(target: string) {
  try { await fs.access(target); return true; } catch { return false; }
}

async function detectV1Candidates(root: string) {
  const candidates: string[] = [];
  for (const name of ['.jutell.json', '.jutell-local', '.jutell-operator.local.json', '.beginner-bridge.json', '.beginner-bridge-local']) {
    if (await exists(path.join(root, name))) candidates.push(name);
  }
  return candidates;
}

export async function initWorkspaceCommand(options: CliOptions, io: CliIo, extraArgs: string[]) {
  const target = path.resolve(options.workspacePath ?? extraArgs[0] ?? process.cwd());
  if (await workspaceConfigExists(target)) {
    io.error(`오류: 이미 Workspace 설정이 있습니다. 덮어쓰지 않습니다.\n현재 Workspace를 확인하려면 \`jutell workspace status\`를 실행하세요.`);
    return 1;
  }

  const v1 = await detectV1Candidates(target);
  const config = defaultConfig();
  const planned: string[] = [];
  for (const relative of Object.values(config.dirs)) {
    if (!(await exists(path.join(target, relative)))) planned.push(relative);
  }

  io.write('새 Workspace를 만듭니다.\n');
  io.write(`위치: ${target}`);
  io.write(`구성 파일: ${WORKSPACE_CONFIG_FILE}`);
  io.write('\n만들 폴더:');
  for (const relative of planned) io.write(`  ${relative}  (${dirKeyLabel(relative as keyof typeof config.dirs)})`);
  io.write('\n이미 있는 폴더는 그대로 두고 사용합니다.');
  if (v1.length > 0) {
    io.write('\n이전 버전 설정이 발견되었습니다 (자동 이동·삭제하지 않습니다):');
    for (const name of v1) io.write(`  ${name}`);
  }

  if (options.yes || input.isTTY) {
    if (!options.yes && !(await io.ask('이대로 만들까요?', true))) {
      io.write('취소했습니다.');
      return 0;
    }
  } else {
    io.write('비대화형 실행에서는 확인 단계를 진행하지 않습니다.\n진행하려면 `--yes`를 함께 지정하세요.');
    io.write('취소했습니다.');
    return 0;
  }

  const result = await scaffoldWorkspace(target, config);
  if (!result.ok) {
    io.error(`오류: ${result.reason ?? 'Workspace를 만들지 못했습니다.'}`);
    return 1;
  }
  io.write('\nWorkspace를 만들었습니다.');
  for (const relative of result.created) io.write(`  생성: ${relative}`);
  for (const relative of result.preserved) io.write(`  유지: ${relative}`);
  io.write('\n다음 명령으로 상태를 확인할 수 있습니다.\n  jutell workspace status');
  return 0;
}