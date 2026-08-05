import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { CliIo, ScopePaths } from '../../types.js';
import { sessionRoot, todayStamp, readSessionMeta, saveSessionMeta, summaryTemplate, SESSION_SUMMARY_FILE } from './storage.js';

export async function finishSessionCommand(paths: ScopePaths, io: CliIo) {
  const root = sessionRoot(paths.dataRoot);
  const stamp = todayStamp();
  const dir = path.join(root, stamp);
  const meta = await readSessionMeta(dir);
  if (!meta) throw new Error('오늘 Session이 없습니다. `jutell session new`로 시작하세요.');
  if (meta.status === 'finished') {
    io.write('오늘 Session은 이미 마감되어 있습니다. SESSION_SUMMARY.md를 다시 만들지 않았습니다.');
    return 0;
  }
  const summaryPath = path.join(dir, SESSION_SUMMARY_FILE);
  try {
    await fs.access(summaryPath);
    io.write('SESSION_SUMMARY.md가 이미 있습니다. 덮어쓰지 않았습니다.');
  } catch {
    await fs.writeFile(summaryPath, `${summaryTemplate(stamp, meta.pages)}\n`, 'utf8');
  }
  meta.status = 'finished';
  await saveSessionMeta(dir, meta);
  io.write(`Session 마감 완료: ${stamp} → SESSION_SUMMARY.md 생성`);
  return 0;
}