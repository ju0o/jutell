import { describe, expect, it } from 'vitest';
import { BLOCK_REASON, evaluateCompletionGuard } from '../src/codex-hooks/completion-guard.js';

// JUTELL-V2.3-HOST-ENFORCED-COMPLETION-CHECKPOINT-01
//
// Canonical cases A/C/D from the task ticket, plus the safety/robustness cases it requires. See
// src/codex-hooks/completion-guard.ts for why the invariant is shaped this way (in particular:
// why 확인 완료 now requires an affirmatively clean `완료 판정` rather than the old design's
// optional gap field, and why loop safety is an unconditional one-block ceiling proven live,
// not a heuristic).

function stopInput(overrides: Record<string, unknown>) {
  return {
    cwd: '/tmp/project',
    hook_event_name: 'Stop',
    model: 'gpt-5.6-terra',
    permission_mode: 'never',
    session_id: 'session-1',
    stop_hook_active: false,
    transcript_path: '/tmp/project/.codex/transcript.jsonl',
    turn_id: 'turn-1',
    ...overrides,
  };
}

describe('확인 완료 + checkpoint absent', () => {
  it('blocks — the proven omission shape: no 완료 판정 line at all', () => {
    const message = ['- 근거: README.md diff 확인', '- 보고서 상태: 확인 완료'].join('\n');
    expect(evaluateCompletionGuard(stopInput({ last_assistant_message: message }))).toEqual({
      decision: 'block',
      reason: BLOCK_REASON,
    });
  });

  it('reason text does not leak internal implementation jargon (no field/hook/JSON identifiers)', () => {
    const message = ['- 보고서 상태: 확인 완료'].join('\n');
    const result = evaluateCompletionGuard(stopInput({ last_assistant_message: message })) as { reason: string };
    expect(result.reason).not.toMatch(/hook|JSON|stop_hook_active|regex/i);
  });
});

describe('확인 완료 + checkpoint clean', () => {
  it('allows when 완료 판정 is exactly 없음', () => {
    const message = ['- 완료 판정: 없음', '- 보고서 상태: 확인 완료'].join('\n');
    expect(evaluateCompletionGuard(stopInput({ last_assistant_message: message }))).toEqual({});
  });

  it('recognizes the checkpoint with markdown bold and a bullet marker around the labels', () => {
    const bold = ['**완료 판정:** 없음', '**보고서 상태:** 확인 완료'].join('\n');
    expect(evaluateCompletionGuard(stopInput({ last_assistant_message: bold }))).toEqual({});
  });
});

describe('확인 완료 + checkpoint says a critical gap exists', () => {
  it('blocks — an explicit gap disclosure still contradicts 확인 완료, same as omission', () => {
    const message = [
      '- 완료 판정: 외부 신원 인증 서비스 실제 연결 미확인',
      '- 보고서 상태: 확인 완료',
    ].join('\n');
    expect(evaluateCompletionGuard(stopInput({ last_assistant_message: message }))).toEqual({
      decision: 'block',
      reason: BLOCK_REASON,
    });
  });
});

describe('non-확인 완료 statuses never need the checkpoint (Case C)', () => {
  it('allows 일부 확인 with no 완료 판정 line', () => {
    const message = ['- 근거: 코드 변경 확인, 브라우저 확인 수단 없음', '- 보고서 상태: 일부 확인'].join('\n');
    expect(evaluateCompletionGuard(stopInput({ last_assistant_message: message }))).toEqual({});
  });

  it('allows 추가 확인 필요 with no 완료 판정 line', () => {
    const message = ['- 보고서 상태: 추가 확인 필요'].join('\n');
    expect(evaluateCompletionGuard(stopInput({ last_assistant_message: message }))).toEqual({});
  });

  it('does not block merely because the report mentions completion-adjacent vocabulary, as long as status is not 확인 완료', () => {
    const message = [
      '- 근거: 외부 신원 인증 서비스 연동 코드 확인, 실제 연결은 이번 요청 범위 밖',
      '- 보고서 상태: 범위 밖',
    ].join('\n');
    expect(evaluateCompletionGuard(stopInput({ last_assistant_message: message }))).toEqual({});
  });
});

