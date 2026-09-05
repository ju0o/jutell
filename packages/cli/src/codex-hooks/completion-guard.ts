/**
 * JUTELL-V2.3-CODEX-DETERMINISTIC-COMPLETION-GUARD-PROTOTYPE-01
 *
 * Deterministic Codex Stop-hook completion guard (prototype).
 *
 * ## What this is, and is not
 *
 * `references/report-format.md` (and `docs/BEGINNER_REPORT_SPEC.md`) already tell the Agent,
 * as guidance: if a `완료에 필수적인 미확인` (completion-critical unconfirmed item) field is
 * present in the report, the very next `보고서 상태` line may not be `확인 완료`. Dogfooding
 * proved that guidance alone does not hold — the Agent can (and, four times running, did)
 * still write `보고서 상태: 확인 완료` right after disclosing a completion-critical gap.
 *
 * This module is the MACHINE INVARIANT half of that rule, not a replacement for it. It does
 * not — and cannot — decide whether a completion-critical gap actually exists; that is MODEL
 * JUDGMENT (does removing a phone field really make external identity verification mandatory?
 * was that real path actually exercised?). All this module does is refuse to let the two
 * already-defined, already-agreed report fields contradict each other once the model has
 * written them both. It is pure syntax over the model's own controlled vocabulary — never a
 * classifier over free-text domain content (no "external service" / "identity" / etc. keyword
 * matching), because that would misfire on unrelated Case A/C reports that happen to mention
 * similar words without any real completion-critical gap. Precision is prioritized over recall.
 *
 * ## The omission problem — addressed, not solved
 *
 * The proven dogfood failure is specifically the case where the Agent discloses the gap only
 * in free prose and never writes the `완료에 필수적인 미확인` field at all. This invariant
 * cannot catch that shape: with no field present, there is nothing for a deterministic,
 * non-semantic check to key off without falling back to a broad keyword classifier (rejected
 * above) or a second semantic pass (rejected — see project constraints: no second LLM/agent
 * inside the hook). So Prototype 01's recall is intentionally bounded to the case where the
 * Agent at least attempts the existing field but still concludes wrongly. That is a real,
 * bounded gap — see the accompanying task report for what remains unproven — not something
 * this module claims to close.
 */

export const REPORT_STATUSES = ['확인 완료', '추가 확인 필요', '일부 확인', '작업 보류', '범위 밖'] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const BLOCK_REASON =
  '완료에 필수적인 미확인 사항이 있는데도 보고서 상태를 확인 완료로 썼습니다. ' +
  '확인되지 않은 내용은 그대로 두고, 보고서 상태만 확인 완료가 아닌 ' +
  '기존 상태(추가 확인 필요/일부 확인/작업 보류/범위 밖) 중 실제로 맞는 것으로 고쳐 다시 답하세요.';

export type StopHookDecision = { decision: 'block'; reason: string };

/** Empty object = no override; Codex proceeds with the original completion normally. */
export type StopHookResult = StopHookDecision | Record<string, never>;

const ALLOW: StopHookResult = {};

// Tolerant of a leading "- "/"* " bullet and markdown "**bold**" wrapping around the label,
// and either a half-width or full-width colon — but not of the enum values themselves, which
// are matched verbatim so no fuzzy status ever counts as a hit.
const UNCONFIRMED_FIELD_PATTERN = /(?:^|\n)\s*[-*]?\s*\**\s*완료에\s*필수적인\s*미확인\s*\**\s*[:：]\s*(.+)/;

const STATUS_PATTERN = new RegExp(
  `(?:^|\\n)\\s*[-*]?\\s*\\**\\s*보고서\\s*상태\\s*\\**\\s*[:：]\\s*\\**\\s*(${REPORT_STATUSES.join('|')})`,
  'g',
);

/**
 * True only when the report explicitly names a non-empty completion-critical unconfirmed item
 * — i.e. the Agent itself already wrote the field. Per report-format.md the field is omitted
 * entirely (not left blank) when there is nothing to disclose, so any non-empty match here is
 * the Agent's own disclosure, not an inference this module makes.
 */
function hasUnconfirmedCompletionGap(message: string): boolean {
  const match = message.match(UNCONFIRMED_FIELD_PATTERN);
  return Boolean(match && match[1] && match[1].trim().length > 0);
}

/**
 * The report's operative final status. A message may repeat a summary line earlier and the
 * full field near the end; the LAST match is treated as the one that actually governs, which
 * is also the most conservative choice against false positives (an earlier draft-looking
 * mention of 확인 완료 followed by a corrected final status will not trigger a block).
 */
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

  // Loop safety: cap enforcement at one automatic hook-forced continuation per turn. If this
  // Stop event is itself already such a continuation, never block again regardless of content
  // — this is a hard backstop against infinite block/continue cycling with a non-compliant or
  // stubborn continuation, on top of the natural termination the invariant already gives (a
  // corrected response simply stops matching it). No workflow engine, no persisted state.
  if (input.stop_hook_active === true) return ALLOW;

  const message = input.last_assistant_message;
  if (typeof message !== 'string' || !message.trim()) return ALLOW;

  if (!hasUnconfirmedCompletionGap(message)) return ALLOW;
  if (finalReportStatus(message) !== '확인 완료') return ALLOW;

  return { decision: 'block', reason: BLOCK_REASON };
}
