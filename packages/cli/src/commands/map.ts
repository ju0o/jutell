import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ensureDataRoot, readBridgeConfig, writeBridgeConfig } from '../config/managed.js';
import { friendlyError } from '../output/friendly.js';
import { addGitExclude, gitExcludeMessage, removeGitExclude } from '../map/git-exclude.js';
import { formatMapSelectionContext, formatMapSelectionIndex, readMapSelectionDetail, mapSelectionProblems, readMapSelectionIndex, sanitizeMapSelectionText } from '../map/selection.js';
import { scanProject } from '../map/scan.js';
import { subjectParticle } from '../map/stamp.js';
import { MAP_STATE_FILE, mapFile, mapHtmlMessage, mapListFiles, mapWriteMessage, parseMap, readMapState, sha256, writeMap, writeMapHtml } from '../map/write.js';
import type { CliIo, ScopePaths } from '../types.js';
import { MAP_HTML_FILE } from '../map/html.js';

export const MAP_HELP = `jutell map             전체 지도, 작은 인덱스, 기능 상세 파일과 .jutell-local/map.html을 만들거나 갱신합니다.
jutell map --list      작은 기계 인덱스에서 기능 이름과 ID만 읽습니다.
jutell map --show <ID 또는 이름 일부>  기능 하나의 상세만 봅니다.
jutell map --git-exclude  지도를 이 컴퓨터에서만 git에서 뺍니다(.git/info/exclude, .gitignore는 그대로).
jutell map --git-include  뺀 것을 되돌립니다.`;

/** Records map.gitExclude in .jutell.json only when that file already exists (never creates a config). */
async function recordGitExclude(paths: ScopePaths, value: boolean) {
  const current = await readBridgeConfig(paths);
  if (current.source !== 'new' || !current.valid) return;
  if ((current.config.map?.gitExclude ?? false) === value) return;
  await writeBridgeConfig(paths, { ...current.config, map: { gitExclude: value } });
}

export { writeMapHtml };

export async function mapCommand(paths: ScopePaths, args: string[], io: CliIo) {
  if (args.includes('--help') || args.includes('-h')) { io.write(MAP_HELP); return 0; }
  if (args[0] === '--list') {
    if (args.length !== 1) throw new Error('사용법: jutell map --list');
    const { index } = await readMapSelectionIndex(paths);
    io.write(formatMapSelectionIndex(index));
    return 0;
  }
  if (args[0] === '--show') {
    if (args.length < 2) throw new Error('사용법: jutell map --show <ID 또는 이름 일부>');
    let id = args.slice(1).join(' ').trim();
    if (!/^f-[a-f0-9]{12}$/.test(id)) {
      // Keyword search over feature names in the small index (never the full map).
      const { index } = await readMapSelectionIndex(paths);
      const word = id.toLowerCase();
      const found = index.sections.filter((section) => section.name.toLowerCase().includes(word));
      if (!found.length) throw new Error(`'${id}'${subjectParticle(id)} 들어간 기능 이름이 없어요. \`jutell map --list\`로 목록을 확인하세요.`);
      if (found.length > 1) {
        io.write([`'${id}'${subjectParticle(id)} 들어간 기능이 ${found.length}개예요. 하나를 골라 ID로 다시 보세요.`, ...found.map((section) => `- ${sanitizeMapSelectionText(section.name)} · ID ${section.id}`)].join('\n'));
        return 0;
      }
      id = found[0].id;
    }
    const result = await readMapSelectionDetail(paths, id);
    // The first line is JuTell's hidden check marker; it is not shown.
    const body = result.text.split(/\r?\n/).slice(1).join('\n').trimEnd();
    io.write(sanitizeMapSelectionText(`${formatMapSelectionContext(result.index, result.entry)}${body}`));
    return 0;
  }
  const exclude = args.includes('--git-exclude');
  const include = args.includes('--git-include');
  if (exclude && include) throw new Error('--git-exclude와 --git-include는 함께 쓸 수 없어요.');
  if (exclude || include) {
    const result = exclude ? await addGitExclude(paths.targetRoot) : await removeGitExclude(paths.targetRoot);
    io.write(gitExcludeMessage(result, paths.targetRoot));
    if (['added', 'already', 'removed', 'absent'].includes(result.status)) await recordGitExclude(paths, exclude);
    return 0;
  }
  const unknown = args.filter((arg) => arg.startsWith('-'));
  if (unknown.length) throw new Error(`jutell map에서 알 수 없는 옵션입니다: ${unknown.join(', ')}`);
  const result = await writeMap(paths);
  io.write(mapWriteMessage(result, paths));
  if (result.status === 'broken' || result.status === 'link') return 0;
  if ((await fs.lstat(paths.dataRoot).catch(() => undefined))?.isSymbolicLink()) {
    io.write('.jutell-local이 링크라서 기능 목록과 보기 쉬운 화면(map.html)은 만들지 않았어요. 링크를 지우면 다음 `jutell map`에서 만들어요.');
    return 0;
  }
  if (result.selection?.status === 'skipped') io.write(`기계용 기능 인덱스와 상세를 갱신하지 못했어요 (${result.selection.reason ?? '파일을 쓸 수 없음'}). 전체 지도는 JuTellMap.md에서 확인하세요.`);
  else if (result.selection) io.write(`기계 인덱스와 기능 상세 ${result.selection.sectionCount}개: .jutell-local/map-index.json`);
  const html = await writeMapHtml(paths);
  if (html !== 'skipped') io.write(mapHtmlMessage(html));
  return 0;
}

