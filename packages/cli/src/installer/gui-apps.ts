import { promises as fs } from 'node:fs';
import path from 'node:path';
import { buildGuiEntry, findGuiApp, globalPinWarning, guiAppFiles, serverEntryPath, type GuiApp, type GuiAppFile, type GuiScope } from './app-specs.js';
import { normalizeConfigPath, readJsonMcp, registerJsonMcp, removeJsonMcp, type JsonMcpState, type JsonMcpWriteResult } from './json-mcp.js';
import { UNVERIFIED_PATH_NOTE } from '../config/paths.js';
import { isPlainObject, parseJsoncObject, stripJsoncComments } from '../config/jsonc.js';
import type { CliIo } from '../types.js';

export type GuiFileStatus = {
  id: string;
  app: string;
  label: string;
  scope: GuiScope;
  file?: string;
  writable: boolean;
  /** true / false / 'unknown' (path not confirmed for this OS). */
  installed: boolean | 'unknown';
  registered: boolean;
  stale: boolean;
  conflict: boolean;
  parseOk: boolean;
  link: boolean;
  /** Global entry pinned to another project. */
  pinnedTo?: string;
};

async function present(target: string) {
  return fs.lstat(target).then(() => true, () => false);
}

async function installedGuess(file: GuiAppFile) {
  if (!file.file) return 'unknown' as const;
  // Settings folder exists → the app has been used here. Project files: the project folder exists already, so the file itself counts.
  if (file.scope === 'project') return present(file.file);
  return present(path.dirname(file.file));
}

function pinnedRoot(entry: Record<string, unknown> | undefined) {
  const env = entry?.env;
  if (!env || typeof env !== 'object') return undefined;
  const root = (env as Record<string, unknown>).JUTELL_PROJECT_ROOT;
  return typeof root === 'string' && !root.includes('${') ? root : undefined;
}

function samePath(a: string, b: string) {
  const norm = (value: string) => normalizeConfigPath(path.resolve(value)).replace(/\/$/, '');
  return process.platform === 'win32' || process.platform === 'darwin' ? norm(a).toLowerCase() === norm(b).toLowerCase() : norm(a) === norm(b);
}

async function serverMissing(state: JsonMcpState) {
  const args = Array.isArray(state.entry?.args) ? state.entry!.args as unknown[] : [];
  const server = args.find((arg): arg is string => typeof arg === 'string' && normalizeConfigPath(arg).endsWith('/assets/mcp-server/index.js'));
  return server ? !(await present(server)) : false;
}

export async function readGuiStatuses(projectRoot: string): Promise<GuiFileStatus[]> {
  const out: GuiFileStatus[] = [];
  for (const file of guiAppFiles(projectRoot)) {
    const base = { id: file.id, app: file.app, label: file.label, scope: file.scope, file: file.file, writable: file.writable, installed: await installedGuess(file) };
    if (!file.file) { out.push({ ...base, registered: false, stale: false, conflict: false, parseOk: true, link: false }); continue; }
    const state = await readJsonMcp({ rootKey: file.rootKey }, file.file, serverEntryPath());
    const stale = state.registered && (state.stale || await serverMissing(state));
    const pinned = file.scope === 'global' ? pinnedRoot(state.entry) : undefined;
    out.push({
      ...base,
      registered: state.registered,
      stale,
      conflict: state.conflict,
      parseOk: state.parseOk,
      link: state.refused === 'link',
      pinnedTo: state.registered && pinned && !samePath(pinned, projectRoot) ? pinned : undefined,
    });
  }
  return out;
}

function fileFor(app: GuiApp, scope: GuiScope, projectRoot: string) {
  return guiAppFiles(projectRoot).find((file) => file.app === app.id && file.scope === scope && file.writable)!;
}

/** Files `jutell use <app>` may create or change, so a failed use can put them back (use.ts rollback). */
export function guiWriteTargets(app: GuiApp, wantsGlobal: boolean, projectRoot: string) {
  if (app.mode === 'status-only') return undefined;
  const file = fileFor(app, guiScopeFor(app, wantsGlobal), projectRoot)?.file;
  return file ? { file, dir: path.dirname(file), files: [file, `${file}.previous`, `${file}.jutell-original`, createdMarker(file)] } : undefined;
}

export function guiScopeFor(app: GuiApp, wantsGlobal: boolean): GuiScope {
  return app.scopes.includes('project') && !wantsGlobal ? 'project' : 'global';
}

