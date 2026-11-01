import type { MatchItem, ReceiptMatch } from './match.js';
import { RECEIPT_LABELS, receiptLabelsFor, resolveReceiptLocale, type ReceiptLabels, type ReceiptLocale } from './i18n.js';

// Receipt i18n (v2.3.0): the fixed labels and JuTell's own note lines come from
// RECEIPT_LABELS (i18n.ts), chosen per locale. The Korean set is re-exported
// below under its original names, so callers and tests that read the labels
// directly keep working and Korean stays the default everywhere.
export { RECEIPT_LABELS, receiptLabelsFor, resolveReceiptLocale } from './i18n.js';
export type { ReceiptLabels, ReceiptLocale } from './i18n.js';
export const RECEIPT_SECTIONS = RECEIPT_LABELS.ko.sections;
export const NEXT_GROUPS = RECEIPT_LABELS.ko.nextGroups;
export const NOTHING_NEXT_LINE = RECEIPT_LABELS.ko.nothingNextLine;
export const DEFAULT_SUMMARY = RECEIPT_LABELS.ko.defaultSummary;
export const SUMMARY_PREFIX = RECEIPT_LABELS.ko.summaryPrefix;
export const MATCH_SECTION = RECEIPT_SECTIONS[0];
export const LABEL_GIT = RECEIPT_LABELS.ko.labelGit;
/** Files already changed before the work (W7): listed in the comparison, never counted as a change or a warning. */
export const BEFORE_WORK_MARK = RECEIPT_LABELS.ko.beforeWorkMark;
export const LABEL_AI = RECEIPT_LABELS.ko.labelAI;
export const LABEL_ESTIMATE = RECEIPT_LABELS.ko.labelEstimate;
/** The comparison count: Git's changed files placed by the map. */
export const LABEL_MATCH = RECEIPT_LABELS.ko.labelMatch;
export const LABEL_JUTELL = RECEIPT_LABELS.ko.labelJuTell;
/** [확인] heading label when JuTell's own ⓘ line sits under it, so the AI label never seems to cover JuTell's line. */
export const LABEL_CHECK_MIXED = RECEIPT_LABELS.ko.labelCheckMixed;
export const HANJA_NOTE = RECEIPT_LABELS.ko.hanjaNote;
export const AI_RESULTS_NOTE = RECEIPT_LABELS.ko.aiResultsNote;
export const NO_MAP_MATCH = RECEIPT_LABELS.ko.noMapMatch;
export const SAYS_BUT_NO_FILES = RECEIPT_LABELS.ko.saysButNoFiles;

export type ReceiptCheck =
  | { what: string; result: '확인함'; how: string }
  | { what: string; result: '안 해봄'; reason: string; jutell?: true };

export type ReceiptInput = {
  asked?: string[];
  done: string[];
  files?: string[];
  filesUnknownReason?: string;
  /** JuTell's own line about the map refresh (set by code, never by the AI). */
  mapNote?: string;
  /** Request matching computed by code (match.ts); never taken from the AI's input. */
  match?: ReceiptMatch;
  /** Set by the receipt command after reading Git; render-only input never claims files were checked. */
  filesChecked?: boolean;
  /** W7: files already changed at the previous receipt (set by code). */
  beforeNote?: string;
  /** Files already changed before the work (W7), marked in [바뀐 파일]. */
  beforeFiles?: string[];
  checks: ReceiptCheck[];
  next: {
    continue: string[];
    nice: string[];
    stop: string[];
  };
  summary?: string;
  askedMore?: number;
  risk?: unknown;
  nextMessage?: unknown;
};