/**
 * Files added or deleted since the map was last synced (ONE rule, shared with the receipt refresh):
 * the current file list vs. the list in map-state.json. Content-only edits never make the map stale.
 * Old state files without a list fall back to the file lines in JuTellMap.md.
 */
export async function staleMapFiles(paths: ScopePaths): Promise<{ exists: boolean; added: string[]; removed: string[] }> {
  const stats = await fs.lstat(mapFile(paths)).catch(() => undefined);
  if (!stats) return { exists: false, added: [], removed: [] };
  const current = mapListFiles((await scanProject(paths.targetRoot)).files);
  const state = await readMapState(paths);
  let recorded: string[];
  if (Array.isArray(state?.files)) recorded = state.files.filter((entry): entry is string => typeof entry === 'string');
  else {
    const parsed = parseMap(await fs.readFile(mapFile(paths), 'utf8'));
    if (typeof parsed === 'string') throw new Error(parsed);
    recorded = [...parsed.placed.keys(), ...parsed.pinned];
  }
  const before = new Set(recorded);
  const now = new Set(current);
  return { exists: true, added: current.filter((file) => !before.has(file)), removed: recorded.filter((file) => !now.has(file)) };
}

/** doctor/status line: "주의" when files were added or deleted since the map was synced; never an error (exit code stays 0). */
export async function mapFreshnessCheck(paths: ScopePaths) {
  const name = '프로젝트 지도';
  if (paths.scope !== 'project') return undefined;
  try {
    const stale = await staleMapFiles(paths);
    if (!stale.exists) return { name, status: '정상' as const, detail: '지도가 없어요. `jutell map`으로 만들 수 있어요.' };
    // The small feature list (map-index.json and map-details) must describe the same map.
    const markdown = await fs.readFile(mapFile(paths), 'utf8').catch(() => undefined);
    const selection = markdown === undefined ? [] : await mapSelectionProblems(paths, markdown).catch(() => []);
    if (!stale.added.length && !stale.removed.length) {
      return selection.length
        ? { name, status: '주의' as const, detail: `지도는 최신이지만 기능 목록이 맞지 않아요: ${selection.join(' · ')}. \`jutell map\`으로 다시 맞추세요.` }
        : { name, status: '정상' as const, detail: '지도가 최신이에요.' };
    }
    const list = (files: string[]) => `${files.slice(0, 3).join(', ')}${files.length > 3 ? ' 등' : ''}`;
    const parts = [
      stale.added.length ? `지도에 없는 새 파일 ${stale.added.length}개(${list(stale.added)})` : '',
      stale.removed.length ? `지도에는 있지만 폴더에서 없어진 파일 ${stale.removed.length}개(${list(stale.removed)})` : '',
    ].filter(Boolean);
    return { name, status: '주의' as const, detail: `지도 오래됨: ${parts.join(', ')}${selection.length ? ` · 기능 목록: ${selection.join(' · ')}` : ''}. \`jutell map\`으로 갱신하세요.` };
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
  // On time out the refresh is cancelled too (AbortSignal): it stops scanning and writes nothing afterwards.
  const controller = new AbortController();
  const timeout = new Promise<'timeout'>((resolve) => { timer = setTimeout(() => { controller.abort(); resolve('timeout'); }, timeoutMs); });
  try {
    const result = await Promise.race([writeMap(paths, new Date(), controller.signal, true), timeout]);
    if (result === 'timeout') return { jutellOwned, note: 'ⓘ 지도 갱신 못 함(시간 초과로 건너뜀)' };
    if (result.status === 'link') return { jutellOwned: false, note: 'ⓘ 지도 갱신 못 함(지도가 링크예요)' };
    if (result.status === 'broken') return { jutellOwned, note: 'ⓘ 지도 갱신 못 함(자동 칸 표시가 망가져 있어요. `jutell map`으로 확인하세요)' };
    // Nothing changed and the page exists: skip re-rendering it.
    const htmlThere = await fs.lstat(path.join(paths.dataRoot, MAP_HTML_FILE)).then((entry) => entry.isFile(), () => false);
    if (!(result.status === 'unchanged' && result.selection?.status === 'unchanged' && htmlThere)) await writeMapHtml(paths).catch(() => undefined);
    // A linked .jutell-local is reported by doctor/status, not again on every receipt.
    if (result.selection?.status === 'skipped' && !/일반 폴더가 아님/.test(result.selection.reason ?? '')) return { jutellOwned, note: `ⓘ 기능 인덱스 갱신 못 함(${result.selection.reason ?? '파일을 쓸 수 없음'})` };
    if (result.status !== 'updated') return result.selection?.status === 'written'
      ? { jutellOwned, note: 'ⓘ 기능 인덱스와 상세 파일을 만들었어요  [JuTell이 고침]' }
      : { jutellOwned };
    const parts = [
      result.added.length ? `새 파일 ${result.added.length}개` : '',
      result.removed.length ? `빠진 파일 ${result.removed.length}개` : '',
    ].filter(Boolean);
    return { jutellOwned, note: `ⓘ 지도를 갱신했어요${parts.length ? ` (${parts.join(', ')} 반영)` : ''}  [JuTell이 고침]` };
  } catch (error) {
    return { jutellOwned, note: `ⓘ 지도 갱신 못 함(${friendlyError(error, paths.targetRoot)})` };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
