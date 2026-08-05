import { stdin as input } from 'node:process';
import type { CliIo, CliOptions, ScopePaths } from '../../types.js';
import { askText } from './prompt.js';
import {
  OPERATOR_STORAGE_ERROR,
  readOperatorStoragePath,
  ensureOperatorStorageDir,
  writeOperatorStoragePath,
  hasOperatorStorageConfig,
  removeOperatorStorageConfig,
} from './operator-storage.js';

function requireInteractiveConfirm() {
  if (!input.isTTY) {
    throw new Error('비대화형 실행에서는 `--yes`를 함께 지정해야 합니다. 확인 단계를 건너뜁니다.');
  }
}

export async function storageCommand(paths: ScopePaths, options: CliOptions, io: CliIo, args: string[]) {
  const sub = args[0] ?? '';
  if (sub === 'set') return storageSetCommand(paths, options, io, args[1]);
  if (sub === 'reset') return storageResetCommand(paths, options, io);
  return storageStatusCommand(paths, io);
}

async function storageStatusCommand(paths: ScopePaths, io: CliIo) {
  try {
    const custom = await readOperatorStoragePath(paths.targetRoot);
    if (custom === undefined) {
      io.write('Session 저장 위치: 기본 저장 (사용 가능)');
      io.write('별도 설정이 없으면 `.jutell-local/`의 기본 저장 위치를 사용합니다.');
      io.write('바꾸려면 `jutell session storage set`을 실행하세요.');
      return 0;
    }
    io.write('Session 저장 위치: 운영자 지정 저장 (사용 가능)');
    return 0;
  } catch {
    io.write('Session 저장 위치: 운영자 지정 저장 (사용 불가능)');
    io.write(OPERATOR_STORAGE_ERROR);
    return 1;
  }
}

async function storageSetCommand(paths: ScopePaths, options: CliOptions, io: CliIo, explicitPath: string | undefined) {
  let candidate = explicitPath?.trim() ?? '';
  if (!candidate) {
    candidate = (await askText('Session 저장 위치 (절대 경로):'))?.trim() ?? '';
  }
  if (!candidate) {
    throw new Error('저장 위치를 입력해야 합니다. 예: `jutell session storage set <절대 경로>`');
  }
  await ensureOperatorStorageDir(candidate);
  if (!options.yes) {
    requireInteractiveConfirm();
    const ok = await io.ask('지정한 위치에 Session을 저장하도록 설정합니다. 계속하시겠습니까?', false);
    if (!ok) {
      io.write('설정을 변경하지 않았습니다.');
      return 0;
    }
  }
  await writeOperatorStoragePath(paths.targetRoot, candidate);
  io.write('운영자 Session 저장 위치를 설정했습니다.');
  io.write('이제 모든 Session 기록은 지정한 로컬 위치에만 저장됩니다.');
  return 0;
}

async function storageResetCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  if (!(await hasOperatorStorageConfig(paths.targetRoot))) {
    io.write('설정된 운영자 Session 저장 위치가 없습니다.');
    return 0;
  }
  if (!options.yes) {
    requireInteractiveConfirm();
    const ok = await io.ask('운영자 Session 저장 위치 설정만 제거합니다. Session 기록 파일은 지우지 않습니다. 계속하시겠습니까?', false);
    if (!ok) {
      io.write('설정을 제거하지 않았습니다.');
      return 0;
    }
  }
  await removeOperatorStorageConfig(paths.targetRoot);
  io.write('운영자 Session 저장 위치 설정을 제거했습니다.');
  io.write('다시 기본 로컬 저장 위치를 사용합니다.');
  return 0;
}