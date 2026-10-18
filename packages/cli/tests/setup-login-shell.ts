// doctor checks that the login shell Codex uses can find `jutell` (B6). Keep that check
// independent of the machine running the suite: every test whose env spreads process.env
// sees a fake `jutell` on PATH and a fake login shell. The fake shell runs the command
// without login mode, because /etc/profile on many systems resets PATH. Tests that exercise the
// check itself (doctor-login-shell.test.ts) pass their own explicit env.
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

if (process.platform !== 'win32') {
  const bin = path.join(mkdtempSync(path.join(os.tmpdir(), 'jutell-fake-bin-')), 'bin');
  mkdirSync(bin);
  writeFileSync(path.join(bin, 'jutell'), '#!/bin/sh\nexit 0\n');
  chmodSync(path.join(bin, 'jutell'), 0o755);
  process.env.PATH = `${bin}${path.delimiter}${process.env.PATH ?? ''}`;
  const shell = path.join(bin, 'login-shell');
  writeFileSync(shell, '#!/bin/sh\n[ "$1" = "-lc" ] && shift\nexec /bin/sh -c "$1"\n');
  chmodSync(shell, 0o755);
  process.env.SHELL = shell;
}
