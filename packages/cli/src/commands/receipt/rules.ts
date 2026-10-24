import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ScopePaths } from '../../types.js';
import { RECEIPT_STATE_FILE } from './before.js';

/** Written by the JuTell MCP server each time get_beginner_report_rules runs (apps/mcp-server rules-stamp.ts). */
export const RULES_STAMP_FILE = 'rules-fetched.json';

/**
 * Printed to stderr (for the AI, not part of the saved receipt) when the rules were not fetched for this
 * work: one short line, so the normal case (rules fetched) costs no tokens at all.
 */
export const RULES_REMINDER = 'JuTell: 이번 작업에서 보고 규칙(get_beginner_report_rules)을 받지 않아 영수증에 기본 규칙을 대신 적용했어요. 최종 답에는 아래 영수증을 고치지 말고 그대로 붙이세요.';

/**
 * Did the AI fetch the report rules for this work? The stamp must be newer than the last receipt
 * (receipt-state.json is rewritten by every receipt and by setup), so an old fetch does not count.
 */
export async function rulesFetchedForThisWork(paths: ScopePaths): Promise<boolean> {
  const stat = (name: string) => fs.lstat(path.join(paths.dataRoot, name)).then((s) => (s.isFile() ? s : undefined), () => undefined);
  const [stamp, state] = await Promise.all([stat(RULES_STAMP_FILE), stat(RECEIPT_STATE_FILE)]);
  if (!stamp) return false;
  return !state || stamp.mtimeMs >= state.mtimeMs;
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