// (The Korean label constants lived here before v2.3.0; they now come from
// RECEIPT_LABELS.ko via the re-exports above, so Korean output is unchanged.)
// A run record: a command name as a whole word (not 'test-app' or 'npm-debug.log'), or a run word plus a
// result word ('테스트 통과'). A line that says it was NOT run ('실행하지 않음') never counts.
const RUN_COMMAND = /(?<![\w./-])(?:npm|npx|pnpm|yarn|tsc|vitest|jest|pytest|eslint|cargo|make)(?![\w./-])/i;
// A noun that names a folder or file ('tests 폴더', '테스트 파일') is not a run.
const RUN_NOUN = /(?:테스트|빌드|검사|린트|명령|(?<![\w./-])(?:tests?|build|lint)(?![\w./-]))(?!\s*(?:폴더|디렉터리|디렉토리|파일|folder|dir|file))/i;
const RUN_RESULT = /실행했|실행함|실행 결과|돌려|돌렸|돌림|통과|실패|성공|(?<![\w-])(?:passed|failed|ran)(?![\w-])/i;
const NOT_RUN = /않|안 ?함|안 ?했|안 ?돌|못 ?함|못 ?했|못 ?돌|생략|건너|미실행|(?<![\w-])(?:not|didn't|skipped)(?![\w-])/i;
export function mentionsRunRecord(text: string): boolean {
  return !NOT_RUN.test(text) && (RUN_COMMAND.test(text) || (RUN_NOUN.test(text) && RUN_RESULT.test(text)));
}


const forbiddenStatusPhrases = ['확인 완료', '일부 확인', '추가 확인 필요'];
const rawCommandPattern = /`|(?:^|[^A-Za-z0-9_])(?:git|npm|npx|node|pnpm|yarn|rg|grep|cat|sed|ls|cd|python|pytest|vitest|tsc|make|curl)\s+\S+|(?:^|\s)--[A-Za-z][A-Za-z0-9-]*(?=\s|=|$)|(?:^|\s)-[A-Za-z](?:[A-Za-z0-9-]*)(?=\s|$)/;
const commandSpans = new RegExp(rawCommandPattern.source.replace(/^`\|/, ''), 'g');
export function markCommandSpans(text: string): string {
  return text.replace(commandSpans, (match) => {
    const lead = /^[^A-Za-z0-9_-]/.test(match) ? match[0] : '';
    return `${lead}\`${match.slice(lead.length)}\``;
  });
}
const normalizedReceipts = new WeakSet<object>();
// C0/C1 controls, bidi controls (U+202A–202E, U+2066–2069, U+200E/F, U+061C) and zero-width characters (U+200B–200D, U+2060, U+FEFF).
const controlCharacters = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069\u200e\u200f\u061c\u200b-\u200d\u2060\ufeff]/g;

function limitText(value: string): string {
  return value.length > 300 ? `${value.slice(0, 299)}…` : value;
}

