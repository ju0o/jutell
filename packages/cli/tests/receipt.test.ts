import { describe, expect, it } from 'vitest';
import { renderReceipt } from '../src/commands/receipt/render.js';

const timestamp = '2026-10-18 16:40';
const sample = {
  done: ['브라우저 탭 이름: 할 일 목록 → 오늘 할 일', '화면 맨 위 큰 글씨: 할 일 목록 → 오늘 할 일'],
  checks: [
    { what: '파일에서 두 제목이 바뀐 것', result: '확인함', how: '파일 내용을 읽음' },
    { what: '브라우저로 열어보기', result: '안 해봄', reason: '이 환경에서 화면을 못 열어서' },
  ],
  next: {
    continue: [],
    nice: ['페이지를 한 번 열어 제목만 봐 주세요'],
    stop: ['부탁한 일은 끝났어요'],
  },
};

describe('receipt renderer', () => {
  it('renders the fixed receipt layout and optional saved path', () => {
    expect(renderReceipt(sample, timestamp, '.jutell-local/reports/2026-10-18-164012.md')).toBe([
      '==============================',
      '  JuTell 작업 영수증',
      '  2026-10-18 16:40',
      '==============================',
      '[이번에 한 작업]',
      ' 1. 브라우저 탭 이름: 할 일 목록 → 오늘 할 일',
      ' 2. 화면 맨 위 큰 글씨: 할 일 목록 → 오늘 할 일',
      '',
      '[확인]',
      ' ✔ 확인함: 파일에서 두 제목이 바뀐 것 (파일 내용을 읽음)',
      ' ✖ 안 해봄: 브라우저로 열어보기 (이 환경에서 화면을 못 열어서)',
      '------------------------------',
      '[다음 추천]',
      ' ▶ 계속 진행',
      '   - 없음',
      ' ○ 해두면 좋은 것',
      '   - 페이지를 한 번 열어 제목만 봐 주세요',
      ' ■ 여기서 멈춰도 됨',
      '   - 부탁한 일은 끝났어요',
      '------------------------------',
      ' 저장됨: .jutell-local/reports/2026-10-18-164012.md',
      '==============================',
    ].join('\n'));
  });

  it('is deterministic and does not print optional risk or next-message fields', () => {
    const input = { ...sample, risk: '민감한 내용', nextMessage: '다음에 보낼 말' };
    const first = renderReceipt(input, timestamp);
    expect(renderReceipt(input, timestamp)).toBe(first);
    expect(first).not.toContain('민감한 내용');
    expect(first).not.toContain('다음에 보낼 말');
    expect(first).not.toContain('저장됨:');
    expect(first).not.toMatch(/확인 완료|일부 확인|추가 확인 필요/);
  });

  it('prints 없음 for empty groups and masks absolute paths in text', () => {
    const output = renderReceipt({
      done: ['/home/jo/sample.ts'],
      checks: [{ what: '파일 확인', result: '확인함', how: 'C:\\Users\\jo\\sample.ts' }],
      next: { continue: [], nice: [], stop: [] },
    }, timestamp);

    expect(output).toContain(' 1. [경로]');
    expect(output).toContain(' ✔ 확인함: 파일 확인 ([경로])');
    expect(output.match(/- 없음/g)).toHaveLength(3);
    expect(output).not.toContain('/home/jo/sample.ts');
    expect(output).not.toContain('C:\\Users');
  });

  it('rejects unsupported results, missing detail, and status fields', () => {
    expect(() => renderReceipt({ ...sample, checks: [{ what: '화면', result: '미확인' }] }, timestamp))
      .toThrow('결과는');
    expect(() => renderReceipt({ ...sample, checks: [{ what: '화면', result: '확인함' }] }, timestamp))
      .toThrow('확인 방법');
    expect(() => renderReceipt({ ...sample, checks: [{ what: '화면', result: '안 해봄' }] }, timestamp))
      .toThrow('이유');
    expect(() => renderReceipt({ ...sample, status: '확인 완료' }, timestamp))
      .toThrow('status 항목');
  });

  it('rejects groups that exceed their entry limits', () => {
    expect(() => renderReceipt({ ...sample, done: ['1', '2', '3', '4', '5', '6'] }, timestamp))
      .toThrow('최대 5개');
    expect(() => renderReceipt({ ...sample, checks: Array.from({ length: 5 }, () => sample.checks[0]) }, timestamp))
      .toThrow('최대 4개');
    expect(() => renderReceipt({
      ...sample,
      next: { continue: ['1'], nice: ['2'], stop: ['3', '4'] },
    }, timestamp)).toThrow('최대 3개');
  });

  it('does not print the save line for an absolute saved path', () => {
    expect(renderReceipt({ done: [], checks: [], next: { continue: [], nice: [], stop: [] } }, timestamp, '/tmp/report.md'))
      .not.toContain('저장됨:');
  });
});
