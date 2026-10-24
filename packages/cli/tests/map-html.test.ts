import { performance } from 'node:perf_hooks';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { cardIds, MAP_COLORS, renderMapHtml } from '../src/map/html.js';
import { map200 } from './fixtures/map-200.js';

// cycle-3 W10 (map HTML Stage 1). Criteria from html-map-roadmap.md / plan.md.
const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">`;
// renderMapHtml(map200()) before W10 (main ac3dfb4), in bytes.
const SIZE_BEFORE_W10 = 199_976;

const small = [
  '# JuTell 지도 — 이 프로젝트는 어떻게 생겼나요?',
  '마지막 갱신: 2026-10-24 20:00',
  '## 할 일 [지도로 짐작]',
  '<!-- jutell:auto 할 일 -->',
  '- test-app/todo.html — 화면',
  '- src/todo/service.ts — 기능',
  '- src/todo/service.test.ts — 테스트',
  '<!-- /jutell:auto -->',
  '내 메모: 할 일 앱',
  '## 로그인 [지도로 짐작]',
  '- src/auth/login.ts — 기능',
  '## 로그인 [지도로 짐작]',
  '- src/auth2/login.ts — 기능',
  '## 아직 분류 안 된 파일',
  '- README.md — 문서',
  '',
].join('\n');

function dom(html: string) {
  return new JSDOM(html).window.document;
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function map2000Files() {
  const lines = ['# 지도'];
  for (let f = 0; f < 200; f += 1) {
    lines.push(`## 기능 ${f}`);
    for (let i = 0; i < 10; i += 1) lines.push(`- src/f${f}/file${i}.ts — ${['화면', '기능', '테스트', '문서'][i % 4]}`);
  }
  return lines.join('\n');
}

describe('map.html Stage 1 (W10)', () => {
  it('snapshot', async () => {
    await expect(renderMapHtml(small)).toMatchFileSnapshot('./__snapshots__/map-html.small.html');
  });

  it('is at least 30% smaller for a 200-feature map', () => {
    const size = Buffer.byteLength(renderMapHtml(map200()));
    expect(size).toBeLessThanOrEqual(SIZE_BEFORE_W10 * 0.7);
  });

  it('every card id is unique and every overview link points at a card', () => {
    for (const html of [renderMapHtml(small), renderMapHtml(map200())]) {
      const doc = dom(html);
      const ids = [...doc.querySelectorAll('[id]')].map((node) => node.id);
      expect(new Set(ids).size).toBe(ids.length);
      const links = [...doc.querySelectorAll('a[href]')];
      expect(links.length).toBe(doc.querySelectorAll('details').length);
      for (const link of links) {
        const target = doc.getElementById(decodeURIComponent(link.getAttribute('href')!.slice(1)));
        expect(target?.tagName).toBe('DETAILS');
        expect(target!.querySelector('summary')!.firstChild!.textContent).toBe(link.textContent);
      }
    }
    expect(cardIds(['로그인', '로그인', '로그인 2', '!!!'])).toEqual(['f-로그인', 'f-로그인-2', 'f-로그인-2-2', 'f-feature']);
  });

  it('keeps the CSP string unchanged and makes no requests', () => {
    const html = renderMapHtml(map200());
    expect(html).toContain(CSP);
    expect(html).not.toMatch(/<script|<link|<iframe|<img|\ssrc=|href="https?:|url\(|@import/i);
  });

  it('headings and landmarks pass in jsdom', () => {
    const doc = dom(renderMapHtml(small));
    expect(doc.documentElement.lang).toBe('ko');
    expect(doc.title).not.toBe('');
    expect(doc.querySelectorAll('h1').length).toBe(1);
    expect(doc.querySelectorAll('main').length).toBe(1);
    expect(doc.querySelectorAll('header').length).toBe(1);
    expect(doc.querySelector('header h1')).not.toBeNull();
    const levels = [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1]));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i += 1) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    for (const th of doc.querySelectorAll('th')) expect(th.getAttribute('scope')).toBe('col');
    expect(doc.querySelector('table caption')?.textContent).toBeTruthy();
    for (const link of doc.querySelectorAll('a')) expect(link.textContent!.trim()).not.toBe('');
    for (const summary of doc.querySelectorAll('summary')) expect(summary.textContent!.trim()).not.toBe('');
  });

  it('light and dark colors meet WCAG AA (4.5:1) for every text/background pair, and dark mode, print and mobile styles exist', () => {
    for (const c of [MAP_COLORS.light, MAP_COLORS.dark]) {
      for (const fg of [c.text, c.muted, c.count, c.link]) for (const bg of [c.bg, c.panel, c.card]) expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    }
    const html = renderMapHtml(small);
    expect(html).toContain('@media (prefers-color-scheme:dark)');
    expect(html).toContain('@media print');
    expect(html).toContain('@media (max-width:40rem)');
    expect(html).toContain('min-height:44px');
  });

  it('empty roles are one line, and the fixed "모름" wording appears once at the top', () => {
    const html = renderMapHtml(small);
    expect(html).toContain('<strong>테스트 경로</strong>: 없음');
    expect(html).not.toContain('해당 역할로 분류된 파일이 없습니다');
    expect(html.match(/데이터 연결/g)?.length).toBe(1);
    expect(html.match(/통과했는지 몰라요/g)?.length).toBe(1);
    expect(html.indexOf('데이터 연결')).toBeLessThan(html.indexOf('<main>'));
    expect(html).toContain('내 메모: 할 일 앱');
  });

  it('same input, same bytes', () => {
    expect(renderMapHtml(map200())).toBe(renderMapHtml(map200()));
    expect(renderMapHtml(small.replace(/\n/g, '\r\n'))).toBe(renderMapHtml(small));
  });

  it('renders 2,000 files in under 50 ms', () => {
    const md = map2000Files();
    renderMapHtml(md);
    let best = Infinity;
    for (let i = 0; i < 5; i += 1) {
      const start = performance.now();
      renderMapHtml(md);
      best = Math.min(best, performance.now() - start);
    }
    expect(best).toBeLessThan(50);
  });
});
