// .jutell-local/map.html: a compact path index with optional detail cards.
// No scripts or external requests; every map byte is escaped.

import { MARKDOWN_ONLY_LINES } from './guide.js';

export const MAP_HTML_FILE = 'map.html';

export function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Light and dark palettes. Every text/background pair here is checked for WCAG AA in tests/map-html.test.ts.
export const MAP_COLORS = {
  light: { bg: '#ffffff', text: '#18212b', muted: '#435160', count: '#536171', link: '#0b5cad', panel: '#f2f6fa', card: '#f7f9fb', border: '#ccd5df' },
  dark: { bg: '#11161c', text: '#e6edf3', muted: '#b4c0cc', count: '#a9b6c4', link: '#8cc4ff', panel: '#1b2430', card: '#161d26', border: '#3a4757' },
} as const;
const L = MAP_COLORS.light;
const D = MAP_COLORS.dark;

const STYLE = [
  `body{font-family:system-ui,sans-serif;max-width:68rem;margin:2rem auto;padding:0 1rem;line-height:1.5;color:${L.text};background:${L.bg}}`,
  `a{color:${L.link}}.count{display:block;color:${L.count};font-size:.9rem;font-weight:400;margin-top:.15rem}.notice,.evidence,.note{color:${L.muted}}`,
  `.notice{background:${L.panel};padding:.8rem 1rem;border-radius:.5rem}.notice p{margin:.3rem 0}`,
  `table{border-collapse:collapse;width:100%;margin:.5rem 0 1rem}th,td{text-align:left;padding:.35rem .5rem;border-bottom:1px solid ${L.border}}td:not(:first-child),th:not(:first-child){text-align:right}td a{display:inline-block;min-height:44px;line-height:44px;overflow-wrap:anywhere}`,
  `details{border:1px solid ${L.border};border-radius:.6rem;margin:.7rem 0;padding:.7rem 1rem}summary{font-weight:650;cursor:pointer;overflow-wrap:anywhere;min-height:44px}`,
  `.evidence{background:${L.card};border-radius:.4rem;padding:.7rem 1rem;margin:.7rem 0}.evidence p{margin:.25rem 0}.files{margin:.4rem 0 .8rem;padding-left:1.4rem;overflow-wrap:anywhere}.files li{padding:.12rem 0}.note{font-size:.95rem;overflow-wrap:anywhere}`,
  `@media (prefers-color-scheme:dark){body{color:${D.text};background:${D.bg}}a{color:${D.link}}.count{color:${D.count}}.notice,.evidence,.note{color:${D.muted}}.notice{background:${D.panel}}.evidence{background:${D.card}}details,th,td{border-color:${D.border}}}`,
  '@media (max-width:40rem){body{margin:1rem auto;padding:0 .75rem}details{padding:.6rem .75rem}.evidence{padding:.6rem .75rem}th,td{padding:.35rem .3rem}}',
  `@media print{body{max-width:none;margin:0;color:#000;background:#fff}a{color:#000;text-decoration:none}.notice,.evidence{background:none}details{break-inside:avoid;border-color:#888}details::details-content{content-visibility:visible;display:block}summary{min-height:0}td a{min-height:0;line-height:inherit}}`,
].join('');

/** Fixed wording shown once at the top instead of in every card (W10). */
const FIXED_UNKNOWN = '모든 기능 공통: <strong>데이터 연결</strong>은 모름 — 지도는 파일끼리 데이터가 어떻게 이어지는지 보지 않아요. <strong>동작</strong>도 모름 — 파일 목록만으로는 잘 동작하는지 알 수 없어요. <strong>테스트 경로</strong>는 지도에 적힌 파일이고, 테스트를 실행하지 않아 통과했는지 몰라요.';

type Section = { title: string; files: string[]; notes: string[] };
type Counts = { screen: number; code: number; tests: number; other: number };

function roleOf(line: string): string {
  const cut = line.lastIndexOf(' — ');
  return cut < 0 ? '' : line.slice(cut + 3);
}

function countsOf(files: string[]): Counts {
  const counts: Counts = { screen: 0, code: 0, tests: 0, other: 0 };
  for (const file of files) {
    const role = roleOf(file);
    if (role === '화면') counts.screen += 1;
    else if (role === '기능') counts.code += 1;
    else if (role === '테스트') counts.tests += 1;
    else counts.other += 1;
  }
  return counts;
}

