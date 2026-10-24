import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

/** Read by `jutell receipt`: when this is older than the last receipt, the rules were not fetched for this work. */
export const RULES_STAMP_FILE = 'rules-fetched.json';

/**
 * Records only the time the report rules were fetched (no prompt, code, or path). Writes only inside an
 * existing, real `.jutell-local` folder of the project, never through a link, and never fails the tool.
 */
export async function recordRulesFetched(projectRoot = process.cwd(), now = new Date()): Promise<boolean> {
  try {
    const directory = path.join(path.resolve(projectRoot), '.jutell-local');
    const stats = await fs.lstat(directory);
    if (stats.isSymbolicLink() || !stats.isDirectory()) return false;
    // A link anywhere above (the project root or a parent folder) would write elsewhere: the real path must match.
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
