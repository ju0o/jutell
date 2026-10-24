import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { resolveProjectRoot, safeDataDir } from '../config/project-root.js';

/** Read by `jutell receipt`: when this is older than the last receipt, the rules were not fetched for this work. */
export const RULES_STAMP_FILE = 'rules-fetched.json';

/**
 * Records only the time the report rules were fetched (no prompt, code, or path). Writes only inside an
 * existing, real `.jutell-local` folder of the project, never through a link, and never fails the tool.
 */
export async function recordRulesFetched(projectRoot = resolveProjectRoot(), now = new Date()): Promise<boolean> {
  try {
    // JUTELL_PROJECT_ROOT may itself go through a link (e.g. a pinned global app entry, /tmp on macOS):
    // resolve the root once, then the data folder must be a real folder directly inside that real root.
    const root = await fs.realpath(path.resolve(projectRoot));
    const directory = path.join(root, '.jutell-local');
    const stats = await fs.lstat(directory);
    if (stats.isSymbolicLink() || !stats.isDirectory()) return false;
    if (!await safeDataDir(root, directory)) return false;
    if (await fs.realpath(directory) !== directory) return false;
    const file = path.join(directory, RULES_STAMP_FILE);
    const existing = await fs.lstat(file).catch(() => undefined);
    if (existing && (!existing.isFile() || existing.nlink > 1)) return false;
    const temp = path.join(directory, `.rules-fetched.${process.pid}.${randomUUID()}.tmp`);
    await fs.writeFile(temp, `${JSON.stringify({ at: now.toISOString() })}\n`, { encoding: 'utf8', flag: 'wx' });
    try { await fs.rename(temp, file); } catch (error) { await fs.rm(temp, { force: true }); throw error; }
    return true;
  } catch {
    return false;
  }
}
