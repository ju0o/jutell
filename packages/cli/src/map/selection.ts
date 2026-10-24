import { createHash } from 'node:crypto';
import { constants as fsConstants, promises as fs } from 'node:fs';
import path from 'node:path';
import { ensureDataRoot } from '../config/managed.js';
import type { ScopePaths } from '../types.js';
import { ESTIMATED_LABEL, UNCLASSIFIED } from './classify.js';
import type { MapScan } from './scan.js';

export const MAP_INDEX_FILE = 'map-index.json';
export const MAP_DETAILS_DIR = 'map-details';
export const MAP_DETAIL_MARKER = '<!-- jutell:generated-map-detail version=1';
const INDEX_VERSION = 1;
const INDEX_MARKER = 'jutell-map-index';
const MAP_SOURCE_FILE = 'JuTellMap.md';
const UNCLASSIFIED_KEY = '분류 안 됨';
const UNCLASSIFIED_HELP = '설명: 아래 줄을 원하는 기능 칸으로 옮기면, 다음부터 그 칸에 둡니다.';
const DETAIL_ID = /^f-[a-f0-9]{12}$/;

export type MapSectionEntry = {
  id: string;
  name: string;
  kind: 'feature' | 'unclassified';
  estimated: boolean;
  pathCount?: number;
  /** Hash of only this section's displayed evidence, so unrelated map edits do not rewrite it. */
  sectionSha256?: string;
  /** Time this section's evidence last changed. */
  generatedAt?: string;
  detail: string;
};

export type MapSelectionIndex = {
  format: typeof INDEX_MARKER;
  version: typeof INDEX_VERSION;
  generatedAt: string;
  sourceMap: { path: 'JuTellMap.md'; sha256: string; commit: string | null };
  scan: { source: MapScan['source']; truncated: boolean; fileCount: number; fingerprint: string };
  caveat?: string;
  sections: MapSectionEntry[];
};

type MapLine = { path: string; role: string };
type MapSection = { title: string; markerKey?: string; notes: string[]; files: MapLine[] };
type AtomicWriter = (file: string, content: string) => Promise<void>;
export type MapSelectionWriteResult = { status: 'written' | 'unchanged' | 'skipped'; indexFile: string; sectionCount: number; reason?: string };

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function parseSections(markdown: string): MapSection[] {
  const sections: MapSection[] = [];
  let current: MapSection | undefined;
  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    if (line.startsWith('## ')) {
      current = { title: line.slice(3), notes: [], files: [] };
      sections.push(current);
      continue;
    }
    if (!current) continue;
    const marker = /^<!-- jutell:auto (.+) -->$/.exec(line.trim());
    if (marker) { current.markerKey = marker[1]; continue; }
    if (line.trim() === '<!-- /jutell:auto -->') continue;
    if (line.startsWith('- ')) {
      const value = line.slice(2);
      const separator = value.lastIndexOf(' — ');
      if (separator < 0) current.notes.push(line);
      else current.files.push({ path: value.slice(0, separator), role: value.slice(separator + 3) });
    } else if (line.trim()) current.notes.push(line);
  }
  return sections;
}

function cleanTitle(title: string) {
  const suffix = ` ${ESTIMATED_LABEL}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
}

function selectionSections(markdown: string) {
  return parseSections(markdown).filter((section) => {
    const kind = cleanTitle(section.title) === UNCLASSIFIED || section.markerKey === UNCLASSIFIED_KEY ? 'unclassified' : 'feature';
    const userNotes = section.notes.some((note) => note !== UNCLASSIFIED_HELP);
    return kind !== 'unclassified' || section.files.length > 0 || userNotes;
  });
}

function escapeCode(value: string) {
  const safe = visibleText(value);
  const longestTicks = Math.max(0, ...[...safe.matchAll(/`+/g)].map(([run]) => run.length));
  const fence = '`'.repeat(longestTicks + 1);
  const padding = safe.startsWith(' ') || safe.endsWith(' ') || safe.includes('`') ? ' ' : '';
  return `${fence}${padding}${safe}${padding}${fence}`;
}

function visibleText(value: string) {
  return value.replace(/[\p{Cc}\p{Cf}]/gu, (character) => {
    const point = character.codePointAt(0) ?? 0;
    return `\\u${point.toString(16).padStart(4, '0')}`;
  });
}

