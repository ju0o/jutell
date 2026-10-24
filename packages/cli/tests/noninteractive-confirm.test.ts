import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmod, lstat, mkdir, mkdtemp, readFile, readlink, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const temporaryRoots: string[] = [];

afterAll(async () => {
  await Promise.all(temporaryRoots.map((root) => rm(root, { recursive: true, force: true })));
});

async function createProject() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jutell-noninteractive-confirm-'));
  temporaryRoots.push(root);

  const home = path.join(root, 'home');
  const bin = path.join(root, 'bin');
  const project = path.join(root, 'project');
  await Promise.all([
    mkdir(home, { recursive: true }),
    mkdir(bin, { recursive: true }),
    mkdir(project, { recursive: true }),
  ]);

  const fakeCodex = path.join(bin, 'codex');
  await writeFile(fakeCodex, '#!/bin/sh\nprintf "codex 0.1.0\\n"\n', 'utf8');
  await chmod(fakeCodex, 0o755);

  const env = {
    ...process.env,
    HOME: home, USERPROFILE: home,
    BEGINNER_BRIDGE_HOME: home,
    CODEX_HOME: path.join(home, '.codex'),
    CLAUDE_CONFIG_DIR: home,
    PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
  };

  const setup = spawnSync(process.execPath, [cliEntry, '--yes', '--no-funding'], {
    cwd: project,
    env,
    encoding: 'utf8',
    input: '',
    timeout: 20000,
  });
  expect(setup.status).toBe(0);

  return { root, project, env };
}

async function snapshotFiles(directory: string, root = directory): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      Object.assign(snapshot, await snapshotFiles(absolute, root));
    } else if (entry.isSymbolicLink()) {
      snapshot[path.relative(root, absolute)] = `symlink:${await readlink(absolute)}`;
    } else if (entry.isFile()) {
      snapshot[path.relative(root, absolute)] = (await readFile(absolute)).toString('base64');
    } else {
      const stats = await lstat(absolute);
      snapshot[path.relative(root, absolute)] = `mode:${stats.mode}`;
    }
  }
  return snapshot;
}

describe('non-interactive confirmation', () => {
  it('requires --yes before global uninstall and leaves config files unchanged', async () => {
    const { root, project, env } = await createProject();
    const before = await snapshotFiles(root);

    const result = spawnSync(process.execPath, [cliEntry, 'uninstall', '--global', '--no-funding'], {
      cwd: project,
      env,
      encoding: 'utf8',
      input: '',
      timeout: 20000,
    });

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`, JSON.stringify({ signal: result.signal, error: result.error?.message })).toContain('확인 없이는 제거하지 않았어요. --yes를 붙이세요');
    expect(await snapshotFiles(root)).toEqual(before);
  });

  it('requires --yes before disabling in a non-interactive shell', async () => {
    const { project, env } = await createProject();

    const result = spawnSync(process.execPath, [cliEntry, 'disable', '--no-funding'], {
      cwd: project,
      env,
      encoding: 'utf8',
      input: '',
      timeout: 20000,
    });

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`, JSON.stringify({ signal: result.signal, error: result.error?.message })).toContain('확인 없이는 진행하지 않았어요. --yes를 붙이세요');
  });
});
