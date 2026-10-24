import { execFileSync, spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { resolveScope } from '../src/config/paths.js';
import { MAP_COPY_FILE, MAP_DECLINED_FILE, MAP_DECLINED_NOTE, MAP_GUIDE, MAP_FILE, MAP_LATER, MAP_QUESTION, MAP_STATE_FILE, mapDeclined, mapWriteMessage, offerMap, rememberMapDeclined, parseMap, sha256, stamp, writeMap } from '../src/map/write.js';
import { MAP_HTML_FILE, renderMapHtml } from '../src/map/html.js';
import { readMapSelectionDetail, writeMapSelectionFiles } from '../src/map/selection.js';
import { scanProject } from '../src/map/scan.js';
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

describe('map readability (dogfood fix)', () => {
  it('a new map starts with one plain Korean line before the first marker', async () => {
    const { dir, paths } = await project();
    await writeMap(paths, NOW);
    const lines = (await read(path.join(dir, MAP_FILE))).split('\n');
    expect(MAP_GUIDE).toBe('<!-- --> 로 된 줄은 JuTell이 자동으로 고치는 자리 표시예요. 지우지 말고, 설명은 마음대로 고쳐도 돼요.');
    expect(lines.indexOf(MAP_GUIDE)).toBe(1);
    expect(lines.indexOf(MAP_GUIDE)).toBeLessThan(lines.findIndex((line) => line.startsWith('<!-- jutell:auto')));
  });

  it('an existing map (old note, old "분류 안 됨" marker, "할 일 목록" section) keeps every human byte on refresh; the guide line is not forced in', async () => {
    const { dir, paths } = await project('old', ['test-app/todo.html', 'AGENTS.md']);
    const old = [
      '# JuTell 지도 — 이 프로젝트는 어떻게 생겼나요?',
      '<!-- 이 파일은 jutell이 자동으로 고칩니다. "설명:" 줄과 직접 옮긴 파일 줄은 그대로 남습니다. -->',
      '마지막 갱신: 2026-10-19 01:06 · 파일 2개 · 분류 안 된 파일 1개',
      '',
      '## 할 일 목록 (내가 고친 제목)', '<!-- jutell:auto 할 일 목록 -->', '- test-app/todo.html — 화면', '<!-- /jutell:auto -->',
      '',
      '## 아직 분류 안 된 파일', '설명: 내 설명', '<!-- jutell:auto 분류 안 됨 -->', '- AGENTS.md — 문서', '<!-- /jutell:auto -->',
      '',
    ].join('\n');
    await fs.writeFile(path.join(dir, MAP_FILE), old);
    expect(await writeMap(paths, LATER)).toMatchObject({ status: 'unchanged' });
    expect(await read(path.join(dir, MAP_FILE))).toBe(old);
    await fs.writeFile(path.join(dir, 'README.md'), 'x');
    await fs.writeFile(path.join(dir, 'test-app', 'todo.css'), 'x');
    expect(await writeMap(paths, LATER)).toMatchObject({ status: 'updated', added: ['README.md', 'test-app/todo.css'], newSections: [] });
    const after = await read(path.join(dir, MAP_FILE));
    expect(humanLines(after)).toEqual(humanLines(old));
    expect(after).toContain('<!-- jutell:auto 분류 안 됨 -->\n- AGENTS.md — 문서\n- README.md — 문서\n<!-- /jutell:auto -->');
    expect(after).toContain('<!-- jutell:auto 할 일 목록 -->\n- test-app/todo.css — 화면\n- test-app/todo.html — 화면\n<!-- /jutell:auto -->');
    expect(after).not.toContain('아직 분류 안 된 파일 -->');
    expect(after).not.toContain(MAP_GUIDE);
  });

  it('section names do not drift: marker = heading words; todo files go to the generic "할 일" (not a page title)', async () => {
    const { dir, paths } = await project('todo', ['test-app/todo.html', 'AGENTS.md']);
    await writeMap(paths, NOW);
    const text = await read(path.join(dir, MAP_FILE));
    expect(text).toContain('## 할 일 [지도로 짐작]\n<!-- jutell:auto 할 일 -->');
    expect(text).toContain('## 아직 분류 안 된 파일\n설명: 아래 줄을 원하는 기능 칸으로 옮기면, 다음부터 그 칸에 둡니다.\n<!-- jutell:auto 아직 분류 안 된 파일 -->');
    expect(text).not.toContain('할 일 목록');
  });
});

describe('map write (W2)', () => {
  it('creates JuTellMap.md in the plan §1 format and records its hash in .jutell-local/map-state.json', async () => {
    const { dir, paths } = await project();
    expect(await writeMap(paths, NOW)).toMatchObject({ status: 'created', files: 5, unclassified: 2 });
    const text = await read(path.join(dir, MAP_FILE));
    expect(text).toBe([
      '# JuTell 지도 — 이 프로젝트는 어떻게 생겼나요?',
      MAP_GUIDE,
      `마지막 갱신: ${stamp(NOW)} · 파일 5개 · 분류 안 된 파일 2개 · 목록 기준 폴더 탐색 · 20,000개 상한 내`,
      '',
      '## 로그인 [지도로 짐작]', '<!-- jutell:auto 로그인 -->', '- src/auth/LoginForm.tsx — 화면', '<!-- /jutell:auto -->',
      '',
      '## 결제 [지도로 짐작]', '<!-- jutell:auto 결제 -->', '- src/payments/pay-ui.ts — 기능', '- src/payments/refund.ts — 기능', '<!-- /jutell:auto -->',
      '',
      '## 아직 분류 안 된 파일', '설명: 아래 줄을 원하는 기능 칸으로 옮기면, 다음부터 그 칸에 둡니다.', '<!-- jutell:auto 아직 분류 안 된 파일 -->', '- index.js — 기능', '- scripts/migrate-2024.js — 기능', '<!-- /jutell:auto -->',
      '',
    ].join('\n'));
    const state = JSON.parse(await read(path.join(dir, '.jutell-local', MAP_STATE_FILE)));
    expect(state).toMatchObject({ version: 2, file: MAP_FILE, hash: sha256(text), files: ['index.js', 'scripts/migrate-2024.js', 'src/auth/LoginForm.tsx', 'src/payments/pay-ui.ts', 'src/payments/refund.ts'] });
    expect(await read(path.join(dir, '.jutell-local', '.gitignore'))).toBe('*\n');
  });

  it('keeps "설명:" lines, human-edited section names and moved file lines byte for byte; only auto blocks change', async () => {
    const { dir, paths } = await project();
    await writeMap(paths, NOW);
    const file = path.join(dir, MAP_FILE);
    let text = await read(file);
    text = text
      .replace('## 로그인 [지도로 짐작]\n', '## 로그인 [지도로 짐작]\n설명: 회원이 들어오고 나가는 기능이에요.        ← 사람이 쓴 줄\n')
      .replace('## 결제 [지도로 짐작]', '## 결제 (내가 지은 이름)')
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
    expect(after).toContain('## 로그인 [지도로 짐작]');
    expect(after).not.toContain('## 결제 (내가 지은 이름) [지도로 짐작]');
    expect(after).toContain(`마지막 갱신: ${stamp(LATER)} · 파일 6개 · 분류 안 된 파일 0개 · 목록 기준 폴더 탐색 · 20,000개 상한 내`);
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
    expect(after.indexOf('## reports [지도로 짐작]')).toBeGreaterThan(after.indexOf('## 결제'));
    expect(after.indexOf('## reports [지도로 짐작]')).toBeLessThan(after.indexOf('## 아직 분류 안 된 파일'));
  });

  it('header time is the local time with its zone; a content-identical refresh later keeps the old header', async () => {
    expect(stamp(NOW)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} \(UTC[+-]\d{1,2}(:\d{2})?\)$/);
    const local = new Date(NOW.getTime() - NOW.getTimezoneOffset() * 60000).toISOString().slice(0, 16).replace('T', ' ');
    expect(stamp(NOW).startsWith(local)).toBe(true);
    const { dir, paths } = await project();
    await writeMap(paths, NOW);
    const file = path.join(dir, MAP_FILE);
    expect(await read(file)).toContain(`마지막 갱신: ${stamp(NOW)}`);
    await writeMap(paths, LATER);
    expect(await read(file)).toContain(`마지막 갱신: ${stamp(NOW)}`);
    expect(await read(file)).not.toContain(stamp(LATER));
  });

  it('map.html shows the guide line with its literal "<!-- -->" (escaped), while real marker comments stay hidden', async () => {
    const { dir, paths } = await project();
    await writeMap(paths, NOW);
    const html = renderMapHtml(await read(path.join(dir, MAP_FILE)));
    expect(html).toContain('&lt;!-- --&gt; 로 된 줄은 JuTell이');
    expect(html).not.toContain('jutell:auto');
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

  it('a non-JuTell map-index.json is kept, and the skip reason says it is NOT JuTell format', async () => {
    const { dir, paths } = await project();
    await fs.mkdir(path.join(dir, '.jutell-local'), { recursive: true });
    const indexFile = path.join(dir, '.jutell-local', 'map-index.json');
    await fs.writeFile(indexFile, '{"mine":true}');
    const result = await writeMap(paths, NOW);
    expect(result.selection?.status).toBe('skipped');
    expect(result.selection?.reason).toBe('기존 인덱스가 JuTell 형식이 아니어서 보존함');
    expect(await read(indexFile)).toBe('{"mine":true}');
  });

  it('no .gitignore: node_modules, dist, build… stay out of the map (git and plain folder alike)', async () => {
    const files = ['src/app.ts', 'node_modules/left-pad/index.js', 'dist/app.js', 'build/out.js', 'web/node_modules/x/y.js', 'coverage/lcov.info'];
    for (const useGit of [true, false]) {
      const { dir } = await project(useGit ? 'git' : 'plain', files);
      if (useGit) execFileSync('git', ['init', '-q'], { cwd: dir });
      expect((await scanProject(dir)).files).toEqual(['src/app.ts']);
    }
  });

  it('tracked files under build/ or vendor/ stay in the map; only untracked ones there are left out', async () => {
    const { dir } = await project('tracked', ['src/app.ts', 'build/config.js', 'vendor/lib.js']);
    execFileSync('git', ['init', '-q'], { cwd: dir });
    execFileSync('git', ['add', '.'], { cwd: dir });
    await fs.mkdir(path.join(dir, 'build', 'gen'), { recursive: true });
    await fs.writeFile(path.join(dir, 'build', 'gen', 'out.js'), 'x');
    expect((await scanProject(dir)).files).toEqual(['build/config.js', 'src/app.ts', 'vendor/lib.js']);
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

  // Reviewer C1: never write the copy through a .jutell-local link.
  it.skipIf(process.platform === 'win32')('a broken map with .jutell-local as a link: no copy, a notice instead', async () => {
    const { dir, paths } = await project();
    await writeMap(paths, NOW);
    const file = path.join(dir, MAP_FILE);
    await fs.writeFile(file, '<!-- /jutell:auto -->\n');
    const elsewhere = path.join(path.dirname(dir), 'elsewhere');
    await fs.mkdir(elsewhere);
    await fs.rm(path.join(dir, '.jutell-local'), { recursive: true, force: true });
    await fs.symlink(elsewhere, path.join(dir, '.jutell-local'));
    const result = await writeMap(paths, LATER);
    expect(result).toMatchObject({ status: 'broken', copy: undefined });
    expect(await fs.readdir(elsewhere)).toEqual([]);
    expect(mapWriteMessage(result, paths)).toContain('사본을 못 만들었어요');
  });

  // Reviewer C3: map-state.json that is not a plain file is left alone and never fails a map write.
  it('map-state.json as a folder: create/update still succeed and the folder is untouched', async () => {
    const { dir, paths } = await project();
    await fs.mkdir(path.join(dir, '.jutell-local', MAP_STATE_FILE), { recursive: true });
    expect((await writeMap(paths, NOW)).status).toBe('created');
    await fs.writeFile(path.join(dir, 'src', 'payments', 'new-pay.ts'), 'x');
    expect((await writeMap(paths, LATER)).status).toBe('updated');
    expect((await fs.lstat(path.join(dir, '.jutell-local', MAP_STATE_FILE))).isDirectory()).toBe(true);
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

  it('"n" is remembered: the next interactive run does not ask again and points to `jutell map`', async () => {
    const { dir, paths } = await project();
    expect(MAP_LATER).toContain('언제든 `jutell map`');
    await offerMap(paths, {} as never, fakeIo('n').io, true);
    await expect(fs.stat(path.join(dir, '.jutell-local', MAP_DECLINED_FILE))).resolves.toBeTruthy();
    const again = fakeIo('');
    expect(await offerMap(paths, {} as never, again.io, true)).toEqual({ asked: false, created: false });
    expect(again.asked).toEqual([]);
    expect(again.written).toEqual([MAP_DECLINED_NOTE]);
    expect(MAP_DECLINED_NOTE).toContain('언제든 `jutell map`');
    await expect(fs.stat(path.join(dir, MAP_FILE))).rejects.toThrow();
  });

  it.skipIf(process.platform === 'win32')('a linked decline marker is not trusted or written through', async () => {
    const { dir, paths } = await project();
    const root = path.dirname(dir);
    await fs.mkdir(path.join(dir, '.jutell-local'), { recursive: true });
    const outside = path.join(root, 'outside-declined.json');
    await fs.writeFile(outside, 'keep');
    await fs.symlink(outside, path.join(dir, '.jutell-local', MAP_DECLINED_FILE));
    const first = fakeIo('n');
    await offerMap(paths, {} as never, first.io, true);
    expect(first.asked).toEqual([MAP_QUESTION]);
    expect(await read(outside)).toBe('keep');
  });

  const declined = (dir: string) => path.join(dir, '.jutell-local', MAP_DECLINED_FILE);
  const decline = async (paths: never) => { await offerMap(paths, {} as never, fakeIo('n').io, true); };

  it('(i) --yes overrides a saved "n": it creates the map without asking, and (iii) the "n" record is deleted', async () => {
    const { dir, paths } = await project();
    await decline(paths as never);
    await expect(fs.stat(declined(dir))).resolves.toBeTruthy();
    const { io, asked } = fakeIo();
    expect(await offerMap(paths, { yes: true } as never, io, false)).toEqual({ asked: false, created: true });
    expect(asked).toEqual([]);
    await expect(fs.stat(path.join(dir, MAP_FILE))).resolves.toBeTruthy();
    await expect(fs.lstat(declined(dir))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('(iii) `jutell map` (writeMap) also deletes the saved "n"; a later map removal asks again', async () => {
    const { dir, paths } = await project();
    await decline(paths as never);
    expect((await writeMap(paths, NOW)).status).toBe('created');
    await expect(fs.lstat(declined(dir))).rejects.toMatchObject({ code: 'ENOENT' });
    await fs.rm(path.join(dir, MAP_FILE));
    const again = fakeIo('n');
    await offerMap(paths, {} as never, again.io, true);
    expect(again.asked).toEqual([MAP_QUESTION]);
  });

  it.skipIf(process.platform === 'win32')('(ii) a hardlinked "n" record is not trusted and not deleted', async () => {
    const { dir, paths } = await project();
    const outside = path.join(path.dirname(dir), 'outside-declined.json');
    await fs.writeFile(outside, 'keep');
    await fs.mkdir(path.join(dir, '.jutell-local'), { recursive: true });
    await fs.link(outside, declined(dir));
    const first = fakeIo('');
    expect(await offerMap(paths, {} as never, first.io, true)).toEqual({ asked: true, created: true });
    expect(first.asked).toEqual([MAP_QUESTION]);
    expect((await fs.lstat(declined(dir))).nlink).toBe(2);
    expect(await read(outside)).toBe('keep');
  });

  it.skipIf(process.platform === 'win32')('(ii) a folder or FIFO named like the record is not a saved "n"', async () => {
    for (const make of ['dir', 'fifo'] as const) {
      const { dir, paths } = await project();
      await fs.mkdir(path.join(dir, '.jutell-local'), { recursive: true });
      if (make === 'dir') await fs.mkdir(declined(dir));
      else execFileSync('mkfifo', [declined(dir)]);
      const first = fakeIo('n');
      await offerMap(paths, {} as never, first.io, true);
      expect(first.asked).toEqual([MAP_QUESTION]);
    }
  });

  it.skipIf(process.platform === 'win32')('(ii) a .jutell-local that is a symlink to a folder outside the project is not read', async () => {
    const { dir, paths } = await project();
    const outsideDir = path.join(path.dirname(dir), 'outside-data');
    await fs.mkdir(outsideDir);
    await fs.writeFile(path.join(outsideDir, MAP_DECLINED_FILE), '{"version":1}\n');
    await fs.symlink(outsideDir, path.join(dir, '.jutell-local'));
    const first = fakeIo('n');
    await offerMap(paths, {} as never, first.io, true);
    expect(first.asked).toEqual([MAP_QUESTION]);
    await expect(fs.stat(path.join(outsideDir, MAP_DECLINED_FILE))).resolves.toBeTruthy();
  });

  it.skipIf(process.platform === 'win32')('(iii) saving the \'no\' writes nothing through a .jutell-local link or outside the project', async () => {
    const { dir, paths } = await project();
    const outsideDir = path.join(path.dirname(dir), 'outside-save');
    await fs.mkdir(outsideDir);
    await fs.symlink(outsideDir, path.join(dir, '.jutell-local'));
    await rememberMapDeclined(paths);
    expect(await fs.readdir(outsideDir)).toEqual([]);
    expect(await mapDeclined(paths)).toBe(false);
    await fs.unlink(path.join(dir, '.jutell-local'));
    await fs.mkdir(path.join(dir, '.jutell-local'));
    await rememberMapDeclined(paths);
    expect(await mapDeclined(paths)).toBe(true);
  });

  it('--yes → creates without asking, plus .jutell-local/map.html (same as `jutell map`)', async () => {
    const { dir, paths } = await project();
    const { io, asked, written } = fakeIo();
    expect(await offerMap(paths, { yes: true } as never, io, false)).toEqual({ asked: false, created: true });
    expect(asked).toEqual([]);
    await expect(fs.stat(path.join(dir, MAP_FILE))).resolves.toBeTruthy();
    expect(await read(path.join(dir, '.jutell-local', MAP_HTML_FILE))).toBe(renderMapHtml(await read(path.join(dir, MAP_FILE))));
    expect(written).toContain('보기 쉬운 화면: .jutell-local/map.html');
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
    const env = { ...process.env, HOME: home, USERPROFILE: home, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: home, JUTELL_NO_FUNDING: '1' };
    const result = spawnSync(process.execPath, [cliEntry, 'setup', '--yes'], { cwd: dir, env, encoding: 'utf8', timeout: 30000 });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('프로젝트 지도(JuTellMap.md)를 만들었어요.');
    expect(await read(path.join(dir, MAP_FILE))).toContain('<!-- jutell:auto 로그인 -->');
    await expect(fs.stat(path.join(dir, '.jutell-local', MAP_STATE_FILE))).resolves.toBeTruthy();
  });
});
