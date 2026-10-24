// Request matching (plan.md §2, W6): deterministic code, no AI.
// Each `asked` item is matched to map features by words; then we look at whether that feature's files changed (Git).
import { ESTIMATED_LABEL, FEATURE_DICTIONARY, UNCLASSIFIED } from '../../map/classify.js';

export type MapSection = { key: string; name: string; files: string[] };

export type MatchItem =
  // `before`: feature files that were already changed before the work (W7). Shown, but never counted as a change.
  // `via`: how the files were tied to the request when the map area alone could not ('file' = the request or
  // the work list names the file; 'only' = the only request, so every changed file belongs to it).
  | { status: 'changed'; features: string[]; files: string[]; before?: string[]; via?: 'file' | 'only' }
  | { status: 'unchanged'; features: string[]; before?: string[] }
  | { status: 'unplaced' };

export type ReceiptMatch =
  | { map: false }
  // `extraAreas`: map area ID (`f-…`, as in `jutell map --show`) of each extra file the map lists.
  | { map: true; items: MatchItem[]; extra: string[]; extraBefore?: string[]; extraAreas?: Record<string, string> };

const OPEN = /^<!-- jutell:auto (.+) -->$/;

/** Sections of JuTellMap.md as the user sees them now (moved lines and renamed headings included). */
export function readMapSections(markdown: string): MapSection[] {
  const sections: MapSection[] = [];
  let current: MapSection | undefined;
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (line.startsWith('## ')) {
      current = { key: '', name: line.slice(3).replace(ESTIMATED_LABEL, '').trim(), files: [] };
      sections.push(current);
      continue;
    }
    if (!current) continue;
    const opened = OPEN.exec(line.trim());
    if (opened && !current.key) { current.key = opened[1]; continue; }
    if (line.startsWith('- ')) {
      const cut = line.lastIndexOf(' — ');
      if (cut > 2) current.files.push(line.slice(2, cut));
    }
  }
  return sections.filter((section) => section.name !== UNCLASSIFIED && section.key !== '분류 안 됨');
}

function candidates(section: MapSection): string[] {
  const names = [section.key, section.name].filter(Boolean);
  const entry = FEATURE_DICTIONARY.find((item) => names.includes(item.feature));
  return [...new Set([...names, ...(entry ? [...entry.words, ...entry.ko] : [])].map((word) => word.toLowerCase()).filter((word) => word.length >= 2))];
}

// After a Korean word, the rest of the same word may only be a particle or a 하다/되다 ending
// ('결제를', '계산하기'); anything else means it is part of another word ('계산기', '결제창').
const KO_TAIL = /^(?:은|는|이|가|을|를|에|의|도|만|과|와|로|으로|랑|이랑|까지|부터|처럼|보다|하|해|했|한|할|함|되|돼|됐|된|될|됨|에서|에게|한테|이나|나)/;
const HANGUL = /[가-힣]/;

function mentions(request: string, word: string): boolean {
  const text = request.toLowerCase();
  if (/^[a-z0-9 _-]+$/.test(word)) return new RegExp(`(^|[^a-z0-9])${word.replace(/[-_ ]/g, '[-_ ]?')}([^a-z0-9]|$)`).test(text);
  for (let at = text.indexOf(word); at >= 0; at = text.indexOf(word, at + 1)) {
    const before = text[at - 1];
    if (before && HANGUL.test(before) && HANGUL.test(word[0])) continue;
    const rest = /^[가-힣]*/.exec(text.slice(at + word.length))?.[0] ?? '';
    if (!HANGUL.test(word.at(-1) ?? '') || rest === '' || KO_TAIL.test(rest)) return true;
  }
  return false;
}

/** Features a request talks about (by map section name, key, or dictionary words). */
export function featuresFor(request: string, sections: MapSection[]): MapSection[] {
  return sections.filter((section) => candidates(section).some((word) => mentions(request, word)));
}

/** Changed files a text names directly: by path, file name, or file name without extension (3+ letters). */
export function filesNamedIn(text: string, changed: string[]): string[] {
  const lower = text.toLowerCase();
  return changed.filter((file) => {
    const full = file.toLowerCase();
    const base = full.split('/').pop() ?? full;
    const stem = base.replace(/\.[a-z0-9]+$/, '');
    return lower.includes(full) || mentions(lower, base) || (stem.length >= 3 && /^[a-z0-9_-]+$/.test(stem) && mentions(lower, stem));
  });
}

/**
 * Matches each request to the changed files. The AI's own `asked` wording is not the only input
 * (dogfood #37: '페이지의 탭 이름과 큰 제목을 바꾸기' left out '할 일', so the requested todo.html became
 * '요청에 없던 곳'): `context` (the work list and summary) and the file names are used too, and with a
 * single request every changed file belongs to it.
 */
export function matchRequests(asked: string[], changed: string[], sections: MapSection[], beforeWork: string[] = [], context: string[] = []): ReceiptMatch {
  const changedSet = new Set(changed);
  const beforeSet = new Set(beforeWork.filter((file) => changedSet.has(file)));
  const claimed = new Set<string>();
  const contextText = context.join('\n');
  const items = asked.map((request): MatchItem => {
    let matched = featuresFor(request, sections);
    const named = filesNamedIn(request, changed);
    // Only one request: the work list describes that same request, so its words count too.
    if (!matched.length && !named.length && asked.length === 1) {
      matched = featuresFor(contextText, sections);
      named.push(...filesNamedIn(contextText, changed));
    }
    if (!matched.length && !named.length) return { status: 'unplaced' };
    const featureFiles = new Set([...matched.flatMap((section) => section.files), ...named]);
    for (const file of featureFiles) claimed.add(file);
    const inFeature = changed.filter((file) => featureFiles.has(file));
    const files = inFeature.filter((file) => !beforeSet.has(file));
    const before = inFeature.filter((file) => beforeSet.has(file));
    const features = matched.map((section) => section.name);
    const withBefore = before.length ? { before } : {};
    const via = features.length ? {} : { via: 'file' as const };
    return files.length ? { status: 'changed', features, files, ...withBefore, ...via } : features.length ? { status: 'unchanged', features, ...withBefore } : { status: 'unplaced' };
  });
  let outside = [...changedSet].filter((file) => !claimed.has(file) && !beforeSet.has(file));
  // A single request that found no place: the changed files are its work, not '요청에 없던 곳'.
  if (asked.length === 1 && items[0].status === 'unplaced' && outside.length) {
    items[0] = { status: 'changed', features: [], files: outside, via: 'only' };
    outside = [];
  }
  const extraBefore = [...changedSet].filter((file) => !claimed.has(file) && beforeSet.has(file));
  return { map: true, items, extra: outside, ...(extraBefore.length ? { extraBefore } : {}) };
}
