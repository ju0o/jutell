import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { constants as fsConstants, promises as fs } from 'node:fs';
import path from 'node:path';
import { ensureDataRoot } from '../config/managed.js';
import type { CliIo, CliOptions, ScopePaths } from '../types.js';
import { classifyFiles, ESTIMATED_LABEL, UNCLASSIFIED, type Classified } from './classify.js';
import { scanProject, type MapScan } from './scan.js';
import { writeMapSelectionFiles, type MapSelectionWriteResult } from './selection.js';

export const MAP_FILE = 'JuTellMap.md';
export const MAP_STATE_FILE = 'map-state.json';
/** Fresh copy written when the existing map is broken (never overwritten). */
export const MAP_COPY_FILE = 'JuTellMap.new.md';
/** Marker key of the "not yet classified" section. */
export const UNCLASSIFIED_KEY = '분류 안 됨';

const TITLE = '# JuTell 지도 — 이 프로젝트는 어떻게 생겼나요?';
const NOTE = '<!-- 이 파일은 jutell이 자동으로 고칩니다. "설명:" 줄과 직접 옮긴 파일 줄은 그대로 남습니다. -->';
const HEADER_PREFIX = '마지막 갱신:';
const UNCLASSIFIED_HELP = '설명: 아래 줄을 원하는 기능 칸으로 옮기면, 다음부터 그 칸에 둡니다.';
const OPEN = /^<!-- jutell:auto (.+) -->$/;
const CLOSE = '<!-- /jutell:auto -->';

export type MapWriteResult =
  | { status: 'created'; file: string; files: number; unclassified: number; selection?: MapSelectionWriteResult }
  | { status: 'updated'; file: string; added: string[]; removed: string[]; newSections: string[]; selection?: MapSelectionWriteResult }
  | { status: 'unchanged'; file: string; selection?: MapSelectionWriteResult }
  | { status: 'broken'; file: string; copy: string; reason: string }
  | { status: 'link'; file: string };

function keyOf(item: Classified) {
  return item.feature === UNCLASSIFIED ? UNCLASSIFIED_KEY : item.feature;
}

function fileLine(item: { path: string; role: string }) {
  return `- ${item.path} — ${item.role}`;
}

/** Path of a "- path — role" line, or undefined. */
function linePath(line: string): string | undefined {
  if (!line.startsWith('- ')) return undefined;
  const cut = line.lastIndexOf(' — ');
  return cut > 2 ? line.slice(2, cut) : undefined;
}

function stamp(now: Date) {
  return `${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}
function headerLine(now: Date, files: number, unclassified: number, scan?: Pick<MapScan, 'source' | 'truncated'>) {
  const source = scan?.source === 'git' ? 'Git 파일 목록' : scan?.source === 'walk' ? '폴더 탐색' : undefined;
  const completeness = scan?.source === 'walk' ? (scan.truncated ? '20,000개 상한 초과로 일부 생략' : '20,000개 상한 내') : undefined;
  const provenance = [source && `목록 기준 ${source}`, completeness].filter(Boolean).join(' · ');
  return `${HEADER_PREFIX} ${stamp(now)} · 파일 ${files}개 · 분류 안 된 파일 ${unclassified}개${provenance ? ` · ${provenance}` : ''}`;
}

function sectionLines(key: string, estimated: boolean, items: Classified[]): string[] {
  const heading = key === UNCLASSIFIED_KEY ? `## ${UNCLASSIFIED}` : `## ${key}${estimated ? ` ${ESTIMATED_LABEL}` : ''}`;
  return [heading, ...(key === UNCLASSIFIED_KEY ? [UNCLASSIFIED_HELP] : []), `<!-- jutell:auto ${key} -->`, ...items.map(fileLine), CLOSE];
}

type Parsed = { lines: string[]; eol: string; blocks: Map<string, { open: number; close: number }>; placed: Map<string, string>; pinned: Set<string> };

