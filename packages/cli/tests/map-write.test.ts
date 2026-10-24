import { execFileSync, spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { resolveScope } from '../src/config/paths.js';
import { readMapSelectionDetail, writeMapSelectionFiles } from '../src/map/selection.js';
import { scanProject } from '../src/map/scan.js';
import { MAP_COPY_FILE, MAP_FILE, MAP_LATER, MAP_QUESTION, MAP_STATE_FILE, offerMap, parseMap, sha256, writeMap } from '../src/map/write.js';
import { parseYesNo } from '../src/output/format.js';
import type { CliIo } from '../src/types.js';

const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const roots: string[] = [];
afterAll(async () => { await Promise.all(roots.map((root) => fs.rm(root, { recursive: true, force: true }))); });

async function project(name = 'proj', files = ['src/auth/LoginForm.tsx', 'src/payments/pay-ui.ts', 'src/payments/refund.ts', 'scripts/migrate-2024.js', 'index.js']) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-mapw-'));
  roots.push(root);
  const dir = path.join(root, name);
  for (const file of files) {
    await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await fs.writeFile(path.join(dir, file), 'x');
  }
  await fs.mkdir(dir, { recursive: true });
  return { dir, paths: resolveScope('project', dir) };
}
const NOW = new Date('2026-10-20T14:03:00.000Z');
const LATER = new Date('2026-10-21T09:00:00.000Z');
const read = (file: string) => fs.readFile(file, 'utf8');

/** Lines outside jutell:auto blocks, minus the jutell-managed "마지막 갱신" line. */
function humanLines(text: string) {
  const out: string[] = [];
  let inside = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('<!-- jutell:auto ')) { inside = true; out.push(line); continue; }
    if (line === '<!-- /jutell:auto -->') { inside = false; out.push(line); continue; }
    if (!inside && !line.startsWith('마지막 갱신:')) out.push(line);
  }
  return out;
}

