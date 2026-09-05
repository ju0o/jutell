/**
 * JUTELL-V2.3-CODEX-DETERMINISTIC-COMPLETION-GUARD-PROTOTYPE-01
 *
 * Minimal, isolated registration helper for the Codex Stop-hook completion guard. This is
 * deliberately NOT wired into `jutell use codex` or any other onboarding flow yet — that is
 * full production onboarding, out of scope for this prototype cycle (see task report).
 *
 * Reuses the exact same safety primitives `config/managed.ts` already uses for the Codex MCP
 * `config.toml` registration (`backupFile`, `writeTextSafely`, `readText`) rather than
 * inventing a parallel mechanism, per "prefer an existing installer/asset surface".
 *
 * Hard boundaries, all deliberate:
 *  - Additive only: a register call appends one new `Stop` hook group; it never edits or
 *    removes any existing group, and never touches any event other than `Stop`.
 *  - Idempotent: if a `Stop` hook whose `command` already equals our script path exists
 *    anywhere in the file, registering again is a no-op.
 *  - Conflict-aware: if `hooks.json` exists but isn't parseable as the expected JSON shape,
 *    this throws rather than silently overwriting/clobbering whatever is actually there.
 *  - Removable: `removeCodexStopHook` strips only the group(s) whose hook `command` matches
 *    our exact script path, leaving every unrelated hook untouched.
 *  - Never touches `config.toml`, never writes a `trusted_hash`, never bypasses Codex's own
 *    hook-trust prompt. Normal Codex trust remains the sole authority over whether the
 *    registered hook actually runs (see JUTELL-V2.3-CODEX-HOOK-TRUST-AND-BLOCK-LIVE-01).
 */
import { backupFile, readText, writeTextSafely } from '../config/managed.js';

export const STOP_HOOK_EVENT = 'Stop';

type HookEntry = { command: string; [key: string]: unknown };
type HookGroup = { hooks?: HookEntry[]; [key: string]: unknown };
type HooksFile = { hooks?: Record<string, HookGroup[]>; [key: string]: unknown };

function parseHooksFile(content: string): HooksFile | undefined {
  if (!content.trim()) return { hooks: {} };
  try {
    const value = JSON.parse(content) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as HooksFile) : undefined;
  } catch {
    return undefined;
  }
}

function stopGroupsOf(parsed: HooksFile): HookGroup[] {
  const groups = parsed.hooks?.[STOP_HOOK_EVENT];
  return Array.isArray(groups) ? groups : [];
}

function groupMatches(group: HookGroup, scriptPath: string): boolean {
  return Array.isArray(group.hooks) && group.hooks.some((hook) => hook && hook.command === scriptPath);
}

export type CodexStopHookStatus = {
  hooksJsonPath: string;
  exists: boolean;
  registered: boolean;
  /** `hooks.json` exists but isn't the expected JSON object shape — refuse to touch it. */
  conflict: boolean;
};

export async function readCodexStopHookStatus(hooksJsonPath: string, scriptPath: string): Promise<CodexStopHookStatus> {
  const content = await readText(hooksJsonPath);
  if (content === undefined) return { hooksJsonPath, exists: false, registered: false, conflict: false };
  const parsed = parseHooksFile(content);
  if (parsed === undefined) return { hooksJsonPath, exists: true, registered: false, conflict: true };
  const registered = stopGroupsOf(parsed).some((group) => groupMatches(group, scriptPath));
  return { hooksJsonPath, exists: true, registered, conflict: false };
}

function conflictError(): Error {
  return new Error('Codex hooks.json이 예상한 형식이 아니라 자동으로 변경하지 않았습니다.');
}

export async function registerCodexStopHook(hooksJsonPath: string, scriptPath: string): Promise<CodexStopHookStatus> {
  const current = await readCodexStopHookStatus(hooksJsonPath, scriptPath);
  if (current.conflict) throw conflictError();
  if (current.registered) return current; // idempotent — nothing to do

  const content = current.exists ? ((await readText(hooksJsonPath)) ?? '') : '';
  const parsed = parseHooksFile(content) ?? { hooks: {} };
  const stopGroups = stopGroupsOf(parsed);
  const newGroup: HookGroup = { hooks: [{ command: scriptPath, args: [], type: 'command', async: false }] };
  const next: HooksFile = { ...parsed, hooks: { ...parsed.hooks, [STOP_HOOK_EVENT]: [...stopGroups, newGroup] } };

  if (current.exists) await backupFile(hooksJsonPath);
  await writeTextSafely(hooksJsonPath, `${JSON.stringify(next, null, 2)}\n`);
  return readCodexStopHookStatus(hooksJsonPath, scriptPath);
}

export async function removeCodexStopHook(hooksJsonPath: string, scriptPath: string): Promise<CodexStopHookStatus> {
  const current = await readCodexStopHookStatus(hooksJsonPath, scriptPath);
  if (current.conflict) throw conflictError();
  if (!current.registered) return current;

  const content = (await readText(hooksJsonPath)) ?? '';
  const parsed = parseHooksFile(content) ?? { hooks: {} };
  const stopGroups = stopGroupsOf(parsed).filter((group) => !groupMatches(group, scriptPath));
  const next: HooksFile = { ...parsed, hooks: { ...parsed.hooks, [STOP_HOOK_EVENT]: stopGroups } };

  await backupFile(hooksJsonPath);
  await writeTextSafely(hooksJsonPath, `${JSON.stringify(next, null, 2)}\n`);
  return readCodexStopHookStatus(hooksJsonPath, scriptPath);
}
