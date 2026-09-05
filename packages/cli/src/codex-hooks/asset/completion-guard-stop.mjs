#!/usr/bin/env node
// JuTell Codex Stop-hook completion guard (prototype) — JUTELL-V2.3-CODEX-DETERMINISTIC-COMPLETION-GUARD-PROTOTYPE-01
//
// Registered directly as a Codex Stop hook `command` (no separate `args` — see
// JUTELL-V2.3-CODEX-HOOK-TRUST-AND-BLOCK-LIVE-01: on Codex CLI 0.153.2, `command` + a
// separate `args` array silently dropped the args and ran a bare, argument-less interpreter
// instead of this script).
//
// Deliberately dependency-free and self-contained (no network, no LLM call, no second agent,
// no persistent backend, no database) so it can run as a single file with nothing to install.
// The decision logic here is intentionally kept in lockstep with
// `packages/cli/src/codex-hooks/completion-guard.ts`, which is the tested, documented source
// of truth for *why* this logic looks the way it does — see the comments there. This asset is
// covered by `packages/cli/tests/codex-hooks-completion-guard-asset.test.ts`, which spawns it
// exactly as Codex would (subprocess, JSON on stdin, JSON or nothing on stdout) and asserts the
// same canonical cases as the unit tests below, so the two can't silently drift apart.

const REPORT_STATUSES = ['확인 완료', '추가 확인 필요', '일부 확인', '작업 보류', '범위 밖'];

const BLOCK_REASON =
  '완료에 필수적인 미확인 사항이 있는데도 보고서 상태를 확인 완료로 썼습니다. ' +
  '확인되지 않은 내용은 그대로 두고, 보고서 상태만 확인 완료가 아닌 ' +
  '기존 상태(추가 확인 필요/일부 확인/작업 보류/범위 밖) 중 실제로 맞는 것으로 고쳐 다시 답하세요.';

const UNCONFIRMED_FIELD_PATTERN = /(?:^|\n)\s*[-*]?\s*\**\s*완료에\s*필수적인\s*미확인\s*\**\s*[:：]\s*(.+)/;

const STATUS_PATTERN = new RegExp(
  `(?:^|\\n)\\s*[-*]?\\s*\\**\\s*보고서\\s*상태\\s*\\**\\s*[:：]\\s*\\**\\s*(${REPORT_STATUSES.join('|')})`,
  'g',
);

function hasUnconfirmedCompletionGap(message) {
  const match = message.match(UNCONFIRMED_FIELD_PATTERN);
  return Boolean(match && match[1] && match[1].trim().length > 0);
}

function finalReportStatus(message) {
  let last;
  for (const match of message.matchAll(STATUS_PATTERN)) last = match[1];
  return last;
}

function evaluateCompletionGuard(rawInput) {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) return {};
  if (rawInput.stop_hook_active === true) return {};
  const message = rawInput.last_assistant_message;
  if (typeof message !== 'string' || !message.trim()) return {};
  if (!hasUnconfirmedCompletionGap(message)) return {};
  if (finalReportStatus(message) !== '확인 완료') return {};
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
