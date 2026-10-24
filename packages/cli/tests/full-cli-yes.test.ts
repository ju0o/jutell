import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, cp, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

// #37: the built CLI (dist/index.js) end to end — `jutell --yes` in a fresh Git project with a fake Codex on PATH.
const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const pkgRoot = fileURLToPath(new URL('..', import.meta.url));
const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

describe('full CLI: jutell --yes (built dist)', () => {
  it('connects Codex, writes project rules, map and baseline, exits 0 without a dashboard; a second run is idempotent', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'jutell-full-yes-'));
    dirs.push(root);
    const home = path.join(root, 'home'); const bin = path.join(root, 'bin'); const project = path.join(root, 'proj');
    await mkdir(home, { recursive: true }); await mkdir(bin); await mkdir(path.join(project, 'src', 'pages'), { recursive: true });
    await writeFile(path.join(bin, 'codex'), '#!/bin/sh\nprintf "codex 0.1.0\\n"\n'); await chmod(path.join(bin, 'codex'), 0o755);
    await writeFile(path.join(bin, 'codex.cmd'), '@echo codex 0.1.0\r\n');
    await writeFile(path.join(project, 'src', 'pages', 'Login.tsx'), '<button>로그인</button>\n');
    await writeFile(path.join(project, 'package.json'), '{"name":"demo","private":true}\n');
    const git = (...args: string[]) => execFileSync('git', args, { cwd: project });
    git('init', '-q'); git('add', '-A'); git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init');
    const env = { ...process.env, HOME: home, USERPROFILE: home, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: home, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}` };
    const run = () => spawnSync(process.execPath, [cliEntry, '--yes'], { cwd: project, env, encoding: 'utf8', timeout: 60000 });

    const first = run();
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).toContain('JuTell 준비 완료.');
    expect(first.stdout).toContain('✓ Codex 연결됨');
    expect(first.stdout).toContain('프로젝트 지도(JuTellMap.md)를 만들었어요.');
    expect(first.stdout).not.toMatch(/대시보드|dashboard/i);

    const agents = await readFile(path.join(project, 'AGENTS.md'), 'utf8');
    expect(agents.match(/BEGIN JUTELL MANAGED BLOCK/g)).toHaveLength(1);
    expect(agents).toContain('jutell receipt');
    expect((await stat(path.join(project, '.agents', 'skills', 'beginner-bridge', 'SKILL.md'))).isFile()).toBe(true);
    const config = await readFile(path.join(home, '.codex', 'config.toml'), 'utf8');
    expect(config).toMatch(/\[mcp_servers\.jutell\]/);
    const map = await readFile(path.join(project, 'JuTellMap.md'), 'utf8');
    expect(map).toContain('- src/pages/Login.tsx');
    expect(map.split('\n').filter((line) => line.startsWith('<!--') && !/^<!-- \/?jutell:auto/.test(line))).toEqual([]);
    expect((await stat(path.join(project, '.jutell-local'))).isDirectory()).toBe(true);

    const second = run();
    expect(second.status, second.stderr).toBe(0);
    expect((await readFile(path.join(project, 'AGENTS.md'), 'utf8')).match(/BEGIN JUTELL MANAGED BLOCK/g)).toHaveLength(1);
    expect((await readFile(path.join(home, '.codex', 'config.toml'), 'utf8')).match(/\[mcp_servers\.jutell\]/g)).toHaveLength(1);
  }, 120000);
  it('local → global switch: a project set up by a local install, then `jutell --yes` from the global CLI, gets its receipt command rewritten', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'jutell-full-switch-'));
    dirs.push(root);
    const home = path.join(root, 'home'); const bin = path.join(root, 'bin'); const project = path.join(root, 'proj');
    await mkdir(home, { recursive: true }); await mkdir(bin); await mkdir(project);
    await writeFile(path.join(bin, 'codex'), '#!/bin/sh\nprintf "codex 0.1.0\\n"\n'); await chmod(path.join(bin, 'codex'), 0o755);
    await writeFile(path.join(bin, 'codex.cmd'), '@echo codex 0.1.0\r\n');
    await writeFile(path.join(project, 'package.json'), '{"name":"demo","private":true}\n');
    // A real local install: the built package copied into <project>/node_modules/jutell (its deps linked).
    const local = path.join(project, 'node_modules', 'jutell');
    await mkdir(local, { recursive: true });
    for (const item of ['dist', 'assets', 'package.json']) await cp(path.join(pkgRoot, item), path.join(local, item), { recursive: true });
    await symlink(path.join(pkgRoot, 'node_modules'), path.join(local, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    const git = (...args: string[]) => execFileSync('git', args, { cwd: project });
    git('init', '-q'); git('add', 'package.json'); git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init');
    const env = { ...process.env, HOME: home, USERPROFILE: home, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: home, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}` };
    const run = (entry: string) => spawnSync(process.execPath, [entry, '--yes'], { cwd: project, env, encoding: 'utf8', timeout: 60000 });

    const viaLocal = run(path.join(local, 'dist', 'index.js'));
    expect(viaLocal.status, viaLocal.stderr).toBe(0);
    expect(await readFile(path.join(project, 'AGENTS.md'), 'utf8')).toContain('npm exec --offline --no -- jutell receipt');

    const viaGlobal = run(cliEntry);
    expect(viaGlobal.status, viaGlobal.stderr).toBe(0);
    expect(viaGlobal.stdout).toContain('영수증 명령을 지금 설치에 맞게 고쳤어요');
    const agents = await readFile(path.join(project, 'AGENTS.md'), 'utf8');
    expect(agents).not.toContain('npm exec --offline --no -- jutell receipt');
    expect(agents).toContain('jutell receipt');
    expect(agents.match(/BEGIN JUTELL MANAGED BLOCK/g)).toHaveLength(1);
  }, 120000);
});
