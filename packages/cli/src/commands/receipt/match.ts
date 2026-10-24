// Request matching (plan.md §2, W6): deterministic code, no AI.
// Each `asked` item is matched to map features by words; then we look at whether that feature's files changed (Git).
import { ESTIMATED_LABEL, FEATURE_DICTIONARY, UNCLASSIFIED } from '../../map/classify.js';

export type MapSection = { key: string; name: string; files: string[] };

export type MatchItem =
  // `before`: feature files that were already changed before the work (W7). Shown, but never counted as a change.
  | { status: 'changed'; features: string[]; files: string[]; before?: string[] }
  | { status: 'unchanged'; features: string[]; before?: string[] }
  | { status: 'unplaced' };

export type ReceiptMatch =
  | { map: false }
  | { map: true; items: MatchItem[]; extra: string[]; extraBefore?: string[] };

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

function mentions(request: string, word: string): boolean {
  const text = request.toLowerCase();
  if (/^[a-z0-9 _-]+$/.test(word)) return new RegExp(`(^|[^a-z0-9])${word.replace(/[-_ ]/g, '[-_ ]?')}([^a-z0-9]|$)`).test(text);
  return text.includes(word);
}

/** Features a request talks about (by map section name, key, or dictionary words). */
export function featuresFor(request: string, sections: MapSection[]): MapSection[] {
  return sections.filter((section) => candidates(section).some((word) => mentions(request, word)));
}

export function matchRequests(asked: string[], changed: string[], sections: MapSection[], beforeWork: string[] = []): ReceiptMatch {
  const changedSet = new Set(changed);
  const beforeSet = new Set(beforeWork.filter((file) => changedSet.has(file)));
  const claimed = new Set<string>();
  const items = asked.map((request): MatchItem => {
    const matched = featuresFor(request, sections);
    if (!matched.length) return { status: 'unplaced' };
    const featureFiles = new Set(matched.flatMap((section) => section.files));
    for (const file of featureFiles) claimed.add(file);
    const inFeature = changed.filter((file) => featureFiles.has(file));
    const files = inFeature.filter((file) => !beforeSet.has(file));
    const before = inFeature.filter((file) => beforeSet.has(file));
    const features = matched.map((section) => section.name);
    const withBefore = before.length ? { before } : {};
    return files.length ? { status: 'changed', features, files, ...withBefore } : { status: 'unchanged', features, ...withBefore };
  });
  const outside = [...changedSet].filter((file) => !claimed.has(file));
  const extra = outside.filter((file) => !beforeSet.has(file));
  const extraBefore = outside.filter((file) => beforeSet.has(file));
  return { map: true, items, extra, ...(extraBefore.length ? { extraBefore } : {}) };
}
