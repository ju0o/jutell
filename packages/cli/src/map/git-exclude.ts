import { execFile } from 'node:child_process';
import { constants as fsConstants, promises as fs, realpathSync } from 'node:fs';
import path from 'node:path';
// Only self-contained imports: the local admin server uses this same file (map.gitExclude switch).
import { writeViaTemp } from '../fs/atomic.js';
const MAP_FILE = 'JuTellMap.md';


/** The two lines JuTell adds to the repository's info/exclude, always together and only once. */
export const EXCLUDE_COMMENT = `# jutell: ${MAP_FILE}를 이 컴퓨터에서만 git에서 뺌 (jutell map --git-include로 되돌림)`;
export const EXCLUDE_LINE = `/${MAP_FILE}`;

/** Escapes gitignore glob characters (and a backslash) in a path piece. */
export function escapeGlob(value: string) {
  return value.replace(/[\\*?[\]]/g, (char) => `\\${char}`);
}

/** Exclude line for a project at `prefix` (from `git rev-parse --show-prefix`) inside its repository. */
export function excludeLineFor(prefix: string) {
  return `/${escapeGlob(prefix)}${MAP_FILE}`;
}

export type GitExcludeResult =
  /** ignored: `git check-ignore -q JuTellMap.md` after the change, reported as is. */
  | { status: 'added' | 'already' | 'removed' | 'absent'; file: string; ignored: boolean }
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

/** Project folder inside its repository, e.g. "sub/proj/" ("" at the top). */
async function showPrefix(root: string) {
  try { return (await git(root, ['rev-parse', '--show-prefix'])).replace(/\r?\n$/, ''); } catch { return ''; }
}

async function mapIgnored(root: string) {
  try { await git(root, ['check-ignore', '-q', '--', MAP_FILE]); return true; } catch { return false; }
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

function hasPair(text: string, line: string) {
  const { list } = lines(text);
  return list.some((entry, index) => entry === EXCLUDE_COMMENT && list[index + 1] === line);
}

/** Appends the two lines once. Existing bytes are kept; never writes through a link; creates the file if missing. */
export async function addGitExclude(root: string): Promise<GitExcludeResult> {
  const file = await excludeFile(root);
  if (!file) return { status: 'not-git' };
  if (await mapCommitted(root)) return { status: 'committed' };
  const line = excludeLineFor(await showPrefix(root));
  const current = await readExclude(file);
  if (current === 'link') return { status: 'link', file };
  if (current && hasPair(current.text, line)) return { status: 'already', file, ignored: await mapIgnored(root) };
  const text = current?.text ?? '';
  const eol = text ? lines(text).eol : '\n';
  const separator = text && !text.endsWith('\n') ? eol : '';
  await fs.mkdir(path.dirname(file), { recursive: true });
  if ((await fs.lstat(path.dirname(file))).isSymbolicLink()) return { status: 'link', file };
  await writeViaTemp(file, `${text}${separator}${EXCLUDE_COMMENT}${eol}${line}${eol}`);
  return { status: 'added', file, ignored: await mapIgnored(root) };
}

/** Removes only JuTell's two lines (each comment line together with the line right after it). Everything else stays byte for byte. */
export async function removeGitExclude(root: string): Promise<GitExcludeResult> {
  const file = await excludeFile(root);
  if (!file) return { status: 'not-git' };
  const line = excludeLineFor(await showPrefix(root));
  const current = await readExclude(file);
  if (current === 'link') return { status: 'link', file };
  if (!current || !hasPair(current.text, line)) return { status: 'absent', file, ignored: await mapIgnored(root) };
  // Work on raw pieces so CRLF/LF mixes and a missing final newline survive.
  const pieces = current.text.split(/(?<=\n)/);
  const strip = (piece: string) => piece.replace(/\r?\n$/, '');
  const kept: string[] = [];
  for (let index = 0; index < pieces.length; index += 1) {
    if (strip(pieces[index]) === EXCLUDE_COMMENT && pieces[index + 1] !== undefined && strip(pieces[index + 1]) === line) { index += 1; continue; }
    kept.push(pieces[index]);
  }
  await writeViaTemp(file, kept.join(''));
  return { status: 'removed', file, ignored: await mapIgnored(root) };
}

/** The exclude file as the person should see it: relative to the project, with / (e.g. ../.git/info/exclude in a subfolder). */
export function shownExcludePath(file: string | undefined, root: string | undefined): string {
  if (!file || !root) return '.git/info/exclude';
  const real = (value: string) => { try { return realpathSync.native(value); } catch { return value; } };
  // Real paths on both sides (macOS /var → /private/var), so git's answer and the project line up.
  const relative = path.relative(real(root), path.join(real(path.dirname(file)), path.basename(file)));
  return (relative && !path.isAbsolute(relative) ? relative : file).split(path.sep).join('/');
}

export function gitExcludeMessage(result: GitExcludeResult, root?: string): string {
  const where = shownExcludePath('file' in result ? result.file : undefined, root);
  switch (result.status) {
    case 'added': return result.ignored
      ? `${MAP_FILE}를 이 컴퓨터에서만 git에서 뺐어요(${where}). 되돌리려면 \`jutell map --git-include\`.`
      : `${where}에 줄을 넣었지만 git이 아직 ${MAP_FILE}를 빼지 않아요(git check-ignore로 확인). 직접 확인해 주세요.`;
    case 'already': return result.ignored ? `${MAP_FILE}는 이미 git에서 빠져 있어요(${where}).` : `JuTell 줄은 이미 있지만 git이 ${MAP_FILE}를 빼지 않아요(git check-ignore로 확인). 직접 확인해 주세요.`;
    case 'removed': return result.ignored ? `JuTell 줄은 지웠지만 ${MAP_FILE}는 다른 규칙(.gitignore 등) 때문에 여전히 git에서 빠져 있어요.` : `${MAP_FILE}를 다시 git에 보이게 했어요(${where}).`;
    case 'absent': return `JuTell이 넣은 git 제외 줄이 없어서 바꿀 것이 없어요.`;
    case 'not-git': return 'git 저장소가 아니라 할 일이 없어요.';
    case 'committed': return `${MAP_FILE}가 이미 커밋돼 있어서 아무것도 바꾸지 않았어요. git에서 빼려면 \`git rm --cached ${MAP_FILE}\`를 직접 실행하세요.`;
    case 'link': return `git 제외 파일(${where})이 링크라서 쓰지 않았어요.`;
  }
}
