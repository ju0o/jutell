import fs from 'node:fs';
import path from 'node:path';
import type { CliIo, ScopePaths } from '../types.js';

export const FUNDING_URL = 'https://ko-fi.com/ju0o___';

const MARKER_FILE = 'funding-notice-shown';

function truthy(value: string | undefined) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== '' && normalized !== '0' && normalized !== 'false';
}

/**
 * Shows the support line at most once per machine, and only in a real
 * terminal. Never runs in CI, never blocks, and never changes the exit code:
 * any failure here is swallowed so a funding message can't break a command.
 */
export function maybeShowFundingNotice(paths: ScopePaths, io: CliIo, suppressed: boolean) {
  try {
    if (suppressed) return;
    if (truthy(process.env.JUTELL_NO_FUNDING)) return;
    if (truthy(process.env.CI)) return;
    if (!process.stdout.isTTY) return;

    const marker = path.join(paths.dataRoot, MARKER_FILE);
    if (fs.existsSync(marker)) return;
    fs.mkdirSync(paths.dataRoot, { recursive: true });
    fs.writeFileSync(marker, new Date().toISOString());

    io.write('');
    io.write(`JuTell은 무료이고 앞으로도 무료입니다. 도움이 되셨다면: ${FUNDING_URL}`);
    io.write('이 안내는 다시 표시되지 않습니다. (끄기: JUTELL_NO_FUNDING=1 또는 --no-funding)');
  } catch {
    // A support message must never affect the command result.
  }
}