function vscodeProfileGuidance(entry: object) {
  return [
    `VS Code 사용자 프로필 파일 위치가 이 운영체제에서는 아직 확인되지 않아(${UNVERIFIED_PATH_NOTE}) 직접 바꾸지 않았어요.`,
    'VS Code에서 "MCP: Open User Configuration"을 열고 "servers" 안에 아래 항목을 넣으세요. 이 프로젝트만 쓰려면 `jutell use vscode`(--global 없이)를 쓰세요.',
    JSON.stringify({ servers: { jutell: entry } }, null, 2),
  ].join('\n');
}

async function readMaybe(file: string) {
  return fs.readFile(file, 'utf8').then((text) => text, () => undefined);
}

function onlyServers(text: string | undefined, rootKey: string) {
  if (text === undefined || stripJsoncComments(text).trim() !== text.replace(/^\uFEFF/, '').trim()) return undefined;
  const value = parseJsoncObject(text);
  if (!value || Object.keys(value).length !== 1 || !isPlainObject(value[rootKey])) return undefined;
  return value[rootKey] as Record<string, unknown>;
}

/**
 * Clean removal: when JuTell created the file (its first backup holds nothing but the JuTell entry)
 * and nothing else is left, take out the file and JuTell's backups. Anything the person wrote stays.
 * Returns true when the file is gone.
 */
/** Sidecar next to an app file that JuTell itself created (decision (l)). */
export function createdMarker(file: string) {
  return `${file}.jutell-created`;
}

async function removeIfJuTellCreated(file: string, rootKey: string) {
  // (l) only when certain: JuTell's own marker says it created the file, and nothing (not even a comment) is left.
  const marker = await readMaybe(createdMarker(file));
  if (marker === undefined) return false;
  const left = onlyServers(await readMaybe(file), rootKey);
  if (!left || Object.keys(left).length) return false;
  let createdDir = false;
  try { createdDir = JSON.parse(marker).createdDir === true; } catch { /* keep the folder */ }
  for (const target of [file, `${file}.previous`, `${file}.jutell-original`, createdMarker(file)]) await fs.rm(target, { force: true });
  // Folders: only the one JuTell made, and only when empty (rmdir refuses otherwise).
  if (createdDir) await fs.rmdir(path.dirname(file)).catch(() => undefined);
  return true;
}

export type GuiUseOutcome = { written: boolean; message: string[]; error?: string };

/** `jutell use <app>`: write the JuTell entry into one app file. Never creates other files. */
export async function useGuiApp(app: GuiApp, wantsGlobal: boolean, projectRoot: string): Promise<GuiUseOutcome> {
  if (app.mode === 'status-only') {
    return { written: false, message: [`${app.label}은(는) 아직 읽기만 지원해요. 설정 파일을 바꾸지 않았어요. 연결 상태는 \`jutell status\`에서 볼 수 있어요.`] };
  }
  const scope = guiScopeFor(app, wantsGlobal);
  const target = fileFor(app, scope, projectRoot);
  const entry = buildGuiEntry(target, projectRoot);
  if (!target.file) {
    if (app.id === 'vscode') return { written: false, message: [vscodeProfileGuidance(entry)] };
    return { written: false, message: [`${app.label} 설정 파일 위치가 이 운영체제에서는 ${UNVERIFIED_PATH_NOTE}이라 바꾸지 않았어요. 넣을 항목:`, JSON.stringify({ [target.rootKey]: { jutell: entry } }, null, 2)] };
  }
  const fileExisted = await fs.lstat(target.file).then(() => true, () => false);
  const dirExisted = await fs.lstat(path.dirname(target.file)).then(() => true, () => false);
  const result = await registerJsonMcp({ rootKey: target.rootKey }, target.file, entry, scope === 'project' ? { projectRoot } : {});
  // (l) record for certain that JuTell created this file (and maybe its folder).
  if (!fileExisted && result.status === 'written') await fs.writeFile(createdMarker(target.file), `${JSON.stringify({ createdDir: !dirExisted })}\n`).catch(() => undefined);
  return describeWrite(app, target, result, projectRoot);
}

