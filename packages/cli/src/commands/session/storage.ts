import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SessionMeta } from './types.js';

export const SESSION_FOLDER_BASE = 'collaboration-sessions';
export const SESSION_META_FILE = 'session.json';
export const SESSION_SUMMARY_FILE = 'SESSION_SUMMARY.md';

export function sessionRoot(dataRoot: string) {
  return path.join(dataRoot, SESSION_FOLDER_BASE);
}

export function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function todayStamp(now = new Date()) {
  const p = pad2;
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

// 레거시 단일 파일 기록: .jutell-local/collaboration-sessions/YYYY-MM-DD-session-NN.md
// 이동·변환·삭제하지 않으며 참고 안내에만 사용한다.
export function listLegacyFlatFiles(sessionRootDir: string, stamp: string): Promise<string[]> {
  return fs.readdir(sessionRootDir).then((entries) =>
    entries
      .filter((entry) => new RegExp(`^${stamp}-session-\\d+\\.md$`).test(entry))
      .sort(),
  ).catch(() => []);
}

export function isValidPageFile(file: string) {
  return /^page-\d+-.+\.md$/.test(file);
}

// date 폴더 안 Page 파일 목록을 page-번호 순서로 정렬한 {number, file}
export async function listPageFiles(dir: string): Promise<Array<{ number: number; file: string }>> {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const pages = entries
    .filter(isValidPageFile)
    .map((file) => {
      const match = /^page-(\d+)-(.+)\.md$/.exec(file);
      return match ? { number: Number(match[1]), file, slug: match[2] } : null;
    })
    .filter((entry): entry is { number: number; file: string; slug: string } => entry !== null);
  pages.sort((a, b) => a.number - b.number);
  return pages;
}

// 오늘 Session이 상태로 있는지 (session.json 존재)
export async function sessionExists(dir: string): Promise<boolean> {
  try {
    await fs.access(path.join(dir, SESSION_META_FILE));
    return true;
  } catch {
    return false;
  }
}

export async function readSessionMeta(dir: string): Promise<SessionMeta | null> {
  const file = path.join(dir, SESSION_META_FILE);
  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SessionMeta>;
    if (typeof parsed.date !== 'string') throw new Error('date 누락');
    const pages = Array.isArray(parsed.pages) ? parsed.pages : [];
    return {
      date: parsed.date,
      status: parsed.status === 'finished' ? 'finished' : 'active',
      currentPage: typeof parsed.currentPage === 'number' ? parsed.currentPage : null,
      pages: pages.filter(
        (page): page is SessionMeta['pages'][number] =>
          typeof page === 'object' &&
          typeof page.number === 'number' &&
          typeof page.agent === 'string' &&
          typeof page.role === 'string' &&
          typeof page.title === 'string' &&
          typeof page.file === 'string',
      ),
    };
  } catch {
    throw new Error(`session.json을 읽지 못했습니다(손상). 파일을 지우지 않고 중단합니다: ${file}`);
  }
}

// 원자적 저장: 임시 파일에 쓴 뒤 이름을 바꾼다. 손상된 기존 파일은 덮어쓰지 않는다.
export async function saveSessionMeta(dir: string, meta: SessionMeta): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, SESSION_META_FILE);
  const existing = await readSessionMeta(dir);
  if (existing && existing.date !== meta.date) {
    throw new Error(`session.json 날짜가 다릅니다. 병합하지 않습니다: ${file}`);
  }
  const tmp = path.join(dir, `${SESSION_META_FILE}.tmp`);
  await fs.writeFile(tmp, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  await fs.rename(tmp, file);
}

export function createInitialMeta(date: string): SessionMeta {
  return { date, status: 'active', currentPage: null, pages: [] };
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function pageFileName(page: { number: number; agent: string; title: string }): string {
  const agent = slugify(page.agent) || 'agent';
  const title = slugify(page.title);
  return `page-${pad2(page.number)}-${agent}${title ? `-${title}` : ''}.md`;
}

export function pageLabel(page: { number: number; agent: string; title: string }) {
  return `Page ${pad2(page.number)} — ${page.agent} / ${page.title}`;
}

export function parseFileNameTitle(file: string) {
  // page-01-opencode-jutell-report-style.md → 부분 타이틀(slug)만 복원
  const match = /^page-\d+-(.+?)\.md$/.exec(file);
  return match ? match[1] : file;
}

// Page 파일 안의 작업 번호 목록 (중복 없이 최대값 + 1 반환)
export function nextWorkNumber(content: string): number {
  const numbers = Array.from(content.matchAll(/^## 작업 (\d+)\s*$/gm), (match) => Number(match[1]));
  return (numbers.length > 0 ? Math.max(...numbers) : 0) + 1;
}

// Page 01을 처음 만들었을 때 같이 넣는 작업 01 블록
export function workTemplate(workNumber: number) {
  const p = pad2(workNumber);
  return [
    `## 작업 ${p}`,
    '',
    '### ChatGPT',
    '',
    '-',
    '',
    '### Agent 답변',
    '',
    '-',
    '',
    '### 내 피드백',
    '',
    '좋았던 점',
    '',
    '-',
    '',
    '불편했던 점',
    '',
    '-',
    '',
    '나라면 이렇게 말할 것 같다',
    '',
    '-',
    '',
    'JuTell 개선 아이디어',
    '',
    '-',
    '',
    '오늘의 발견',
    '',
    '-',
  ].join('\n');
}

export function pageTemplate(page: SessionMeta['pages'][number], date: string) {
  return [
    `# ${pageLabel(page)}`,
    '',
    `- Date: ${date}`,
    `- Agent: ${page.agent}`,
    `- 역할: ${page.role}`,
    '- 상태: 진행 중',
    '',
    '---',
    '',
    workTemplate(1),
    '',
  ].join('\n');
}

export function summaryTemplate(date: string, pages: SessionMeta['pages'][number][]) {
  const pageLines = pages.length > 0 ? pages.map((page) => `- ${pageLabel(page)}`) : ['- (Page 없음)'];
  return [
    '# Session Summary',
    '',
    `Date: ${date}`,
    '',
    '## 오늘 Page',
    '',
    ...pageLines,
    '',
    '## 오늘 가장 좋았던 점',
    '',
    '-',
    '',
    '## 오늘 가장 불편했던 점',
    '',
    '-',
    '',
    '## 오늘의 핵심 발견',
    '',
    '-',
    '',
    '## Agent별 차이',
    '',
    '-',
    '',
    '## JuTell에 반영할 후보',
    '',
    '-',
    '',
    '## 다음 Session에서 가장 먼저 할 일',
    '',
    '-',
    '',
  ].join('\n');
}