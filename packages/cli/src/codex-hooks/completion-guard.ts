/**
 * JUTELL-V2.3-HOST-ENFORCED-COMPLETION-CHECKPOINT-01
 * (supersedes the field+status invariant from JUTELL-V2.3-CODEX-DETERMINISTIC-COMPLETION-GUARD-PROTOTYPE-01)
 *
 * ## Why the previous invariant wasn't enough
 *
 * The previous version blocked only when the Agent *itself* wrote a non-empty
 * `완료에 필수적인 미확인` field alongside `보고서 상태: 확인 완료`. Five live dogfood
 * reproductions (see `Jutell-private/dogfood/completion-guard/`) showed the same failure
 * shape every time: the Agent correctly understood a completion-critical gap, correctly
 * disclosed it in free prose, and simply never wrote the field — so there was nothing for a
 * deterministic, non-semantic check to key off. That's not a wording problem to fix with a
 * clearer instruction; it's an architecture problem. An *optional* field can always be omitted,
 * on purpose or by accident, and a validator whose only input is "did the Agent choose to leave
 * evidence" is not a validator over the claim, it's a validator over the Agent's memory of the
 * instruction.
 *
 * ## The inverted invariant
 *
 * Old: IF the critical-gap field is present AND status is 확인 완료 → BLOCK.
 * New: IF status is 확인 완료 AND the required completion checkpoint is NOT affirmatively
 *      clean → BLOCK.
 *
 * 확인 완료 must now earn survival by including a `완료 판정` line. Its value must be exactly
 * the closed-vocabulary token `없음` (no completion-critical gap) — anything else (including
 * simply not writing the field at all) is treated as "not affirmatively clean" and blocks,
 * exactly like an explicit gap disclosure would. This flips omission from invisible-to-the-hook
 * into a hit: there is no third option between "wrote 없음" and "didn't", so the Agent can no
 * longer produce a 확인 완료 the hook can't see into.
 *
 * `완료 판정` is deliberately closed-vocabulary (exact match on `없음`), mirroring how
 * `보고서 상태` itself is already a closed five-value enum in this same file — not a new kind of
 * strictness, the same one already accepted elsewhere in this report format.
 *
 * ## Model judgment vs machine invariant (unchanged split)
 *
 * The model still does 100% of the semantic work: whether a completion-critical gap actually
 * exists, and what it is. The machine still does none of that — it never keyword-matches domain
 * content ("external service", "payment", "identity", "browser", ...). It only checks whether a
 * `확인 완료` claim is accompanied by the one closed-vocabulary token that means "I performed
 * this specific judgment and it came out clean." A model that dishonestly writes `완료 판정: 없음`
 * when it knows better is a model behaving in bad faith, which is out of scope for any
 * syntax-level machine invariant — same limit the old design had, stated plainly rather than
 * hidden.
 *
 * ## Loop safety — proven, not assumed
 *
 * JUTELL-V2.3-HOST-ENFORCED-COMPLETION-CHECKPOINT-01 live-verified (see the task's dogfood/live
 * smoke record) that Codex's `stop_hook_active` is a flag, not a counter: it is `false` on the
 * first Stop of a turn and `true` on every one after that, and it never resets or increments
 * further — Codex itself imposes no independent cap on Stop-hook-forced continuations. A probe
 * hook that kept returning `block` regardless of `stop_hook_active` was observed to be
 * re-invoked 18+ times in 90 seconds with no sign of self-terminating, even after the model
 * itself gave up and started replying "I remain blocked." That rules out any design that
 * conditionally blocks again once `stop_hook_active` is `true` (e.g. "block again only if the
 * checkpoint still says the gap exists") — there is no bounded way to tell attempt 2 from
 * attempt 200 from this field alone, so *any* second block is a potential infinite loop, not a
 * bounded one. The only proven-safe rule is the same one the previous prototype used: exactly
 * one forced continuation per turn, full stop, regardless of what that continuation contains.
 * This is a hard ceiling, not a tuning choice — see the task report for the reproduction.
 */

