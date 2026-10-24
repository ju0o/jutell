import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { CODEX_CANNOT_RUN_JUTELL, READY_WITH_WARNING } from '../src/commands/default.js';

// Reviewer #37 follow-up: setup-login-shell.ts (a global setupFile) always gives tests a login shell that finds
// jutell, so the setup warning never showed in other tests. This one passes its own SHELL that cannot find it.
const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

describe.skipIf(process.platform === 'win32')('full CLI: jutell --yes when Codex cannot find jutell (built dist)', () => {
  it('prints the warning first and never says 준비 완료', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'jutell-setup-warn-'));
    dirs.push(root);
    const home = path.join(root, 'home'); const bin = path.join(root, 'bin'); const project = path.join(root, 'proj');
    await mkdir(home, { recursive: true }); await mkdir(bin); await mkdir(path.join(project, 'src'), { recursive: true });
    await writeFile(path.join(bin, 'codex'), '#!/bin/sh\nprintf "codex 0.1.0\\n"\n'); await chmod(path.join(bin, 'codex'), 0o755);
    // A login shell whose PATH has no jutell (like a non-default global npm folder).
    const shell = path.join(bin, 'bare-login-shell');
    await writeFile(shell, '#!/bin/sh\nPATH=/usr/bin:/bin; export PATH\n[ "$1" = "-lc" ] && shift\nexec /bin/sh -c "$1"\n'); await chmod(shell, 0o755);
    await writeFile(path.join(project, 'src', 'a.ts'), 'export {};\n');
    const git = (...args: string[]) => execFileSync('git', args, { cwd: project });
    git('init', '-q'); git('add', '-A'); git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init');
    const env = { HOME: home, USERPROFILE: home, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: home, SHELL: shell, NO_COLOR: '1', PATH: `${bin}:${path.dirname(process.execPath)}:/usr/bin:/bin` };
    const result = spawnSync(process.execPath, [cliEntry, '--yes'], { cwd: project, env, encoding: 'utf8', timeout: 60000 });
    expect(result.status, result.stderr).toBe(0);
    const out = result.stdout;
    expect(out).toContain(CODEX_CANNOT_RUN_JUTELL);
    expect(out).toContain(READY_WITH_WARNING);
    expect(out).not.toContain('준비 완료');
    expect(out.indexOf(CODEX_CANNOT_RUN_JUTELL)).toBeLessThan(out.indexOf(READY_WITH_WARNING));
  }, 90000);
});
