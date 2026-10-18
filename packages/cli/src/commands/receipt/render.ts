export type ReceiptCheck =
  | { what: string; result: '확인함'; how: string }
  | { what: string; result: '안 해봄'; reason: string };

export type ReceiptInput = {
  asked?: string[];
  done: string[];
  files?: string[];
  filesUnknownReason?: string;
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

export const RECEIPT_SECTIONS = ['[요청한 것]', '[이번에 한 작업]', '[바뀐 파일]', '[확인]', '[다음 추천]'] as const;
export const NEXT_GROUPS = [' ▶ 계속', ' ○ 추천', ' ■ 여기서 멈춰도 됨'] as const;
export const NOTHING_NEXT_LINE = ' 여기서 멈춰도 됩니다 – 요청한 작업이 끝났어요';
export const DEFAULT_SUMMARY = '요청한 작업을 마쳤어요.';
export const SUMMARY_PREFIX = '한 줄 요약: ';

const forbiddenStatusPhrases = ['확인 완료', '일부 확인', '추가 확인 필요'];
const rawCommandPattern = /`|(?:^|[^A-Za-z0-9_])(?:git|npm|npx|node|pnpm|yarn|rg|grep|cat|sed|ls|cd|python|pytest|vitest|tsc|make|curl)\s+\S+|(?:^|\s)--[A-Za-z][A-Za-z0-9-]*(?=\s|=|$)|(?:^|\s)-[A-Za-z](?:[A-Za-z0-9-]*)(?=\s|$)/;
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

function maskAbsolutePaths(value: string): string {
  const boundary = /(^|[\s("'`=\[,;])/g;
  const pathPattern = /\/(?:[^/\s"'`<>|?*]+(?:\/[^/\s"'`<>|?*]+)*)?|[A-Za-z]:[\\/](?:[^\\/\s"'`<>|?*]+(?:[\\/][^\\/\s"'`<>|?*]+)*)?|\\\\[^\\/\s"'`<>|?*]+[\\/][^\\/\s"'`<>|?*]+(?:[\\/][^\\/\s"'`<>|?*]+)*/g;

  return value.replace(new RegExp(`${boundary.source}${pathPattern.source}`, 'g'), (match) => {
    const prefix = match.match(boundary)?.[0] ?? '';
    return `${prefix}[경로]`;
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
  if (rawCommandPattern.test(cleaned)) {
    return fail(`명령어를 그대로 쓰지 말고, 무엇을 확인했는지 쉬운 말로 써 주세요: ${label}`);
  }
  return limitText(maskAbsolutePaths(cleaned.trim()));
}

function readTextArray(value: unknown, label: string, max: number): string[] {
  if (!Array.isArray(value)) return fail(`${label}은(는) 목록이어야 해요.`);
  if (value.length > max) return fail(`${label}은(는) 최대 ${max}개까지 적을 수 있어요.`);
  return value.map((item, index) => readText(item, `${label} ${index + 1}번`));
}

function validateReceipt(value: unknown, allowEmptyDetails = false): ReceiptInput {
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
      return { what, result: '안 해봄', reason };
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

  return { asked, done, files, ...(filesUnknownReason ? { filesUnknownReason } : {}), checks, next };
}

function cleanFileName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = limitText(maskAbsolutePaths(value.replace(controlCharacters, '')));
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
  text = rawCommandPattern.test(withoutBackticks)
    ? '명령어 줄은 쉬운 말로 바꾸지 못해 뺐어요'
    : withoutBackticks;
  text = maskAbsolutePaths(text).trim();
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
export function normalizeReceipt(value: unknown, problems?: string[]): ReceiptInput {
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
    if (done.length === 0) gapChecks.push({ what: '한 일 목록이 비어 있었어요', result: '안 해봄', reason: '' });
    if (sourceChecks.length === 0) gapChecks.push({ what: '확인한 내용을 받지 못했어요', result: '안 해봄', reason: '' });
    const hasInputProblems = initialProblemCount > 0 || issues.length > 0;
    if (hasInputProblems) gapChecks.push({ what: '입력을 읽지 못했어요', result: '안 해봄', reason: '' });
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
        { what: '한 일 목록이 비어 있었어요', result: '안 해봄', reason: '' },
        { what: '확인한 내용을 받지 못했어요', result: '안 해봄', reason: '' },
        { what: '입력을 읽지 못했어요', result: '안 해봄', reason: '' },
      ],
      next: { continue: [], nice: [], stop: [] },
    });
  }
}

function renderList<T>(items: T[], format: (item: T, index: number) => string, empty: string): string[] {
  return items.length === 0 ? [empty] : items.map(format);
}

export function renderReceipt(input: unknown, timestamp: string, savedPath?: string): string {
  const receipt = validateReceipt(input, typeof input === 'object' && input !== null && normalizedReceipts.has(input));
  const time = readText(timestamp, '시간');
  const summarySource = typeof input === 'object' && input !== null ? (input as { summary?: unknown }).summary : undefined;
  const summary = limitText(cleanReceiptText(summarySource)
    ?? (receipt.done.length > 0 ? `${receipt.done[0]}${receipt.done.length > 1 ? ` 외 ${receipt.done.length - 1}건` : ''}` : DEFAULT_SUMMARY));
  const asked = receipt.asked ?? [];
  const askedMoreSource = typeof input === 'object' && input !== null ? (input as { askedMore?: unknown }).askedMore : undefined;
  const askedMore = typeof askedMoreSource === 'number' && Number.isInteger(askedMoreSource) && askedMoreSource > 0 ? askedMoreSource : 0;
  const files = receipt.files ?? [];
  const filesUnknownReason = receipt.filesUnknownReason;
  // A placeholder like '없음' is not a recommendation: with nothing real, say it's fine to stop here.
  const nextGroups = [receipt.next.continue, receipt.next.nice, receipt.next.stop].map((group) => group.filter((item) => !isPlaceholder(item)));
  const lines = [
    '==============================',
    '  JuTell 작업 영수증',
    `  ${time}`,
    '==============================',
    ...(asked.length > 0 ? [
      RECEIPT_SECTIONS[0],
      ...asked.map((item, index) => ` ${index + 1}. ${item}`),
      ...(askedMore > 0 ? [` 외 ${askedMore}개`] : []),
      '',
    ] : []),
    RECEIPT_SECTIONS[1],
    ...renderList(receipt.done, (item, index) => ` ${index + 1}. ${item}`, ' 없음'),
    '',
    ...(filesUnknownReason ? [
      RECEIPT_SECTIONS[2],
      ` 확인 못 함 (${filesUnknownReason})`,
      '',
    ] : files.length > 0 ? [
      RECEIPT_SECTIONS[2],
      ...files.slice(0, 8).map((item, index) => ` ${index + 1}. ${item}`),
      ...(files.length > 8 ? [` 외 ${files.length - 8}개`] : []),
      '',
    ] : []),
    RECEIPT_SECTIONS[3],
    ...renderList(
      receipt.checks,
      (check) => check.result === '확인함'
        ? ` ✔ 직접 확인한 것: ${check.what}${check.how ? ` (${check.how})` : ''}`
        : ` ✖ 확인 못 한 것: ${check.what}${check.reason ? ` (${check.reason})` : ''}`,
      ' ✔ 직접 확인한 것: 없음',
    ),
    // '확인 못 한 것' is never left out: with nothing unchecked it says so explicitly.
    ...(receipt.checks.some((check) => check.result !== '확인함') ? [] : [' ✖ 확인 못 한 것: 없음']),
    '------------------------------',
    RECEIPT_SECTIONS[4],
    ...(nextGroups.every((group) => group.length === 0)
      ? [NOTHING_NEXT_LINE]
      : nextGroups.flatMap((group, index) => group.length === 0 ? [] : [NEXT_GROUPS[index], ...group.map((item) => `   - ${item}`)])),
    '------------------------------',
  ];

  if (savedPath && !isAbsolutePath(savedPath)) {
    lines.push(` 저장됨: ${maskAbsolutePaths(readText(savedPath, '저장 경로'))}`);
  }
  lines.push('==============================');
  lines.push(`${SUMMARY_PREFIX}${summary}`);
  return lines.join('\n');
}

/** Saved report file: the receipt inside a text code block (valid Markdown), summary as the last line. */
export function receiptMarkdown(output: string): string {
  const lines = output.split('\n');
  const summary = lines[lines.length - 1]?.startsWith(SUMMARY_PREFIX) ? lines.pop()! : `${SUMMARY_PREFIX}${DEFAULT_SUMMARY}`;
  return ['# JuTell 작업 영수증', '', '```text', ...lines, '```', '', summary, ''].join('\n');
}
