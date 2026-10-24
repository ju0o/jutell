// W10: a deterministic JuTellMap.md with 200 features (2 files each, no tests), as a typical project map.
export function map200() {
  const lines = ['# JuTell 지도 — 이 프로젝트는 어떻게 생겼나요?', '', '마지막 갱신: 2026-10-24 20:00', ''];
  for (let i = 0; i < 200; i += 1) {
    const name = `기능 ${String(i).padStart(3, '0')}`;
    lines.push(`## ${name} [지도로 짐작]`, `<!-- jutell:auto ${name} -->`, `- src/feature${i}/Page${i}.tsx — 화면`, `- src/feature${i}/service${i}.ts — 기능`, '<!-- /jutell:auto -->', '');
  }
  return lines.join('\n');
}
