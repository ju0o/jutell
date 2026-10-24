import { describe, expect, it } from 'vitest';
import { HANJA_NOTE, renderReceipt } from '../src/commands/receipt/render.js';

describe('optional Hanja note', () => {
  it('shows once when the AI text has Hanja, never otherwise', () => {
    const base = { done: ['로그인 화면 수정'], checks: [{ what: '파일 읽기', result: '확인함', how: '파일 내용을 읽음' }], next: { continue: [], nice: [], stop: ['끝났어요'] } };
    const withHanja = renderReceipt({ ...base, done: ['登錄 화면 修正'] }, '2026-10-24T00:00:00Z');
    expect(withHanja.split(HANJA_NOTE).length - 1).toBe(1);
    expect(renderReceipt(base, '2026-10-24T00:00:00Z')).not.toContain('한자가 섞여');
  });
});