function escapeMarkdownText(value: string) {
  return visibleText(value).replace(/([\\`*_{}\[\]<>()#+.!|>~])/g, '\\$1');
}

function markerLine(entry: MapSectionEntry) {
  return `${MAP_DETAIL_MARKER} id="${entry.id}" section="${entry.sectionSha256 ?? 'legacy'}" at="${entry.generatedAt ?? 'legacy'}" -->`;
}

function detailPath(id: string) {
  return path.posix.join('.jutell-local', MAP_DETAILS_DIR, `${id}.md`);
}

function sectionDigest(section: MapSection, entry: Omit<MapSectionEntry, 'detail' | 'sectionSha256' | 'generatedAt'>, presentPaths: ReadonlySet<string>) {
  return sha256(JSON.stringify({
    id: entry.id,
    name: entry.name,
    kind: entry.kind,
    estimated: entry.estimated,
    notes: section.notes,
    files: section.files.map((file) => ({ ...file, present: presentPaths.has(file.path) })),
  }));
}

/** Map area ID (same as the feature index: `f-…`) for every file listed in JuTellMap.md. */
export function mapAreaIds(markdown: string): Map<string, string> {
  const ids = new Map<string, string>();
  selectionSections(markdown).forEach((section, position) => {
    const id = `f-${sha256(section.markerKey ? `marker:${section.markerKey}` : `heading:${section.title}:${position}`).slice(0, 12)}`;
    for (const file of section.files) if (!ids.has(file.path)) ids.set(file.path, id);
  });
  return ids;
}

function buildIndex(markdown: string, scan: MapScan, commit: string | null, generatedAt: string, oldIndex?: MapSelectionIndex): MapSelectionIndex {
  const sections = selectionSections(markdown);
  const presentPaths = new Set(scan.files);
  const entries = sections.map((section, position): MapSectionEntry => {
    const name = cleanTitle(section.title);
    const kind = name === UNCLASSIFIED || section.markerKey === UNCLASSIFIED_KEY ? 'unclassified' : 'feature';
    // Auto-block keys stay stable when a person renames the visible heading.
    const identity = section.markerKey ? `marker:${section.markerKey}` : `heading:${section.title}:${position}`;
    const id = `f-${sha256(identity).slice(0, 12)}`;
    const base = { id, name, kind, estimated: section.title.endsWith(` ${ESTIMATED_LABEL}`), pathCount: section.files.length } as const;
    const sectionSha256 = sectionDigest(section, base, presentPaths);
    const previous = oldIndex?.sections.find((item) => item.id === id);
    const unchanged = previous?.sectionSha256 === sectionSha256 && typeof previous.generatedAt === 'string';
    return {
      ...base,
      sectionSha256,
      generatedAt: unchanged ? previous.generatedAt : generatedAt,
      detail: detailPath(id),
    };
  });
  const files = scan.files.filter((file) => file !== MAP_SOURCE_FILE);
  const fingerprint = sha256(JSON.stringify({ source: scan.source, truncated: scan.truncated, files }));
  return {
    format: INDEX_MARKER,
    version: INDEX_VERSION,
    generatedAt,
    sourceMap: { path: MAP_SOURCE_FILE, sha256: sha256(markdown), commit },
    scan: { source: scan.source, truncated: scan.truncated, fileCount: files.length, fingerprint },
    caveat: '분류는 추정; 데이터 연결·동작·테스트 통과는 미확인',
    sections: entries,
  };
}

function renderDetail(section: MapSection, entry: MapSectionEntry, index: MapSelectionIndex, presentPaths: ReadonlySet<string>) {
  const line = (file: MapSection['files'][number]) => `- ${escapeCode(file.path)} — ${escapeMarkdownText(file.role)}${presentPaths.has(file.path) ? '' : ' — 지금 폴더에서 찾지 못함'}`;
  // Only groups that have files; no repeated "nothing here" lines.
  const groups: Array<[string, typeof section.files]> = [
    ['화면', section.files.filter((file) => file.role === '화면')],
    ['코드', section.files.filter((file) => file.role === '기능')],
    ['테스트', section.files.filter((file) => file.role === '테스트')],
    ['기타', section.files.filter((file) => !['화면', '기능', '테스트'].includes(file.role))],
  ];
  const listed = groups.filter(([, files]) => files.length).flatMap(([title, files]) => [`## ${title}`, ...files.map(line), '']);
  return [
    markerLine(entry),
    `# ${escapeMarkdownText(entry.name)}`,
    '',
    `- 정리한 시각: ${entry.generatedAt ?? index.generatedAt}${entry.estimated ? ` · 이름과 분류는 파일 이름으로 짐작함 ${ESTIMATED_LABEL}` : ''}`,
    '- 모르는 것: 파일끼리 데이터가 어떻게 이어지는지, 실제로 잘 동작하는지, 테스트가 통과하는지 (지도는 앱이나 테스트를 실행하지 않아요)',
    '',
    ...(listed.length ? listed : ['지도에 적힌 파일이 없어요.', '']),
    ...(section.notes.length ? ['## 지도에 사용자가 적은 설명 (JuTell이 확인하지 않음)', ...section.notes.map((note) => `- ${escapeMarkdownText(note)}`), ''] : []),
  ].join('\n');
}

function parseExistingIndex(value: string | undefined): MapSelectionIndex | undefined {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return validIndex(parsed) ? parsed : undefined;
  } catch { return undefined; }
}

async function safeReadRegular(file: string): Promise<string | undefined> {
  const stats = await fs.lstat(file).catch(() => undefined);
  if (!stats || !stats.isFile() || stats.isSymbolicLink()) return undefined;
  return fs.readFile(file, { encoding: 'utf8', flag: fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0) }).catch(() => undefined);
}

async function isRegularDirectory(dir: string) {
  const stats = await fs.lstat(dir).catch(() => undefined);
  return Boolean(stats?.isDirectory() && !stats.isSymbolicLink());
}

async function safeDirectory(dir: string) {
  const stats = await fs.lstat(dir).catch(() => undefined);
  if (stats) return stats.isDirectory() && !stats.isSymbolicLink();
  await fs.mkdir(dir).catch((error) => { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; });
  const created = await fs.lstat(dir).catch(() => undefined);
  return Boolean(created?.isDirectory() && !created.isSymbolicLink());
}

/** Writes one short JSON index and one Markdown detail per section, without deleting old detail files. */
export async function writeMapSelectionFiles(
  paths: ScopePaths,
  markdown: string,
  scan: MapScan,
  now: Date,
  commit: string | null,
  writeAtomically: AtomicWriter,
): Promise<MapSelectionWriteResult> {
  const indexFile = path.join(paths.dataRoot, MAP_INDEX_FILE);
  const detailsDir = path.join(paths.dataRoot, MAP_DETAILS_DIR);
  const changedDetails: string[] = [];
  try {
    await ensureDataRoot(paths);
    const rootStats = await fs.lstat(paths.dataRoot);
    if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) return { status: 'skipped', indexFile, sectionCount: 0, reason: '.jutell-local 경로가 일반 폴더가 아님' };
    if (!(await safeDirectory(detailsDir))) return { status: 'skipped', indexFile, sectionCount: 0, reason: '상세 파일 폴더가 일반 폴더가 아님' };

    const oldIndexText = await safeReadRegular(indexFile);
    const oldIndex = parseExistingIndex(oldIndexText);
    if (oldIndexText !== undefined && !oldIndex) return { status: 'skipped', indexFile, sectionCount: 0, reason: '기존 인덱스가 JuTell 형식이 아니어서 보존함' };
    const probe = buildIndex(markdown, scan, commit, now.toISOString(), oldIndex);
    const sameSource = oldIndex?.sourceMap.sha256 === probe.sourceMap.sha256
      && oldIndex?.sourceMap.commit === probe.sourceMap.commit
      && oldIndex?.scan.fingerprint === probe.scan.fingerprint;
    const sameSelectionShape = oldIndex !== undefined
      && oldIndex.caveat === probe.caveat
      && oldIndex.sections.length === probe.sections.length
      && oldIndex.sections.every((section, position) => {
        const next = probe.sections[position];
        return next !== undefined && section.id === next.id && section.name === next.name
          && section.kind === next.kind && section.estimated === next.estimated && section.pathCount === next.pathCount
          && section.sectionSha256 === next.sectionSha256;
      });
    const index = sameSource && sameSelectionShape ? { ...probe, generatedAt: oldIndex?.generatedAt ?? probe.generatedAt } : probe;
    const sections = selectionSections(markdown);
    const presentPaths = new Set(scan.files);
    const detailWrites = sections.flatMap((section, position) => {
      const entry = index.sections[position];
      return entry ? [{ entry, file: path.join(detailsDir, `${entry.id}.md`), content: `${renderDetail(section, entry, index, presentPaths)}\n` }] : [];
    });
    const indexContent = `${JSON.stringify(index)}\n`;

    // Check every destination before the first replacement so a later user-owned file cannot
    // leave an earlier generated detail paired with an old index.
    const indexStats = await fs.lstat(indexFile).catch(() => undefined);
    if (indexStats && (!indexStats.isFile() || indexStats.isSymbolicLink())) return { status: 'skipped', indexFile, sectionCount: index.sections.length, reason: '인덱스를 덮어쓰지 않았어요 (일반 파일이 아님)' };
    const existingDetails = new Map<string, string | undefined>();
    for (const target of detailWrites) {
      const stats = await fs.lstat(target.file).catch(() => undefined);
      if (stats && (!stats.isFile() || stats.isSymbolicLink())) return { status: 'skipped', indexFile, sectionCount: index.sections.length, reason: `상세 파일을 덮어쓰지 않았어요 (${target.entry.id})` };
      const existing = await safeReadRegular(target.file);
      if (existing !== undefined && !existing.startsWith(`${MAP_DETAIL_MARKER} `)) return { status: 'skipped', indexFile, sectionCount: index.sections.length, reason: `기존 상세 파일을 보존했어요 (${target.entry.id})` };
      existingDetails.set(target.entry.id, existing);
    }

    let changed = false;
    for (const target of detailWrites) {
      if (existingDetails.get(target.entry.id) === target.content) continue;
      await writeAtomically(target.file, target.content);
      changedDetails.push(target.entry.id);
      changed = true;
    }

    if (oldIndexText !== indexContent) { await writeAtomically(indexFile, indexContent); changed = true; }
    return { status: changed ? 'written' : 'unchanged', indexFile, sectionCount: index.sections.length };
  } catch (error) {
    const message = (error as Error).message || '파일 작성 오류';
    const reason = changedDetails.length
      ? `부분 갱신됨: 상세 ${changedDetails.join(', ')} 기록 후 중단했어요. 인덱스 갱신을 확인하려면 \`jutell map\`을 다시 실행하세요 (${message})`
      : message;
    return { status: 'skipped', indexFile, sectionCount: 0, reason };
  }
}

