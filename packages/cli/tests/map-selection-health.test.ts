import { execFileSync, spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { resolveScope } from '../src/config/paths.js';
import { mapFreshnessCheck, refreshMapForReceipt } from '../src/commands/map.js';
import { MAP_DETAILS_DIR, MAP_DETAIL_MARKER, MAP_INDEX_FILE } from '../src/map/selection.js';
import { MAP_FILE, writeMap } from '../src/map/write.js';

const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const roots: string[] = [];
afterAll(async () => { await Promise.all(roots.map((root) => fs.rm(root, { recursive: true, force: true }))); });

async function project(git = true) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-health-')));
  roots.push(root);
  const dir = path.join(root, 'proj');
  for (const file of ['src/auth/login.ts', 'src/payments/refund.ts']) {
    await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await fs.writeFile(path.join(dir, file), 'x');
  }
  if (git) execFileSync('git', ['init', '-q'], { cwd: dir });
  const home = path.join(root, 'home');
  await fs.mkdir(home);
  const env = { ...process.env, HOME: home, USERPROFILE: home, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: home, JUTELL_NO_FUNDING: '1' };
  const run = (...args: string[]) => spawnSync(process.execPath, [cliEntry, ...args], { cwd: dir, env, encoding: 'utf8', timeout: 30000 });
  return { root, dir, run, paths: resolveScope('project', dir) };
}

describe('map index health (item 11, review #34 follow-ups 3-6)', () => {
  it('doctor/status says when the feature list no longer matches the map, and is fine after jutell map', async () => {
    const { dir, paths } = await project();
    await writeMap(paths);
    expect((await mapFreshnessCheck(paths))?.status).toBe('정상');
    // A person edits the map by hand: same files, different text.
    await fs.appendFile(path.join(dir, MAP_FILE), '\n설명: 직접 적은 줄\n');
    const check = await mapFreshnessCheck(paths);
    expect(check?.status).toBe('주의');
    expect(check?.detail).toContain('기능 목록이 지금 지도와 달라요');
    await writeMap(paths);
    expect((await mapFreshnessCheck(paths))?.status).toBe('정상');
  });

  it('reports a missing detail file, and jutell map recreates it', async () => {
    const { dir, paths } = await project();
    await writeMap(paths);
    const index = JSON.parse(await fs.readFile(path.join(dir, '.jutell-local', MAP_INDEX_FILE), 'utf8')) as { sections: Array<{ id: string }> };
    await fs.rm(path.join(dir, '.jutell-local', MAP_DETAILS_DIR, `${index.sections[0].id}.md`));
    expect((await mapFreshnessCheck(paths))?.detail).toContain('상세 파일이 없는 기능 1개');
    await writeMap(paths);
    expect((await mapFreshnessCheck(paths))?.status).toBe('정상');
  });

  it('removes orphan detail files JuTell wrote, keeps a person\'s own file', async () => {
    const { dir, paths } = await project();
    await writeMap(paths);
    const details = path.join(dir, '.jutell-local', MAP_DETAILS_DIR);
    const orphan = path.join(details, 'f-aaaaaaaaaaaa.md');
    const mine = path.join(details, 'f-bbbbbbbbbbbb.md');
    await fs.writeFile(orphan, `${MAP_DETAIL_MARKER} id="f-aaaaaaaaaaaa" -->\n# 옛 기능\n`);
    await fs.writeFile(mine, '# 내가 쓴 메모\n');
    expect((await mapFreshnessCheck(paths))?.detail).toContain('오래된 상세 파일 1개');
    await fs.writeFile(path.join(dir, 'src/auth/new.ts'), 'y');
    await writeMap(paths);
    await expect(fs.lstat(orphan)).rejects.toThrow();
    expect(await fs.readFile(mine, 'utf8')).toBe('# 내가 쓴 메모\n');
  });

  it('a receipt refresh with nothing changed rewrites neither the index nor map.html', async () => {
    const { dir, paths } = await project();
    expect(await refreshMapForReceipt(paths)).toBeDefined();
    await writeMap(paths);
    await refreshMapForReceipt(paths);
    const index = path.join(dir, '.jutell-local', MAP_INDEX_FILE);
    const html = path.join(dir, '.jutell-local', 'map.html');
    const before = [(await fs.stat(index)).mtimeMs, (await fs.stat(html)).mtimeMs];
    await new Promise((resolve) => setTimeout(resolve, 30));
    const step = await refreshMapForReceipt(paths);
    expect(step.note).toBeUndefined();
    expect([(await fs.stat(index)).mtimeMs, (await fs.stat(html)).mtimeMs]).toEqual(before);
  });

  it('a linked .jutell-local is not repeated on every receipt; doctor names it once', async () => {
    const { root, dir, paths } = await project();
    await fs.mkdir(path.join(root, 'elsewhere'));
    await fs.symlink(path.join(root, 'elsewhere'), path.join(dir, '.jutell-local'));
    await fs.writeFile(path.join(dir, MAP_FILE), '# 지도\n');
    const step = await refreshMapForReceipt(paths);
    expect(step.note ?? '').not.toContain('기능 인덱스 갱신 못 함');
    expect((await mapFreshnessCheck(paths))?.detail ?? '').toContain('.jutell-local이 링크라서');
    expect(await fs.readdir(path.join(root, 'elsewhere'))).toEqual([]);
  });

  it('a broken .jutell-local link in a non-git folder: jutell map exits 0 with a plain line and writes nothing outside', async () => {
    const { root, dir, run } = await project(false);
    await fs.symlink(path.join(root, 'nowhere'), path.join(dir, '.jutell-local'));
    const result = run('map');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('.jutell-local이 링크라서 기능 목록과 보기 쉬운 화면(map.html)은 만들지 않았어요');
    expect(result.stderr).not.toContain('오류');
    await expect(fs.lstat(path.join(root, 'nowhere'))).rejects.toThrow();
  });
});