export const REPORT_STATUSES = ['확인 완료', '추가 확인 필요', '일부 확인', '작업 보류', '범위 밖'] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** The one value of `완료 판정` that means "checkpoint performed, no completion-critical gap." */
export const CHECKPOINT_CLEAN_VALUE = '없음';

export const BLOCK_REASON =
  '확인 완료로 답하려면 그 앞에 완료 판정을 먼저 밝혀야 합니다. ' +
  '이미 확인한 내용을 근거로 완료 판정을 다시 쓰세요 — 완료에 필수적으로 확인되지 않은 것이 정말 없으면 ' +
  '완료 판정: 없음이라고 쓰고 확인 완료를 유지하고, 있으면 그 내용을 완료 판정에 적은 뒤 보고서 상태를 ' +
  '확인 완료가 아닌 기존 상태(추가 확인 필요/일부 확인/작업 보류/범위 밖) 중 실제로 맞는 것으로 고치세요.';

export type StopHookDecision = { decision: 'block'; reason: string };

/** Empty object = no override; Codex proceeds with the original completion normally. */
export type StopHookResult = StopHookDecision | Record<string, never>;

const ALLOW: StopHookResult = {};

// Same bullet/bold/colon tolerance as the status pattern below — see its comment.
const CHECKPOINT_PATTERN = /(?:^|\n)\s*[-*]?\s*\**\s*완료\s*판정\s*\**\s*[:：]\s*\**\s*(.+)/g;

const STATUS_PATTERN = new RegExp(
  `(?:^|\\n)\\s*[-*]?\\s*\\**\\s*보고서\\s*상태\\s*\\**\\s*[:：]\\s*\\**\\s*(${REPORT_STATUSES.join('|')})`,
  'g',
);

type Checkpoint = 'absent' | 'clean' | 'gap';

/**
 * The checkpoint's operative value. As with status below, a message may repeat an earlier
 * draft-looking line; the LAST match governs, which is also the conservative choice against
 * false positives (an earlier "완료 판정: 없음" followed by a corrected, honest disclosure later
 * in the same message will not be treated as clean).
 */
function readCheckpoint(message: string): Checkpoint {
  let last: string | undefined;
  for (const match of message.matchAll(CHECKPOINT_PATTERN)) last = match[1];
  if (last === undefined) return 'absent';
  return last.trim() === CHECKPOINT_CLEAN_VALUE ? 'clean' : 'gap';
}

/** The report's operative final status — see readCheckpoint for why the LAST match governs. */
function finalReportStatus(message: string): ReportStatus | undefined {
  let last: ReportStatus | undefined;
  for (const match of message.matchAll(STATUS_PATTERN)) {
    last = match[1] as ReportStatus;
  }
  return last;
}

/**
 * Pure decision function: no I/O, no process access, safe to unit-test directly and safe to
 * call from the shipped stdin/stdout hook entrypoint (see assets/codex-hooks). Never throws —
 * any unrecognized/unexpected shape falls through to ALLOW (fail-open by design: a validator
 * bug must never brick the user's ability to finish a turn).
 */
export function evaluateCompletionGuard(rawInput: unknown): StopHookResult {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) return ALLOW;
  const input = rawInput as Record<string, unknown>;

  // Loop safety: proven hard ceiling, not a heuristic — see the file header. Exactly one forced
  // continuation per turn, unconditionally, regardless of what that continuation contains.
  if (input.stop_hook_active === true) return ALLOW;

  const message = input.last_assistant_message;
  if (typeof message !== 'string' || !message.trim()) return ALLOW;

  // The checkpoint is only required when a 확인 완료 claim is being made — an honest non-complete
  // status never needs it and is never delayed by it (Case C).
  if (finalReportStatus(message) !== '확인 완료') return ALLOW;

  // 'absent' (omitted, the proven failure shape) and 'gap' (explicitly disclosed) are both
  // treated the same way: 확인 완료 has not earned survival. Only an affirmatively clean
  // checkpoint lets it through.
  if (readCheckpoint(message) === 'clean') return ALLOW;

  return { decision: 'block', reason: BLOCK_REASON };
}
