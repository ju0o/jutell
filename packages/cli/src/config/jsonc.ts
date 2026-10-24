/**
 * Small JSONC helpers shared by OpenCode and the GUI app adapter (json-mcp.ts).
 * No dependencies; comments and trailing commas are accepted, nothing else is.
 */

/** Replaces // and /* *\/ comments with spaces, keeping every offset and newline in place. */
export function stripJsoncComments(text: string) {
  let out = '';
  let inString = false;
  let escaped = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const next = text[i + 1];
    if (inBlock) {
      if (c === '*' && next === '/') { inBlock = false; out += '  '; i += 1; }
      else out += c === '\n' ? '\n' : ' ';
      continue;
    }
    if (inLine) {
      if (c === '\n') { inLine = false; out += '\n'; }
      else out += ' ';
      continue;
    }
    if (inString) {
      out += c;
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; out += c; continue; }
    if (c === '/' && next === '/') { inLine = true; out += '  '; i += 1; continue; }
    if (c === '/' && next === '*') { inBlock = true; out += '  '; i += 1; continue; }
    out += c;
  }
  return out;
}

/** Parses a JSONC object. Empty text is `{}`. Anything that is not an object is `undefined`. */
export function parseJsoncObject(text: string): Record<string, unknown> | undefined {
  const trimmed = (text ?? '').replace(/^\uFEFF/, '').trim();
  if (!trimmed) return {};
  try {
    const value = parseJsonc(trimmed).value;
    return isPlainObject(value) ? value : undefined;
  } catch { return undefined; }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export type JsoncMember = {
  key: string;
  keyStart: number;
  valueStart: number;
  valueEnd: number;
  /** Offset of the comma that follows the value, if any. */
  commaAt?: number;
  node: JsoncNode;
};
export type JsoncNode =
  | { kind: 'object'; start: number; end: number; members: JsoncMember[]; value: Record<string, unknown> }
  | { kind: 'other'; start: number; end: number; value: unknown };

/**
 * JSONC parser that keeps offsets so a caller can change one member and leave every other byte as is.
 * Throws on anything that is not valid JSON once comments and trailing commas are allowed.
 */
export function parseJsonc(text: string): JsoncNode {
  const clean = stripJsoncComments(text);
  let i = 0;
  const fail = (what: string): never => { throw new Error(`JSON 형식 오류 (${what}, 위치 ${i})`); };
  const ws = () => { while (i < clean.length && /\s/.test(clean[i])) i += 1; };
  const str = (): string => {
    const start = i;
    if (clean[i] !== '"') fail('문자열 필요');
    i += 1;
    while (i < clean.length) {
      if (clean[i] === '\\') { i += 2; continue; }
      if (clean[i] === '"') { i += 1; return JSON.parse(clean.slice(start, i)) as string; }
      if (clean[i] === '\n') fail('문자열 안 줄바꿈');
      i += 1;
    }
    return fail('닫히지 않은 문자열');
  };
  const value = (): JsoncNode => {
    ws();
    const start = i;
    const c = clean[i];
    if (c === '{') {
      i += 1;
      const members: JsoncMember[] = [];
      const obj: Record<string, unknown> = {};
      ws();
      while (clean[i] !== '}') {
        if (i >= clean.length) fail('닫히지 않은 객체');
        const keyStart = i;
        const key = str();
        ws();
        if (clean[i] !== ':') fail('콜론 필요');
        i += 1;
        const node = value();
        const member: JsoncMember = { key, keyStart, valueStart: node.start, valueEnd: node.end, node };
        members.push(member);
        Object.defineProperty(obj, key, { value: node.value, enumerable: true, configurable: true, writable: true });
        ws();
        if (clean[i] === ',') { member.commaAt = i; i += 1; ws(); continue; }
        if (clean[i] !== '}') fail('쉼표나 } 필요');
      }
      i += 1;
      return { kind: 'object', start, end: i, members, value: obj };
    }
    if (c === '[') {
      i += 1;
      const items: unknown[] = [];
      ws();
      while (clean[i] !== ']') {
        if (i >= clean.length) fail('닫히지 않은 배열');
        items.push(value().value);
        ws();
        if (clean[i] === ',') { i += 1; ws(); continue; }
        if (clean[i] !== ']') fail('쉼표나 ] 필요');
      }
      i += 1;
      return { kind: 'other', start, end: i, value: items };
    }
    if (c === '"') return { kind: 'other', start, end: (str(), i), value: JSON.parse(clean.slice(start, i)) };
    const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(clean.slice(i));
    if (!match) fail('알 수 없는 값');
    i += match![0].length;
    return { kind: 'other', start, end: i, value: JSON.parse(match![0]) };
  };
  const root = value();
  ws();
  if (i !== clean.length) fail('값 뒤에 남은 내용');
  return root;
}
