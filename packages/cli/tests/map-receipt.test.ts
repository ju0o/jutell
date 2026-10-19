import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, describe, expect, it } from 'vitest';
import { resolveScope } from '../src/config/paths.js';
import { refreshMapForReceipt } from '../src/commands/map.js';
import { receiptCommand } from '../src/commands/receipt/index.js';
import { writeMap } from '../src/map/write.js';
import type { CliIo } from '../src/types.js';

const roots: string[] = [];
afterAll(async () => { await Promise.all(roots.map((root) => fs.rm(root, { recursive: true, force: true }))); });
const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, stdio: 'ignore' });
const sample = { asked: ['로그인 고치기'], done: ['로그인 폼을 고쳤어요'], checked: [], unchecked: ['화면 (안 열어 봄)'], next: [] };

async function project(name = 'proj') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-mapr-'));
  roots.push(root);
  const dir = path.join(root, name);
  await fs.mkdir(path.join(dir, 'src', 'auth'), { recursive: true });
  await fs.writeFile(path.join(dir, 'src', 'auth', 'login.ts'), 'x');
  git(dir, 'init', '-q');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'init');
  const paths = resolveScope('project', dir);
  const output: string[] = [];
  const io = { write: (m: string) => output.push(m), error: () => {}, ask: async () => false, choose: async () => undefined } as unknown as CliIo;
  const receipt = async (timeoutMs?: number) => {
    const stdin = new PassThrough();
    stdin.end(JSON.stringify(sample));
    output.length = 0;
    expect(await receiptCommand(paths, ['--file', '-'], io, stdin, new Date(), timeoutMs)).toBe(0);
    return output.join('\n');
  };
  return { dir, paths, receipt };
}
function section(text: string, name: string) {
  const start = text.indexOf(name);
  if (start < 0) return '';
  return text.slice(start, text.indexOf('\n\n', start) >= 0 ? text.indexOf('\n\n', start) : undefined);
}

describe('receipt refreshes the map (W5)', () => {
  it('with a map: refreshes it, adds the ⓘ [JuTell이 고침] line, and leaves JuTellMap.md out of [바뀐 파일]', async () => {
    const { dir, paths, receipt } = await project();
    await writeMap(paths);
    git(dir, 'add', 'JuTellMap.md');
    git(dir, 'commit', '-qm', 'map');
    await fs.writeFile(path.join(dir, 'src', 'auth', 'session.ts'), 'x');
    const text = await receipt();
    expect(text).toContain(' ⓘ 지도를 갱신했어요 (새 파일 1개 반영)  [JuTell이 고침]');
    expect(await fs.readFile(path.join(dir, 'JuTellMap.md'), 'utf8')).toContain('- src/auth/session.ts — 기능');
    const files = section(text, '[바뀐 파일]');
    expect(files).toContain('src/auth/session.ts');
    expect(files).not.toContain('JuTellMap.md');
    expect(await fs.readFile(path.join(dir, '.jutell-local', 'map.html'), 'utf8')).toContain('session.ts');
  });

  it('without a map: no map line and no map is created', async () => {
    const { dir, receipt } = await project();
    await fs.writeFile(path.join(dir, 'a.ts'), 'x');
    const text = await receipt();
    expect(text).not.toContain('지도를 갱신');
    expect(text).not.toContain('지도 갱신 못 함');
    await expect(fs.stat(path.join(dir, 'JuTellMap.md'))).rejects.toThrow();
  });

  it('nothing new: no ⓘ line, and the earlier JuTell-made map change is still not listed', async () => {
    const { paths, receipt } = await project();
    await writeMap(paths);
    const text = await receipt();
    expect(text).not.toContain('지도를 갱신했어요');
    expect(text).not.toContain('JuTellMap.md');
  });

  it('map edited by someone else (hash differs from map-state.json) at the start: listed as a normal changed file', async () => {
    const { dir, paths, receipt } = await project();
    await writeMap(paths);
    git(dir, 'add', 'JuTellMap.md');
    git(dir, 'commit', '-qm', 'map');
    await fs.appendFile(path.join(dir, 'JuTellMap.md'), '\n설명: 내가 쓴 메모\n');
    const text = await receipt();
    expect(section(text, '[바뀐 파일]')).toContain('JuTellMap.md');
    expect(await fs.readFile(path.join(dir, 'JuTellMap.md'), 'utf8')).toContain('설명: 내가 쓴 메모');
  });

  it('a failed refresh still saves the receipt and says "지도 갱신 못 함(이유)"', async () => {
    const { dir, paths, receipt } = await project();
    await writeMap(paths);
    await fs.writeFile(path.join(dir, 'JuTellMap.md'), '<!-- jutell:auto 로그인 -->\n');
    const text = await receipt();
    expect(text).toContain(' ⓘ 지도 갱신 못 함(자동 칸 표시가 망가져 있어요');
    expect(text).toContain('저장됨: .jutell-local/reports/');
    expect((await fs.readdir(path.join(dir, '.jutell-local', 'reports'))).length).toBe(1);
  });

  it('over the time limit: skips the refresh and says so; the receipt is still saved', async () => {
    const { dir, paths, receipt } = await project();
    await writeMap(paths);
    await fs.writeFile(path.join(dir, 'new.ts'), 'x');
    expect((await refreshMapForReceipt(paths, 0)).note).toBe('ⓘ 지도 갱신 못 함(시간 초과로 건너뜀)');
    const text = await receipt(0);
    expect(text).toContain('ⓘ 지도 갱신 못 함(시간 초과로 건너뜀)');
    expect(text).toContain('저장됨: .jutell-local/reports/');
  });

  it('works in a Korean path with spaces', async () => {
    const { dir, paths, receipt } = await project('한글 폴더/내 프로젝트');
    await writeMap(paths);
    await fs.writeFile(path.join(dir, 'src', 'auth', '새 파일.ts'), 'x');
    expect(await receipt()).toContain('ⓘ 지도를 갱신했어요 (새 파일 1개 반영)  [JuTell이 고침]');
  });
});