describe('map write (W2)', () => {
  it('creates JuTellMap.md in the plan §1 format and records its hash in .jutell-local/map-state.json', async () => {
    const { dir, paths } = await project();
    expect(await writeMap(paths, NOW)).toMatchObject({ status: 'created', files: 5, unclassified: 2 });
    const text = await read(path.join(dir, MAP_FILE));
    expect(text).toBe([
      '# JuTell 지도 — 이 프로젝트는 어떻게 생겼나요?',
      '<!-- 이 파일은 jutell이 자동으로 고칩니다. "설명:" 줄과 직접 옮긴 파일 줄은 그대로 남습니다. -->',
      '마지막 갱신: 2026-10-20 14:03 UTC · 파일 5개 · 분류 안 된 파일 2개 · 목록 기준 폴더 탐색 · 20,000개 상한 내',
      '',
      '## 로그인 [지도 기준 추정]', '<!-- jutell:auto 로그인 -->', '- src/auth/LoginForm.tsx — 화면', '<!-- /jutell:auto -->',
      '',
      '## 결제 [지도 기준 추정]', '<!-- jutell:auto 결제 -->', '- src/payments/pay-ui.ts — 기능', '- src/payments/refund.ts — 기능', '<!-- /jutell:auto -->',
      '',
      '## 아직 분류 안 된 파일', '설명: 아래 줄을 원하는 기능 칸으로 옮기면, 다음부터 그 칸에 둡니다.', '<!-- jutell:auto 분류 안 됨 -->', '- index.js — 기능', '- scripts/migrate-2024.js — 기능', '<!-- /jutell:auto -->',
      '',
    ].join('\n'));
    const state = JSON.parse(await read(path.join(dir, '.jutell-local', MAP_STATE_FILE)));
    expect(state).toMatchObject({ version: 1, file: MAP_FILE, hash: sha256(text) });
    expect(await read(path.join(dir, '.jutell-local', '.gitignore'))).toBe('*\n');
  });

  it('keeps "설명:" lines, human-edited section names and moved file lines byte for byte; only auto blocks change', async () => {
    const { dir, paths } = await project();
    await writeMap(paths, NOW);
    const file = path.join(dir, MAP_FILE);
    let text = await read(file);
    text = text
      .replace('## 로그인 [지도 기준 추정]\n', '## 로그인 [지도 기준 추정]\n설명: 회원이 들어오고 나가는 기능이에요.        ← 사람이 쓴 줄\n')
      .replace('## 결제 [지도 기준 추정]', '## 결제 (내가 지은 이름)')
      // moved out of every auto block into the 로그인 section: pinned there
      .replace('- index.js — 기능\n', '')
      .replace('설명: 회원이 들어오고 나가는 기능이에요.        ← 사람이 쓴 줄\n', '설명: 회원이 들어오고 나가는 기능이에요.        ← 사람이 쓴 줄\n- index.js — 기능 (여기가 맞아요)\n')
      // moved into another auto block: stays in that block
      .replace('- scripts/migrate-2024.js — 기능\n', '')
      .replace('<!-- jutell:auto 결제 -->\n', '<!-- jutell:auto 결제 -->\n- scripts/migrate-2024.js — 기능\n');
    await fs.writeFile(file, text);
    await fs.writeFile(path.join(dir, 'src', 'auth', 'session.ts'), 'x');

    expect((await writeMap(paths, LATER)).status).toBe('updated');
    const after = await read(file);
    expect(humanLines(after)).toEqual(humanLines(text));
    expect(after).toContain('- index.js — 기능 (여기가 맞아요)');
    expect(after.match(/index\.js/g)).toHaveLength(1);
    expect(after).toContain('<!-- jutell:auto 결제 -->\n- scripts/migrate-2024.js — 기능\n- src/payments/pay-ui.ts — 기능\n- src/payments/refund.ts — 기능\n<!-- /jutell:auto -->');
    expect(after).toContain('<!-- jutell:auto 로그인 -->\n- src/auth/LoginForm.tsx — 화면\n- src/auth/session.ts — 기능\n<!-- /jutell:auto -->');
    expect(after).toContain('## 결제 (내가 지은 이름)\n<!-- jutell:auto 결제 -->\n- scripts/migrate-2024.js — 기능\n- src/payments/pay-ui.ts — 기능\n- src/payments/refund.ts — 기능');
    expect(after).toContain('## 로그인 [지도 기준 추정]');
    expect(after).not.toContain('## 결제 (내가 지은 이름) [지도 기준 추정]');
    expect(after).toContain('마지막 갱신: 2026-10-21 09:00 UTC · 파일 6개 · 분류 안 된 파일 0개 · 목록 기준 폴더 탐색 · 20,000개 상한 내');
  });

  it('new features get a new section before "아직 분류 안 된 파일"; CRLF maps stay CRLF', async () => {
    const { dir, paths } = await project();
    await writeMap(paths, NOW);
    const file = path.join(dir, MAP_FILE);
    await fs.writeFile(file, (await read(file)).replace(/\n/g, '\r\n'));
    await fs.mkdir(path.join(dir, 'src', 'billing'), { recursive: true });
    await fs.mkdir(path.join(dir, 'src', 'reports'), { recursive: true });
    await fs.writeFile(path.join(dir, 'src', 'reports', 'r.ts'), 'x');
    await writeMap(paths, LATER);
    const after = await read(file);
    expect(after.split('\r\n').join('').includes('\n')).toBe(false);
    expect(after.indexOf('## reports [지도 기준 추정]')).toBeGreaterThan(after.indexOf('## 결제'));
    expect(after.indexOf('## reports [지도 기준 추정]')).toBeLessThan(after.indexOf('## 아직 분류 안 된 파일'));
  });

  it('writes nothing when nothing changed (mtime and bytes stay the same)', async () => {
    const { dir, paths } = await project();
    await writeMap(paths, NOW);
    const file = path.join(dir, MAP_FILE);
    const old = new Date(2020, 0, 1);
    await fs.utimes(file, old, old);
    const before = await read(file);
    expect((await writeMap(paths, LATER)).status).toBe('unchanged');
    expect((await fs.stat(file)).mtimeMs).toBe(old.getTime());
    expect(await read(file)).toBe(before);
  });

  it('reports a partial detail write and rejects a stale card if a later write fails', async () => {
    const { dir, paths } = await project();
    await writeMap(paths, NOW);
    const mapFile = path.join(dir, MAP_FILE);
    const map = await read(mapFile);
    const indexFile = path.join(dir, '.jutell-local', 'map-index.json');
    const indexBefore = await read(indexFile);
    const index = JSON.parse(indexBefore) as { sections: Array<{ id: string }> };
    await fs.writeFile(path.join(dir, 'src', 'auth', 'session.ts'), 'x');
    await fs.writeFile(path.join(dir, 'src', 'payments', 'new.ts'), 'x');
    const scan = await scanProject(dir);
    const changedMap = map
      .replace('<!-- jutell:auto 로그인 -->\n', '<!-- jutell:auto 로그인 -->\n- src/auth/session.ts — 기능\n')
      .replace('<!-- jutell:auto 결제 -->\n', '<!-- jutell:auto 결제 -->\n- src/payments/new.ts — 기능\n');
    let calls = 0;
    const result = await writeMapSelectionFiles(paths, changedMap, scan, LATER, 'a'.repeat(40), async (file, content) => {
      calls += 1;
      if (calls === 2) throw new Error('simulated write failure');
      await fs.writeFile(file, content, 'utf8');
    });
    expect(result.status).toBe('skipped');
    expect(result.reason).toContain('부분 갱신됨');
    expect(result.reason).toContain(index.sections[0]!.id);
    expect(await read(indexFile)).toBe(indexBefore);
    await expect(readMapSelectionDetail(paths, index.sections[0]!.id)).rejects.toThrow('현재 인덱스 출처와 맞지 않아요');
  });

  it('replaces the file via a temp file + rename and leaves no temp file behind', async () => {
    const { dir, paths } = await project();
    await writeMap(paths, NOW);
    const file = path.join(dir, MAP_FILE);
    const inode = (await fs.stat(file)).ino;
    await fs.writeFile(path.join(dir, 'new.ts'), 'x');
    expect((await writeMap(paths, LATER)).status).toBe('updated');
    expect((await fs.stat(file)).ino).not.toBe(inode);
    expect((await fs.readdir(dir)).filter((name) => name.includes('jutell-tmp'))).toEqual([]);
  });

  it('never writes through a link', async () => {
    const { dir, paths } = await project();
    const target = path.join(dir, 'elsewhere.md');
    await fs.writeFile(target, 'mine');
    await fs.symlink(target, path.join(dir, MAP_FILE));
    expect((await writeMap(paths, NOW)).status).toBe('link');
    expect(await read(target)).toBe('mine');
  });

  it('a broken map is not overwritten: a fresh copy goes to .jutell-local and the reason is reported', async () => {
    const { dir, paths } = await project();
    await writeMap(paths, NOW);
    const file = path.join(dir, MAP_FILE);
    const broken = (await read(file)).replace('<!-- /jutell:auto -->\n\n## 결제', '\n## 결제');
    await fs.writeFile(file, broken);
    const result = await writeMap(paths, LATER);
    expect(result.status).toBe('broken');
    expect(await read(file)).toBe(broken);
    expect(await read(path.join(dir, '.jutell-local', MAP_COPY_FILE))).toContain('<!-- jutell:auto 로그인 -->');
    for (const bad of ['<!-- /jutell:auto -->\n', '<!-- jutell:auto a -->\n', '<!-- jutell:auto a -->\n<!-- /jutell:auto -->\n<!-- jutell:auto a -->\n<!-- /jutell:auto -->\n']) {
      expect(typeof parseMap(bad)).toBe('string');
    }
  });

  it('works in a Korean path with spaces', async () => {
    const { dir, paths } = await project('한글 폴더/내 프로젝트', ['src/로그인/화면.tsx', '설명 문서.md']);
    expect((await writeMap(paths, NOW)).status).toBe('created');
    expect(await read(path.join(dir, MAP_FILE))).toContain('- src/로그인/화면.tsx — 화면');
  });
});