function fail(message: string): never {
  throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAbsolutePath(value: string): boolean {
  return value.startsWith('/') || value.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(value);
}

// Mask placeholders follow the receipt locale too: Korean by default, English
// when the receipt renders in English. Set at the render entry points.
const MASK_MARKS = {
  ko: { secretMark: '[비밀값]', path: '[경로]' },
  en: { secretMark: '[redacted]', path: '[path]' },
} as const;
let maskMarks: { secretMark: string; path: string } = MASK_MARKS.ko;
/** Resolves the locale (explicit option > JUTELL_LANG/JUTELL_LOCALE/LC_ALL/LANG, Korean default)
 *  and switches the labels and mask placeholders this module hands out. */
function applyReceiptLocale(locale: ReceiptLocale): ReceiptLabels {
  maskMarks = MASK_MARKS[locale] ?? MASK_MARKS.ko;
  return receiptLabelsFor(locale);
}

/**
 * Secret values never reach the receipt (Reviewer #37): `KEY=value` / `token: value` for secret-looking names,
 * Bearer headers, private key blocks, and well-known token shapes are replaced with [비밀값].
 */
const SECRET_ASSIGNMENT = /\b([A-Za-z0-9_.-]*(?:api[_-]?key|secret|token|passw(?:or)?d|pwd|private[_-]?key|access[_-]?key|credential)[A-Za-z0-9_.-]*)(\s*[=:]\s*)(["']?)[^\s"'`,;]+\3/gi;
const SECRET_SHAPES = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}/g,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bxox[abposr]-[A-Za-z0-9-]{10,}/g,
  /\bA(?:KIA|SIA)[0-9A-Z]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
];
export function maskSecretValues(value: string): string {
  let text = value.replace(SECRET_ASSIGNMENT, (_match, key: string, sep: string) => `${key}${sep}${maskMarks.secretMark}`);
  for (const shape of SECRET_SHAPES) text = text.replace(shape, maskMarks.secretMark);
  return text;
}

function maskAbsolutePaths(value: string): string {
  const boundary = /(^|[\s("'`=\[,;])/g;
  const pathPattern = /\/(?:[^/\s"'`<>|?*]+(?:\/[^/\s"'`<>|?*]+)*)?|[A-Za-z]:[\\/](?:[^\\/\s"'`<>|?*]+(?:[\\/][^\\/\s"'`<>|?*]+)*)?|\\\\[^\\/\s"'`<>|?*]+[\\/][^\\/\s"'`<>|?*]+(?:[\\/][^\\/\s"'`<>|?*]+)*/g;

  return value.replace(new RegExp(`${boundary.source}${pathPattern.source}`, 'g'), (match) => {
    const prefix = match.match(boundary)?.[0] ?? '';
    return `${prefix}${maskMarks.path}`;
  });
}

function readText(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    return fail(`${label}은(는) 비어 있지 않은 글자여야 해요.`);
  }
  const cleaned = value.replace(controlCharacters, '');
  if (cleaned.trim().length === 0) {
    return fail(`${label}은(는) 비어 있지 않은 글자여야 해요.`);
  }
  if (forbiddenStatusPhrases.some((phrase) => cleaned.includes(phrase))) {
    return fail('상태 문구는 영수증 내용에 넣을 수 없어요.');
  }
  // Commands already shown as code spans (normalizeReceipt's markCommandSpans) are allowed.
  if (rawCommandPattern.test(spansAllowed ? cleaned.replace(/`[^`\n]+`/g, ' ') : cleaned)) {
    return fail(`명령어를 그대로 쓰지 말고, 무엇을 확인했는지 쉬운 말로 써 주세요: ${label}`);
  }
  return limitText(maskSecretValues(maskAbsolutePaths(cleaned.trim())));
}

function readTextArray(value: unknown, label: string, max: number): string[] {
  if (!Array.isArray(value)) return fail(`${label}은(는) 목록이어야 해요.`);
  if (value.length > max) return fail(`${label}은(는) 최대 ${max}개까지 적을 수 있어요.`);
  return value.map((item, index) => readText(item, `${label} ${index + 1}번`));
}

// Only a normalized receipt (normalizeReceipt already turned commands into code spans) may contain them;
// a receipt passed straight to renderReceipt keeps the strict 'no raw commands' rule.
let spansAllowed = false;
function validateReceipt(value: unknown, allowEmptyDetails = false): ReceiptInput {
  spansAllowed = allowEmptyDetails;
  try { return validateReceiptInner(value, allowEmptyDetails); } finally { spansAllowed = false; }
}
function validateReceiptInner(value: unknown, allowEmptyDetails: boolean): ReceiptInput {
  if (!isRecord(value)) return fail('영수증 입력은 JSON 객체여야 해요.');
  if (Object.hasOwn(value, 'status')) return fail('status 항목은 영수증 입력에 넣을 수 없어요.');

  const asked = value.asked === undefined ? [] : readTextArray(value.asked, '요청한 것', 5);
  const done = readTextArray(value.done, '이번에 한 작업', 5);
  const files = value.files === undefined ? [] : readFileNames(value.files);
  const filesUnknownReason = typeof value.filesUnknownReason === 'string'
    ? cleanReceiptText(value.filesUnknownReason)
    : undefined;
  if (!Array.isArray(value.checks)) return fail('확인 항목은 목록이어야 해요.');
  if (value.checks.length > 4) return fail('확인 항목은 최대 4개까지 적을 수 있어요.');

  const checks = value.checks.map((check, index): ReceiptCheck => {
    const label = `확인 항목 ${index + 1}번`;
    if (!isRecord(check)) return fail(`${label}은(는) 객체여야 해요.`);

    const what = readText(check.what, `${label}의 대상`);
    if (check.result === '확인함') {
      const how = allowEmptyDetails && check.how === '' ? '' : readText(check.how, `${label}의 확인 방법`);
      return { what, result: '확인함', how };
    }
    if (check.result === '안 해봄') {
      const reason = allowEmptyDetails && check.reason === '' ? '' : readText(check.reason, `${label}의 이유`);
      // Only code-made (normalized) receipts can mark a line as JuTell's own blank-line notice.
      return { what, result: '안 해봄', reason, ...(allowEmptyDetails && check.jutell === true ? { jutell: true as const } : {}) };
    }
    return fail(`${label}의 결과는 '확인함' 또는 '안 해봄'이어야 해요.`);
  });

  if (!isRecord(value.next)) return fail('다음 추천은 객체여야 해요.');
  const next = {
    continue: readTextArray(value.next.continue, '계속 진행', 3),
    nice: readTextArray(value.next.nice, '해두면 좋은 것', 3),
    stop: readTextArray(value.next.stop, '여기서 멈춰도 됨', 3),
  };
  const nextCount = next.continue.length + next.nice.length + next.stop.length;
  if (nextCount > 3) return fail('다음 추천은 세 묶음을 합쳐 최대 3개까지 적을 수 있어요.');

  const mapNote = typeof value.mapNote === 'string' ? cleanReceiptText(value.mapNote) : undefined;
  const match = readMatch(value.match, asked.length);
  const beforeNote = typeof value.beforeNote === 'string' ? cleanReceiptText(value.beforeNote) : undefined;
  const beforeFiles = readFileNames(value.beforeFiles);
  return { asked, done, files, ...(filesUnknownReason ? { filesUnknownReason } : {}), ...(mapNote ? { mapNote } : {}), ...(beforeNote ? { beforeNote } : {}), ...(beforeFiles.length ? { beforeFiles } : {}), ...(match ? { match } : {}), ...(value.filesChecked === true ? { filesChecked: true } : {}), checks, next };
}

function readNames(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => (typeof item === 'string' ? cleanReceiptText(item) : undefined)).filter((item): item is string => Boolean(item)) : [];
}

/** Only the shape match.ts produces; anything else is dropped. Names are cleaned like file names. */
function readMatch(value: unknown, askedCount: number): ReceiptMatch | undefined {
  if (!isRecord(value)) return undefined;
  if (value.map === false) return { map: false };
  if (value.map !== true || !Array.isArray(value.items) || value.items.length !== askedCount) return undefined;
  const items: MatchItem[] = [];
  for (const item of value.items) {
    if (!isRecord(item)) return undefined;
    if (item.status === 'unplaced') items.push({ status: 'unplaced' });
    else if (item.status === 'unchanged') items.push({ status: 'unchanged', features: readNames(item.features), ...readBefore(item.before) });
    else if (item.status === 'changed') items.push({ status: 'changed', features: readNames(item.features), files: readFileNames(item.files), ...readBefore(item.before), ...(item.via === 'file' || item.via === 'context' || item.via === 'sensitive' ? { via: item.via } : {}) });
    else return undefined;
  }
  const extraBefore = readFileNames(value.extraBefore ?? []);
  const extra = readFileNames(value.extra ?? []);
  const sensitiveNamed = readFileNames(value.sensitiveNamed ?? []);
  const areas = isRecord(value.extraAreas)
    ? Object.fromEntries(extra.flatMap((file) => {
      const id = (value.extraAreas as Record<string, unknown>)[file];
      return typeof id === 'string' && /^f-[a-f0-9]{12}$/.test(id) ? [[file, id]] : [];
    }))
    : {};
  return { map: true, items, extra, ...(sensitiveNamed.length ? { sensitiveNamed } : {}), ...(extraBefore.length ? { extraBefore } : {}), ...(Object.keys(areas).length ? { extraAreas: areas } : {}) };
}

function readBefore(value: unknown): { before?: string[] } {
  const before = readFileNames(value ?? []);
  return before.length ? { before } : {};
}

function shortList(items: string[], L: ReceiptLabels, max = 3) {
  return `${items.slice(0, max).join(', ')}${items.length > max ? L.moreItems(items.length - max) : ''}`;
}

function matchLines(receipt: ReceiptInput, asked: string[], askedMore: number, saysButNoFiles: boolean, L: ReceiptLabels): string[] {
  const more = askedMore > 0 ? [L.askedMore(askedMore)] : [];
  const tail = [
    ...(saysButNoFiles ? [`${L.saysButNoFiles}  ${L.labelGit}`] : []),
    ...(receipt.mapNote ? [` ${receipt.mapNote}`] : []),
    '',
  ];
  const plain = (note: string) => [`${L.sections[0]}  ${note}  ${L.labelGit}`, ...asked.map((item, index) => ` ${index + 1}. ${item}  ${L.labelAI}`), ...more, ...tail];
  if (receipt.filesUnknownReason) return plain(L.filesUnknownMatchNote);
  const match = receipt.match;
  if (!match || !match.map) return plain(L.noMapMatch);
  const count = (status: MatchItem['status']) => match.items.filter((item) => item.status === status).length;
  const parts = [
    count('changed') ? L.matchChanged(count('changed')) : '',
    count('unchanged') ? L.matchUnchanged(count('unchanged')) : '',
    count('unplaced') ? L.matchUnplaced(count('unplaced')) : '',
  ].filter(Boolean);
  const lines = [`${L.sections[0]}  ${L.matchSummary(asked.length, parts)}  ${L.labelMatch}`];
  match.items.forEach((item, index) => {
    lines.push(` ${index + 1}. ${asked[index]}  ${L.labelAI}`);
    if (item.status === 'changed') lines.push(`${L.itemChanged}${shortList(item.files, L)}  ${item.via === 'context' ? L.viaContext : item.via === 'sensitive' ? L.viaSensitive : item.features.length ? L.viaGitMap(item.features.join(', ')) : L.viaGitFileName}`);
    else if (item.status === 'unchanged') lines.push(`${L.itemUnchanged(item.features.join(', '))}  ${L.viaGitMap(item.features.join(', '))}`);
    else lines.push(`${L.itemUnplaced}  ${L.labelEstimate}`);
    if (item.status !== 'unplaced' && item.before?.length) lines.push(`    ${L.beforeWorkMark} ${L.beforeFilesLine} ${shortList(item.before, L)}  ${L.labelGit}`);
  });
  lines.push(...more);
  // Each file the map lists carries its area ID, so the user can find it in the map (`jutell map --show`).
  // Map area ids ([f-…]) mean nothing to the person reading: file names only (dogfood #37).
  if (match.sensitiveNamed?.length) lines.push(L.sensitiveChanged(shortList(match.sensitiveNamed, L)));
  if (match.extra.length) lines.push(`${L.extraChanged}${shortList(match.extra, L)}  ${L.labelGit}`);
  if (match.extraBefore?.length) lines.push(` ${L.beforeWorkMark} ${L.extraBeforeLine.trim()} ${shortList(match.extraBefore, L)}  ${L.labelGit}`);
  return [...lines, ...tail];
}

function cleanFileName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = limitText(maskSecretValues(maskAbsolutePaths(value.replace(controlCharacters, ''))));
  return text.length > 0 ? text : undefined;
}

function readFileNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(cleanFileName).filter((item): item is string => item !== undefined);
}

function addProblem(problems: string[] | undefined, message: string): void {
  if (!problems) return;
  try {
    problems.push(message);
  } catch {
    // A caller-provided problem list must not make normalization fail.
  }
}

function cleanReceiptText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  let text = value.replace(controlCharacters, '').trim();
  for (const phrase of forbiddenStatusPhrases) text = text.split(phrase).join('');
  text = text.trim();
  if (!text) return undefined;

  const withoutBackticks = text.replace(/`/g, '');
  // Keep the sentence (e.g. a test result) and show each command part as a code span instead of dropping it.
  text = rawCommandPattern.test(withoutBackticks) ? markCommandSpans(withoutBackticks) : withoutBackticks;
  text = maskSecretValues(maskAbsolutePaths(text)).trim();
  return text ? limitText(text) : undefined;
}

// A placeholder like '없음' is not a recommendation. Dropped BEFORE the 3-item cut, so
// ['없음','없음','없음','real'] keeps 'real'; with nothing real, the receipt says it's fine to stop.
const isPlaceholder = (item: string) => /^[\s\-–—:]*(없음|없습니다|없어요|추천 없음|추천할 것 없음|해당 없음|none|n\/a)?[\s.。!]*$/i.test(item);
const withoutPlaceholders = (value: unknown) => Array.isArray(value) ? value.filter((item) => typeof item !== 'string' || !isPlaceholder(item)) : value;

function normalizeTextArray(
  value: unknown,
  label: string,
  problems: string[],
  maximum = Number.POSITIVE_INFINITY,
): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    problems.push(`${label} 목록을 읽지 못했습니다.`);
    return [];
  }
  const items: string[] = [];
  for (let index = 0; index < Math.min(value.length, maximum); index += 1) {
    const text = cleanReceiptText(value[index]);
    if (text) items.push(text);
  }
  return items;
}

function markNormalized(receipt: ReceiptInput): ReceiptInput {
  normalizedReceipts.add(receipt);
  return receipt;
}

/** Converts old and minimal receipt inputs into renderable data without throwing. */
export function normalizeReceipt(value: unknown, problems?: string[], locale?: ReceiptLocale): ReceiptInput {
  const L = applyReceiptLocale(resolveReceiptLocale(locale));
  const initialProblemCount = Array.isArray(problems) ? problems.length : 0;
  try {
    const issues: string[] = [];
    const input = isRecord(value) ? value : {};
    if (!isRecord(value)) issues.push('영수증 입력을 객체로 읽지 못했습니다.');
    if (Object.hasOwn(input, 'status')) issues.push('status 항목은 사용할 수 없습니다.');

    const hasNewFields = ['asked', 'checked', 'unchecked'].some((field) => Object.hasOwn(input, field));
    const newShape = hasNewFields || Array.isArray(input.next);
    const allAsked = normalizeTextArray(input.asked, '요청한 것', issues);
    const asked = allAsked.slice(0, 5);
    const askedMore = allAsked.length - asked.length;
    const done = normalizeTextArray(input.done, '이번에 한 작업', issues, 5);
    const files = readFileNames(input.files);
    const sourceChecks: ReceiptCheck[] = [];
    const next = { continue: [] as string[], nice: [] as string[], stop: [] as string[] };

    if (newShape) {
      const checked = normalizeTextArray(input.checked, '직접 확인한 것', issues, 4);
      const unchecked = normalizeTextArray(input.unchecked, '확인 못 한 것', issues, 4);
      for (const what of checked) sourceChecks.push({ what, result: '확인함', how: '' });
      for (const what of unchecked) sourceChecks.push({ what, result: '안 해봄', reason: '' });
      next.nice = normalizeTextArray(withoutPlaceholders(input.next), '다음 추천', issues, 3);
    } else {
      if (input.checks !== undefined && !Array.isArray(input.checks)) {
        issues.push('확인 항목 목록을 읽지 못했습니다.');
      } else if (Array.isArray(input.checks)) {
        for (let index = 0; index < Math.min(input.checks.length, 4); index += 1) {
          const check = input.checks[index];
          if (!isRecord(check)) {
            issues.push('확인 항목을 읽지 못했습니다.');
            continue;
          }
          const what = cleanReceiptText(check.what);
          if (!what) continue;
          if (check.result === '확인함') {
            sourceChecks.push({ what, result: '확인함', how: cleanReceiptText(check.how) ?? '' });
          } else if (check.result === '안 해봄') {
            sourceChecks.push({ what, result: '안 해봄', reason: cleanReceiptText(check.reason) ?? '' });
          } else {
            issues.push('확인 항목 결과를 읽지 못했습니다.');
          }
        }
      }

      if (input.next !== undefined && !isRecord(input.next)) {
        issues.push('다음 추천을 읽지 못했습니다.');
      } else if (isRecord(input.next)) {
        let remaining = 3;
        for (const group of ['continue', 'nice', 'stop'] as const) {
          next[group] = normalizeTextArray(withoutPlaceholders(input.next[group]), '다음 추천', issues, remaining);
          remaining -= next[group].length;
        }
      }
    }

    const gapChecks: ReceiptCheck[] = [];
    if (done.length === 0) gapChecks.push({ what: L.gapNoDone, result: '안 해봄', reason: '', jutell: true });
    if (sourceChecks.length === 0) gapChecks.push({ what: L.gapNoChecks, result: '안 해봄', reason: '', jutell: true });
    const hasInputProblems = initialProblemCount > 0 || issues.length > 0;
    if (hasInputProblems) gapChecks.push({ what: L.gapBadInput, result: '안 해봄', reason: '', jutell: true });
    for (const issue of issues) addProblem(problems, issue);

    const availableCheckSlots = Math.max(0, 4 - gapChecks.length);
    const checks = [...sourceChecks.slice(0, availableCheckSlots), ...gapChecks];
    const summary = cleanReceiptText(input.summary);
    return markNormalized({ asked, done, files, checks, next, ...(summary ? { summary } : {}), ...(askedMore > 0 ? { askedMore } : {}) });
  } catch {
    addProblem(problems, '영수증 입력을 읽지 못했습니다.');
    return markNormalized({
      asked: [],
      done: [],
      files: [],
      checks: [
        { what: L.gapNoDone, result: '안 해봄', reason: '', jutell: true },
        { what: L.gapNoChecks, result: '안 해봄', reason: '', jutell: true },
        { what: L.gapBadInput, result: '안 해봄', reason: '', jutell: true },
      ],
      next: { continue: [], nice: [], stop: [] },
    });
  }
}

function renderList<T>(items: T[], format: (item: T, index: number) => string, empty: string): string[] {
  return items.length === 0 ? [empty] : items.map(format);
}

export function renderReceipt(input: unknown, timestamp: string, savedPath?: string, locale?: ReceiptLocale): string {
  const L = applyReceiptLocale(resolveReceiptLocale(locale));
  const receipt = validateReceipt(input, typeof input === 'object' && input !== null && normalizedReceipts.has(input));
  const time = readText(timestamp, '시간');
  const summarySource = typeof input === 'object' && input !== null ? (input as { summary?: unknown }).summary : undefined;
  const codeMatch = receipt.match?.map && !receipt.filesUnknownReason ? receipt.match : undefined;
  // The summary says WHAT was done (AI summary or the first done item, as before W6); with request
  // matching the count, counted by code from Git (plan.md §2), is appended with its own label.
  const aiSummary = cleanReceiptText(summarySource)
    ?? (receipt.done.length > 0 ? `${receipt.done[0]}${receipt.done.length > 1 ? L.doneMore(receipt.done.length - 1) : ''}` : undefined);
  const count = codeMatch && codeMatch.items.length > 0
    ? L.summaryCount(codeMatch.items.length, codeMatch.items.filter((item) => item.status === 'changed').length)
    : '';
  const summary = `${aiSummary ? `${limitText(aiSummary)}  ${L.labelAI}` : `${L.defaultSummary}  ${L.labelJuTell}`}${count}`;
  const beforeFiles = new Set(receipt.beforeFiles ?? []);
  // Only an actual run record (a done item or a check marked 확인함) brings the note; '안 해봄' checks never do.
  const mentionsRun = [...receipt.done, ...receipt.checks.flatMap((check) => check.result === '확인함' ? [`${check.what} ${check.how}`] : [])]
    .some((text) => mentionsRunRecord(text));
  const asked = receipt.asked ?? [];
  // Chinese characters (Hanja) in what the AI wrote are hard for beginners: say so once.
  const hasHanja = /\p{Script=Han}/u.test([...asked, ...receipt.done, ...receipt.checks.flatMap((check) => [check.what, check.result === '확인함' ? check.how : check.reason]), ...receipt.next.continue, ...receipt.next.nice, ...receipt.next.stop, aiSummary ?? ''].join('\n'));
  const askedMoreSource = typeof input === 'object' && input !== null ? (input as { askedMore?: unknown }).askedMore : undefined;
  const askedMore = typeof askedMoreSource === 'number' && Number.isInteger(askedMoreSource) && askedMoreSource > 0 ? askedMoreSource : 0;
  const files = receipt.files ?? [];
  const filesUnknownReason = receipt.filesUnknownReason;
  // A placeholder like '없음' is not a recommendation: with nothing real, say it's fine to stop here.
  const nextGroups = [receipt.next.continue, receipt.next.nice, receipt.next.stop].map((group) => group.filter((item) => !isPlaceholder(item)));
  // "Said it did something, but Git shows no changed file" (only when Git could be read).
  const saysButNoFiles = receipt.filesChecked === true && !filesUnknownReason && files.length === 0 && receipt.done.some((item) => !isPlaceholder(item));
  const lines = [
    '==============================',
    L.header,
    `  ${time}`,
    '==============================',
    ...(asked.length > 0 ? matchLines(receipt, asked, askedMore, saysButNoFiles, L) : []),
    `${L.sections[1]}  ${receipt.done.length ? L.labelAI : L.labelJuTell}`,
    ...renderList(receipt.done, (item, index) => ` ${index + 1}. ${item}`, L.noneItem),
    ...(asked.length === 0 && saysButNoFiles ? [`${L.saysButNoFiles}  ${L.labelGit}`] : []),
    '',
    ...(filesUnknownReason ? [
      `${L.sections[2]}  ${L.labelGit}`,
      L.filesUnknownLine(filesUnknownReason),
      '',
    ] : files.length > 0 ? [
      `${L.sections[2]}  ${L.labelGit}`,
      ...files.slice(0, 8).map((item, index) => ` ${index + 1}. ${item}${beforeFiles.has(item) ? ` ${L.beforeWorkMark}` : ''}`),
      ...(files.length > 8 ? [L.moreFiles(files.length - 8)] : []),
      ...(receipt.beforeNote ? [` ${receipt.beforeNote.trim()}`] : []),
      '',
    ] : []),
    ...(asked.length === 0 && receipt.mapNote ? [` ${receipt.mapNote}`, ''] : []),
    // Every line carries its own source label (dogfood: [확인], ' ○ 추천' and '- …' lines had none).
    // Every line in [확인] written by JuTell (dogfood #37): the heading says so, not 'AI가 적음'.
    `${L.sections[3]}  ${receipt.checks.length > 0 && receipt.checks.every((check) => check.result !== '확인함' && check.jutell === true) ? L.labelJuTell : mentionsRun || hasHanja || receipt.checks.some((check) => check.result !== '확인함' && check.jutell === true) ? L.labelCheckMixed : L.labelAI}`,
    ...renderList(
      receipt.checks,
      (check) => check.result === '확인함'
        ? `${L.verifiedItem}${check.what}${check.how ? ` (${check.how})` : ''}  ${L.labelAI}`
        : `${L.notVerifiedItem}${check.what}${check.reason ? ` (${check.reason})` : ''}  ${check.jutell ? L.labelJuTell : L.labelAI}`,
      `${L.verifiedNone}  ${L.labelAI}`,
    ),
    // '확인 못 한 것' is never left out: with nothing unchecked it says so explicitly.
    ...(receipt.checks.some((check) => check.result !== '확인함') ? [] : [`${L.notVerifiedNone}  ${L.labelAI}`]),
    ...(mentionsRun ? [L.aiResultsNote] : []),
    ...(hasHanja ? [L.hanjaNote] : []),
    '------------------------------',
    ...(nextGroups.every((group) => group.length === 0)
      ? [L.sections[4], `${L.nothingNextLine}  ${L.labelJuTell}`]
      : [`${L.sections[4]}  ${L.labelAI}`]),
    ...(nextGroups.every((group) => group.length === 0)
      ? []
      : nextGroups.flatMap((group, index) => group.length === 0 ? [] : [`${L.nextGroups[index]}  ${L.labelAI}`, ...group.map((item) => `   - ${item}  ${L.labelAI}`)])),
    '------------------------------',
  ];

  if (savedPath && !isAbsolutePath(savedPath)) {
    lines.push(`${L.saveLine}${maskAbsolutePaths(readText(savedPath, '저장 경로'))}  ${L.labelJuTell}`);
  }
  lines.push('==============================');
  lines.push(`${L.summaryPrefix}${summary}`);
  return lines.join('\n');
}

/** Saved report file: the receipt inside a text code block (valid Markdown), summary as the last line. */
export function receiptMarkdown(output: string, locale?: ReceiptLocale): string {
  const L = receiptLabelsFor(resolveReceiptLocale(locale));
  const lines = output.split('\n');
  const summary = lines[lines.length - 1]?.startsWith(L.summaryPrefix) ? lines.pop()! : `${L.summaryPrefix}${L.defaultSummary}`;
  return [L.markdownTitle, '', '```text', ...lines, '```', '', summary, ''].join('\n');
}
