import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, describe, expect, it } from 'vitest';
import { resolveScope } from '../src/config/paths.js';
import { receiptCommand } from '../src/commands/receipt/index.js';
import { featuresFor, matchRequests, readMapSections } from '../src/commands/receipt/match.js';
import { writeMap } from '../src/map/write.js';
import type { CliIo } from '../src/types.js';

const roots: string[] = [];
afterAll(async () => { await Promise.all(roots.map((root) => fs.rm(root, { recursive: true, force: true }))); });
const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, stdio: 'ignore' });

/** A committed project with a committed map: 할 일 목록 (test-app/todo.html), 로그인 (src/auth/login.ts), scripts (unclassified). */
async function project(options: { map?: boolean; name?: string } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-match-'));
  roots.push(root);
  const dir = path.join(root, options.name ?? 'proj');
  for (const file of ['test-app/todo.html', 'src/auth/login.ts', 'scripts/migrate-2024.js']) {
    await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await fs.writeFile(path.join(dir, file), 'x');
  }
  git(dir, 'init', '-q');
  const paths = resolveScope('project', dir);
  if (options.map !== false) await writeMap(paths);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'init');
  const output: string[] = [];
  const io = { write: (m: string) => output.push(m), error: () => {}, ask: async () => false, choose: async () => undefined } as unknown as CliIo;
  const receipt = async (input: object) => {
    const stdin = new PassThrough();
    stdin.end(JSON.stringify(input));
    output.length = 0;
    expect(await receiptCommand(paths, ['--file', '-'], io, stdin)).toBe(0);
    return output.join('\n');
  };
  const edit = (file: string) => fs.appendFile(path.join(dir, file), '\nchanged');
  return { dir, paths, receipt, edit };
}
const base = { checked: ['테스트를 돌려 통과했다고 봤어요'], unchecked: ['브라우저 화면 (안 열어 봄)'], next: [] };

