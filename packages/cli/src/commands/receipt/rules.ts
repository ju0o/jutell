import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ScopePaths } from '../../types.js';
import { RECEIPT_STATE_FILE } from './before.js';

/** Written by the JuTell MCP server each time get_beginner_report_rules runs (apps/mcp-server rules-stamp.ts). */
export const RULES_STAMP_FILE = 'rules-fetched.json';

/**
 * Did the AI fetch the report rules for this work? The stamp must be newer than the last receipt
 * (receipt-state.json is rewritten by every receipt and by setup), so an old fetch does not count.
 */
export async function rulesFetchedForThisWork(paths: ScopePaths, now = Date.now()): Promise<boolean> {
  try {
    const stampFile = path.join(paths.dataRoot, RULES_STAMP_FILE);
    const stamp = await fs.lstat(stampFile);
    if (!stamp.isFile() || stamp.size > 200) return false;
    // The content must be the server's own {"at": ISO time} (an empty `touch`ed file does not count).
    const parsed: unknown = JSON.parse(await fs.readFile(stampFile, 'utf8'));
    const at = typeof parsed === 'object' && parsed !== null && typeof (parsed as { at?: unknown }).at === 'string'
      ? Date.parse((parsed as { at: string }).at) : NaN;
    if (!Number.isFinite(at) || at > now + 60_000) return false;
    const state = await fs.lstat(path.join(paths.dataRoot, RECEIPT_STATE_FILE)).catch(() => undefined);
    return !state || at >= Math.floor(state.mtimeMs) - 1000;
  } catch {
    return false;
  }
}

const INTERNAL_PROGRESS = /get_beginner_report_rules|보고 규칙을 (?:받|불러|확인|적용)|JuTell (?:MCP|규칙)|MCP (?:도구|툴)/;

/**
 * The report rules JuTell can apply itself: the work list talks about the user's work, not JuTell's own
 * steps. Changes the receipt in place (it stays the same normalized object) and returns how many were removed.
 */
export function applyRulesWithoutFetch(receipt: { done: string[]; summary?: string }): number {
  const kept = receipt.done.filter((item) => !INTERNAL_PROGRESS.test(item));
  const removed = receipt.done.length - kept.length;
  receipt.done.splice(0, receipt.done.length, ...kept);
  if (receipt.summary && INTERNAL_PROGRESS.test(receipt.summary)) { delete receipt.summary; return removed + 1; }
  return removed;
}
