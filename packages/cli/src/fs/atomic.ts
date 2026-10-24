import { randomBytes } from 'node:crypto';
import { constants as fsConstants, promises as fs } from 'node:fs';
import path from 'node:path';
// No imports from the rest of the CLI: the local admin server reaches this file through map/git-exclude.ts.

const NO_FOLLOW = fsConstants.O_NOFOLLOW ?? 0;

/**
 * The one temp-then-rename write. The temp file is created next to `file` with O_EXCL|O_NOFOLLOW
 * (never through a planted link), then renamed over `file`: rename replaces the directory entry
 * itself, so a link at `file` is replaced, never followed. Keeps the existing file's permissions
 * unless `mode` is given. On failure the temp file is removed and the error is rethrown.
 */
export async function writeViaTemp(file: string, content: string | Uint8Array, options: { mode?: number } = {}) {
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.jutell-tmp-${process.pid}-${randomBytes(4).toString('hex')}`);
  const existingMode = options.mode ?? await fs.lstat(file).then((stat) => (stat.isFile() ? stat.mode & 0o777 : undefined), () => undefined);
  const handle = await fs.open(temporary, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | NO_FOLLOW, existingMode ?? 0o644);
  try {
    try {
      await handle.writeFile(content, typeof content === 'string' ? 'utf8' : undefined);
      // open() applies the umask; set the kept mode exactly (e.g. 600 on a config with secrets).
      if (existingMode !== undefined) await handle.chmod(existingMode);
    } finally { await handle.close(); }
    await fs.rename(temporary, file);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
}
