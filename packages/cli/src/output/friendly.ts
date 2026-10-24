import path from 'node:path';

// Plain Korean for system errors (no EACCES/EISDIR, no stack-style English) and no absolute paths in messages.
const CODES: Record<string, string> = {
  EACCES: '권한이 없어 읽거나 쓸 수 없어요',
  EPERM: '권한이 없어 바꿀 수 없어요',
  ENOENT: '파일이나 폴더가 없어요',
  EISDIR: '파일이 있어야 할 자리에 폴더가 있어요',
  ENOTDIR: '폴더가 있어야 할 자리에 파일이 있어요',
  EEXIST: '같은 이름이 이미 있어요',
  ELOOP: '링크라서 따라가지 않았어요',
  EROFS: '읽기 전용이라 쓸 수 없어요',
  ENOSPC: '디스크 공간이 모자라요',
  EBUSY: '다른 프로그램이 쓰고 있어요',
  EMFILE: '열린 파일이 너무 많아요',
  ENAMETOOLONG: '경로가 너무 길어요',
  ETIMEDOUT: '시간이 너무 오래 걸렸어요',
  ABORT_ERR: '시간 제한으로 멈췄어요',
};

const ABSOLUTE = /(^|[\s("'`=[,;:])((?:\/|[A-Za-z]:[\\/]|\\\\)[^\s"'`<>|?*,;)]*)/g;

/** Replaces absolute paths: inside `root` → relative path, elsewhere → [경로]. */
export function hideAbsolutePaths(text: string, root?: string): string {
  return text.replace(ABSOLUTE, (_match, prefix: string, found: string) => {
    if (root) {
      const relative = path.relative(root, found);
      if (relative === '') return `${prefix}.`;
      if (!relative.startsWith('..') && !path.isAbsolute(relative)) return `${prefix}${relative.split(path.sep).join('/')}`;
    }
    return `${prefix}[경로]`;
  });
}

/** One plain Korean sentence for an error, safe to show (relative paths only). */
export function friendlyError(error: unknown, root?: string): string {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (code && CODES[code]) {
    const target = (error as NodeJS.ErrnoException).path;
    return target ? `${CODES[code]} (${hideAbsolutePaths(` ${target}`, root).trim()})` : CODES[code];
  }
  const fromText = Object.keys(CODES).find((key) => new RegExp(`\\b${key}\\b`).test(message));
  if (fromText) return CODES[fromText];
  if (!/[가-힣]/.test(message)) return '알 수 없는 오류가 생겼어요(--verbose를 붙이면 자세히 보여요)';
  return hideAbsolutePaths(message, root);
}
