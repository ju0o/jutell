import { describe, expect, it } from 'vitest';
import { AGENT_READY_WITH_WARNING, CODEX_CANNOT_RUN_JUTELL, readyOutput } from '../src/commands/default.js';

describe('setup ready message with a Codex warning (dogfood #37)', () => {
  it('shows the warning first and never says 준비 완료 when there is one', () => {
    const [first, second] = readyOutput('JuTell 준비 완료.\n\n✓ Codex 연결됨', true);
    expect(first).toBe(CODEX_CANNOT_RUN_JUTELL);
    expect(second).toContain('JuTell 준비됨, 하나 확인 필요.');
    expect(second).not.toContain('준비 완료');
  });
  it('the "AI Agent 연결 준비 완료" line is not a ✓ when there is a warning', () => {
    const [, second] = readyOutput('JuTell 준비 완료\n\n✓ 설정 연결됨\n✓ AI Agent 연결 준비 완료', true);
    expect(second).toContain(AGENT_READY_WITH_WARNING);
    expect(second).not.toContain('✓ AI Agent 연결 준비 완료');
    expect(second).toContain('✓ 설정 연결됨');
  });
  it('keeps the plain message without a warning', () => {
    expect(readyOutput('JuTell 준비 완료.', false)).toEqual(['JuTell 준비 완료.']);
  });
});
