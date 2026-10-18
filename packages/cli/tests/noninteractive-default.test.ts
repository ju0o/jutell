import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const temporaryRoots: string[] = [];

afterAll(async () => {
  await Promise.all(temporaryRoots.map((root) => rm(root, { recursive: true, force: true })));
});

describe('non-interactive default command', () => {
  it('repairs a connected setup without starting the dashboard', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'jutell-noninteractive-default-'));
    temporaryRoots.push(root);

    const home = path.join(root, 'home');
    const bin = path.join(root, 'bin');
    const projectA = path.join(root, 'project-a');
    const projectB = path.join(root, 'project-b');
    await Promise.all([
      mkdir(home, { recursive: true }),
      mkdir(bin, { recursive: true }),
      mkdir(projectA, { recursive: true }),
      mkdir(projectB, { recursive: true }),
    ]);

    const fakeCodex = path.join(bin, 'codex');
    await writeFile(fakeCodex, '#!/bin/sh\nprintf "codex 0.1.0\\n"\n', 'utf8');
    await chmod(fakeCodex, 0o755);

    const env = {
      ...process.env,
      HOME: home,
      BEGINNER_BRIDGE_HOME: home,
      CODEX_HOME: path.join(home, '.codex'),
      CLAUDE_CONFIG_DIR: home,
      PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
    };

    const first = spawnSync(process.execPath, [cliEntry, '--yes', '--no-funding'], {
      cwd: projectA,
      env,
      encoding: 'utf8',
      timeout: 20000,
    });
    expect(first.error).toBeUndefined();
    expect(first.error?.code).not.toBe('ETIMEDOUT');
    expect(first.status).toBe(0);

    const second = spawnSync(process.execPath, [cliEntry, '--yes', '--no-funding'], {
      cwd: projectB,
      env,
      encoding: 'utf8',
      timeout: 20000,
    });
    expect(second.error).toBeUndefined();
    expect(second.error?.code).not.toBe('ETIMEDOUT');
    expect(second.status).toBe(0);
    expect(`${second.stdout}${second.stderr}`).toContain('관리자 화면은 `jutell dashboard`로 열 수 있어요.');
    expect(existsSync(path.join(projectB, '.jutell-local', 'dashboard.json'))).toBe(false);
  });
});
