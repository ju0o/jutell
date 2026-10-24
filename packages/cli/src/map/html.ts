// .jutell-local/map.html: a compact path index with optional detail cards.
// No scripts or external requests; every map byte is escaped.

export const MAP_HTML_FILE = 'map.html';

export function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const STYLE = 'body{font-family:system-ui,sans-serif;max-width:68rem;margin:2rem auto;padding:0 1rem;line-height:1.5;color:#18212b}.count{display:block;color:#536171;font-size:.9rem;font-weight:400;margin-top:.15rem}.notice,.evidence,.note{color:#435160}.notice{background:#f2f6fa;padding:.8rem 1rem;border-radius:.5rem}details{border:1px solid #ccd5df;border-radius:.6rem;margin:.7rem 0;padding:.7rem 1rem}summary{font-weight:650;cursor:pointer;overflow-wrap:anywhere}.evidence{background:#f7f9fb;border-radius:.4rem;padding:.7rem 1rem;margin:.7rem 0}.evidence p{margin:.25rem 0}.files{margin:.4rem 0 .8rem;padding-left:1.4rem;overflow-wrap:anywhere}.files li{padding:.12rem 0}.note{font-size:.95rem;overflow-wrap:anywhere}';

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

function renderFiles(files: string[]) {
  if (!files.length) return '<p class="note">해당 역할로 분류된 파일이 없습니다.</p>';
  return `<ul class="files">${files.map((file) => `<li>${escapeHtml(file)}</li>`).join('')}</ul>`;
}

function renderSection(section: Section) {
  const counts = countsOf(section.files);
  const screens = section.files.filter((file) => roleOf(file) === '화면');
  const code = section.files.filter((file) => roleOf(file) === '기능');
  const tests = section.files.filter((file) => roleOf(file) === '테스트');
  const other = section.files.filter((file) => !['화면', '기능', '테스트'].includes(roleOf(file)));
  const details = [
    `<section class="evidence" aria-label="근거 카드: ${escapeHtml(section.title)}">`,
    '<p><strong>화면 경로</strong> · 파일명/폴더/확장자 기준 분류</p>', renderFiles(screens),
    '<p><strong>코드 경로</strong> · 파일명/폴더/확장자 기준 분류</p>', renderFiles(code),
    '<p><strong>테스트 경로</strong> · 지도에 적힌 경로; 현재 파일 존재/실행 결과 미확인</p>', renderFiles(tests),
    '<p><strong>데이터 연결</strong> · 미확인 — 현재 지도는 데이터 경로를 기능에 연결하지 않습니다.</p>',
    '<p><strong>동작 검증</strong> · 미확인 — 파일 목록은 실행 성공이나 테스트 통과를 증명하지 않습니다.</p>',
    ...(other.length ? ['<p><strong>기타 경로</strong></p>', renderFiles(other)] : []),
    ...section.notes.map((note) => `<p class="note">${escapeHtml(note)}</p>`),
    '</section>',
  ].join('\n');
  const summary = `${escapeHtml(section.title)}<span class="count">파일 ${section.files.length}개 · 화면 ${counts.screen} · 코드 ${counts.code} · 테스트 ${counts.tests} · 기타 ${counts.other}</span>`;
  return `<details><summary>${summary}</summary>${details}</details>`;
}

/** Converts JuTellMap.md into a compact index and collapsed detail cards. */
export function renderMapHtml(markdown: string): string {
  const { title, sections, headerNotes } = parseSections(markdown);
  const out = [
    `<h1>${escapeHtml(title)}</h1>`,
    '<p class="notice">이 지도는 파일 경로를 기준으로 묶은 안내입니다. 기능 이름과 역할은 지도 기준 추정이며, 화면·코드·데이터의 연결 및 실제 동작은 확인되지 않았습니다. 위 시각은 마지막 지도 갱신 시각입니다. 최신성은 jutell status에서 확인하세요.</p>',
    ...headerNotes.map((note) => `<p class="note">${escapeHtml(note)}</p>`),
    '<h2>파일 분류 인덱스 · 펼치면 경로와 확인 상태를 볼 수 있어요</h2>',
    ...sections.map(renderSection),
  ];
  return [
    '<!doctype html>',
    '<html lang="ko"><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title><style>${STYLE}</style></head><body>`,
    ...out,
    '</body></html>',
    '',
  ].join('\n');
}