function parseSections(markdown: string) {
  const lines = markdown.replace(/\r\n/g, '\n').replace(/<!--(?!\s*-->)[\s\S]*?-->/g, '').split('\n');
  let title = 'JuTell 지도';
  const sections: Section[] = [];
  let current: Section | undefined;
  const headerNotes: string[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    if (MARKDOWN_ONLY_LINES.has(line.trim())) continue;
    if (line.startsWith('# ')) { title = line.slice(2); continue; }
    if (line.startsWith('## ')) {
      current = { title: line.slice(3), files: [], notes: [] };
      sections.push(current);
      continue;
    }
    if (line.startsWith('- ')) {
      if (current) current.files.push(line.slice(2));
      continue;
    }
    if (current) current.notes.push(line);
    else headerNotes.push(line);
  }
  return { title, sections, headerNotes };
}

function renderRole(label: string, files: string[]) {
  // W10: an empty role is one line ("테스트 경로: 없음") instead of a heading plus a "no files" paragraph.
  if (!files.length) return `<p><strong>${label}</strong>: 없음</p>`;
  return `<p><strong>${label}</strong></p><ul class="files">${files.map((file) => `<li>${escapeHtml(file)}</li>`).join('')}</ul>`;
}

/** Card ids: deterministic, unique, from the feature title (letters and digits of any language kept). */
export function cardIds(titles: string[]) {
  const used = new Set<string>();
  return titles.map((title) => {
    const base = `f-${title.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'feature'}`;
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
    used.add(id);
    return id;
  });
}

function split(section: Section) {
  return {
    screens: section.files.filter((file) => roleOf(file) === '화면'),
    code: section.files.filter((file) => roleOf(file) === '기능'),
    tests: section.files.filter((file) => roleOf(file) === '테스트'),
    other: section.files.filter((file) => !['화면', '기능', '테스트'].includes(roleOf(file))),
  };
}

function renderSection(section: Section, id: string) {
  const { screens, code, tests, other } = split(section);
  const details = [
    '<div class="evidence">',
    renderRole('화면 경로', screens),
    renderRole('코드 경로', code),
    renderRole('테스트 경로', tests),
    ...(other.length ? [renderRole('기타 경로', other)] : []),
    ...section.notes.map((note) => `<p class="note">${escapeHtml(note)}</p>`),
    '</div>',
  ].join('');
  const summary = `${escapeHtml(section.title)}<span class="count">파일 ${section.files.length}개</span>`;
  return `<details id="${escapeHtml(id)}"><summary>${summary}</summary>${details}</details>`;
}

function renderOverview(sections: Section[], ids: string[]) {
  if (!sections.length) return '';
  const rows = sections.map((section, index) => {
    const counts = countsOf(section.files);
    return `<tr><td><a href="#${escapeHtml(ids[index])}">${escapeHtml(section.title)}</a></td><td>${section.files.length}</td><td>${counts.screen}</td><td>${counts.code}</td><td>${counts.tests}</td><td>${counts.other}</td></tr>`;
  });
  return [
    '<h2 id="overview">한눈에 보기</h2>',
    '<table><caption class="note">기능 이름을 누르면 그 기능 카드로 가요.</caption>',
    '<thead><tr><th scope="col">기능</th><th scope="col">파일</th><th scope="col">화면</th><th scope="col">코드</th><th scope="col">테스트</th><th scope="col">기타</th></tr></thead><tbody>',
    rows.join('\n'),
    '</tbody></table>',
  ].join('\n');
}

/** Converts JuTellMap.md into an overview table and collapsed detail cards (W10 Stage 1). */
export function renderMapHtml(markdown: string): string {
  const { title, sections, headerNotes } = parseSections(markdown);
  const ids = cardIds(sections.map((section) => section.title));
  const out = [
    `<header><h1>${escapeHtml(title)}</h1>`,
    '<div class="notice"><p>이 지도는 파일 경로를 기준으로 묶은 안내입니다. 기능 이름과 역할은 지도 기준 추정이며, 화면·코드·데이터의 연결 및 실제 동작은 확인되지 않았습니다. 아래 시각은 마지막 지도 갱신 시각입니다. 최신성은 jutell status에서 확인하세요.</p>',
    `<p>${FIXED_UNKNOWN}</p></div>`,
    ...headerNotes.map((note) => `<p class="note">${escapeHtml(note)}</p>`),
    '</header><main>',
    renderOverview(sections, ids),
    '<h2 id="cards">기능별 파일 목록 · 펼치면 경로를 볼 수 있어요</h2>',
    ...sections.map((section, index) => renderSection(section, ids[index])),
    '</main>',
  ];
  return [
    '<!doctype html>',
    '<html lang="ko"><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta name="color-scheme" content="light dark">`,
    `<title>${escapeHtml(title)}</title><style>${STYLE}</style></head><body>`,
    ...out,
    '</body></html>',
    '',
  ].join('\n');
}
