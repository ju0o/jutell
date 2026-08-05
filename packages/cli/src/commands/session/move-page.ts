import path from 'node:path';
import type { CliIo, CliOptions, ScopePaths } from '../../types.js';
import {
  sessionRoot, todayStamp, readSessionMeta, saveSessionMeta,
  pageLabel, listPageFiles,
} from './storage.js';
import { arrowList } from './prompt.js';

export async function movePageCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  const root = sessionRoot(paths.dataRoot);
  const stamp = todayStamp();
  const dir = path.join(root, stamp);
  const meta = await readSessionMeta(dir);
  if (!meta) throw new Error('오늘 Session이 없습니다. `jutell session new`로 시작하세요.');
  if (meta.pages.length === 0) throw new Error('Page가 없습니다. `jutell session page`로 먼저 만들세요.`');

  const files = await listPageFiles(dir);
  if (options.page) {
    const target = meta.pages.find((p) => p.number === options.page);
    if (!target) throw new Error(`Page ${options.page}을(를) 찾지 못했습니다.`);
    meta.currentPage = options.page as number;
    await saveSessionMeta(dir, meta);
    io.write(`현재 Page 변경: ${pageLabel(target)}`);
    return 0;
  }

  const labels = files.map((f, index) => pageLabel(meta.pages[index] ?? f));
  const defaultIndex = Math.max(0, (meta.currentPage ?? 1) - 1);
  const picked = await arrowList('이동할 Page 선택:', labels, defaultIndex);
  if (picked === null || picked === -1) {
    throw new Error('Page 선택이 필요합니다. `--page <번호>`를 지정할 수도 있습니다.');
  }
  const target = meta.pages[picked] ?? null;
  if (!target) throw new Error('Page 목록을 읽지 못했습니다.');
  meta.currentPage = target.number;
  await saveSessionMeta(dir, meta);
  io.write(`Page 이동 완료: ${pageLabel(target)}`);
  return 0;
}