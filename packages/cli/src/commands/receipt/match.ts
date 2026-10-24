// Request matching (plan.md §2, W6): deterministic code, no AI.
// Each `asked` item is matched to map features by words; then we look at whether that feature's files changed (Git).
import { ESTIMATED_LABEL, FEATURE_DICTIONARY, UNCLASSIFIED } from '../../map/classify.js';

export type MapSection = { key: string; name: string; files: string[] };

export type MatchItem =
  // `before`: feature files that were already changed before the work (W7). Shown, but never counted as a change.
  // `via`: how the files were tied when the request's own map words did not ('file' = the user's request
  // names the file; 'context' = map area guessed from the AI's work list/summary, shown as an estimate).
  | { status: 'changed'; features: string[]; files: string[]; before?: string[]; via?: 'file' | 'context' }
  | { status: 'unchanged'; features: string[]; before?: string[] }
  | { status: 'unplaced' };

export type ReceiptMatch =
  | { map: false }
  // `extraAreas`: map area ID (`f-…`, as in `jutell map --show`) of each extra file the map lists.
  | { map: true; items: MatchItem[]; extra: string[]; sensitiveNamed?: string[]; extraBefore?: string[]; extraAreas?: Record<string, string> };

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
 * Files that are always '⚠ 요청에 없던 곳' when the work changed them, whatever any matching says (review
 * #37 rule 1): secrets, dependencies and lockfiles, CI, agent instructions/settings, container builds.
 */
const SENSITIVE = /(^|\/)(\.env[^/]*|[^/]*\.(pem|key|p12|pfx)|[^/]*secrets?[^/]*|package\.json|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|AGENTS\.md|CLAUDE\.md|\.jutell\.json|\.beginner-bridge\.json|Dockerfile[^/]*|docker-compose[^/]*)$|(^|\/)(\.github\/workflows|\.gitlab-ci\.yml|\.circleci|\.codex|\.claude)(\/|$)/i;
export function isSensitiveFile(file: string): boolean {
  return SENSITIVE.test(file);
}

const LOCKFILE = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$/i;
/** Sensitive files the user's request names directly: the full file name/path, or a dependency (package.json + lockfiles). */
export function sensitiveNamedIn(request: string, files: string[], dependencies: string[]): string[] {
  const lower = request.toLowerCase();
  const namesDependency = dependencies.some((name) => name.length >= 2 && mentions(lower, name.toLowerCase()));
  return files.filter((file) => {
    const full = file.toLowerCase();
    const base = full.split('/').pop() ?? full;
    if (lower.includes(full) || mentions(lower, base)) return true;
    return namesDependency && (base === 'package.json' || LOCKFILE.test(full));
  });
}

const folder = (file: string) => (file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '');

/**
 * Matches each request to the changed files (review #37 rules 1-4):
 * - map words in the user's request, then file names the user's request mentions;
 * - with one request and no place yet, map words from the AI's work list/summary, labelled as an estimate
 *   (AI text never ties a file by name, so it can never remove a warning);
 * - a matched request also takes changed files in the same folder as a file it already has;
 * - sensitive files (isSensitiveFile) ALWAYS stay '⚠': `asked` is AI-written, so naming a file there never links it
 *   (Reviewer B1 #37). A named one moves to its own '⚠ 민감 파일 바뀜 … (요청에 적혀 있음 · AI가 적음)' line.
 */
export function matchRequests(asked: string[], changed: string[], sections: MapSection[], beforeWork: string[] = [], context: string[] = [], dependencies: string[] = []): ReceiptMatch {
  const changedSet = new Set(changed);
  const beforeSet = new Set(beforeWork.filter((file) => changedSet.has(file)));
  const sensitive = new Set(changed.filter((file) => isSensitiveFile(file) && !beforeSet.has(file)));
  const claimed = new Set<string>();
  const linked = new Set<string>();
  // File names/paths are cut out of the AI text first: AI text never ties a file by its name (rule 4).
  const contextText = context.join('\n').replace(/[\w./@-]*(\/|\.[a-z0-9]{1,8}\b)[\w./@-]*/gi, ' ');
  const items = asked.map((request): MatchItem => {
    let matched = featuresFor(request, sections);
    const named = filesNamedIn(request, changed).filter((file) => !sensitive.has(file));
    const ownSensitive = sensitiveNamedIn(request, [...sensitive], dependencies);
    for (const file of ownSensitive) linked.add(file);
    let fromContext = false;
    if (!matched.length && !named.length && asked.length === 1) {
      matched = featuresFor(contextText, sections);
      fromContext = matched.length > 0;
    }
    if (!matched.length && !named.length) return { status: 'unplaced' };
    const featureFiles = new Set([...matched.flatMap((section) => section.files), ...named]);
    const own = changed.filter((file) => featureFiles.has(file) && !sensitive.has(file));
    // Same folder as a file this request already has (not the project root, not sensitive files).
    const folders = new Set(own.filter((file) => !sensitive.has(file)).map(folder).filter(Boolean));
    const near = changed.filter((file) => !featureFiles.has(file) && !sensitive.has(file) && !beforeSet.has(file) && folders.has(folder(file)));
    for (const file of [...featureFiles, ...near]) if (!sensitive.has(file)) claimed.add(file);
    const inFeature = [...own, ...near];
    const files = inFeature.filter((file) => !beforeSet.has(file));
    const before = inFeature.filter((file) => beforeSet.has(file));
    const features = matched.map((section) => section.name);
    const withBefore = before.length ? { before } : {};
    const via = fromContext ? { via: 'context' as const } : features.length ? {} : { via: 'file' as const };
    return files.length ? { status: 'changed', features, files, ...withBefore, ...via } : features.length ? { status: 'unchanged', features, ...withBefore } : { status: 'unplaced' };
  });
  const extra = changed.filter((file) => (sensitive.has(file) && !linked.has(file)) || (!sensitive.has(file) && !claimed.has(file) && !beforeSet.has(file)));
  const sensitiveNamed = [...linked];
  const extraBefore = [...changedSet].filter((file) => !claimed.has(file) && beforeSet.has(file));
  return { map: true, items, extra, ...(sensitiveNamed.length ? { sensitiveNamed } : {}), ...(extraBefore.length ? { extraBefore } : {}) };
}
