import path from 'node:path';
import type { CliIo, CliOptions, ScopePaths } from '../../types.js';
import { todayStamp, readSessionMeta, listLegacyFlatFiles, pageLabel } from './storage.js';
import { resolveSessionRoot } from './operator-storage.js';
import { createSessionCommand } from './new-session.js';
import { createPageCommand } from './create-page.js';
import { addWorkCommand } from './add-work.js';
import { movePageCommand } from './move-page.js';
import { finishSessionCommand } from './finish-session.js';
import { storageCommand } from './storage-command.js';

export async function sessionStatusCommand(paths: ScopePaths, io: CliIo) {
  const { root } = await resolveSessionRoot(paths);
  const stamp = todayStamp();
  const meta = await readSessionMeta(path.join(root, stamp));
  if (!meta) {
    const legacy = await listLegacyFlatFiles(root, stamp);
    if (legacy.length > 0) {
      io.write(`오늘 Session 폴더가 아직 없습니다. (레거시 단일 파일 ${legacy.length}개는 그대로 두고 있습니다.)`);
    } else {
      io.write('오늘 Session이 없습니다. `jutell session new`로 시작하세요.');
    }
    return 0;
  }
  const current = meta.pages.find((page) => page.number === meta.currentPage) ?? null;
  io.write(`Session: ${meta.date} — ${meta.status === 'finished' ? '마감됨' : '진행 중'}`);
  io.write(`현재 Page: ${current ? pageLabel(current) : '(없음)'}`);
  if (meta.pages.length === 0) {
    io.write('Page가 아직 없습니다. `jutell session page`로 첫 Page를 추가하세요.');
    return 0;
  }
  for (const page of meta.pages) {
    const marker = page.number === meta.currentPage ? ' (현재)' : '';
    io.write(`- ${pageLabel(page)}${marker}`);
  }
  return 0;
}

export async function sessionCommand(paths: ScopePaths, options: CliOptions, io: CliIo, extraArgs: string[]) {
  const sub = extraArgs[0] ?? '';
  if (sub === 'new') return createSessionCommand(paths, io);
  if (sub === 'page') return createPageCommand(paths, options, io);
  if (sub === 'work') return addWorkCommand(paths, options, io);
  if (sub === 'move') return movePageCommand(paths, options, io);
  if (sub === 'finish') return finishSessionCommand(paths, io);
  if (sub === 'storage') return storageCommand(paths, options, io, extraArgs.slice(1));
  if (sub === '') return sessionStatusCommand(paths, io);
  throw new Error(`알 수 없는 session 하위 명령입니다: ${sub}\n가능한 명령: new, page, work, move, finish, storage`);
}
