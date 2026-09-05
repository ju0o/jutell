import { describe, expect, it } from 'vitest';
import { BLOCK_REASON, evaluateCompletionGuard } from '../src/codex-hooks/completion-guard.js';

// JUTELL-V2.3-CODEX-DETERMINISTIC-COMPLETION-GUARD-PROTOTYPE-01
//
// Canonical cases A/C/D from the task ticket, plus the safety/robustness cases the ticket
// requires. See src/codex-hooks/completion-guard.ts for why the invariant is shaped this way
// (and what it deliberately does not try to catch).

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

describe('Case A — trivial complete, no completion-critical gap', () => {
  it('allows a plain 확인 완료 report with no unconfirmed-gap field', () => {
    const message = [
      '- 근거: README.md diff 확인',
      '- 위험도: 낮음',
      '- 보고서 상태: 확인 완료',
    ].join('\n');
    expect(evaluateCompletionGuard(stopInput({ last_assistant_message: message }))).toEqual({});
  });
});

describe('Case C — secondary verification unavailable, honestly reported', () => {
  it('allows 일부 확인 with no unconfirmed-gap field', () => {
    const message = [
      '- 근거: 코드 변경 확인, 브라우저 확인 수단 없음',
      '- 위험도: 낮음',
      '- 보고서 상태: 일부 확인',
    ].join('\n');
    expect(evaluateCompletionGuard(stopInput({ last_assistant_message: message }))).toEqual({});
  });

  it('allows 추가 확인 필요 with no unconfirmed-gap field', () => {
    const message = ['- 근거: 핵심 동작 확인됨', '- 보고서 상태: 추가 확인 필요'].join('\n');
    expect(evaluateCompletionGuard(stopInput({ last_assistant_message: message }))).toEqual({});
  });

  it('does not block merely because the report mentions an external/service-sounding term, as long as status is not 확인 완료', () => {
    // Guards against accidentally having built a broad keyword classifier instead of the
    // narrow field+status invariant: this message is full of Case-D-adjacent vocabulary but
    // never claims 확인 완료, so it must never block.
    const message = [
      '- 근거: 외부 신원 인증 서비스 연동 코드 확인, 실제 연결은 이번 요청 범위 밖',
      '- 보고서 상태: 범위 밖',
    ].join('\n');
    expect(evaluateCompletionGuard(stopInput({ last_assistant_message: message }))).toEqual({});
  });
});

describe('Case D — known completion-critical contradiction', () => {
  const message = [
    '- 근거: 전화번호 입력 제거, 외부 신원 인증 서비스가 필수 경로가 됨',
    '- 완료에 필수적인 미확인: 외부 신원 인증 서비스 실제 연결',
    '- 보고서 상태: 확인 완료',
  ].join('\n');

  it('blocks when the unconfirmed-gap field is present alongside 확인 완료', () => {
    const result = evaluateCompletionGuard(stopInput({ last_assistant_message: message }));
    expect(result).toEqual({ decision: 'block', reason: BLOCK_REASON });
  });

  it('reason text does not leak internal implementation jargon (no field/hook/JSON identifiers)', () => {
    const result = evaluateCompletionGuard(stopInput({ last_assistant_message: message })) as { reason: string };
    expect(result.reason).not.toMatch(/hook|JSON|stop_hook_active|regex/i);
  });

  it('recognizes the field with markdown bold and a bullet marker around the labels', () => {
    const bold = [
      '**완료에 필수적인 미확인:** 외부 신원 인증 서비스 실제 연결',
      '**보고서 상태:** 확인 완료',
    ].join('\n');
    expect(evaluateCompletionGuard(stopInput({ last_assistant_message: bold }))).toEqual({
      decision: 'block',
      reason: BLOCK_REASON,
    });
  });
});

describe('Case D corrected — the honest follow-up response', () => {
  it('allows once the status is changed away from 확인 완료, gap field still present', () => {
    const corrected = [
      '- 완료에 필수적인 미확인: 외부 신원 인증 서비스 실제 연결',
      '- 보고서 상태: 일부 확인',
    ].join('\n');
    expect(evaluateCompletionGuard(stopInput({ last_assistant_message: corrected }))).toEqual({});
  });

  it('allows once the unconfirmed-gap field is dropped and status stays honest', () => {
    const corrected = ['- 보고서 상태: 작업 보류'].join('\n');
    expect(evaluateCompletionGuard(stopInput({ last_assistant_message: corrected }))).toEqual({});
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

describe('loop safety', () => {
  const contradictory = [
    '- 완료에 필수적인 미확인: 외부 신원 인증 서비스 실제 연결',
    '- 보고서 상태: 확인 완료',
  ].join('\n');

  it('does not block again when stop_hook_active is already true, even if still contradictory', () => {
    const result = evaluateCompletionGuard(stopInput({ last_assistant_message: contradictory, stop_hook_active: true }));
    expect(result).toEqual({});
  });

  it('still blocks the first time, when stop_hook_active is false', () => {
    const result = evaluateCompletionGuard(stopInput({ last_assistant_message: contradictory, stop_hook_active: false }));
    expect(result).toEqual({ decision: 'block', reason: BLOCK_REASON });
  });
});
