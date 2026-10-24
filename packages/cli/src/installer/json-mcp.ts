import { promises as fs } from 'node:fs';
import path from 'node:path';
import { backupFile } from '../config/managed.js';
import { writeViaTemp } from '../fs/atomic.js';
import { isPlainObject, parseJsonc, type JsoncMember, type JsoncNode } from '../config/jsonc.js';

/**
 * One adapter for GUI apps whose MCP config is a JSON(C) file (Cursor, Claude Desktop, VS Code).
 * It edits only the text span of the JuTell entry: comments, order, unknown keys, other servers,
 * CRLF and a BOM outside that span stay byte-identical. Not wired to any command yet (PR-B).
 */
export type JsonMcpSpec = {
  /** `mcpServers` (Cursor, Claude Desktop, Windsurf, Copilot) or `servers` (VS Code). */
  rootKey: 'mcpServers' | 'servers';
  /** Server name. JuTell always uses `jutell`. */
  name?: string;
};

export type JsonMcpEntry = Record<string, unknown> & { command: string; args: string[] };

export type JsonMcpState = {
  file: string;
  exists: boolean;
  /** false: the file is not valid JSONC, or the root / server list is not an object. */
  parseOk: boolean;
  /** 'link' / 'not-file': JuTell never writes it. */
  refused?: 'link' | 'not-file';
  registered: boolean;
  /** A server named `jutell` that is not JuTell's (command shape differs). */
  conflict: boolean;
  /** JuTell's entry, but its index.js path differs from the expected one. */
  stale: boolean;
  entry?: Record<string, unknown>;
  error?: string;
};

export type JsonMcpWriteResult = {
  status: 'written' | 'unchanged' | 'absent' | 'conflict' | 'invalid' | 'link' | 'not-file' | 'outside-project' | 'changed-during-write';
  message: string;
  backup?: string;
  /** For a link: the entry to paste into the real file yourself (g2). */
  suggestion?: string;
  /** remove(): the JuTell entry held keys JuTell never writes (j). */
  userKeys?: string[];
};

export type JsonMcpOptions = {
  /** Project files (`.cursor/`, `.vscode/`): write only when the real path stays inside this folder. */
  projectRoot?: string;
  /** Test hook, called after the first read and before the re-check (h2). */
  beforeWrite?: () => Promise<void>;
  /** Test hook to make the write itself fail (h). */
  write?: (file: string, text: string) => Promise<void>;
};

const SERVER_SUFFIX = 'assets/mcp-server/index.js';

