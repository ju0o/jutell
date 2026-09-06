#!/usr/bin/env node
// JuTell Codex Stop-hook completion guard — JUTELL-V2.3-HOST-ENFORCED-COMPLETION-CHECKPOINT-01
// (supersedes JUTELL-V2.3-CODEX-DETERMINISTIC-COMPLETION-GUARD-PROTOTYPE-01's field+status invariant)
//
// Registered directly as a Codex Stop hook `command` (no separate `args` — see
// JUTELL-V2.3-CODEX-HOOK-TRUST-AND-BLOCK-LIVE-01: on this Codex CLI, `command` + a separate
// `args` array silently dropped the args and ran a bare, argument-less interpreter instead of
// this script).
//
// Deliberately dependency-free and self-contained (no network, no LLM call, no second agent,
// no persistent backend, no database) so it can run as a single file with nothing to install.
// The decision logic here is intentionally kept in lockstep with
// `packages/cli/src/codex-hooks/completion-guard.ts`, which is the tested, documented source of
// truth for *why* this logic looks the way it does — see the comments there, in particular the
// proven, unconditional loop-safety ceiling (`stop_hook_active === true` always allows: Codex
// was live-observed to re-invoke a hook that kept blocking 18+ times in 90s with no sign of
// self-terminating). This asset is covered by
// `packages/cli/tests/codex-hooks-completion-guard-asset.test.ts`, which spawns it exactly as
// Codex would (subprocess, JSON on stdin, JSON or nothing on stdout) and asserts the same
// canonical cases as the unit tests, so the two can't silently drift apart.

const REPORT_STATUSES = ['확인 완료', '추가 확인 필요', '일부 확인', '작업 보류', '범위 밖'];
const CHECKPOINT_CLEAN_VALUE = '없음';

const BLOCK_REASON =
  '확인 완료로 답하려면 그 앞에 완료 판정을 먼저 밝혀야 합니다. ' +
  '이미 확인한 내용을 근거로 완료 판정을 다시 쓰세요 — 완료에 필수적으로 확인되지 않은 것이 정말 없으면 ' +
  '완료 판정: 없음이라고 쓰고 확인 완료를 유지하고, 있으면 그 내용을 완료 판정에 적은 뒤 보고서 상태를 ' +
  '확인 완료가 아닌 기존 상태(추가 확인 필요/일부 확인/작업 보류/범위 밖) 중 실제로 맞는 것으로 고치세요.';

const CHECKPOINT_PATTERN = /(?:^|\n)\s*[-*]?\s*\**\s*완료\s*판정\s*\**\s*[:：]\s*\**\s*(.+)/g;

const STATUS_PATTERN = new RegExp(
  `(?:^|\\n)\\s*[-*]?\\s*\\**\\s*보고서\\s*상태\\s*\\**\\s*[:：]\\s*\\**\\s*(${REPORT_STATUSES.join('|')})`,
  'g',
);

function readCheckpoint(message) {
  let last;
  for (const match of message.matchAll(CHECKPOINT_PATTERN)) last = match[1];
  if (last === undefined) return 'absent';
  return last.trim() === CHECKPOINT_CLEAN_VALUE ? 'clean' : 'gap';
}

function finalReportStatus(message) {
  let last;
  for (const match of message.matchAll(STATUS_PATTERN)) last = match[1];
  return last;
}

function evaluateCompletionGuard(rawInput) {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) return {};
  if (rawInput.stop_hook_active === true) return {}; // proven hard ceiling — see header comment
  const message = rawInput.last_assistant_message;
  if (typeof message !== 'string' || !message.trim()) return {};
  if (finalReportStatus(message) !== '확인 완료') return {};
  if (readCheckpoint(message) === 'clean') return {};
  return { decision: 'block', reason: BLOCK_REASON };
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('error', () => process.exit(0));
process.stdin.on('end', () => {
  let output = {};
  try {
    output = evaluateCompletionGuard(JSON.parse(raw));
  } catch {
    // Malformed input: fail open, no output, no crash — never blocks on a parse error.
    output = {};
  }
  if (output && output.decision === 'block') {
    try { process.stdout.write(JSON.stringify(output)); } catch { /* fail open */ }
  }
  process.exit(0);
});
