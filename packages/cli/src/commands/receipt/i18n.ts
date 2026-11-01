import { ESTIMATED_LABEL } from '../../map/classify.js';

/**
 * Receipt i18n (v2.3.0): the receipt's fixed labels, headings and JuTell's own
 * note lines come from one dictionary per locale. Everything the AI writes
 * (requests, done items, checks, recommendations) is passed through as data and
 * is never translated here.
 *
 * Locale choice (`resolveReceiptLocale`): an explicit option wins, then
 * `JUTELL_LANG` / `JUTELL_LOCALE` / `LC_ALL` / `LANG`. Korean stays the default:
 * an unset or non-English locale renders the exact same Korean receipt as
 * before, and under vitest (`VITEST` set) the environment variables are ignored
 * so the existing Korean test snapshots hold on any machine.
 */

export type ReceiptLocale = 'ko' | 'en';

export type ReceiptLabels = {
  /** The banner title line (rendered with two leading spaces). */
  header: string;
  /** Title of the saved Markdown report file. */
  markdownTitle: string;
  /** [요청 대조] / [Request Check], [이번에 한 작업] / [Work Done], [바뀐 파일] / [Changed Files], [확인] / [Verification], [다음 추천] / [Next Steps]. */
  sections: readonly string[];
  /** The three [다음 추천] group headings. */
  nextGroups: readonly string[];
  nothingNextLine: string;
  defaultSummary: string;
  summaryPrefix: string;
  labelGit: string;
  labelAI: string;
  labelJuTell: string;
  /** Map-guess marker ([지도로 짐작]); the same label the map itself prints. */
  labelEstimate: string;
  labelMatch: string;
  labelCheckMixed: string;
  hanjaNote: string;
  aiResultsNote: string;
  noMapMatch: string;
  /** The [요청 대조] note when the changed files could not be read at all. */
  filesUnknownMatchNote: string;
  saysButNoFiles: string;
  beforeWorkMark: string;
  saveLine: string;
  noneItem: string;
  filesUnknownLine: (reason: string) => string;
  verifiedItem: string;
  notVerifiedItem: string;
  verifiedNone: string;
  notVerifiedNone: string;
  /** Tail for request overflow counts (' 외 N개'). */
  askedMore: (count: number) => string;
  /** Tail when the changed-file list was cut at 8. */
  moreFiles: (count: number) => string;
  /** Tail for shortList(). */
  moreItems: (count: number) => string;
  /** The [요청 대조] count line, up to (not including) its source label. */
  matchSummary: (asked: number, parts: string[]) => string;
  matchChanged: (count: number) => string;
  matchUnchanged: (count: number) => string;
  matchUnplaced: (count: number) => string;
  itemChanged: string;
  itemUnchanged: (features: string) => string;
  itemUnplaced: string;
  viaContext: string;
  viaSensitive: string;
  /** `[Git 기준 · 지도: X]` / `[Git Verified · map: X]` */
  viaGitMap: (features: string) => string;
  /** `[Git 기준 · 파일 이름으로 찾음]` / `[Git Verified · matched by file name]` */
  viaGitFileName: string;
  beforeFilesLine: string;
  sensitiveChanged: (list: string) => string;
  extraChanged: string;
  extraBeforeLine: string;
  /** The ` · 요청 N개 중 M개 처리` tail on the one-line summary. */
  summaryCount: (asked: number, handled: number) => string;
  /** The ' 외 N건' tail when the AI summary falls back to the first done item. */
  doneMore: (count: number) => string;
  /** JuTell's own [확인] gap lines (normalizeReceipt); never the AI's words. */
  gapNoDone: string;
  gapNoChecks: string;
  gapBadInput: string;
};