describe('Case A — trivial complete', () => {
  it('allows directly when the Agent already includes a clean checkpoint on the first attempt', () => {
    const message = ['- 완료 판정: 없음', '- 보고서 상태: 확인 완료'].join('\n');
    expect(evaluateCompletionGuard(stopInput({ last_assistant_message: message }))).toEqual({});
  });

  it('blocks a first attempt missing the checkpoint, but allows the corrected continuation', () => {
    const first = ['- 보고서 상태: 확인 완료'].join('\n');
    expect(evaluateCompletionGuard(stopInput({ last_assistant_message: first, stop_hook_active: false }))).toEqual({
      decision: 'block',
      reason: BLOCK_REASON,
    });
    const corrected = ['- 완료 판정: 없음', '- 보고서 상태: 확인 완료'].join('\n');
    expect(evaluateCompletionGuard(stopInput({ last_assistant_message: corrected, stop_hook_active: true }))).toEqual({});
  });
});

describe('first block → continuation → corrected honest status (Case D outcome B/C)', () => {
  it('honest non-complete continuation survives', () => {
    const corrected = ['- 완료 판정: 외부 신원 인증 서비스 실제 연결 미확인', '- 보고서 상태: 일부 확인'].join('\n');
    expect(evaluateCompletionGuard(stopInput({ last_assistant_message: corrected, stop_hook_active: true }))).toEqual({});
  });

  it('corrected checkpoint-clean 확인 완료 survives', () => {
    const corrected = ['- 완료 판정: 없음', '- 보고서 상태: 확인 완료'].join('\n');
    expect(evaluateCompletionGuard(stopInput({ last_assistant_message: corrected, stop_hook_active: true }))).toEqual({});
  });
});

describe('first block → continuation still contradictory — proven one-block ceiling', () => {
  it('does not block again when stop_hook_active is already true, even if the checkpoint still says a gap exists', () => {
    // JUTELL-V2.3-HOST-ENFORCED-COMPLETION-CHECKPOINT-01 live-verified that Codex re-invokes a
    // hook that keeps blocking indefinitely (18+ times in 90s, no self-termination) because
    // stop_hook_active never resets or increments past `true`. A second block here would be an
    // unbounded loop risk, not a bounded one, so this MUST allow — the invalid completion is
    // still a known, disclosed limit of this prototype (see file header), not silently unnoticed.
    const stillContradictory = [
      '- 완료 판정: 외부 신원 인증 서비스 실제 연결 미확인',
      '- 보고서 상태: 확인 완료',
    ].join('\n');
    expect(
      evaluateCompletionGuard(stopInput({ last_assistant_message: stillContradictory, stop_hook_active: true })),
    ).toEqual({});
  });

  it('does not block again when stop_hook_active is already true, even if the checkpoint is still missing', () => {
    const stillMissing = ['- 보고서 상태: 확인 완료'].join('\n');
    expect(evaluateCompletionGuard(stopInput({ last_assistant_message: stillMissing, stop_hook_active: true }))).toEqual({});
  });
});

describe('no last_assistant_message — safe behavior', () => {
  it('allows when the field is entirely missing', () => {
    expect(evaluateCompletionGuard(stopInput({ last_assistant_message: undefined }))).toEqual({});
  });

  it('allows when the field is an empty string', () => {
    expect(evaluateCompletionGuard(stopInput({ last_assistant_message: '' }))).toEqual({});
  });

  it('allows when the field is present but not a string', () => {
    expect(evaluateCompletionGuard(stopInput({ last_assistant_message: 12345 }))).toEqual({});
  });
});

describe('malformed hook input — safe behavior, no destructive action', () => {
  it('allows on null input', () => {
    expect(evaluateCompletionGuard(null)).toEqual({});
  });

  it('allows on a bare string instead of an object', () => {
    expect(evaluateCompletionGuard('not an object')).toEqual({});
  });

  it('allows on an array instead of an object', () => {
    expect(evaluateCompletionGuard([])).toEqual({});
  });

  it('allows on completely unrelated object shapes', () => {
    expect(evaluateCompletionGuard({ some: 'other', shape: 1 })).toEqual({});
  });
});
