import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ensureDataRoot } from '../config/managed.js';
import { MAP_HTML_FILE, renderMapHtml } from '../map/html.js';
import { scanProject } from '../map/scan.js';
import { MAP_FILE, mapFile, mapWriteMessage, writeMap, writeViaTemp } from '../map/write.js';
import type { CliIo, ScopePaths } from '../types.js';

export const MAP_HELP = `jutell map             프로젝트 지도(JuTellMap.md)와 .jutell-local/map.html을 만들거나 갱신합니다.`;

/** Writes .jutell-local/map.html from the current JuTellMap.md (only when it differs). */
export async function writeMapHtml(paths: ScopePaths): Promise<'written' | 'unchanged' | 'skipped'> {
  const markdown = await fs.readFile(mapFile(paths), 'utf8').catch(() => undefined);
  if (markdown === undefined) return 'skipped';
  await ensureDataRoot(paths);
  if (!(await fs.lstat(paths.dataRoot)).isDirectory()) return 'skipped';
  const file = path.join(paths.dataRoot, MAP_HTML_FILE);
  const stats = await fs.lstat(file).catch(() => undefined);
  if (stats && !stats.isFile()) return 'skipped';
  const html = renderMapHtml(markdown);
  if (stats && (await fs.readFile(file, 'utf8')) === html) return 'unchanged';
  await writeViaTemp(file, html);
  return 'written';
}

export async function mapCommand(paths: ScopePaths, args: string[], io: CliIo) {
  if (args.includes('--help') || args.includes('-h')) { io.write(MAP_HELP); return 0; }
  const unknown = args.filter((arg) => arg.startsWith('-'));
  if (unknown.length) throw new Error(`jutell map에서 알 수 없는 옵션입니다: ${unknown.join(', ')}`);
  const result = await writeMap(paths);
  io.write(mapWriteMessage(result, paths));
  if (result.status === 'broken' || result.status === 'link') return 0;
  const html = await writeMapHtml(paths);
  if (html !== 'skipped') io.write(`보기 쉬운 화면: ${path.join('.jutell-local', MAP_HTML_FILE)}${html === 'unchanged' ? ' (바뀐 것 없음)' : ''}`);
  return 0;
}

/** Files changed after JuTellMap.md was last written (by modification time). */
export async function staleMapFiles(paths: ScopePaths): Promise<{ exists: boolean; newer: string[] }> {
  const stats = await fs.lstat(mapFile(paths)).catch(() => undefined);
  if (!stats) return { exists: false, newer: [] };
  const scan = await scanProject(paths.targetRoot);
  const newer: string[] = [];
  for (const file of scan.files) {
    if (file === MAP_FILE) continue;
    const fileStats = await fs.lstat(path.join(paths.targetRoot, file)).catch(() => undefined);
    if (fileStats && fileStats.mtimeMs > stats.mtimeMs) newer.push(file);
  }
  return { exists: true, newer };
}

/** doctor/status line: "주의" when the map is older than project files; never an error (exit code stays 0). */
export async function mapFreshnessCheck(paths: ScopePaths) {
  const name = '프로젝트 지도';
  if (paths.scope !== 'project') return undefined;
  try {
    const stale = await staleMapFiles(paths);
    if (!stale.exists) return { name, status: '정상' as const, detail: '지도가 없어요. `jutell map`으로 만들 수 있어요.' };
    if (!stale.newer.length) return { name, status: '정상' as const, detail: '지도가 최신이에요.' };
    const shown = stale.newer.slice(0, 3).join(', ');
    return { name, status: '주의' as const, detail: `지도 오래됨: 지도보다 새로 바뀐 파일 ${stale.newer.length}개(${shown}${stale.newer.length > 3 ? ' 등' : ''}). \`jutell map\`으로 갱신하세요.` };
  } catch {
    return { name, status: '직접 확인 필요' as const, detail: '지도를 확인하지 못했어요.' };
  }
}