function validIndex(value: unknown): value is MapSelectionIndex {
  if (!value || typeof value !== 'object') return false;
  const index = value as Partial<MapSelectionIndex>;
  const hash = /^[a-f0-9]{64}$/i;
  if (index.format !== INDEX_MARKER || index.version !== INDEX_VERSION || typeof index.generatedAt !== 'string' || !Number.isFinite(Date.parse(index.generatedAt))) return false;
  if (!index.sourceMap || index.sourceMap.path !== 'JuTellMap.md' || !hash.test(index.sourceMap.sha256) || !(index.sourceMap.commit === null || /^[a-f0-9]{40,64}$/i.test(index.sourceMap.commit))) return false;
  if (!index.scan || !['git', 'walk'].includes(index.scan.source) || typeof index.scan.truncated !== 'boolean' || !Number.isInteger(index.scan.fileCount) || index.scan.fileCount < 0 || !hash.test(index.scan.fingerprint)) return false;
  if (!(index.caveat === undefined || typeof index.caveat === 'string') || !Array.isArray(index.sections)) return false;
  const ids = new Set<string>();
  return index.sections.every((section) => Boolean(section)
    && DETAIL_ID.test(section.id)
    && !ids.has(section.id)
    && ids.add(section.id)
    && typeof section.name === 'string'
    && (section.kind === 'feature' || section.kind === 'unclassified')
    && typeof section.estimated === 'boolean'
    && (section.pathCount === undefined || (Number.isInteger(section.pathCount) && section.pathCount >= 0))
    && (section.sectionSha256 === undefined || hash.test(section.sectionSha256))
    && (section.generatedAt === undefined || (typeof section.generatedAt === 'string' && Number.isFinite(Date.parse(section.generatedAt))))
    && section.detail === detailPath(section.id));
}

