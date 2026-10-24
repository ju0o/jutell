import { spawnSync } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { renderMapHtml } from '../src/map/html.js';

const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const roots: string[] = [];
afterAll(async () => { await Promise.all(roots.map((root) => fs.rm(root, { recursive: true, force: true }))); });

// Dogfood PR #31: with Codex already connected (shared CODEX_HOME), `jutell --yes` in a second project made no map.
describe('`jutell --yes` makes the map in every project (dogfood fix)', () => {
  // A shell-script fake codex cannot run on Windows (same limit as noninteractive-default.test.ts).
  it.skipIf(process.platform === 'win32')('creates JuTellMap.md + .jutell-local/map.html in a new project even when Codex is already connected; never overwrites', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-mapyes-'));
    roots.push(root);
    const home = path.join(root, 'home');
    const bin = path.join(root, 'bin');
    await fs.mkdir(home, { recursive: true });
    await fs.mkdir(bin, { recursive: true });
    await fs.writeFile(path.join(bin, 'codex'), '#!/bin/sh\nprintf "codex 0.1.0\\n"\n', { mode: 0o755 });
    const projects = ['project-a', 'project-b', 'project-c'].map((name) => path.join(root, name));
    for (const dir of projects) {
      await fs.mkdir(path.join(dir, 'test-app'), { recursive: true });
      await fs.writeFile(path.join(dir, 'test-app', 'todo.html'), '<h1>할 일 목록</h1>');
      execFileSync('git', ['init', '-q'], { cwd: dir });
    }
    const env = { ...process.env, HOME: home, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: home, JUTELL_NO_FUNDING: '1', PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}` };
    const run = (cwd: string) => spawnSync(process.execPath, [cliEntry, '--yes', '--no-funding'], { cwd, env, encoding: 'utf8', timeout: 30000 });
    const map = (dir: string) => path.join(dir, 'JuTellMap.md');
    const html = (dir: string) => path.join(dir, '.jutell-local', 'map.html');

    for (const dir of projects.slice(0, 2)) {
      const result = run(dir);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('프로젝트 지도(JuTellMap.md)를 만들었어요.');
      expect(result.stdout).toContain('보기 쉬운 화면: .jutell-local/map.html');
      expect(await fs.readFile(html(dir), 'utf8')).toBe(renderMapHtml(await fs.readFile(map(dir), 'utf8')));
    }

    // Already fully set up (repeat run): an existing map is never overwritten.
    const [, b, c] = projects;
    await fs.writeFile(map(b), 'my own map');
    const repeat = run(b);
    expect(repeat.status).toBe(0);
    expect(await fs.readFile(map(b), 'utf8')).toBe('my own map');
    expect(repeat.stdout).not.toContain('프로젝트 지도(JuTellMap.md)를 만들었어요.');

    // Third project, everything connected long ago: still gets a map.
    const third = run(c);
    expect(third.status).toBe(0);
    await expect(fs.stat(map(c))).resolves.toBeTruthy();
    await expect(fs.stat(html(c))).resolves.toBeTruthy();

    // Repeat run in a fully set-up project whose map was deleted: --yes makes it again.
    await fs.rm(map(c));
    expect(run(c).status).toBe(0);
    await expect(fs.stat(map(c))).resolves.toBeTruthy();
  });
});
