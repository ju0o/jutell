import { statSync } from 'node:fs';
import path from 'node:path';

/**
 * Project folder the server works in.
 * 1. JUTELL_PROJECT_ROOT, only when it is an absolute path to an existing folder
 *    (GUI apps whose global config has no project variable can pass it via env).
 * 2. Otherwise the process cwd (Codex CLI and every existing setup).
 * A relative or missing value is ignored on purpose so a typo never moves
 * reports or counters to an unexpected folder.
 */
export function resolveProjectRoot(env: NodeJS.ProcessEnv = process.env, cwd: string = process.cwd()): string {
  const value = env.JUTELL_PROJECT_ROOT;
  if (value && path.isAbsolute(value)) {
    try {
      if (statSync(value).isDirectory()) return value;
    } catch {
      // fall through to cwd
    }
  }
  return cwd;
}

/**
 * Same rule as the CLI's safeDataRoot (#31 B1, #33): the data folder may be
 * written only when it is a real directory (not a link) whose real path stays
 * inside the project. A folder that does not exist yet is safe to create.
 */
export async function safeDataDir(projectRoot: string, dataDir: string): Promise<boolean> {
  const { promises: fs } = await import('node:fs');
  try {
    const stats = await fs.lstat(dataDir);
    if (stats.isSymbolicLink() || !stats.isDirectory()) return false;
    const [root, data] = await Promise.all([fs.realpath(projectRoot), fs.realpath(dataDir)]);
    const relative = path.relative(root, data);
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
  } catch (error) {
    return (error as NodeJS.ErrnoException)?.code === 'ENOENT' && path.dirname(path.resolve(dataDir)) === path.resolve(projectRoot);
  }
}