const ko: ReceiptLabels = {
  header: '  JuTell 작업 영수증',
  markdownTitle: '# JuTell 작업 영수증',
  sections: ['[요청 대조]', '[이번에 한 작업]', '[바뀐 파일]', '[확인]', '[다음 추천]'],
  nextGroups: [' ▶ 계속', ' ○ 추천', ' ■ 여기서 멈춰도 됨'],
  nothingNextLine: ' 여기서 멈춰도 됩니다 – 따로 추천할 다음 작업이 없어요',
  defaultSummary: 'AI가 작업 설명을 주지 않아 Git이 본 변경만 적었어요.',
  summaryPrefix: '한 줄 요약: ',
  labelGit: '[Git 기준]',
  labelAI: '[AI가 적음]',
  labelJuTell: '[JuTell이 적음]',
  labelEstimate: ESTIMATED_LABEL,
  labelMatch: '[Git 기준 · 지도 대조]',
  labelCheckMixed: '[AI가 적음 · JuTell이 적은 줄은 따로 표시]',
  hanjaNote: ' ⓘ AI가 적은 글에 한자가 섞여 있어요. 뜻이 헷갈리면 AI에게 쉬운 우리말로 다시 써 달라고 하세요  [JuTell이 적음]',
  aiResultsNote: ' ⓘ 위 테스트·명령 결과는 AI가 알려 준 내용이에요. JuTell이 직접 돌려 보지는 않았어요  [JuTell이 적음]',
  noMapMatch: '지도가 없어 장소 대조는 못 했어요',
  filesUnknownMatchNote: '바뀐 파일을 확인하지 못해 대조는 못 했어요',
  saysButNoFiles: ' ⚠ 말과 실제가 달라요: 한 일은 적혀 있는데 바뀐 파일이 없어요',
  beforeWorkMark: '(작업 전부터)',
  saveLine: ' 저장됨: ',
  noneItem: ' 없음',
  filesUnknownLine: (reason) => ` 확인 못 함 (${reason})`,
  verifiedItem: ' ✔ 직접 확인한 것: ',
  notVerifiedItem: ' ✖ 확인 못 한 것: ',
  verifiedNone: ' ✔ 직접 확인한 것: 없음',
  notVerifiedNone: ' ✖ 확인 못 한 것: 없음',
  askedMore: (count) => ` 외 ${count}개`,
  moreFiles: (count) => ` 외 ${count}개`,
  moreItems: (count) => ` 외 ${count}개`,
  matchSummary: (asked, parts) => `요청 ${asked}개 중 ${parts.join(' · ')}`,
  matchChanged: (count) => `${count}개 바뀐 곳 있음`,
  matchUnchanged: (count) => `${count}개 바뀐 곳 없음`,
  matchUnplaced: (count) => `${count}개 장소 못 찾음`,
  itemChanged: '    → 바뀐 곳 있음: ',
  itemUnchanged: (features) => `    → 바뀐 곳 없음: '${features}' 파일이 바뀌지 않았어요`,
  itemUnplaced: '    → 장소를 못 찾았어요(지도에 맞는 기능이 없어요)',
  viaContext: '[추정 · AI 설명 기준]',
  viaSensitive: '[Git 기준 · 요청에 적힌 민감 파일]',
  viaGitMap: (features) => `[Git 기준 · 지도: ${features}]`,
  viaGitFileName: '[Git 기준 · 파일 이름으로 찾음]',
  beforeFilesLine: '바뀌어 있던 파일:',
  sensitiveChanged: (list) => ` ⚠ 민감 파일 바뀜: ${list} (요청에 적혀 있음 · AI가 적음)`,
  extraChanged: ' ⚠ 요청에 없던 곳도 바뀜: ',
  extraBeforeLine: ' 바뀌어 있던 요청 밖 파일: ',
  summaryCount: (asked, handled) => ` · 요청 ${asked}개 중 ${handled}개 처리  [Git 기준]`,
  doneMore: (count) => ` 외 ${count}건`,
  gapNoDone: '한 일 목록이 비어 있었어요',
  gapNoChecks: '확인한 내용을 받지 못했어요',
  gapBadInput: '입력을 읽지 못했어요',
};