/** (k) Windows paths: `C:\\Users\\…` and `C:/Users/…` are the same path. */
export function normalizeConfigPath(value: string) {
  let out = value.replace(/\\/g, '/').replace(/\/+/g, '/');
  if (/^[A-Za-z]:\//.test(out)) out = out[0].toLowerCase() + out.slice(1);
  return out;
}

function isNodeCommand(command: unknown) {
  if (typeof command !== 'string') return false;
  const base = normalizeConfigPath(command).split('/').pop()!.toLowerCase();
  return base === 'node' || base === 'node.exe';
}

function serverPathOf(entry: Record<string, unknown>) {
  const args = Array.isArray(entry.args) ? entry.args : [];
  return args.find((arg): arg is string => typeof arg === 'string' && normalizeConfigPath(arg).endsWith(`/${SERVER_SUFFIX}`));
}

/** Decision 4: name `jutell` + node running `…/assets/mcp-server/index.js`. */
export function isJuTellEntry(entry: unknown): entry is Record<string, unknown> {
  return isPlainObject(entry) && isNodeCommand(entry.command) && serverPathOf(entry) !== undefined;
}

type Parsed = {
  bom: string;
  body: string;
  eol: string;
  indent: string;
  root?: Extract<JsoncNode, { kind: 'object' }>;
  servers?: JsoncMember;
  member?: JsoncMember;
  error?: string;
};

function detectIndent(body: string) {
  const match = /\n([ \t]+)\S/.exec(body);
  if (!match) return '  ';
  return match[1].startsWith('\t') ? '\t' : match[1].length >= 4 && match[1].length % 4 === 0 ? '    ' : '  ';
}

function analyse(text: string, spec: JsonMcpSpec): Parsed {
  const bom = text.startsWith('\uFEFF') ? '\uFEFF' : '';
  const body = bom ? text.slice(1) : text;
  const eol = body.includes('\r\n') ? '\r\n' : '\n';
  const parsed: Parsed = { bom, body, eol, indent: detectIndent(body) };
  if (!body.trim()) return parsed;
  let root: JsoncNode;
  try { root = parseJsonc(body); } catch (error) { return { ...parsed, error: (error as Error).message }; }
  if (root.kind !== 'object') return { ...parsed, error: '최상위 값이 객체가 아닙니다' };
  parsed.root = root;
  parsed.servers = lastMember(root, spec.rootKey);
  if (parsed.servers && parsed.servers.node.kind !== 'object') return { ...parsed, error: `"${spec.rootKey}" 값이 객체가 아닙니다` };
  if (parsed.servers && parsed.servers.node.kind === 'object') parsed.member = lastMember(parsed.servers.node, spec.name ?? 'jutell');
  return parsed;
}

function lastMember(node: Extract<JsoncNode, { kind: 'object' }>, key: string) {
  return [...node.members].reverse().find((member) => member.key === key);
}

async function inspect(file: string): Promise<'missing' | 'link' | 'not-file' | 'file'> {
  try {
    const stats = await fs.lstat(file);
    if (stats.isSymbolicLink()) return 'link';
    return stats.isFile() ? 'file' : 'not-file';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'missing';
    throw error;
  }
}

export async function readJsonMcp(spec: JsonMcpSpec, file: string, expectedServerPath?: string): Promise<JsonMcpState> {
  const base: JsonMcpState = { file, exists: false, parseOk: true, registered: false, conflict: false, stale: false };
  const kind = await inspect(file);
  if (kind === 'missing') return base;
  if (kind === 'not-file') return { ...base, exists: true, parseOk: false, refused: 'not-file', error: '파일이 아닙니다' };
  // A link is read (status only) but never written.
  let text: string;
  try { text = await fs.readFile(file, 'utf8'); } catch (error) { return { ...base, exists: true, parseOk: false, refused: kind === 'link' ? 'link' : undefined, error: (error as Error).message }; }
  const parsed = analyse(text, spec);
  const state: JsonMcpState = { ...base, exists: true, refused: kind === 'link' ? 'link' : undefined };
  if (parsed.error) return { ...state, parseOk: false, error: parsed.error };
  const entry = parsed.member?.node.value;
  if (entry === undefined) return state;
  if (!isJuTellEntry(entry)) return { ...state, conflict: true, entry: isPlainObject(entry) ? entry : undefined };
  const current = serverPathOf(entry)!;
  const stale = expectedServerPath !== undefined && normalizeConfigPath(current) !== normalizeConfigPath(expectedServerPath);
  return { ...state, registered: true, stale, entry };
}

function serialize(value: unknown, indent: string, baseIndent: string, eol: string) {
  return JSON.stringify(value, null, indent).split('\n').map((line, index) => (index === 0 ? line : baseIndent + line)).join(eol);
}

function lineIndentAt(body: string, offset: number) {
  const lineStart = body.lastIndexOf('\n', offset - 1) + 1;
  const match = /^[ \t]*/.exec(body.slice(lineStart, offset));
  return match ? match[0] : '';
}

/** Inserts `"key": value` as the last member of `node`, keeping a trailing comma style intact. */
function insertMember(parsed: Parsed, node: Extract<JsoncNode, { kind: 'object' }>, key: string, value: unknown) {
  const { body, eol, indent } = parsed;
  const closeAt = node.end - 1;
  const parentIndent = lineIndentAt(body, node.start);
  const memberIndent = parentIndent + indent;
  const text = `${JSON.stringify(key)}: ${serialize(value, indent, memberIndent, eol)}`;
  const last = node.members.at(-1);
  if (!last) {
    return `${body.slice(0, node.start + 1)}${eol}${memberIndent}${text}${eol}${parentIndent}${body.slice(closeAt)}`;
  }
  if (last.commaAt !== undefined) {
    // Trailing comma already there: add ours after it, with its own trailing comma.
    // Keep a comment that follows the comma on its line: add ours on the next line.
    const at = last.commaAt + 1;
    const lineEnd = body.indexOf('\n', at);
    if (lineEnd !== -1 && /^[ \t]*(\/\/[^\n]*)?\r?$/.test(body.slice(at, lineEnd))) {
      return `${body.slice(0, lineEnd + 1)}${memberIndent}${text},${eol}${body.slice(lineEnd + 1)}`;
    }
    return `${body.slice(0, at)}${eol}${memberIndent}${text},${body.slice(at)}`;
  }
  return `${body.slice(0, last.valueEnd)},${eol}${memberIndent}${text}${body.slice(last.valueEnd)}`;
}

function removeMember(parsed: Parsed, node: Extract<JsoncNode, { kind: 'object' }>, member: JsoncMember) {
  const { body } = parsed;
  const index = node.members.indexOf(member);
  let start = member.keyStart;
  let end = member.valueEnd;
  // Last member without its own comma: drop only the previous member's comma character,
  // so comments between that comma and our key stay byte for byte.
  let previousComma: number | undefined;
  if (member.commaAt !== undefined) {
    end = member.commaAt + 1;
  } else if (index > 0 && node.members[index - 1].commaAt !== undefined) {
    previousComma = node.members[index - 1].commaAt!;
  }
  // Take the whole line when the member sits on its own lines.
  const lineStart = body.lastIndexOf('\n', start - 1) + 1;
  if (start === member.keyStart && /^[ \t]*$/.test(body.slice(lineStart, start))) {
    const rest = /^[ \t]*\r?\n/.exec(body.slice(end));
    if (rest) { start = lineStart; end += rest[0].length; }
  }
  let out = body.slice(0, start) + body.slice(end);
  if (previousComma !== undefined) out = out.slice(0, previousComma) + out.slice(previousComma + 1);
  // (l) the object stays, as `{}` when nothing but whitespace is left inside.
  const open = node.start;
  const close = out.indexOf('}', open);
  if (close > open && /^\s*$/.test(out.slice(open + 1, close))) out = `${out.slice(0, open + 1)}${out.slice(close)}`;
  return out;
}

function desiredEntry(existing: Record<string, unknown> | undefined, entry: JsonMcpEntry) {
  if (!existing) return { ...entry };
  // (j) keep keys the person added (e.g. disabledTools, other env values); JuTell's own keys win.
  const merged: Record<string, unknown> = { ...existing };
  for (const [key, value] of Object.entries(entry)) {
    merged[key] = key === 'env' && isPlainObject(value) && isPlainObject(existing.env) ? { ...existing.env, ...value } : value;
  }
  return merged;
}

function userKeysOf(existing: Record<string, unknown>) {
  const own = new Set(['type', 'command', 'args', 'env', 'cwd']);
  const keys = Object.keys(existing).filter((key) => !own.has(key));
  if (isPlainObject(existing.env)) keys.push(...Object.keys(existing.env).filter((key) => key !== 'JUTELL_PROJECT_ROOT').map((key) => `env.${key}`));
  return keys;
}

async function guard(file: string, options: JsonMcpOptions): Promise<JsonMcpWriteResult | undefined> {
  const kind = await inspect(file);
  if (kind === 'link') return { status: 'link', message: `${file} 파일이 링크라서 직접 바꾸지 않았어요 — 아래 내용을 원본 파일에 넣으세요.` };
  if (kind === 'not-file') return { status: 'not-file', message: `${file} 은(는) 파일이 아니라서 바꾸지 않았어요.` };
  if (options.projectRoot) {
    const realRoot = await fs.realpath(options.projectRoot);
    // The folder (e.g. `.cursor/`) may not exist yet: check the nearest existing parent.
    let probe = path.dirname(file);
    while (!(await fs.lstat(probe).then(() => true, () => false))) probe = path.dirname(probe);
    const realProbe = await fs.realpath(probe);
    const relative = path.relative(realRoot, realProbe);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return { status: 'outside-project', message: `${file} 이(가) 프로젝트 밖을 가리켜서 바꾸지 않았어요.` };
  }
  return undefined;
}

async function readCurrent(file: string) {
  try { return await fs.readFile(file, 'utf8'); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function commit(file: string, before: string | undefined, next: string, spec: JsonMcpSpec, options: JsonMcpOptions): Promise<JsonMcpWriteResult | { backup?: string }> {
  // (h2) the app may have rewritten the file since we read it.
  await options.beforeWrite?.();
  const again = await readCurrent(file);
  if (again !== before) return { status: 'changed-during-write', message: '앱이 설정을 바꾸는 중이에요 — 앱을 닫고 다시 실행하세요. 파일은 바꾸지 않았어요.' };
  const refused = await guard(file, options);
  if (refused) return refused;
  const backup = before === undefined ? undefined : await backupFile(file);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const write = options.write ?? ((target: string, text: string) => writeViaTemp(target, text));
  try {
    await write(file, next);
  } catch (error) {
    return { status: 'invalid', message: `설정 파일을 쓰지 못했어요 (${(error as Error).message}). 원본은 그대로예요.`, backup };
  }
  // Re-parse what we wrote; restore the original on any surprise.
  const written = await readCurrent(file);
  if (written === undefined || analyse(written, spec).error) {
    if (before === undefined) await fs.rm(file, { force: true });
    else await writeViaTemp(file, before);
    return { status: 'invalid', message: '쓴 내용을 다시 읽지 못해 원래대로 되돌렸어요.', backup };
  }
  return { backup };
}

export async function registerJsonMcp(spec: JsonMcpSpec, file: string, entry: JsonMcpEntry, options: JsonMcpOptions = {}): Promise<JsonMcpWriteResult> {
  const name = spec.name ?? 'jutell';
  const refused = await guard(file, options);
  if (refused) return refused.status === 'link' ? { ...refused, suggestion: JSON.stringify({ [spec.rootKey]: { [name]: entry } }, null, 2) } : refused;
  const before = await readCurrent(file);
  const parsed = analyse(before ?? '', spec);
  if (parsed.error) return { status: 'invalid', message: `${file} 형식을 읽지 못해 바꾸지 않았어요 (${parsed.error}).` };
  let nextBody: string;
  if (!parsed.root) {
    // (b) new or empty file.
    nextBody = `${serialize({ [spec.rootKey]: { [name]: entry } }, parsed.indent, '', parsed.eol)}${parsed.eol}`;
  } else if (!parsed.servers || parsed.servers.node.kind !== 'object') {
    nextBody = insertMember(parsed, parsed.root, spec.rootKey, { [name]: entry });
  } else if (!parsed.member) {
    nextBody = insertMember(parsed, parsed.servers.node, name, entry);
  } else {
    const existing = parsed.member.node.value;
    if (!isJuTellEntry(existing)) return { status: 'conflict', message: `${file} 에 JuTell이 만들지 않은 "${name}" 항목이 있어 바꾸지 않았어요.` };
    const next = desiredEntry(existing, entry);
    if (JSON.stringify(next) === JSON.stringify(existing)) return { status: 'unchanged', message: '이미 같은 내용이에요.' };
    const memberIndent = lineIndentAt(parsed.body, parsed.member.keyStart);
    nextBody = parsed.body.slice(0, parsed.member.valueStart) + serialize(next, parsed.indent, memberIndent, parsed.eol) + parsed.body.slice(parsed.member.valueEnd);
  }
  const result = await commit(file, before, parsed.bom + nextBody, spec, options);
  if ('status' in result) return result;
  return { status: 'written', message: `${file} 에 JuTell 항목을 넣었어요.`, backup: result.backup };
}

export async function removeJsonMcp(spec: JsonMcpSpec, file: string, options: JsonMcpOptions = {}): Promise<JsonMcpWriteResult> {
  const name = spec.name ?? 'jutell';
  const refused = await guard(file, options);
  if (refused) return refused;
  const before = await readCurrent(file);
  if (before === undefined) return { status: 'absent', message: '설정 파일이 없어요.' };
  const parsed = analyse(before, spec);
  if (parsed.error) return { status: 'invalid', message: `${file} 형식을 읽지 못해 바꾸지 않았어요 (${parsed.error}).` };
  if (!parsed.member || !parsed.servers || parsed.servers.node.kind !== 'object') return { status: 'absent', message: 'JuTell 항목이 없어요.' };
  const existing = parsed.member.node.value;
  if (!isJuTellEntry(existing)) return { status: 'conflict', message: `${file} 의 "${name}" 항목은 JuTell이 만든 것이 아니라 지우지 않았어요.` };
  const nextBody = removeMember(parsed, parsed.servers.node, parsed.member);
  const result = await commit(file, before, parsed.bom + nextBody, spec, options);
  if ('status' in result) return result;
  const userKeys = userKeysOf(existing);
  const note = userKeys.length && result.backup ? ` 직접 넣으신 설정(${userKeys.join(', ')})도 함께 빠졌어요. 백업: ${result.backup}` : '';
  return { status: 'written', message: `${file} 에서 JuTell 항목만 뺐어요.${note}`, backup: result.backup, userKeys };
}