function describeWrite(app: GuiApp, target: GuiAppFile, result: JsonMcpWriteResult, projectRoot: string): GuiUseOutcome {
  if (result.status === 'link') return { written: false, message: [result.message, result.suggestion ?? ''] };
  if (result.status === 'written' || result.status === 'unchanged') {
    const lines = [`${target.label} 연결이 끝났어요. 설정 파일: ${target.file}`];
    if (result.backup) lines.push(`이전 파일 백업: ${result.backup}`);
    if (target.scope === 'global') lines.push(globalPinWarning(app, projectRoot));
    lines.push(app.restartHint);
    return { written: result.status === 'written', message: lines };
  }
  return { written: false, message: [], error: result.message };
}

/** `jutell disconnect <app>`: take out only the JuTell entry. */
export async function disconnectGuiApp(app: GuiApp, wantsGlobal: boolean, projectRoot: string): Promise<GuiUseOutcome> {
  if (app.mode === 'status-only') return { written: false, message: [`${app.label}은(는) 읽기만 지원해서 설정 파일을 바꾸지 않았어요. JuTell 항목이 있다면 직접 지우세요.`] };
  const scope = guiScopeFor(app, wantsGlobal);
  const target = fileFor(app, scope, projectRoot);
  if (!target.file) return { written: false, message: ['VS Code에서 MCP: List Servers → jutell → Uninstall을 실행하세요. (이 운영체제에서는 자동으로 못 지워요.)'] };
  const result = await removeJsonMcp({ rootKey: target.rootKey }, target.file, scope === 'project' ? { projectRoot } : {});
  if (result.status === 'absent') return { written: false, message: [`${target.label}에 JuTell 연결이 없어요.`] };
  if (result.status === 'written') {
    if (await removeIfJuTellCreated(target.file, target.rootKey)) return { written: true, message: [`${target.label}: JuTell이 만든 설정 파일이라 통째로 지웠어요 (${target.file}).`, app.restartHint] };
    return { written: true, message: [result.message, ...(result.backup && !result.userKeys?.length ? [`이전 파일 백업: ${result.backup}`] : []), app.restartHint] };
  }
  return { written: false, message: [], error: result.message };
}

/** W7 setup/upgrade: refresh only stale paths in entries JuTell already has. Never creates entries or files. */
export async function refreshGuiEntries(projectRoot: string): Promise<string[]> {
  const notes: string[] = [];
  for (const file of guiAppFiles(projectRoot)) {
    if (!file.writable || !file.file) continue;
    const state = await readJsonMcp({ rootKey: file.rootKey }, file.file, serverEntryPath());
    if (!state.registered || state.refused) continue;
    if (!state.stale && !(await serverMissing(state))) continue;
    const result = await registerJsonMcp({ rootKey: file.rootKey }, file.file, { command: process.execPath, args: [serverEntryPath()] }, file.scope === 'project' ? { projectRoot } : {});
    notes.push(result.status === 'written' ? `${file.label}: JuTell 연결의 경로를 지금 설치된 JuTell로 고쳤어요.` : `${file.label}: ${result.message}`);
  }
  return notes;
}

/** Install hint lines for setup (decision 18): installed apps without a JuTell entry. */
export async function guiInstallHints(projectRoot: string): Promise<string[]> {
  const statuses = await readGuiStatuses(projectRoot);
  const hints: string[] = [];
  for (const id of ['cursor', 'claude-desktop', 'vscode'] as const) {
    const mine = statuses.filter((status) => status.app === id && status.writable);
    if (mine.some((status) => status.registered)) continue;
    if (!mine.some((status) => status.installed === true && status.scope !== 'project')) continue;
    hints.push(`${findGuiApp(id)!.label}: 설치됨 — \`jutell use ${id}\`으로 연결할 수 있어요.`);
  }
  return hints;
}

/**
 * W7 uninstall. Project scope: project files + global entries pinned to this project.
 * Global scope: every writable global file. Status-only files are never touched.
 */
