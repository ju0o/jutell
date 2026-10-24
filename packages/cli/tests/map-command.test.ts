import { execFileSync, spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { resolveScope } from '../src/config/paths.js';
import { mapFreshnessCheck } from '../src/commands/map.js';
import { escapeHtml, renderMapHtml } from '../src/map/html.js';
import { writeMap } from '../src/map/write.js';

const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const roots: string[] = [];
afterAll(async () => { await Promise.all(roots.map((root) => fs.rm(root, { recursive: true, force: true }))); });

async function project(name = 'proj', files = ['src/auth/login.ts', 'src/payments/refund.ts', 'index.js']) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-mapc-'));
  roots.push(root);
  const dir = path.join(root, name);
  const home = path.join(root, 'home');
  await fs.mkdir(home, { recursive: true });
  for (const file of files) {
    await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await fs.writeFile(path.join(dir, file), 'x');
  }
  execFileSync('git', ['init', '-q'], { cwd: dir });
  const env = { ...process.env, HOME: home, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: home, JUTELL_NO_FUNDING: '1' };
  const run = (...args: string[]) => spawnSync(process.execPath, [cliEntry, ...args], { cwd: dir, env, encoding: 'utf8', timeout: 30000 });
  return { dir, run, paths: resolveScope('project', dir) };
}

