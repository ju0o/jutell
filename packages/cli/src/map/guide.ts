// JuTellMap.md-only guide lines. They tell a reader how to edit the Markdown file, so map.html
// (read-only, human view) drops them.
export const MAP_GUIDE = '표와 목록은 JuTell이 자동으로 다시 채워요. 설명 글은 마음대로 고쳐도 되지만, 숨은 칸 표시(HTML 주석)는 지우지 마세요.';
export const UNCLASSIFIED_HELP = '설명: 아래 줄을 원하는 기능 칸으로 옮기면, 다음부터 그 칸에 둡니다.';
export const MARKDOWN_ONLY_LINES: ReadonlySet<string> = new Set([MAP_GUIDE, UNCLASSIFIED_HELP]);