export async function uninstallGuiEntries(projectRoot: string, global: boolean): Promise<string[]> {
  const notes: string[] = [];
  for (const file of guiAppFiles(projectRoot)) {
    if (!file.writable) continue;
    if (!file.file) {
      if (file.id === 'vscode-global' && global) notes.push('VS Code 사용자 프로필: 이 운영체제에서는 자동으로 못 지워요. VS Code에서 MCP: List Servers → jutell → Uninstall을 실행하세요.');
      continue;
    }
    if (!global && file.scope === 'global') {
      const state = await readJsonMcp({ rootKey: file.rootKey }, file.file);
      const pinned = pinnedRoot(state.entry);
      if (!state.registered || !pinned || !samePath(pinned, projectRoot)) continue;
    }
    const result = await removeJsonMcp({ rootKey: file.rootKey }, file.file, file.scope === 'project' ? { projectRoot } : {});
    if (result.status === 'absent') continue;
    if (result.status === 'written' && await removeIfJuTellCreated(file.file, file.rootKey)) notes.push(`${file.label}: JuTell이 만든 설정 파일이라 통째로 지웠어요 (${file.file}).`);
    else if (result.status === 'written') notes.push(`${file.label}: JuTell 연결만 지웠어요.${result.backup ? ` 백업: ${result.backup}` : ''}`);
    else if (result.status === 'link') notes.push(`${file.label}: 파일이 링크라서 직접 지우지 않았어요. 원본 파일에서 "jutell" 항목을 지우세요.`);
    else if (result.status === 'conflict') notes.push(`${file.label}: JuTell이 만들지 않은 "jutell" 항목이라 건너뛰었어요.`);
    else notes.push(`${file.label}: ${result.message}`);
  }
  return notes;
}

export function writeLines(io: CliIo, lines: string[]) {
  for (const line of lines) if (line) io.write(line);
}

export const GUI_CHECK_PREFIX = '앱 연결: ';

function fixCommand(status: GuiFileStatus) {
  if (status.id === 'claude-desktop') return 'jutell use claude-desktop';
  return `jutell use ${status.app}${status.scope === 'global' ? ' --global' : ''}`;
}

/** W6: one line per app file. Only a broken config file is an error; the rest are warnings at most. */
export function guiStatusCheck(status: GuiFileStatus): { name: string; label: string; status: '정상' | '주의' | '오류'; detail: string } {
  const name = `${GUI_CHECK_PREFIX}${status.id}`;
  const label = status.label;
  const installed = status.installed === true ? '설치됨' : '설치 여부 모름';
  if (!status.file) return { name, label, status: '정상', detail: `이 운영체제의 설정 파일 위치가 ${UNVERIFIED_PATH_NOTE}이라 확인하지 않았어요.` };
  if (!status.parseOk) return { name, label, status: '오류', detail: `설정 파일을 읽을 수 없어요(형식 오류): ${status.file}. 파일을 고친 뒤 다시 확인하세요. JuTell은 이 파일을 바꾸지 않아요.` };
  if (status.link) return { name, label, status: '주의', detail: `설정 파일이 링크라서 JuTell이 바꾸지 않아요: ${status.file}` };
  if (status.conflict) return { name, label, status: '주의', detail: `JuTell이 만들지 않은 "jutell" 항목이 있어요. 직접 관리하세요: ${status.file}` };
  if (!status.writable) {
    return status.registered
      ? { name, label, status: '주의', detail: `JuTell이 만들지 않은 등록 — 직접 관리하세요 (${status.file})` }
      : { name, label, status: '정상', detail: `${installed}. 읽기만 지원해요.` };
  }
  if (!status.registered) return { name, label, status: '정상', detail: `${installed}. 연결 안 함 — 원하면 \`${fixCommand(status)}\`` };
  if (status.stale) return { name, label, status: '주의', detail: `JuTell 연결이 지금 설치된 JuTell이 아닌 예전 위치를 가리켜요. \`${fixCommand(status)}\`을 다시 실행하세요.` };
  if (status.pinnedTo) return { name, label, status: '주의', detail: `\`${status.pinnedTo}\`에 고정됨. 이 프로젝트에서 쓰려면 \`${fixCommand(status)}\`을 다시 실행하세요.` };
  return { name, label, status: '정상', detail: `연결됨 (${status.file})` };
}

/** VS Code reads other apps' configs too (discovery), so the same server can show twice. */
export function vscodeDuplicateNote(statuses: GuiFileStatus[]) {
  const vscode = statuses.some((status) => status.app === 'vscode' && status.writable && status.registered);
  const others = statuses.some((status) => status.app !== 'vscode' && status.registered);
  return vscode && others ? 'VS Code는 다른 앱(Cursor·Claude Desktop 등)의 MCP 설정도 찾아 읽을 수 있어서 jutell이 두 번 보일 수 있어요. 하나만 쓰면 됩니다.' : undefined;
}
