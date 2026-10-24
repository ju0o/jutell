import { describe, expect, it } from 'vitest';
import { stamp, subjectParticle } from '../src/map/stamp.js';
import { formatMapSelectionIndex } from '../src/map/selection.js';

describe('natural Korean particle for map search messages', () => {
  it('picks 이/가 by the final consonant', () => {
    expect(subjectParticle('결제')).toBe('가');
    expect(subjectParticle('로그인')).toBe('이');
    expect(subjectParticle('할 일')).toBe('이');
    expect(subjectParticle('login')).toBe('이');
    expect(subjectParticle('todo')).toBe('가');
    expect(subjectParticle('v2')).toBe('가');
    expect(subjectParticle('v3')).toBe('이');
  });
});

describe('map --list time uses the header format (local time with zone)', () => {
  it('formats generatedAt like the JuTellMap header, not raw ISO', () => {
    const iso = '2026-10-24T04:18:00.000Z';
    const index = { generatedAt: iso, sourceMap: { commit: null }, scan: { source: 'git', fileCount: 0, truncated: false }, sections: [] } as unknown as Parameters<typeof formatMapSelectionIndex>[0];
    const text = formatMapSelectionIndex(index);
    expect(text).toContain(`정리한 시각 ${stamp(new Date(iso))}`);
    expect(text).not.toContain(iso);
    expect(stamp(new Date(iso))).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d \(UTC[+-]\d+(?::\d\d)?\)$/);
  });
});
