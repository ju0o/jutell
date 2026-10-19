// .jutell-local/map.html: the same content as JuTellMap.md, as one self-contained page.
// No scripts, no links, no external requests (CSP default-src 'none'); every md byte is escaped.

export const MAP_HTML_FILE = 'map.html';

export function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const STYLE = 'body{font-family:system-ui,sans-serif;max-width:60rem;margin:2rem auto;padding:0 1rem;line-height:1.5}summary{font-weight:600;font-size:1.1rem;cursor:pointer}details{margin:.6rem 0}ul{margin:.2rem 0}.note{color:#555}';

/** Converts JuTellMap.md to HTML. Each "## " section can be folded and unfolded (<details>). */
export function renderMapHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const out: string[] = [];
  let title = 'JuTell 지도';
  let inSection = false;
  let inList = false;
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    if (line.startsWith('# ')) { title = line.slice(2); out.push(`<h1>${escapeHtml(title)}</h1>`); continue; }
    if (line.startsWith('## ')) {
      closeList();
      if (inSection) out.push('</details>');
      out.push(`<details open><summary>${escapeHtml(line.slice(3))}</summary>`);
      inSection = true;
      continue;
    }
    if (line.startsWith('- ')) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${escapeHtml(line.slice(2))}</li>`);
      continue;
    }
    closeList();
    out.push(`<p class="note">${escapeHtml(line)}</p>`);
  }
  closeList();
  if (inSection) out.push('</details>');
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