describe('request matching (W6, plan.md §2)', () => {
  it('① a requested feature\'s file changed → 바뀐 곳 있음 with [Git 기준 · 지도: 기능]', async () => {
    const { receipt, edit } = await project();
    await edit('test-app/todo.html');
    const text = await receipt({ ...base, asked: ['할 일 페이지 제목 바꾸기'], done: ['제목을 바꿨어요'] });
    expect(text).toContain('[요청 대조]  요청 1개 중 1개 바뀐 곳 있음');
    expect(text).toContain(' 1. 할 일 페이지 제목 바꾸기\n    → 바뀐 곳 있음: test-app/todo.html  [Git 기준 · 지도: 할 일 목록]');
    expect(text).not.toContain('요청에 없던 곳');
    expect(text.split('\n').at(-1)).toBe('한 줄 요약: 요청 1개 중 1개를 처리했어요.');
  });

  it('② the feature\'s files did not change → 바뀐 곳 없음, and the summary counts it by code', async () => {
    const { receipt, edit } = await project();
    await edit('test-app/todo.html');
    const text = await receipt({ ...base, asked: ['할 일 페이지 제목 바꾸기', '로그인 버튼 색 바꾸기'], done: ['둘 다 했어요'], summary: '요청 2개를 모두 처리했어요' });
    expect(text).toContain('[요청 대조]  요청 2개 중 1개 바뀐 곳 있음 · 1개 바뀐 곳 없음');
    expect(text).toContain(" 2. 로그인 버튼 색 바꾸기\n    → 바뀐 곳 없음: '로그인' 파일이 바뀌지 않았어요  [Git 기준 · 지도: 로그인]");
    expect(text.split('\n').at(-1)).toBe('한 줄 요약: 요청 2개 중 1개를 처리했어요.');
  });

  it('③ no feature matches → 장소를 못 찾았어요 [지도 기준 추정]', async () => {
    const { receipt, edit } = await project();
    await edit('test-app/todo.html');
    const text = await receipt({ ...base, asked: ['배경 음악 넣기'], done: ['넣었어요'] });
    expect(text).toContain('[요청 대조]  요청 1개 중 1개 장소 못 찾음');
    expect(text).toContain('    → 장소를 못 찾았어요(지도에 맞는 기능이 없어요)  [지도 기준 추정]');
  });

  it('④ a place outside the request changed → ⚠ 요청에 없던 곳도 바뀜 [Git 기준]', async () => {
    const { receipt, edit } = await project();
    await edit('test-app/todo.html');
    await edit('scripts/migrate-2024.js');
    const text = await receipt({ ...base, asked: ['할 일 페이지 제목 바꾸기'], done: ['제목을 바꿨어요'] });
    expect(text).toContain(' ⚠ 요청에 없던 곳도 바뀜: scripts/migrate-2024.js  [Git 기준]');
  });

  it('⑤ done is written but 0 files changed → ⚠ 말과 실제가 달라요 (with and without asked)', async () => {
    const { receipt } = await project();
    const text = await receipt({ ...base, asked: ['할 일 페이지 제목 바꾸기'], done: ['제목을 바꿨어요'] });
    expect(text).toContain(" → 바뀐 곳 없음: '할 일 목록' 파일이 바뀌지 않았어요".trim());
    expect(text).toContain(' ⚠ 말과 실제가 달라요: 한 일은 적혀 있는데 바뀐 파일이 없어요  [Git 기준]');
    const noAsked = await receipt({ ...base, done: ['제목을 바꿨어요'] });
    expect(noAsked).toContain(' ⚠ 말과 실제가 달라요: 한 일은 적혀 있는데 바뀐 파일이 없어요  [Git 기준]');
    const nothingDone = await receipt({ ...base, done: [] });
    expect(nothingDone).not.toContain('말과 실제가 달라요');
  });

  it('⑥ only the map auto-update changed → "요청에 없던 곳" is 0 and the map shows only as the ⓘ line', async () => {
    const { dir, receipt } = await project();
    await fs.writeFile(path.join(dir, 'test-app', 'done.html'), 'x');
    git(dir, 'add', 'test-app/done.html');
    git(dir, 'commit', '-qm', 'add');
    // the map is now stale; the receipt refreshes it (JuTell's own change) and nothing else changed
    const text = await receipt({ ...base, asked: ['할 일 페이지 제목 바꾸기'], done: ['제목을 바꿨어요'] });
    expect(text).toContain(' ⓘ 지도를 갱신했어요 (새 파일 1개 반영)  [JuTell이 고침]');
    expect(text).not.toContain('요청에 없던 곳');
    expect(text).not.toContain('JuTellMap.md');
  });

  it('every fact line has a source label; test/command results are [AI가 적음] with the ⓘ "JuTell이 직접 보지 않았어요" line', async () => {
    const { receipt, edit } = await project();
    await edit('test-app/todo.html');
    const text = await receipt({ ...base, asked: ['할 일 페이지 제목 바꾸기'], done: ['제목을 바꿨어요'] });
    expect(text).toContain('[이번에 한 작업]  [AI가 적음]');
    expect(text).toContain('[바뀐 파일]  [Git 기준]');
    expect(text).toContain(' ✔ 직접 확인한 것: 테스트를 돌려 통과했다고 봤어요  [AI가 적음]');
    expect(text).toContain(' ✖ 확인 못 한 것: 브라우저 화면 (안 열어 봄)  [AI가 적음]');
    expect(text).toContain(' ⓘ 테스트·명령 결과는 AI가 적은 내용이에요(JuTell이 직접 보지 않았어요)');
    for (const line of text.split('\n')) {
      if (/^ +(→|⚠|✔|✖)/.test(line)) expect(line).toMatch(/\[(Git 기준|AI가 적음|지도 기준 추정|Git 기준 · 지도: [^\]]+)\]$/);
    }
  });

  it('no map → Git only, "지도가 없어 장소 대조는 못 했어요", and the summary is not a code count', async () => {
    const { receipt, edit } = await project({ map: false });
    await edit('test-app/todo.html');
    const text = await receipt({ ...base, asked: ['할 일 페이지 제목 바꾸기'], done: ['제목을 바꿨어요'] });
    expect(text).toContain('[요청 대조]  지도가 없어 장소 대조는 못 했어요  [Git 기준]\n 1. 할 일 페이지 제목 바꾸기');
    expect(text).not.toContain('→');
    expect(text).toContain('[바뀐 파일]  [Git 기준]\n 1. test-app/todo.html');
    expect(text.split('\n').at(-1)).toBe('한 줄 요약: 제목을 바꿨어요');
  });

  it('the forbidden status phrases rule is unchanged', async () => {
    const { receipt } = await project();
    const text = await receipt({ ...base, asked: ['할 일'], done: ['확인 완료'] });
    expect(text).not.toContain('확인 완료');
  });

  it('works in a Korean path with spaces', async () => {
    const { receipt, edit } = await project({ name: '한글 폴더/내 프로젝트' });
    await edit('src/auth/login.ts');
    expect(await receipt({ ...base, asked: ['로그인 고치기'], done: ['고쳤어요'] })).toContain('→ 바뀐 곳 있음: src/auth/login.ts  [Git 기준 · 지도: 로그인]');
  });
});