/** Reads only the small index; it never opens JuTellMap.md. */
export async function readMapSelectionIndex(paths: ScopePaths): Promise<{ index: MapSelectionIndex; text: string }> {
  const file = path.join(paths.dataRoot, MAP_INDEX_FILE);
  if (!(await isRegularDirectory(paths.dataRoot))) throw new Error('.jutell-local 경로가 일반 폴더가 아니어서 인덱스를 읽지 않았어요.');
  const text = await safeReadRegular(file);
  if (text === undefined) throw new Error('기계용 지도 인덱스를 읽지 못했어요. `jutell map`으로 생성하세요.');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('기계용 지도 인덱스 형식이 올바르지 않아요. 기존 `.jutell-local/map-index.json`을 보관용 이름으로 바꾼 뒤 `jutell map`을 실행하세요.'); }
  if (!validIndex(parsed)) throw new Error('기계용 지도 인덱스 형식이 올바르지 않아요. 기존 `.jutell-local/map-index.json`을 보관용 이름으로 바꾼 뒤 `jutell map`을 실행하세요.');
  return { index: parsed, text };
}

/** Resolves a stable ID from the index, then opens only that feature's detail file. */
export async function readMapSelectionDetail(paths: ScopePaths, id: string): Promise<{ entry: MapSectionEntry; index: MapSelectionIndex; text: string }> {
  if (!DETAIL_ID.test(id)) throw new Error('기능 ID 형식이 올바르지 않아요. `jutell map --list`에서 ID를 확인하세요.');
  const { index } = await readMapSelectionIndex(paths);
  const entry = index.sections.find((section) => section.id === id);
  if (!entry) throw new Error('해당 기능 ID가 인덱스에 없어요. `jutell map --list`에서 ID를 확인하세요.');
  const detailsDir = path.join(paths.dataRoot, MAP_DETAILS_DIR);
  if (!(await isRegularDirectory(detailsDir))) throw new Error('기능 상세 폴더가 일반 폴더가 아니어서 읽지 않았어요.');
  const file = path.join(detailsDir, `${id}.md`);
  const text = await safeReadRegular(file);
  if (text === undefined) throw new Error('선택한 기능 상세를 읽지 못했어요. `jutell map`으로 갱신하세요.');
  if (!entry.sectionSha256 || !entry.generatedAt || text.split(/\r?\n/, 1)[0] !== markerLine(entry)) throw new Error('선택한 상세가 현재 인덱스 출처와 맞지 않아요. `jutell map`으로 갱신하세요.');
  return { entry, index, text };
}

