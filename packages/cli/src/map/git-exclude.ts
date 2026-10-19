import { execFile } from 'node:child_process';
import { constants as fsConstants, promises as fs } from 'node:fs';
import path from 'node:path';
import { MAP_FILE, writeViaTemp } from './write.js';

/** The two lines JuTell adds to the repository's info/exclude, always together and only once. */
export const EXCLUDE_COMMENT = `# jutell: ${MAP_FILE}를 이 컴퓨터에서만 git에서 뺌 (jutell map --git-include로 되돌림)`;
export const EXCLUDE_LINE = `/${MAP_FILE}`;

export type GitExcludeResult =
  | { status: 'added' | 'already' | 'removed' | 'absent'; file: string }
  | { status: 'not-git' }
  | { status: 'committed' }
  | { status: 'link'; file: string };

function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', ['--no-optional-locks', ...args], { cwd, timeout: 5000, maxBuffer: 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

/** Absolute path of info/exclude for this checkout (works in worktrees and submodules), or undefined outside git. */
export async function excludeFile(root: string): Promise<string | undefined> {
  try {
    const out = (await git(root, ['rev-parse', '--git-path', 'info/exclude'])).replace(/\r?\n$/, '');
    return path.resolve(root, out);
  } catch {
    return undefined;
  }
}

async function mapCommitted(root: string) {
  try { await git(root, ['ls-files', '--error-unmatch', '--', MAP_FILE]); return true; } catch { return false; }
}

async function readExclude(file: string): Promise<{ text: string } | 'link' | undefined> {
  const stats = await fs.lstat(file).catch(() => undefined);
  if (!stats) return undefined;
  if (!stats.isFile()) return 'link';
  return { text: await fs.readFile(file, { encoding: 'utf8', flag: fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0) }) };
}

function lines(text: string) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  return { eol, list: text.split(/\r?\n/) };
}

function hasPair(text: string) {
  const { list } = lines(text);
  return list.some((line, index) => line === EXCLUDE_COMMENT && list[index + 1] === EXCLUDE_LINE);
}

/** Appends the two lines once. Existing bytes are kept; never writes through a link; creates the file if missing. */
export async function addGitExclude(root: string): Promise<GitExcludeResult> {
  const file = await excludeFile(root);
  if (!file) return { status: 'not-git' };
  if (await mapCommitted(root)) return { status: 'committed' };
  const current = await readExclude(file);
  if (current === 'link') return { status: 'link', file };
  if (current && hasPair(current.text)) return { status: 'already', file };
  const text = current?.text ?? '';
  const eol = text ? lines(text).eol : '\n';
  const separator = text && !text.endsWith('\n') ? eol : '';
  await fs.mkdir(path.dirname(file), { recursive: true });
  if ((await fs.lstat(path.dirname(file))).isSymbolicLink()) return { status: 'link', file };
  await writeViaTemp(file, `${text}${separator}${EXCLUDE_COMMENT}${eol}${EXCLUDE_LINE}${eol}`);
  return { status: 'added', file };
}

/** Removes only JuTell's two lines (each comment line together with the line right after it). Everything else stays byte for byte. */
export async function removeGitExclude(root: string): Promise<GitExcludeResult> {
  const file = await excludeFile(root);
  if (!file) return { status: 'not-git' };
  const current = await readExclude(file);
  if (current === 'link') return { status: 'link', file };
  if (!current || !hasPair(current.text)) return { status: 'absent', file };
  // Work on raw pieces so CRLF/LF mixes and a missing final newline survive.
  const pieces = current.text.split(/(?<=\n)/);
  const strip = (piece: string) => piece.replace(/\r?\n$/, '');
  const kept: string[] = [];
  for (let index = 0; index < pieces.length; index += 1) {
    if (strip(pieces[index]) === EXCLUDE_COMMENT && pieces[index + 1] !== undefined && strip(pieces[index + 1]) === EXCLUDE_LINE) { index += 1; continue; }
    kept.push(pieces[index]);
  }
  await writeViaTemp(file, kept.join(''));
  return { status: 'removed', file };
}

export function gitExcludeMessage(result: GitExcludeResult): string {
  switch (result.status) {
    case 'added': return `${MAP_FILE}를 이 컴퓨터에서만 git에서 뺐어요(.git/info/exclude). 되돌리려면 \`jutell map --git-include\`.`;
    case 'already': return `${MAP_FILE}는 이미 git에서 빠져 있어요.`;
    case 'removed': return `${MAP_FILE}를 다시 git에 보이게 했어요.`;
    case 'absent': return `JuTell이 넣은 git 제외 줄이 없어서 바꿀 것이 없어요.`;
    case 'not-git': return 'git 저장소가 아니라 할 일이 없어요.';
    case 'committed': return `${MAP_FILE}가 이미 커밋돼 있어서 아무것도 바꾸지 않았어요. git에서 빼려면 \`git rm --cached ${MAP_FILE}\`를 직접 실행하세요.`;
    case 'link': return 'git 제외 파일(.git/info/exclude)이 링크라서 쓰지 않았어요.';
  }
}
