export type ReceiptCheck =
  | { what: string; result: '확인함'; how: string }
  | { what: string; result: '안 해봄'; reason: string };

export type ReceiptInput = {
  done: string[];
  checks: ReceiptCheck[];
  next: {
    continue: string[];
    nice: string[];
    stop: string[];
  };
  risk?: unknown;
  nextMessage?: unknown;
};

export const RECEIPT_SECTIONS = ['[이번에 한 작업]', '[확인]', '[다음 추천]'] as const;
export const NEXT_GROUPS = [' ▶ 계속 진행', ' ○ 해두면 좋은 것', ' ■ 여기서 멈춰도 됨'] as const;

const forbiddenStatusPhrases = ['확인 완료', '일부 확인', '추가 확인 필요'];
const rawCommandPattern = /`|(?:^|[^A-Za-z0-9_])(?:git|npm|npx|node|pnpm|yarn|rg|grep|cat|sed|ls|cd|python|pytest|vitest|tsc|make|curl)\s+\S+|(?:^|\s)--[A-Za-z][A-Za-z0-9-]*(?=\s|=|$)|(?:^|\s)-[A-Za-z](?:[A-Za-z0-9-]*)(?=\s|$)/;

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
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fail(`${label}은(는) 비어 있지 않은 글자여야 해요.`);
  }
  if (/[\r\n]/.test(value)) {
    return fail(`${label}은(는) 한 줄로 입력해 주세요.`);
  }
  if (forbiddenStatusPhrases.some((phrase) => value.includes(phrase))) {
    return fail('상태 문구는 영수증 내용에 넣을 수 없어요.');
  }
  if (rawCommandPattern.test(value)) {
    return fail(`명령어를 그대로 쓰지 말고, 무엇을 확인했는지 쉬운 말로 써 주세요: ${label}`);
  }
  return maskAbsolutePaths(value.trim());
}

function readTextArray(value: unknown, label: string, max: number): string[] {
  if (!Array.isArray(value)) return fail(`${label}은(는) 목록이어야 해요.`);
  if (value.length > max) return fail(`${label}은(는) 최대 ${max}개까지 적을 수 있어요.`);
  return value.map((item, index) => readText(item, `${label} ${index + 1}번`));
}

function validateReceipt(value: unknown): ReceiptInput {
  if (!isRecord(value)) return fail('영수증 입력은 JSON 객체여야 해요.');
  if (Object.hasOwn(value, 'status')) return fail('status 항목은 영수증 입력에 넣을 수 없어요.');

  const done = readTextArray(value.done, '이번에 한 작업', 5);
  if (!Array.isArray(value.checks)) return fail('확인 항목은 목록이어야 해요.');
  if (value.checks.length > 4) return fail('확인 항목은 최대 4개까지 적을 수 있어요.');

  const checks = value.checks.map((check, index): ReceiptCheck => {
    const label = `확인 항목 ${index + 1}번`;
    if (!isRecord(check)) return fail(`${label}은(는) 객체여야 해요.`);

    const what = readText(check.what, `${label}의 대상`);
    if (check.result === '확인함') {
      return { what, result: '확인함', how: readText(check.how, `${label}의 확인 방법`) };
    }
    if (check.result === '안 해봄') {
      return { what, result: '안 해봄', reason: readText(check.reason, `${label}의 이유`) };
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

  return { done, checks, next };
}

function renderList<T>(items: T[], format: (item: T, index: number) => string, empty: string): string[] {
  return items.length === 0 ? [empty] : items.map(format);
}

export function renderReceipt(input: unknown, timestamp: string, savedPath?: string): string {
  const receipt = validateReceipt(input);
  const time = readText(timestamp, '시간');
  const lines = [
    '==============================',
    '  JuTell 작업 영수증',
    `  ${time}`,
    '==============================',
    RECEIPT_SECTIONS[0],
    ...renderList(receipt.done, (item, index) => ` ${index + 1}. ${item}`, ' 없음'),
    '',
    RECEIPT_SECTIONS[1],
    ...renderList(
      receipt.checks,
      (check) => check.result === '확인함'
        ? ` ✔ 확인함: ${check.what} (${check.how})`
        : ` ✖ 안 해봄: ${check.what} (${check.reason})`,
      ' 없음',
    ),
    '------------------------------',
    RECEIPT_SECTIONS[2],
    NEXT_GROUPS[0],
    ...renderList(receipt.next.continue, (item) => `   - ${item}`, '   - 없음'),
    NEXT_GROUPS[1],
    ...renderList(receipt.next.nice, (item) => `   - ${item}`, '   - 없음'),
    NEXT_GROUPS[2],
    ...renderList(receipt.next.stop, (item) => `   - ${item}`, '   - 없음'),
    '------------------------------',
  ];

  if (savedPath && !isAbsolutePath(savedPath)) {
    lines.push(` 저장됨: ${maskAbsolutePaths(readText(savedPath, '저장 경로'))}`);
  }
  lines.push('==============================');
  return lines.join('\n');
}
