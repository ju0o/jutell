import { afterAll, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const roots: string[] = [];
afterAll(async () => { await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))); });

describe('bare `jutell --yes` records the receipt baseline (not only `jutell setup`)', () => {
  it('package.json / package-lock.json from `npm install jutell` show as (작업 전부터); a second `jutell` mid-task does not hide the AI\'s edit', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'jutell-default-base-'));
    roots.push(root);
    const home = path.join(root, 'home'); const bin = path.join(root, 'bin'); const project = path.join(root, 'proj');
    await Promise.all([mkdir(home, { recursive: true }), mkdir(bin, { recursive: true }), mkdir(path.join(project, 'src'), { recursive: true })]);
    await writeFile(path.join(bin, 'codex'), '#!/bin/sh\nprintf "codex 0.1.0\\n"\n'); await chmod(path.join(bin, 'codex'), 0o755);
    await writeFile(path.join(bin, 'codex.cmd'), '@echo codex 0.1.0\r\n');
    const env = { ...process.env, HOME: home, USERPROFILE: home, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: home, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}` };
    await writeFile(path.join(project, 'package.json'), '{"name":"app"}\n');
    await writeFile(path.join(project, 'src', 'login.ts'), 'v1\n');
    const git = (...args: string[]) => execFileSync('git', args, { cwd: project });
    git('init', '-q'); git('add', '.'); git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base');
    await writeFile(path.join(project, 'package.json'), '{"name":"app","devDependencies":{"jutell":"^2"}}\n');
    await writeFile(path.join(project, 'package-lock.json'), '{}\n');
    const run = (...args: string[]) => spawnSync(process.execPath, [cliEntry, ...args], { cwd: project, env, encoding: 'utf8', timeout: 30000, input: args.includes('receipt') ? JSON.stringify({ asked: ['로그인 고치기'], done: ['로그인 고침'] }) : undefined });
    expect(run('--yes', '--no-funding').status).toBe(0);
    await writeFile(path.join(project, 'src', 'login.ts'), 'v2\n');
    expect(run('--yes', '--no-funding').status).toBe(0); // run again during the task
    const receipt = run('receipt', '--file', '-');
    expect(receipt.status).toBe(0);
    expect(receipt.stdout).toMatch(/package-lock\.json[^\n]*\(작업 전부터\)|\(작업 전부터\)[^\n]*package-lock\.json/);
    expect(receipt.stdout).not.toContain('첫 영수증이라');
    expect(receipt.stdout).not.toMatch(/login\.ts[^\n]*\(작업 전부터\)/);
    // B1: install type changed → the block names an old command; one repeat `jutell --yes` (already-configured path) fixes it.
    const agents = path.join(project, 'AGENTS.md');
    const block = readFileSync(agents, 'utf8');
    expect(block).toContain('`jutell receipt`를 한 번');
    writeFileSync(agents, block.replace('`jutell receipt`를 한 번', '`npm exec --offline --no -- jutell receipt`를 한 번'));
    const repeat = run('--yes', '--no-funding');
    expect(repeat.status).toBe(0);
    expect(repeat.stdout).toContain('영수증 명령을 지금 설치에 맞게 고쳤어요');
    expect(readFileSync(agents, 'utf8')).toBe(block);
    const doctor = run('doctor');
    expect(doctor.stdout).not.toMatch(/주의\s+영수증 명령/);
  }, 90_000);
});
