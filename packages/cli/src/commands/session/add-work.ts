import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { CliIo, CliOptions, ScopePaths } from '../../types.js';
import {
  todayStamp, readSessionMeta, saveSessionMeta,
  nextWorkNumber, workTemplate, pageLabel, listPageFiles, pad2,
} from './storage.js';
import { resolveSessionRoot } from './operator-storage.js';
import { arrowList } from './prompt.js';

export async function addWorkCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  const { root } = await resolveSessionRoot(paths);
  const stamp = todayStamp();
  const dir = path.join(root, stamp);
  const meta = await readSessionMeta(dir);
  if (!meta) throw new Error('오늘 Session이 없습니다. `jutell session new`로 시작하세요.');

  let page = meta.pages.find((p) => p.number === (options.page ?? meta.currentPage));
  if (!page) {
    if (meta.pages.length === 0) throw new Error('Page가 없습니다. `jutell session page`로 먼저 만들거나 `--page <번호>`를 지정하세요.');
    if (options.page) throw new Error(`Page ${options.page}을(를) 찾지 못했습니다.`);
    const files = await listPageFiles(dir);
    const picks = files.map((f, index) => ({
      label: `${pageLabel(meta.pages[index] ?? f)} — ${f.number}`,
    }));
    const picked = await arrowList('작업을 추가할 Page 선택:', picks.map((p) => p.label), Math.max(0, (meta.currentPage ?? 1) - 1));
    if (picked === null || picked === -1) throw new Error('Page 선택이 필요합니다.');
    page = meta.pages[picked] ?? null;
    if (!page) throw new Error('Page 목록을 읽지 못했습니다.');
  }

  const filePath = path.join(dir, page.file);
  let content: string;
  try { content = await fs.readFile(filePath, 'utf8'); } catch {
    throw new Error(`Page 파일을 읽지 못했습니다: ${page.file}`);
  }
  const workNumber = nextWorkNumber(content);
  content = `${content.replace(/\s+$/, '')}\n\n${workTemplate(workNumber)}\n`;
  await fs.writeFile(filePath, content, 'utf8');
  io.write(`작업 ${pad2(workNumber)} 추가 완료: ${pageLabel(page)} (작업 번호는 Page마다 독립)`);
  return 0;
}