// Puts each file into a feature section and gives it a role, without AI (plan.md §1).

export const UNCLASSIFIED = '아직 분류 안 된 파일';
export const ESTIMATED_LABEL = '[지도로 짐작]';

/** Word dictionary: a whole word in a folder or file name (case-insensitive) → feature name. */
export const FEATURE_DICTIONARY: ReadonlyArray<{ feature: string; words: readonly string[] }> = [
  { feature: '로그인', words: ['auth', 'login', 'logout', 'signin', 'signup', 'signout', 'session', 'oauth', 'password'] },
  { feature: '결제', words: ['pay', 'payment', 'checkout', 'billing', 'invoice', 'stripe'] },
  // Feature names are kinds of features, never a page title ("할 일 목록" read like the page title and drifted when it changed).
  { feature: '할 일', words: ['todo', 'todos', 'task', 'tasks'] },
  { feature: '검색', words: ['search'] },
  { feature: '알림', words: ['notification', 'notifications', 'notify', 'alert', 'alerts'] },
  { feature: '프로필', words: ['profile', 'profiles', 'avatar'] },
  { feature: '관리자', words: ['admin'] },
  { feature: '장바구니', words: ['cart', 'basket'] },
];

/** Folders skipped when a folder name is used as the feature name (case-insensitive). */
export const GENERIC_FOLDERS = new Set(['src', 'lib', 'app', 'scripts', 'bin', 'tools', 'utils', 'util', 'helpers', 'common', 'shared', 'misc', 'internal', 'packages', 'apps']);

export type FileRole = '화면' | '기능' | '테스트' | '설정' | '문서';

export type Classified = {
  path: string;
  /** Feature section name; UNCLASSIFIED when nothing fits. */
  feature: string;
  /** True when the name came from a folder, not the dictionary: shown with ESTIMATED_LABEL. */
  estimated: boolean;
  role: FileRole;
};

const wordIndex = new Map<string, string>();
for (const entry of FEATURE_DICTIONARY) for (const word of entry.words) wordIndex.set(word, entry.feature);

function words(segment: string): string[] {
  return segment
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

export function featureOf(relative: string): { feature: string; estimated: boolean } {
  const parts = relative.split('/');
  // ① dictionary match on folder names and the file name
  for (const part of parts) {
    for (const word of words(part)) {
      const feature = wordIndex.get(word);
      if (feature) return { feature, estimated: false };
    }
  }
  // ② first folder that is not generic
  const folder = parts.slice(0, -1).find((part) => !GENERIC_FOLDERS.has(part.toLowerCase()));
  if (folder) return { feature: folder, estimated: true };
  // ③ root files and files directly under generic folders
  return { feature: UNCLASSIFIED, estimated: false };
}

const TEST_FOLDERS = new Set(['test', 'tests', '__tests__', 'spec', 'specs', 'e2e']);
const DOC_FOLDERS = new Set(['docs', 'doc']);
const SCREEN_FOLDERS = new Set(['components', 'pages', 'views', 'screens', 'ui', 'public', 'styles']);
const DOC_EXT = new Set(['md', 'mdx', 'txt', 'rst', 'adoc']);
const CONFIG_EXT = new Set(['json', 'yaml', 'yml', 'toml', 'ini', 'env', 'lock', 'cfg', 'conf']);
const SCREEN_EXT = new Set(['html', 'htm', 'css', 'scss', 'sass', 'less', 'tsx', 'jsx', 'vue', 'svelte', 'astro']);

export function roleOf(relative: string): FileRole {
  const parts = relative.toLowerCase().split('/');
  const name = parts[parts.length - 1];
  const folders = parts.slice(0, -1);
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';
  if (/\.(test|spec)\.[^.]+$/.test(name) || folders.some((folder) => TEST_FOLDERS.has(folder))) return '테스트';
  if (DOC_EXT.has(ext) || folders.some((folder) => DOC_FOLDERS.has(folder))) return '문서';
  if (CONFIG_EXT.has(ext) || name.startsWith('.') || /\.config\.[^.]+$/.test(name) || /^(dockerfile|makefile)$/.test(name)) return '설정';
  if (SCREEN_EXT.has(ext) || folders.some((folder) => SCREEN_FOLDERS.has(folder))) return '화면';
  return '기능';
}

export function classifyFile(relative: string): Classified {
  return { path: relative, ...featureOf(relative), role: roleOf(relative) };
}

/** Classifies every file; output order follows input order (scanProject already sorts). */
export function classifyFiles(files: readonly string[]): Classified[] {
  return files.map(classifyFile);
}