/** Parses an existing map. Returns a reason string when the markers are broken. */
export function parseMap(text: string): Parsed | string {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split('\n').map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line));
  const blocks = new Map<string, { open: number; close: number }>();
  const placed = new Map<string, string>();
  const pinned = new Set<string>();
  let current: { key: string; open: number } | undefined;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const opened = OPEN.exec(line);
    if (opened) {
      if (current) return `${index + 1}번째 줄: 자동 칸이 닫히기 전에 새 자동 칸이 열렸어요`;
      if (blocks.has(opened[1])) return `${index + 1}번째 줄: 같은 이름의 자동 칸이 두 번 있어요(${opened[1]})`;
      current = { key: opened[1], open: index };
    } else if (line === CLOSE) {
      if (!current) return `${index + 1}번째 줄: 열리지 않은 자동 칸을 닫았어요`;
      blocks.set(current.key, { open: current.open, close: index });
      current = undefined;
    } else {
      const file = linePath(lines[index]);
      if (file === undefined) continue;
      // A file line inside an auto block remembers its section; outside any block it was moved by a person.
      if (current) placed.set(file, current.key);
      else pinned.add(file);
    }
  }
  if (current) return `${current.open + 1}번째 줄의 자동 칸이 닫히지 않았어요`;
  return { lines, eol, blocks, placed, pinned };
}

/** Full map text for a project without one. */
export function renderNewMap(items: Classified[], now: Date, scan?: Pick<MapScan, 'source' | 'truncated'>): string {
  const groups = group(items, new Map());
  const keys = [...groups.keys()].filter((key) => key !== UNCLASSIFIED_KEY);
  const out = [TITLE, NOTE, headerLine(now, items.length, groups.get(UNCLASSIFIED_KEY)?.length ?? 0, scan)];
  for (const key of [...keys, UNCLASSIFIED_KEY]) {
    const list = groups.get(key) ?? [];
    out.push('', ...sectionLines(key, list[0]?.estimated ?? false, list));
  }
  return `${out.join('\n')}\n`;
}

