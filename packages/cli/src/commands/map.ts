import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ensureDataRoot, readBridgeConfig, writeBridgeConfig } from '../config/managed.js';
import { addGitExclude, gitExcludeMessage, removeGitExclude } from '../map/git-exclude.js';
import { MAP_HTML_FILE, renderMapHtml } from '../map/html.js';
import { formatMapSelectionContext, formatMapSelectionIndex, readMapSelectionDetail, readMapSelectionIndex, sanitizeMapSelectionText } from '../map/selection.js';
import { scanProject } from '../map/scan.js';
import { MAP_FILE, MAP_STATE_FILE, mapFile, mapWriteMessage, sha256, writeMap, writeViaTemp } from '../map/write.js';
import type { CliIo, ScopePaths } from '../types.js';

export const MAP_HELP = `jutell map             전체 지도, 작은 인덱스, 기능 상세 파일과 .jutell-local/map.html을 만들거나 갱신합니다.
jutell map --list      작은 기계 인덱스에서 기능 이름과 ID만 읽습니다.
jutell map --show <ID> 인덱스와 선택한 기능 상세 파일 하나만 읽습니다.
jutell map --git-exclude  지도를 이 컴퓨터에서만 git에서 뺍니다(.git/info/exclude, .gitignore는 그대로).
jutell map --git-include  뺀 것을 되돌립니다.`;

/** Records map.gitExclude in .jutell.json only when that file already exists (never creates a config). */
async function recordGitExclude(paths: ScopePaths, value: boolean) {
  const current = await readBridgeConfig(paths);
  if (current.source !== 'new' || !current.valid) return;
  if ((current.config.map?.gitExclude ?? false) === value) return;
  await writeBridgeConfig(paths, { ...current.config, map: { gitExclude: value } });
}

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
  if (args[0] === '--list') {
    if (args.length !== 1) throw new Error('사용법: jutell map --list');
    const { index } = await readMapSelectionIndex(paths);
    io.write(formatMapSelectionIndex(index));
    return 0;
  }
  if (args[0] === '--show') {
    if (args.length !== 2) throw new Error('사용법: jutell map --show <ID>');
    const result = await readMapSelectionDetail(paths, args[1]);
    io.write(sanitizeMapSelectionText(`${formatMapSelectionContext(result.index, result.entry)}${result.text.trimEnd()}`));
    return 0;
  }
  const exclude = args.includes('--git-exclude');
  const include = args.includes('--git-include');
  if (exclude && include) throw new Error('--git-exclude와 --git-include는 함께 쓸 수 없어요.');
  if (exclude || include) {
    const result = exclude ? await addGitExclude(paths.targetRoot) : await removeGitExclude(paths.targetRoot);
    io.write(gitExcludeMessage(result));
    if (['added', 'already', 'removed', 'absent'].includes(result.status)) await recordGitExclude(paths, exclude);
    return 0;
  }
  const unknown = args.filter((arg) => arg.startsWith('-'));
  if (unknown.length) throw new Error(`jutell map에서 알 수 없는 옵션입니다: ${unknown.join(', ')}`);
  const result = await writeMap(paths);
  io.write(mapWriteMessage(result, paths));
  if (result.status === 'broken' || result.status === 'link') return 0;
  if (result.selection?.status === 'skipped') io.write(`기계용 기능 인덱스와 상세를 갱신하지 못했어요 (${result.selection.reason ?? '파일을 쓸 수 없음'}). 전체 지도는 JuTellMap.md에서 확인하세요.`);
  else if (result.selection) io.write(`기계 인덱스와 기능 상세 ${result.selection.sectionCount}개: .jutell-local/map-index.json`);
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

export const RECEIPT_MAP_TIMEOUT_MS = 3000;

/**
 * Receipt step (plan.md W5): refresh the map only when it exists, within a time limit.
 * - jutellOwned: the map's content at the start matched map-state.json, so its git change is JuTell's own
 *   and is left out of [바뀐 파일]. Otherwise someone else edited it and it is a normal changed file.
 * - note: the receipt's "ⓘ 지도를 갱신했어요 … [JuTell이 고침]" or "ⓘ 지도 갱신 못 함(이유)" line.
 * Never throws: a failed refresh must not stop the receipt from being saved.
 */
export async function refreshMapForReceipt(paths: ScopePaths, timeoutMs = RECEIPT_MAP_TIMEOUT_MS): Promise<{ jutellOwned: boolean; note?: string }> {
  const file = mapFile(paths);
  const stats = await fs.lstat(file).catch(() => undefined);
  if (!stats) return { jutellOwned: false };
  let jutellOwned = false;
  try {
    if (stats.isFile()) {
      const [text, state] = await Promise.all([
        fs.readFile(file, 'utf8'),
        fs.readFile(path.join(paths.dataRoot, MAP_STATE_FILE), 'utf8').then((raw) => JSON.parse(raw) as { hash?: unknown }).catch(() => undefined),
      ]);
      jutellOwned = typeof state?.hash === 'string' && state.hash === sha256(text);
    }
  } catch {
    jutellOwned = false;
  }
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<'timeout'>((resolve) => { timer = setTimeout(() => resolve('timeout'), timeoutMs); });
  try {
    const result = await Promise.race([writeMap(paths), timeout]);
    if (result === 'timeout') return { jutellOwned, note: 'ⓘ 지도 갱신 못 함(시간 초과로 건너뜀)' };
    if (result.status === 'link') return { jutellOwned: false, note: 'ⓘ 지도 갱신 못 함(지도가 링크예요)' };
    if (result.status === 'broken') return { jutellOwned, note: 'ⓘ 지도 갱신 못 함(자동 칸 표시가 망가져 있어요. `jutell map`으로 확인하세요)' };
    await writeMapHtml(paths).catch(() => undefined);
    if (result.selection?.status === 'skipped') return { jutellOwned, note: `ⓘ 기능 인덱스 갱신 못 함(${result.selection.reason ?? '파일을 쓸 수 없음'})` };
    if (result.status !== 'updated') return result.selection?.status === 'written'
      ? { jutellOwned, note: 'ⓘ 기능 인덱스와 상세 파일을 만들었어요  [JuTell이 고침]' }
      : { jutellOwned };
    const parts = [
      result.added.length ? `새 파일 ${result.added.length}개` : '',
      result.removed.length ? `빠진 파일 ${result.removed.length}개` : '',
    ].filter(Boolean);
    return { jutellOwned, note: `ⓘ 지도를 갱신했어요${parts.length ? ` (${parts.join(', ')} 반영)` : ''}  [JuTell이 고침]` };
  } catch (error) {
    return { jutellOwned, note: `ⓘ 지도 갱신 못 함(${(error as Error).message || '알 수 없는 오류'})` };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