describe('match.ts (deterministic matching)', () => {
  const map = [
    '# 지도', '## 로그인', '<!-- jutell:auto 로그인 -->', '- src/auth/a.ts — 기능', '<!-- /jutell:auto -->',
    '## 환불 (내가 지은 이름)', '<!-- jutell:auto payments -->', '- src/payments/r.ts — 기능', '<!-- /jutell:auto -->',
    '## cli [지도 기준 추정]', '- index.js — 기능 (옮긴 줄)', '<!-- jutell:auto cli -->', '- packages/cli/x.ts — 기능', '<!-- /jutell:auto -->',
    '## 아직 분류 안 된 파일', '<!-- jutell:auto 분류 안 됨 -->', '- run.js — 기능', '<!-- /jutell:auto -->',
  ].join('\n');
  const sections = readMapSections(map);

  it('reads sections as the user sees them (renamed headings, moved lines), without the unclassified section', () => {
    expect(sections).toEqual([
      { key: '로그인', name: '로그인', files: ['src/auth/a.ts'] },
      { key: 'payments', name: '환불 (내가 지은 이름)', files: ['src/payments/r.ts'] },
      { key: 'cli', name: 'cli', files: ['index.js', 'packages/cli/x.ts'] },
    ]);
  });

  it('matches by Korean dictionary words, English words (whole word, any case), key and human heading', () => {
    expect(featuresFor('로그아웃 버튼', sections).map((s) => s.key)).toEqual(['로그인']);
    expect(featuresFor('fix the Login form', sections).map((s) => s.key)).toEqual(['로그인']);
    expect(featuresFor('payments 고치기', sections).map((s) => s.key)).toEqual(['payments']);
    expect(featuresFor('환불 (내가 지은 이름) 칸', sections).map((s) => s.key)).toEqual(['payments']);
    expect(featuresFor('CLI 도움말', sections).map((s) => s.key)).toEqual(['cli']);
    expect(featuresFor('client 설정', sections)).toEqual([]);
  });

  it('same input → same result; extra files are those no matched feature owns', () => {
    const result = matchRequests(['로그인 고치기'], ['src/auth/a.ts', 'run.js'], sections);
    expect(result).toEqual({ map: true, items: [{ status: 'changed', features: ['로그인'], files: ['src/auth/a.ts'] }], extra: ['run.js'] });
    expect(matchRequests(['로그인 고치기'], ['src/auth/a.ts', 'run.js'], sections)).toEqual(result);
  });
});
