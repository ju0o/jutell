import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { CliIo, ScopePaths } from '../../types.js';
import { sessionRoot, todayStamp, readSessionMeta, createInitialMeta, saveSessionMeta, listLegacyFlatFiles } from './storage.js';

export async function createSessionCommand(paths: ScopePaths, io: CliIo) {
  const root = sessionRoot(paths.dataRoot);
  const stamp = todayStamp();
  const dir = path.join(root, stamp);
  const meta = await readSessionMeta(dir);
  if (meta) {
    io.write(`오늘 Session이 이미 있습니다: ${stamp} — ${meta.status === 'finished' ? '마감됨' : '진행 중'}`);
    io.write('기존 Session을 이어서 사용하세요.');
    return 0;
  }
  await fs.mkdir(dir, { recursive: true });
  await saveSessionMeta(dir, createInitialMeta(stamp));
  const legacy = await listLegacyFlatFiles(root, stamp);
  if (legacy.length > 0) {
    io.write(`레거시 단일 파일 ${legacy.length}개를 발견했지만 자동 변환하지 않고 그대로 둡니다.`);
  }
  io.write(`Session 생성 완료: ${stamp}`);
  io.write('첫 Page를 추가하려면 `jutell session page`를 실행하세요.');
  return 0;
}
