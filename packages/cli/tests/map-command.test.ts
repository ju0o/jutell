import { execFileSync, spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { resolveScope } from '../src/config/paths.js';
import { mapFreshnessCheck } from '../src/commands/map.js';
import { escapeHtml, renderMapHtml } from '../src/map/html.js';
import { MAP_DETAILS_DIR, MAP_INDEX_FILE } from '../src/map/selection.js';
import { MAP_FILE, sha256, writeMap } from '../src/map/write.js';

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
  const env = { ...process.env, HOME: home, USERPROFILE: home, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: home, JUTELL_NO_FUNDING: '1' };
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
    expect(html).toContain('<summary>&lt;b&gt;기능&lt;/b&gt;<span class="count">파일 2개</span></summary>');
    expect(html).toContain('<td><a href="#f-b-기능-b">&lt;b&gt;기능&lt;/b&gt;</a></td><td>2</td><td>1</td><td>1</td><td>0</td><td>0</td>');
    expect(html).not.toContain('jutell:auto');
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });

  it('uses a collapsed index with no scripts or external requests; CSP default-src none', () => {
    const html = renderMapHtml('# 지도\n## 로그인\n- https://evil.example/x.js — 기능\n');
    expect(html).toContain(`content="default-src 'none'; style-src 'unsafe-inline'"`);
    expect(html).not.toMatch(/<script|<link|<iframe|<img|\ssrc=|href="https?:|url\(|@import/i);
    // W10: the only links are in-page anchors from the overview table to the cards.
    for (const href of html.match(/\shref="[^"]*"/g) ?? []) expect(href).toMatch(/^ href="#f-/);
    expect(html).toContain('<h2 id="cards">기능별 파일 목록');
    expect(html).toContain('<details id="f-로그인"><summary>로그인<span class="count">파일 1개</span></summary>');
    expect(html).toContain('<strong>데이터 연결</strong>은 모름');
    expect(html).toContain('통과했는지 몰라요');
  });

  it('keeps file paths behind the index and labels grouping and verification limits', () => {
    const html = renderMapHtml('# 지도\n## 로그인 [지도 기준 추정]\n- src/auth/Login.tsx — 화면\n- src/auth/login.test.ts — 테스트\n');
    expect(html.indexOf('기능별 파일 목록')).toBeLessThan(html.indexOf('src/auth/Login.tsx'));
    expect(html).toContain('<td>2</td><td>1</td><td>0</td><td>1</td><td>0</td>');
    expect(html).toContain('기능 이름과 역할은 지도 기준 추정');
    expect(html).toContain('<strong>데이터 연결</strong>은 모름');
    expect(html).toContain('<strong>테스트 경로</strong>는 지도에 적힌 파일이고, 테스트를 실행하지 않아 통과했는지 몰라요');
    expect(html).toContain('<strong>코드 경로</strong>: 없음');
    expect(html).not.toMatch(/미확인|존재\//);
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
    const index = JSON.parse(await fs.readFile(path.join(dir, '.jutell-local', MAP_INDEX_FILE), 'utf8')) as { sections: Array<{ name: string; id: string }> };
    const login = index.sections.find((section) => section.name === '로그인');
    expect(login).toBeDefined();
    expect(await fs.readFile(path.join(dir, '.jutell-local', MAP_DETAILS_DIR, `${login!.id}.md`), 'utf8')).toContain('session.ts');
  });

  it('rejects unknown options and shows help', async () => {
    const { run } = await project();
    expect(run('map', '--nope').status).not.toBe(0);
    expect(run('map', '--help').stdout).toContain('jutell map');
    expect(run('map', '--help').stdout).toContain('jutell map --show <기능 이름 일부>');
    // No argument: usage, not an error (dogfood #37).
    const bare = run('map', '--show');
    expect(bare.status).toBe(0);
    expect(bare.stdout).toContain('사용법: jutell map --show <기능 이름 일부>');
  });

  it('works in a Korean path with spaces', async () => {
    const { dir, run } = await project('한글 폴더/내 프로젝트', ['src/로그인/화면.tsx']);
    expect(run('map').status).toBe(0);
    expect(await fs.readFile(path.join(dir, '.jutell-local', 'map.html'), 'utf8')).toContain('src/로그인/화면.tsx');
  });

  it('keeps the full JuTellMap.md and reads one selected detail from a small index', async () => {
    const { dir, run } = await project('proj', [
      'src/auth/LoginForm.tsx', 'src/auth/session.ts', 'src/auth/odd`file.ts', 'tests/auth.test.ts',
      'src/payments/Checkout.tsx', 'src/payments/charge.ts', 'tests/payments.test.ts',
      'src/reports/summary.ts', 'src/reports/export.ts',
    ]);
    expect(run('map').status).toBe(0);
    let userEditedMap = await fs.readFile(path.join(dir, MAP_FILE), 'utf8');
    userEditedMap = userEditedMap.replace('<!-- jutell:auto 로그인 -->', '설명: # 링크 [x](javascript:alert(1))\u001b[31m\n<!-- jutell:auto 로그인 -->');
    await fs.writeFile(path.join(dir, MAP_FILE), userEditedMap);
    await writeMap(resolveScope('project', dir));
    const fullMapFile = path.join(dir, MAP_FILE);
    const fullMap = await fs.readFile(fullMapFile, 'utf8');
    expect(fullMap).toContain('src/payments/Checkout.tsx');

    const indexFile = path.join(dir, '.jutell-local', MAP_INDEX_FILE);
    const indexText = await fs.readFile(indexFile, 'utf8');
    const index = JSON.parse(indexText) as { sourceMap: { path: string; sha256: string; commit: string | null }; sections: Array<{ id: string; name: string; detail: string; pathCount: number }> };
    const login = index.sections.find((section) => section.name === '로그인');
    const payments = index.sections.find((section) => section.name === '결제');
    expect(login).toBeDefined();
    expect(payments).toBeDefined();
    expect(login!.pathCount).toBe(4);
    expect(index.sections.some((section) => section.name === '아직 분류 안 된 파일')).toBe(false);
    expect(index.sourceMap).toEqual({ path: MAP_FILE, sha256: sha256(fullMap), commit: null });
    expect(indexText).not.toContain('src/auth/LoginForm.tsx');

    const detailFile = path.join(dir, '.jutell-local', MAP_DETAILS_DIR, `${login!.id}.md`);
    const detail = await fs.readFile(detailFile, 'utf8');
    expect(detail).toContain('src/auth/LoginForm.tsx');
    expect(detail).toContain('- `` src/auth/odd`file.ts `` — 기능');
    expect(detail).toContain('\\# 링크 \\[x\\]\\(javascript:alert\\(1\\)\\)\\\\u001b\\[31m');
    expect(detail).not.toContain('해당 역할로');
    expect(detail).toContain('데이터가 어떻게 이어지는지');
    expect(detail).toContain('테스트가 통과하는지');
    expect(detail).not.toMatch(/SHA-256|단면/);

    const unselectedDetail = path.join(dir, '.jutell-local', MAP_DETAILS_DIR, `${payments!.id}.md`);
    await fs.rm(unselectedDetail);
    const movedMap = path.join(dir, `${MAP_FILE}.temporarily-hidden`);
    await fs.rename(fullMapFile, movedMap);
    const list = run('map', '--list');
    const shown = run('map', '--show', login!.id);
    await fs.rename(movedMap, fullMapFile);
    expect(list.status).toBe(0);
    // IDs and commits are for the AI's files only (dogfood #37).
    expect(list.stdout).not.toContain(login!.id);
    expect(list.stdout).not.toMatch(/커밋 [0-9a-f]{7}|ID f-/);
    expect(list.stdout).toContain('- 로그인 · 파일 4개');
    expect(list.stdout).toContain('jutell map --show <기능 이름 일부>');
    expect(list.stdout).toContain('파일 목록: Git 파일 목록');
    expect(list.stdout).not.toContain('src/auth/LoginForm.tsx');
    expect(shown.status).toBe(0);
    expect(shown.stdout).toContain('src/auth/LoginForm.tsx');
    expect(shown.stdout).toContain(`${MAP_FILE} 기준 · Git 파일 목록`);
    expect(shown.stdout).not.toMatch(/커밋 [0-9a-f]{7}|ID f-/);
    expect(shown.stdout).toContain('지금 폴더와 다시 맞춰 보지 않았어요.');
    expect(shown.stdout).not.toMatch(/SHA-256|선택 단면|라이브 파일|<!--/);
    expect(list.stdout).not.toMatch(/SHA-256|단면/);
    // Keyword search: a part of the name opens the same detail.
    const byName = run('map', '--show', '로그');
    expect(byName.status).toBe(0);
    expect(byName.stdout).toContain('src/auth/LoginForm.tsx');
    const none = run('map', '--show', '없는기능');
    expect(none.status).not.toBe(0);
    expect(none.stderr).toContain('들어간 기능 이름이 없어요');
    expect(shown.stdout).not.toContain('src/payments/Checkout.tsx');
    await expect(fs.stat(unselectedDetail)).rejects.toThrow();
    expect(await fs.readFile(fullMapFile, 'utf8')).toContain('src/payments/Checkout.tsx');
    await fs.writeFile(detailFile, `${detail.split('\n', 1)[0]}\nraw \u001b[31mcontrol\u202e\rreturn`);
    const terminalSafe = run('map', '--show', login!.id);
    expect(terminalSafe.status).toBe(0);
    expect(terminalSafe.stdout).toContain('\\u001b[31mcontrol\\u202e\\u000dreturn');
    expect(terminalSafe.stdout).not.toContain('\u001b');
    expect(terminalSafe.stdout).not.toContain('\r');
    await fs.writeFile(detailFile, '사용자가 만든 같은 이름의 파일');
    const rejected = run('map', '--show', login!.id);
    expect(rejected.status).not.toBe(0);
    expect(rejected.stderr).toContain('현재 인덱스 출처와 맞지 않아요');
  });

  it('refreshes only the feature detail whose evidence changed', async () => {
    const { dir, run } = await project('proj', ['src/auth/LoginForm.tsx', 'src/payments/Checkout.tsx']);
    expect(run('map').status).toBe(0);
    const dataDir = path.join(dir, '.jutell-local');
    const indexFile = path.join(dataDir, MAP_INDEX_FILE);
    const before = JSON.parse(await fs.readFile(indexFile, 'utf8')) as {
      generatedAt: string;
      sourceMap: { sha256: string };
      sections: Array<{ id: string; name: string }>;
    };
    const login = before.sections.find((section) => section.name === '로그인')!;
    const payments = before.sections.find((section) => section.name === '결제')!;
    const loginFile = path.join(dataDir, MAP_DETAILS_DIR, `${login.id}.md`);
    const paymentsFile = path.join(dataDir, MAP_DETAILS_DIR, `${payments.id}.md`);
    const loginBefore = await fs.readFile(loginFile, 'utf8');
    const paymentsBefore = await fs.readFile(paymentsFile, 'utf8');

    await fs.writeFile(path.join(dir, 'src', 'auth', 'session.ts'), 'x');
    expect(run('map').status).toBe(0);

    const afterMap = await fs.readFile(path.join(dir, MAP_FILE), 'utf8');
    const after = JSON.parse(await fs.readFile(indexFile, 'utf8')) as typeof before;
    expect(after.sourceMap.sha256).toBe(sha256(afterMap));
    expect(after.generatedAt).not.toBe(before.generatedAt);
    expect(await fs.readFile(loginFile, 'utf8')).not.toBe(loginBefore);
    expect(await fs.readFile(loginFile, 'utf8')).toContain('src/auth/session.ts');
    expect(await fs.readFile(paymentsFile, 'utf8')).toBe(paymentsBefore);
  });

  it('does not follow symlinked map data directories during selected reads', async () => {
    const { dir, run } = await project();
    expect(run('map').status).toBe(0);
    const dataRoot = path.join(dir, '.jutell-local');
    const savedData = path.join(dir, '.jutell-local-saved');
    await fs.rename(dataRoot, savedData);
    await fs.symlink(savedData, dataRoot);
    const list = run('map', '--list');
    expect(list.status).not.toBe(0);
    expect(list.stderr).toContain('.jutell-local 경로가 일반 폴더가 아니어서 인덱스를 읽지 않았어요');
    await fs.rm(dataRoot);
    await fs.rename(savedData, dataRoot);

    const index = JSON.parse(await fs.readFile(path.join(dataRoot, MAP_INDEX_FILE), 'utf8')) as { sections: Array<{ id: string; name: string }> };
    const login = index.sections.find((section) => section.name === '로그인')!;
    const detailsDir = path.join(dataRoot, MAP_DETAILS_DIR);
    const savedDetails = path.join(dataRoot, `${MAP_DETAILS_DIR}-saved`);
    await fs.rename(detailsDir, savedDetails);
    await fs.symlink(savedDetails, detailsDir);
    const shown = run('map', '--show', login.id);
    expect(shown.status).not.toBe(0);
    expect(shown.stderr).toContain('기능 상세 폴더가 일반 폴더가 아니어서 읽지 않았어요');
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
    expect((await mapFreshnessCheck(paths))?.detail).toBe('지도 오래됨: 지도에는 있지만 폴더에서 없어진 파일 1개(index.js). `jutell map`으로 갱신하세요.');
    await fs.rename(path.join(dir, 'src', 'payments', 'refund.ts'), path.join(dir, 'src', 'payments', 'refund2.ts'));
    const detail = (await mapFreshnessCheck(paths))?.detail ?? '';
    expect(detail).toContain('새 파일 1개(src/payments/refund2.ts)');
    expect(detail).toContain('없어진 파일 2개');
  });

  it('jutell on/off adding or removing its own AGENTS.md does not make the map out of date (dogfood #37)', async () => {
    const { dir, paths } = await project();
    await fs.writeFile(path.join(dir, 'AGENTS.md'), '# rules');
    await writeMap(paths);
    await fs.rm(path.join(dir, 'AGENTS.md'));
    expect(await mapFreshnessCheck(paths)).toMatchObject({ status: '정상', detail: '지도가 최신이에요.' });
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
