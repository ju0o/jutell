// doctor checks that the login shell Codex uses can find `jutell` (B6). Keep that check
// independent of the machine running the suite: every test whose env spreads process.env
// sees a fake `jutell` on PATH and a fake login shell. The fake shell runs the command
// without login mode, because /etc/profile on many systems resets PATH. Tests that exercise the
// check itself (doctor-login-shell.test.ts) pass their own explicit env.
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';

if (process.platform !== 'win32') {
  const root = mkdtempSync(path.join(os.tmpdir(), 'jutell-fake-bin-'));
  const bin = path.join(root, 'bin');
  const previousPath = process.env.PATH;
  const previousShell = process.env.SHELL;
  // Remove this file's fake bin once its tests finish, so runs leave nothing in /tmp.
  afterAll(() => {
    process.env.PATH = previousPath;
    if (previousShell === undefined) delete process.env.SHELL; else process.env.SHELL = previousShell;
    rmSync(root, { recursive: true, force: true });
  });
  mkdirSync(bin);
  writeFileSync(path.join(bin, 'jutell'), '#!/bin/sh\nexit 0\n');
  chmodSync(path.join(bin, 'jutell'), 0o755);
  process.env.PATH = `${bin}${path.delimiter}${process.env.PATH ?? ''}`;
  const shell = path.join(bin, 'login-shell');
  // Like a profile that puts the npm bin on PATH: tests that narrow PATH still find the fake jutell.
  writeFileSync(shell, `#!/bin/sh\nPATH="${bin}:$PATH"; export PATH\n[ "$1" = "-lc" ] && shift\nexec /bin/sh -c "$1"\n`);
  chmodSync(shell, 0o755);
  process.env.SHELL = shell;
}