const en: ReceiptLabels = {
  header: '  JuTell Work Receipt',
  markdownTitle: '# JuTell Work Receipt',
  sections: ['[Request Check]', '[Work Done]', '[Changed Files]', '[Verification]', '[Next Steps]'],
  nextGroups: [' ▶ Keep going', ' ○ Recommended', ' ■ Safe to stop here'],
  nothingNextLine: " Safe to stop here – there is nothing else to recommend",
  defaultSummary: 'The AI gave no work summary, so only the changes Git saw are listed.',
  summaryPrefix: 'Summary: ',
  labelGit: '[Git Verified]',
  labelAI: '[AI Claimed]',
  labelJuTell: '[JuTell Note]',
  labelEstimate: '[Map guess]',
  labelMatch: '[Git Verified · Map Check]',
  labelCheckMixed: "[AI Claimed · JuTell's own lines shown separately]",
  hanjaNote: " ⓘ The AI's text mixes in Hanja (Chinese characters). If that is confusing, ask the AI to rewrite it in plain words  [JuTell Note]",
  aiResultsNote: " ⓘ The test and command results above were reported by the AI. JuTell did not run them itself  [JuTell Note]",
  noMapMatch: 'No project map was available, so the requests could not be checked against it',
  filesUnknownMatchNote: 'Could not read the changed files, so the requests were not checked against Git',
  saysButNoFiles: ' ⚠ Words and reality differ: work is written down, but Git shows no changed files',
  beforeWorkMark: '(pre-existing)',
  saveLine: ' Saved to: ',
  noneItem: ' none',
  filesUnknownLine: (reason) => ` Could not check (${reason})`,
  verifiedItem: ' ✔ Verified directly: ',
  notVerifiedItem: ' ✖ Not verified: ',
  verifiedNone: ' ✔ Verified directly: none',
  notVerifiedNone: ' ✖ Not verified: none',
  askedMore: (count) => ` (+${count} more)`,
  moreFiles: (count) => ` and ${count} more`,
  moreItems: (count) => ` and ${count} more`,
  matchSummary: (asked, parts) => `${asked} request${asked === 1 ? '' : 's'}: ${parts.join(' · ')}`,
  matchChanged: (count) => `${count} changed`,
  matchUnchanged: (count) => `${count} unchanged`,
  matchUnplaced: (count) => `${count} not placed`,
  itemChanged: '    → changed: ',
  itemUnchanged: (features) => `    → unchanged: no file for '${features}' was changed`,
  itemUnplaced: '    → could not place it (no map feature matches this request)',
  viaContext: "[Guessed · from the AI's description]",
  viaSensitive: '[Git Verified · sensitive file named in the request]',
  viaGitMap: (features) => `[Git Verified · map: ${features}]`,
  viaGitFileName: '[Git Verified · matched by file name]',
  beforeFilesLine: 'files already changed before the work:',
  sensitiveChanged: (list) => ` ⚠ Sensitive file changed: ${list} (named in the request · [AI Claimed])`,
  extraChanged: ' ⚠ Changed outside the request: ',
  extraBeforeLine: ' already-changed files outside the request: ',
  summaryCount: (asked, handled) => ` · ${handled} of ${asked} requests handled  [Git Verified]`,
  doneMore: (count) => ` and ${count} more`,
  gapNoDone: 'The work list was empty',
  gapNoChecks: 'No verified checks were received',
  gapBadInput: 'The input could not be read',
};

export const RECEIPT_LABELS: Record<ReceiptLocale, ReceiptLabels> = { ko, en };

export function receiptLabelsFor(locale: ReceiptLocale): ReceiptLabels {
  return locale === 'en' ? en : ko;
}

/**
 * Locale resolution: an explicit option wins, then JUTELL_LANG, JUTELL_LOCALE,
 * LC_ALL and LANG. Anything that does not clearly start with `en` falls back to
 * Korean (including `C` / `C.UTF-8`), and under vitest the environment is
 * ignored entirely so the existing Korean test snapshots hold on any machine.
 */
export function resolveReceiptLocale(explicit?: string): ReceiptLocale {
  const testEnvironment = process.env.VITEST !== undefined || process.env.NODE_ENV === 'test';
  const sources = [explicit];
  if (!testEnvironment) sources.push(process.env.JUTELL_LANG, process.env.JUTELL_LOCALE, process.env.LC_ALL, process.env.LANG);
  for (const source of sources) {
    if (typeof source !== 'string' || source.length === 0) continue;
    const value = source.toLowerCase();
    if (value.startsWith('en')) return 'en';
    if (value.startsWith('ko')) return 'ko';
  }
  return 'ko';
}