describe('install question (W2)', () => {
  function fakeIo(answer?: string) {
    const asked: string[] = [];
    const written: string[] = [];
    const io = {
      write: (message: string) => { written.push(message); },
      error: () => {},
      ask: async (message: string, defaultYes = false) => { asked.push(message); return parseYesNo(answer ?? '', defaultYes); },
      choose: async () => undefined,
    } as unknown as CliIo;
    return { io, asked, written };
  }

  it('Enter → asks once and creates the map', async () => {
    const { dir, paths } = await project();
    const { io, asked } = fakeIo('');
    expect(await offerMap(paths, {} as never, io, true)).toEqual({ asked: true, created: true });
    expect(asked).toEqual([MAP_QUESTION]);
    await expect(fs.stat(path.join(dir, MAP_FILE))).resolves.toBeTruthy();
  });

  it('"n" → does not create and says it can be made later with `jutell map`', async () => {
    const { dir, paths } = await project();
    const { io, written } = fakeIo('n');
    expect(await offerMap(paths, {} as never, io, true)).toEqual({ asked: true, created: false });
    await expect(fs.stat(path.join(dir, MAP_FILE))).rejects.toThrow();
    expect(written).toEqual([MAP_LATER]);
  });

  it('--yes → creates without asking', async () => {
    const { dir, paths } = await project();
    const { io, asked } = fakeIo();
    expect(await offerMap(paths, { yes: true } as never, io, false)).toEqual({ asked: false, created: true });
    expect(asked).toEqual([]);
    await expect(fs.stat(path.join(dir, MAP_FILE))).resolves.toBeTruthy();
  });

  it('existing map → does not ask and does not touch it', async () => {
    const { dir, paths } = await project();
    await fs.writeFile(path.join(dir, MAP_FILE), 'my map');
    const { io, asked } = fakeIo('');
    expect(await offerMap(paths, {} as never, io, true)).toEqual({ asked: false, created: false });
    expect(asked).toEqual([]);
    expect(await read(path.join(dir, MAP_FILE))).toBe('my map');
  });

  it('no terminal and no --yes → does not ask and does not create', async () => {
    const { dir, paths } = await project();
    const { io, asked } = fakeIo('');
    expect(await offerMap(paths, {} as never, io, false)).toEqual({ asked: false, created: false });
    expect(asked).toEqual([]);
    await expect(fs.stat(path.join(dir, MAP_FILE))).rejects.toThrow();
  });

  it('built CLI: `jutell setup --yes` creates JuTellMap.md and map-state.json', async () => {
    const { dir } = await project();
    const home = path.join(path.dirname(dir), 'home');
    await fs.mkdir(home, { recursive: true });
    execFileSync('git', ['init', '-q'], { cwd: dir });
    const env = { ...process.env, HOME: home, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: home, JUTELL_NO_FUNDING: '1' };
    const result = spawnSync(process.execPath, [cliEntry, 'setup', '--yes'], { cwd: dir, env, encoding: 'utf8', timeout: 30000 });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('프로젝트 지도(JuTellMap.md)를 만들었어요.');
    expect(await read(path.join(dir, MAP_FILE))).toContain('<!-- jutell:auto 로그인 -->');
    await expect(fs.stat(path.join(dir, '.jutell-local', MAP_STATE_FILE))).resolves.toBeTruthy();
  });
});