describe('map HTML (W3)', () => {
  it('escapes every md byte: file names with HTML/quotes cannot inject markup', () => {
    const md = '# 지도\n## <b>기능</b>\n<!-- jutell:auto x -->\n- src/<script>alert("x")</script>.ts — 기능\n- a&b\'c.ts — 화면\n<!-- /jutell:auto -->\n설명: <img src=x onerror=alert(1)>\n';
    const html = renderMapHtml(md);
    expect(html).not.toMatch(/<script|<img|<b>|onerror=alert\(1\)>/);
    expect(html).toContain('<li>src/&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;.ts — 기능</li>');
    expect(html).toContain('<li>a&amp;b&#39;c.ts — 화면</li>');
    expect(html).toContain('<summary>&lt;b&gt;기능&lt;/b&gt;</summary>');
    expect(html).not.toContain('jutell:auto');
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });

  it('makes no external requests: no scripts, links, src/href, url(); CSP default-src none', () => {
    const html = renderMapHtml('# 지도\n## 로그인\n- https://evil.example/x.js — 기능\n');
    expect(html).toContain(`content="default-src 'none'; style-src 'unsafe-inline'"`);
    expect(html).not.toMatch(/<script|<link|<iframe|<img|\ssrc=|\shref=|url\(|@import/i);
    expect(html).toContain('<details open><summary>로그인</summary>');
  });
});

describe('jutell map (W3)', () => {
  it('creates JuTellMap.md and .jutell-local/map.html, then says in one line what changed', async () => {
    const { dir, run } = await project();
    const first = run('map');
    expect(first.status).toBe(0);
    expect(first.stdout).toContain('프로젝트 지도(JuTellMap.md)를 만들었어요. 파일 3개');
    expect(first.stdout).toContain('보기 쉬운 화면: .jutell-local/map.html');
    const html = await fs.readFile(path.join(dir, '.jutell-local', 'map.html'), 'utf8');
    expect(html).toContain('<li>src/auth/login.ts — 기능</li>');

    expect(run('map').stdout).toContain('프로젝트 지도(JuTellMap.md)는 바뀐 것이 없어요.');

    await fs.writeFile(path.join(dir, 'src', 'auth', 'session.ts'), 'x');
    await fs.mkdir(path.join(dir, 'src', 'reports'));
    await fs.writeFile(path.join(dir, 'src', 'reports', 'r.ts'), 'x');
    await fs.rm(path.join(dir, 'index.js'));
    const third = run('map');
    expect(third.stdout).toContain('프로젝트 지도(JuTellMap.md)를 갱신했어요: 새 파일 2개, 빠진 파일 1개, 새 칸 1개(reports).');
    expect(await fs.readFile(path.join(dir, '.jutell-local', 'map.html'), 'utf8')).toContain('session.ts');
  });

  it('rejects unknown options and shows help', async () => {
    const { run } = await project();
    expect(run('map', '--nope').status).not.toBe(0);
    expect(run('map', '--help').stdout).toContain('jutell map');
    expect(run('--help').stdout).toContain('jutell map            프로젝트 지도');
  });

  it('works in a Korean path with spaces', async () => {
    const { dir, run } = await project('한글 폴더/내 프로젝트', ['src/로그인/화면.tsx']);
    expect(run('map').status).toBe(0);
    expect(await fs.readFile(path.join(dir, '.jutell-local', 'map.html'), 'utf8')).toContain('src/로그인/화면.tsx');
  });
});

describe('"지도 오래됨" in doctor and status: one rule, the file LIST (dogfood fix)', () => {
  it('정상 when absent or fresh; a content-only change (even a newer file) gives no warning', async () => {
    const { dir, paths } = await project();
    expect((await mapFreshnessCheck(paths))?.status).toBe('정상');
    await writeMap(paths);
    expect(await mapFreshnessCheck(paths)).toMatchObject({ status: '정상', detail: '지도가 최신이에요.' });
    await fs.writeFile(path.join(dir, 'index.js'), 'changed content');
    const future = new Date(Date.now() + 60_000);
    await fs.utimes(path.join(dir, 'index.js'), future, future);
    expect(await mapFreshnessCheck(paths)).toMatchObject({ status: '정상', detail: '지도가 최신이에요.' });
  });

  it('an added file gives a warning', async () => {
    const { dir, paths } = await project();
    await writeMap(paths);
    await fs.writeFile(path.join(dir, 'src', 'auth', 'session.ts'), 'x');
    expect(await mapFreshnessCheck(paths)).toMatchObject({ status: '주의', detail: '지도 오래됨: 지도에 없는 새 파일 1개(src/auth/session.ts). `jutell map`으로 갱신하세요.' });
  });

  it('a deleted file gives a warning (a move shows both)', async () => {
    const { dir, paths } = await project();
    await writeMap(paths);
    await fs.rm(path.join(dir, 'index.js'));
    expect((await mapFreshnessCheck(paths))?.detail).toBe('지도 오래됨: 지도에 없는 없어진 파일 1개(index.js). `jutell map`으로 갱신하세요.');
    await fs.rename(path.join(dir, 'src', 'payments', 'refund.ts'), path.join(dir, 'src', 'payments', 'refund2.ts'));
    const detail = (await mapFreshnessCheck(paths))?.detail ?? '';
    expect(detail).toContain('새 파일 1개(src/payments/refund2.ts)');
    expect(detail).toContain('없어진 파일 2개');
  });

  it('records the file list in map-state.json (version 2); an old version-1 state falls back to the map lines', async () => {
    const { dir, paths } = await project();
    await writeMap(paths);
    const stateFile = path.join(dir, '.jutell-local', 'map-state.json');
    const state = JSON.parse(await fs.readFile(stateFile, 'utf8'));
    expect(state).toMatchObject({ version: 2, files: ['index.js', 'src/auth/login.ts', 'src/payments/refund.ts'] });
    await fs.writeFile(stateFile, JSON.stringify({ version: 1, file: 'JuTellMap.md', hash: state.hash, writtenAt: state.writtenAt }));
    expect((await mapFreshnessCheck(paths))?.status).toBe('정상');
    await fs.writeFile(path.join(dir, 'new.js'), 'x');
    expect((await mapFreshnessCheck(paths))?.detail).toContain('새 파일 1개(new.js)');
    // `jutell map` with nothing changed in the map still upgrades the state with the list, keeping the old hash.
    await fs.rm(path.join(dir, 'new.js'));
    expect(await writeMap(paths)).toMatchObject({ status: 'unchanged' });
    expect(JSON.parse(await fs.readFile(stateFile, 'utf8'))).toMatchObject({ version: 2, hash: state.hash, files: state.files });
  });

  it('built doctor shows the 주의 line but its exit code does not change because of it; status prints it too', async () => {
    const { dir, run } = await project();
    run('map');
    await fs.writeFile(path.join(dir, 'index.js'), 'edited');
    const fresh = run('doctor', '--json');
    const freshCheck = (JSON.parse(fresh.stdout) as Array<{ name: string; status: string }>).find((check) => check.name === '프로젝트 지도');
    expect(freshCheck?.status).toBe('정상');
    await fs.writeFile(path.join(dir, 'extra.js'), 'x');
    const stale = run('doctor', '--json');
    const staleCheck = (JSON.parse(stale.stdout) as Array<{ name: string; status: string }>).find((check) => check.name === '프로젝트 지도');
    expect(staleCheck?.status).toBe('주의');
    expect(stale.status).toBe(fresh.status);
    expect(run('status').stdout).toContain('주의: 지도 오래됨');
  });
});