function group(items: Classified[], placement: Map<string, string>) {
  const groups = new Map<string, Classified[]>();
  for (const item of items) {
    const key = placement.get(item.path) ?? keyOf(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return groups;
}

/**
 * Updates only what is inside the jutell:auto blocks (and the "마지막 갱신" line when something changed).
 * Lines a person wrote ("설명:", headings, moved file lines) stay byte for byte.
 * A file moved into another auto block stays in that block; a file moved outside every block is left out of the blocks.
 */
export function updateMap(existing: string, items: Classified[], now: Date, scan?: Pick<MapScan, 'source' | 'truncated'>): { text: string; changed: boolean; added: string[]; removed: string[]; newSections: string[] } | string {
  const parsed = parseMap(existing);
  if (typeof parsed === 'string') return parsed;
  const { lines, eol, blocks, placed, pinned } = parsed;
  const placement = new Map([...placed].filter(([, key]) => blocks.has(key)));
  const groups = group(items.filter((item) => !pinned.has(item.path)), placement);
  const out: string[] = [];
  let index = 0;
  const ordered = [...blocks.entries()].sort((a, b) => a[1].open - b[1].open);
  for (const [key, block] of ordered) {
    out.push(...lines.slice(index, block.open + 1));
    out.push(...(groups.get(key) ?? []).map(fileLine));
    index = block.close;
    groups.delete(key);
  }
  let tail = lines.slice(index);
  // New sections go before the "not yet classified" section when it is the last one, else at the end.
  const fresh = [...groups.entries()].filter(([key]) => key !== UNCLASSIFIED_KEY).flatMap(([key, list]) => ['', ...sectionLines(key, list[0].estimated, list)]);
  const freshUnclassified = groups.has(UNCLASSIFIED_KEY) ? ['', ...sectionLines(UNCLASSIFIED_KEY, false, groups.get(UNCLASSIFIED_KEY) ?? [])] : [];
  const unclassifiedHeading = out.lastIndexOf(`## ${UNCLASSIFIED}`);
  if (fresh.length && unclassifiedHeading >= 0 && blocks.get(UNCLASSIFIED_KEY) && ordered[ordered.length - 1][0] === UNCLASSIFIED_KEY) {
    const insertAt = unclassifiedHeading > 0 && out[unclassifiedHeading - 1] === '' ? unclassifiedHeading - 1 : unclassifiedHeading;
    out.splice(insertAt, 0, ...fresh);
  } else if (fresh.length) {
    const trailing = tail.length && tail[tail.length - 1] === '' ? tail.pop() : undefined;
    tail = [...tail, ...fresh, ...(trailing !== undefined ? [''] : [])];
  }
  if (freshUnclassified.length) {
    const trailing = tail.length && tail[tail.length - 1] === '' ? tail.pop() : undefined;
    tail = [...tail, ...freshUnclassified, ...(trailing !== undefined ? [''] : [])];
  }
  const result = [...out, ...tail];
  const before = new Set(placed.keys());
  const after = new Set(items.filter((item) => !pinned.has(item.path)).map((item) => item.path));
  const diff = {
    added: [...after].filter((file) => !before.has(file)),
    removed: [...before].filter((file) => !after.has(file)),
    newSections: [...groups.keys()],
  };
  if (result.join(eol) === lines.join(eol)) return { text: existing, changed: false, ...diff };
  const unclassified = items.filter((item) => !pinned.has(item.path) && (placement.get(item.path) ?? keyOf(item)) === UNCLASSIFIED_KEY).length;
  const header = result.findIndex((line) => line.startsWith(HEADER_PREFIX));
  if (header >= 0) result[header] = headerLine(now, items.length, unclassified, scan);
  return { text: result.join(eol), changed: true, ...diff };
}

export function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

export async function writeViaTemp(file: string, content: string) {
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.jutell-tmp-${process.pid}`);
  const flags = fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | (fsConstants.O_NOFOLLOW ?? 0);
  const existingMode = await fs.lstat(file).then((stat) => stat.mode & 0o777, () => undefined);
  const handle = await fs.open(temporary, flags, existingMode ?? 0o644);
  try { await handle.writeFile(content, 'utf8'); } finally { await handle.close(); }
  try { await fs.rename(temporary, file); } catch (error) { await fs.rm(temporary, { force: true }); throw error; }
}

async function recordState(paths: ScopePaths, text: string, now: Date) {
  await ensureDataRoot(paths);
  if (!(await fs.lstat(paths.dataRoot)).isDirectory()) return;
  const stateFile = path.join(paths.dataRoot, MAP_STATE_FILE);
  if ((await fs.lstat(stateFile).catch(() => undefined))?.isSymbolicLink()) return;
  await writeViaTemp(stateFile, `${JSON.stringify({ version: 1, file: MAP_FILE, hash: sha256(text), writtenAt: now.toISOString() }, null, 2)}\n`);
}

export function mapFile(paths: ScopePaths) {
  return path.join(paths.targetRoot, MAP_FILE);
}

function currentCommit(root: string): string | null {
  try {
    const commit = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 1000,
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    }).trim();
    return /^[a-f0-9]{40,64}$/i.test(commit) ? commit : null;
  } catch { return null; }
}

async function updateSelection(paths: ScopePaths, markdown: string, scan: MapScan, now: Date) {
  return writeMapSelectionFiles(paths, markdown, scan, now, currentCommit(paths.targetRoot), writeViaTemp);
}

export async function mapExists(paths: ScopePaths) {
  return (await fs.lstat(mapFile(paths)).catch(() => undefined)) !== undefined;
}

/** Creates JuTellMap.md or refreshes its auto blocks. Writes nothing when nothing changed. */
export async function writeMap(paths: ScopePaths, now = new Date()): Promise<MapWriteResult> {
  const file = mapFile(paths);
  const stats = await fs.lstat(file).catch(() => undefined);
  if (stats && !stats.isFile()) return { status: 'link', file };
  const scan = await scanProject(paths.targetRoot);
  const items = classifyFiles(scan.files.filter((relative) => relative !== MAP_FILE));
  if (!stats) {
    const text = renderNewMap(items, now, scan);
    await writeViaTemp(file, text);
    await recordState(paths, text, now);
    const selection = await updateSelection(paths, text, scan, now);
    return { status: 'created', file, files: items.length, unclassified: items.filter((item) => item.feature === UNCLASSIFIED).length, selection };
  }
  const existing = await fs.readFile(file, { encoding: 'utf8', flag: fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0) });
  const updated = updateMap(existing, items, now, scan);
  if (typeof updated === 'string') {
    await ensureDataRoot(paths);
    const copy = path.join(paths.dataRoot, MAP_COPY_FILE);
    if ((await fs.lstat(copy).catch(() => undefined))?.isSymbolicLink()) throw new Error('지도 사본 위치가 링크라서 쓰지 않았어요');
    await writeViaTemp(copy, renderNewMap(items, now, scan));
    return { status: 'broken', file, copy, reason: updated };
  }
  if (!updated.changed) {
    const selection = await updateSelection(paths, existing, scan, now);
    return { status: 'unchanged', file, selection };
  }
  await writeViaTemp(file, updated.text);
  await recordState(paths, updated.text, now);
  const selection = await updateSelection(paths, updated.text, scan, now);
  return { status: 'updated', file, added: updated.added, removed: updated.removed, newSections: updated.newSections, selection };
}

/** One plain line about a map write, for the terminal. */
export function mapWriteMessage(result: MapWriteResult, paths: ScopePaths): string {
  const shown = (file: string) => path.relative(paths.targetRoot, file) || file;
  if (result.status === 'created') return `프로젝트 지도(${MAP_FILE})를 만들었어요. 파일 ${result.files}개, 분류 안 된 파일 ${result.unclassified}개.`;
  if (result.status === 'updated') {
    const parts = [
      result.added.length ? `새 파일 ${result.added.length}개` : '',
      result.removed.length ? `빠진 파일 ${result.removed.length}개` : '',
      result.newSections.length ? `새 칸 ${result.newSections.length}개(${result.newSections.join(', ')})` : '',
    ].filter(Boolean);
    return `프로젝트 지도(${MAP_FILE})를 갱신했어요${parts.length ? `: ${parts.join(', ')}` : ''}.`;
  }
  if (result.status === 'unchanged') return `프로젝트 지도(${MAP_FILE})는 바뀐 것이 없어요.`;
  if (result.status === 'link') return `${MAP_FILE}이 링크라서 쓰지 않았어요.`;
  if (result.status !== 'broken') return '';
  return `${MAP_FILE}의 자동 칸 표시가 망가져 있어서(${result.reason}) 고치지 않았어요. 새 지도는 ${shown(result.copy)}에 만들었어요.`;
}

export const MAP_QUESTION = '프로젝트 지도(JuTellMap.md)를 만들까요? 파일이 어디 있는지 기능별로 정리해요.';
export const MAP_LATER = '프로젝트 지도는 만들지 않았어요. 나중에 `jutell map`으로 만들 수 있어요.';

/**
 * The one install question (plan.md §1): Enter or --yes creates the map, "n" does not.
 * Never asks when a map already exists, outside a project, or without a terminal to answer in.
 * A failed map write never fails the installation.
 */
export async function offerMap(paths: ScopePaths, options: CliOptions, io: CliIo, interactive: boolean) {
  if (paths.scope !== 'project') return { asked: false, created: false };
  if (await mapExists(paths)) return { asked: false, created: false };
  let asked = false;
  if (!options.yes) {
    if (!interactive) { io.write(MAP_LATER); return { asked, created: false }; }
    asked = true;
    if (!(await io.ask(MAP_QUESTION, true))) { io.write(MAP_LATER); return { asked, created: false }; }
  }
  try {
    const result = await writeMap(paths);
    io.write(mapWriteMessage(result, paths));
    return { asked, created: result.status === 'created' };
  } catch (error) {
    io.write(`프로젝트 지도를 만들지 못했어요(${(error as Error).message}). 나중에 \`jutell map\`으로 다시 시도할 수 있어요.`);
    return { asked, created: false };
  }
}