/** Keeps line breaks in generated details but renders terminal controls visibly. */
export function sanitizeMapSelectionText(value: string) {
  return value.replace(/[\p{Cc}\p{Cf}]/gu, (character) => {
    if (character === '\n' || character === '\t') return character;
    const point = character.codePointAt(0) ?? 0;
    return `\\u${point.toString(16).padStart(4, '0')}`;
  });
}

export function formatMapSelectionIndex(index: MapSelectionIndex) {
  const rows = index.sections.map((section) => `- ${visibleText(section.name)} · ${section.pathCount === undefined ? '파일 수 모름' : `파일 ${section.pathCount}개`}${section.estimated ? ` ${ESTIMATED_LABEL}` : ''} · ID ${section.id}`);
  const scan = `${index.scan.source === 'git' ? 'Git 파일 목록' : '폴더 탐색'} · ${index.scan.fileCount}개${index.scan.truncated ? ' · 너무 많아 일부 빠졌을 수 있음' : ''}`;
  return [
    `기능 목록 · 정리한 시각 ${index.generatedAt}${index.sourceMap.commit ? ` · 커밋 ${index.sourceMap.commit.slice(0, 7)}` : ''}`,
    `파일 목록: ${scan}`,
    ...rows,
    '파일끼리의 연결, 실제 동작, 테스트 통과는 이 목록으로 알 수 없어요.',
    '자세히 보기: `jutell map --show <ID 또는 이름 일부>`',
  ].join('\n');
}

/** Global source and scan metadata shown with the selected, section-local detail. */
export function formatMapSelectionContext(index: MapSelectionIndex, entry: MapSectionEntry) {
  const scan = `${index.scan.source === 'git' ? 'Git 파일 목록' : '폴더 탐색'} ${index.scan.fileCount}개${index.scan.truncated ? ' (일부 빠졌을 수 있음)' : ''}`;
  return [
    `${index.sourceMap.path} 기준 · ${scan} · ID ${entry.id}${index.sourceMap.commit ? ` · 커밋 ${index.sourceMap.commit.slice(0, 7)}` : ''}`,
    '지금 폴더와 다시 맞춰 보지 않았어요. 최신으로 하려면 `jutell map`을 실행하세요.',
    '',
  ].join('\n');
}
