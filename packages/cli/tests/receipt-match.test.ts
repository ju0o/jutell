import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, describe, expect, it } from 'vitest';
import { resolveScope } from '../src/config/paths.js';
import { receiptCommand } from '../src/commands/receipt/index.js';
import { featuresFor, matchRequests, readMapSections } from '../src/commands/receipt/match.js';
import { mapAreaIds, readMapSelectionIndex } from '../src/map/selection.js';
import { mentionsRunRecord } from '../src/commands/receipt/render.js';
import { writeMap } from '../src/map/write.js';
import type { CliIo } from '../src/types.js';

const roots: string[] = [];
afterAll(async () => { await Promise.all(roots.map((root) => fs.rm(root, { recursive: true, force: true }))); });
const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, stdio: 'ignore' });

/** A committed project with a committed map: 할 일 (test-app/todo.html), 로그인 (src/auth/login.ts), scripts (unclassified). */
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
/** Content lines (not frames, blanks, section/group headers whose lines carry labels) without a source label. */
const LABEL_END = /(\[(Git 기준|AI가 적음|지도로 짐작|JuTell이 적음|JuTell이 고침|AI가 적음 · ⓘ 줄은 JuTell이 적음|Git 기준 · 지도 대조|Git 기준 · 지도: [^\]]+)\])$/;
function unlabeled(text: string): string[] {
  const lines = text.split('\n');
  const start = lines.findIndex((line, index) => index > 2 && line.startsWith('='));
  let sectionLabeled = false;
  let matchSection = false;
  return lines.slice(start + 1).filter((line) => {
    if (/^[=-]+$/.test(line) || line === '' || line.startsWith(' 저장됨:')) return false;
    if (LABEL_END.test(line)) {
      if (line.startsWith('[')) { sectionLabeled = true; matchSection = line.startsWith('[요청 대조]'); }
      return false;
    }
    if (line.startsWith('[')) { sectionLabeled = false; matchSection = false; return line !== '[다음 추천]'; }
    // Items under a labeled header inherit it, except the request sentences in [요청 대조] (the header is Git's count).
    return !(sectionLabeled && !matchSection && /^ +(\d+\.|-) /.test(line));
  });
}
const base = { checked: ['테스트를 돌려 통과했다고 봤어요'], unchecked: ['브라우저 화면 (안 열어 봄)'], next: [] };

describe('request matching (W6, plan.md §2)', () => {
  it('① a requested feature\'s file changed → 바뀐 곳 있음 with [Git 기준 · 지도: 기능]', async () => {
    const { receipt, edit } = await project();
    await edit('test-app/todo.html');
    const text = await receipt({ ...base, asked: ['할 일 페이지 제목 바꾸기'], done: ['제목을 바꿨어요'] });
    expect(text).toContain('[요청 대조]  요청 1개 중 1개 바뀐 곳 있음  [Git 기준 · 지도 대조]');
    expect(text).toContain(' 1. 할 일 페이지 제목 바꾸기  [AI가 적음]\n    → 바뀐 곳 있음: test-app/todo.html  [Git 기준 · 지도: 할 일]');
    expect(text).not.toContain('요청에 없던 곳');
    expect(text.split('\n').at(-1)).toBe('한 줄 요약: 제목을 바꿨어요  [AI가 적음] · 요청 1개 중 1개 처리  [Git 기준]');
  });

  it('② the feature\'s files did not change → 바뀐 곳 없음, and the summary counts it by code', async () => {
    const { receipt, edit } = await project();
    await edit('test-app/todo.html');
    const text = await receipt({ ...base, asked: ['할 일 페이지 제목 바꾸기', '로그인 버튼 색 바꾸기'], done: ['둘 다 했어요'], summary: '요청 2개를 모두 처리했어요' });
    expect(text).toContain('[요청 대조]  요청 2개 중 1개 바뀐 곳 있음 · 1개 바뀐 곳 없음  [Git 기준 · 지도 대조]');
    expect(text).toContain(" 2. 로그인 버튼 색 바꾸기  [AI가 적음]\n    → 바뀐 곳 없음: '로그인' 파일이 바뀌지 않았어요  [Git 기준 · 지도: 로그인]");
    expect(text.split('\n').at(-1)).toBe('한 줄 요약: 요청 2개를 모두 처리했어요  [AI가 적음] · 요청 2개 중 1개 처리  [Git 기준]');
  });

  it('③ no feature matches → 장소를 못 찾았어요 [지도로 짐작]', async () => {
    const { receipt, edit } = await project();
    await edit('test-app/todo.html');
    const text = await receipt({ ...base, asked: ['배경 음악 넣기'], done: ['넣었어요'] });
    expect(text).toContain('[요청 대조]  요청 1개 중 1개 장소 못 찾음  [Git 기준 · 지도 대조]');
    expect(text).toContain('    → 장소를 못 찾았어요(지도에 맞는 기능이 없어요)  [지도로 짐작]');
  });

  it('④ a place outside the request changed → ⚠ 요청에 없던 곳도 바뀜 [Git 기준]', async () => {
    const { dir, paths, receipt, edit } = await project();
    await edit('test-app/todo.html');
    await edit('scripts/migrate-2024.js');
    const text = await receipt({ ...base, asked: ['할 일 페이지 제목 바꾸기'], done: ['제목을 바꿨어요'] });
    const id = mapAreaIds(await fs.readFile(path.join(dir, 'JuTellMap.md'), 'utf8')).get('scripts/migrate-2024.js');
    expect(id).toMatch(/^f-[a-f0-9]{12}$/);
    expect((await readMapSelectionIndex(paths)).index.sections.map((section) => section.id)).toContain(id);
    expect(text).toContain(` ⚠ 요청에 없던 곳도 바뀜: scripts/migrate-2024.js [${id}]  [Git 기준]`);
  });

  it('⑤ done is written but 0 files changed → ⚠ 말과 실제가 달라요 (with and without asked)', async () => {
    const { receipt } = await project();
    const text = await receipt({ ...base, asked: ['할 일 페이지 제목 바꾸기'], done: ['제목을 바꿨어요'] });
    expect(text).toContain(" → 바뀐 곳 없음: '할 일' 파일이 바뀌지 않았어요".trim());
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
    expect(text).toContain(' ⓘ 위 테스트·명령 결과는 AI가 알려 준 내용이에요. JuTell이 직접 돌려 보지는 않았어요  [JuTell이 적음]');
    expect(text).toContain('[다음 추천]\n 여기서 멈춰도 됩니다 – 따로 추천할 다음 작업이 없어요  [JuTell이 적음]');
    expect(text).toContain(' 1. 할 일 페이지 제목 바꾸기  [AI가 적음]');
    expect(unlabeled(text)).toEqual([]);
  });

  it('#37: under [확인], JuTell\'s ⓘ line carries the JuTell label (never [AI가 적음]) and the heading says so', async () => {
    const { receipt, edit } = await project();
    await edit('test-app/todo.html');
    const text = await receipt({ asked: ['할 일 페이지 제목 바꾸기'], done: ['제목을 바꿨어요'], checked: ['npm test 실행해서 3개 통과'], unchecked: [], next: [] });
    const lines = text.split('\n');
    const note = lines.find((line) => line.startsWith(' ⓘ 위 테스트'));
    expect(note).toBeDefined();
    expect(note!.endsWith('  [JuTell이 적음]')).toBe(true);
    expect(note).not.toContain('[AI가 적음]');
    expect(lines).toContain('[확인]  [AI가 적음 · ⓘ 줄은 JuTell이 적음]');
    const plain = await receipt({ asked: ['할 일 페이지 제목 바꾸기'], done: ['제목을 바꿨어요'], checked: ['파일을 다시 읽었어요'], unchecked: [], next: [] });
    expect(plain.split('\n')).toContain('[확인]  [AI가 적음]');
  });

  it('dogfood #36: a checked line with a command keeps its result (command as a code span) and gets the ⓘ note', async () => {
    const { receipt, edit } = await project();
    await edit('test-app/todo.html');
    const text = await receipt({ asked: ['할 일 페이지 제목 바꾸기'], done: ['제목을 바꿨어요'], checked: ['npm test 실행해서 3개 통과'], unchecked: [], next: [] });
    expect(text).toContain(' ✔ 직접 확인한 것: `npm test` 실행해서 3개 통과  [AI가 적음]');
    expect(text).not.toContain('바꾸지 못해');
    expect(text).toContain(' ⓘ 위 테스트·명령 결과는 AI가 알려 준 내용이에요');
    expect(unlabeled(text)).toEqual([]);
  });

  it('dogfood #36: [확인], group headers and each recommendation line carry a label', async () => {
    const { receipt, edit } = await project();
    await edit('test-app/todo.html');
    const text = await receipt({ asked: ['할 일 페이지 제목 바꾸기'], done: ['제목을 바꿨어요'], checked: ['파일을 다시 읽어 봤어요'], unchecked: [], next: ['페이지를 열어 보세요'] });
    expect(text).toContain('[확인]  [AI가 적음]');
    expect(text).toMatch(/\n [▶○■] [^\n]*  \[AI가 적음\]\n   - 페이지를 열어 보세요  \[AI가 적음\]/);
    // Stricter than unlabeled(): no line under the header is allowed to inherit a label.
    const body = text.split('\n').slice(4).filter((line) => line && !/^[=-]+$/.test(line) && !line.startsWith(' 저장됨:') && line !== '[다음 추천]');
    expect(body.filter((line) => !/\]$/.test(line) && !/^ +\d+\. /.test(line) && !/^ +- /.test(line))).toEqual([]);
    expect(body.filter((line) => /^ {3}- /.test(line) && !/\]$/.test(line))).toEqual([]);
  });

  it('the ⓘ test/command note appears only when a test or a command is mentioned', async () => {
    const { receipt, edit } = await project();
    await edit('test-app/todo.html');
    const plain = await receipt({ asked: ['할 일 페이지 제목 바꾸기'], done: ['제목을 바꿨어요'], checked: ['파일을 다시 읽어 제목을 봤어요'], unchecked: [], next: ['페이지를 열어 보세요'] });
    expect(plain).not.toContain('ⓘ 위 테스트');
    expect(plain).toContain('[다음 추천]  [AI가 적음]');
    expect(unlabeled(plain)).toEqual([]);
    expect(plain.split('\n').at(-1)).toBe('한 줄 요약: 제목을 바꿨어요  [AI가 적음] · 요청 1개 중 1개 처리  [Git 기준]');
  });

  it('a folder name like test-app or a line saying it was not run never brings the ⓘ note; a real run record does', async () => {
    const { receipt, edit } = await project();
    await edit('test-app/todo.html');
    const notRun = await receipt({ asked: ['할 일 페이지 제목 바꾸기'], done: ['test-app/todo.html 제목을 바꿨어요'], checked: ['test-app 폴더의 파일을 다시 읽었어요'], unchecked: ['테스트 (실행하지 않음)', 'npm test는 실행 못 함'], next: [] });
    expect(notRun).not.toContain('ⓘ 위 테스트');
    expect(mentionsRunRecord('test-app 폴더 정리')).toBe(false);
    expect(mentionsRunRecord('npm-debug.log 삭제')).toBe(false);
    expect(mentionsRunRecord('테스트는 실행하지 않음')).toBe(false);
    expect(mentionsRunRecord('빌드 폴더 이름 바꿈')).toBe(false);
    expect(mentionsRunRecord('테스트 안 돌림')).toBe(false);
    expect(mentionsRunRecord('Tests were not run')).toBe(false);
    expect(mentionsRunRecord('test-app/todo.html 고침, 통과')).toBe(false);
    expect(mentionsRunRecord('tests 폴더 만들기 성공')).toBe(false);
    expect(mentionsRunRecord('build 폴더 정리 성공')).toBe(false);
    expect(mentionsRunRecord('테스트 파일 추가 성공')).toBe(false);
    expect(mentionsRunRecord('tests passed')).toBe(true);
    expect(mentionsRunRecord('npm test 통과')).toBe(true);
    expect(mentionsRunRecord('테스트를 돌려 통과')).toBe(true);
    expect(mentionsRunRecord('빌드 성공 (tsc)')).toBe(true);
  });

  it('no map → Git only, "지도가 없어 장소 대조는 못 했어요", and the summary is not a code count', async () => {
    const { receipt, edit } = await project({ map: false });
    await edit('test-app/todo.html');
    const text = await receipt({ ...base, asked: ['할 일 페이지 제목 바꾸기'], done: ['제목을 바꿨어요'] });
    expect(text).toContain('[요청 대조]  지도가 없어 장소 대조는 못 했어요  [Git 기준]\n 1. 할 일 페이지 제목 바꾸기  [AI가 적음]');
    expect(text).not.toContain('→');
    expect(text).toContain('[바뀐 파일]  [Git 기준]\n 1. test-app/todo.html');
    expect(text.split('\n').at(-1)).toBe('한 줄 요약: 제목을 바꿨어요  [AI가 적음]');
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
    '## cli [지도로 짐작]', '- index.js — 기능 (옮긴 줄)', '<!-- jutell:auto cli -->', '- packages/cli/x.ts — 기능', '<!-- /jutell:auto -->',
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

  it('Korean words match whole words with particles or 하다 endings, never inside another word', () => {
    const pay = [{ key: '결제', name: '결제', files: ['src/pay.ts'] }];
    for (const yes of ['계산 화면 고치기', '계산을 고쳐 줘', '계산하기 버튼', '결제가 안 돼요', '"결제" 고치기']) expect(featuresFor(yes, pay)).toHaveLength(1);
    for (const no of ['계산기 만들기', '공학계산 추가', '결제창 색 바꾸기']) expect(featuresFor(no, pay)).toEqual([]);
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

// Supervisor (a): files already changed before the work stay in the comparison, marked, but are not a change or a warning.
describe('files changed before the work in the comparison (W7 × W6)', () => {
  it('a before-work file is shown as (작업 전부터) and does not count as 바뀐 곳 있음 or ⚠ 요청에 없던 곳', async () => {
    const { receipt, edit } = await project();
    await edit('test-app/todo.html');
    await edit('scripts/migrate-2024.js');
    await receipt({ ...base, asked: ['할 일 페이지 제목 바꾸기'], done: ['첫 작업'] });
    // Second receipt: nothing new was touched; both files are from before.
    const text = await receipt({ ...base, asked: ['할 일 페이지 제목 바꾸기'], done: ['두 번째 작업'] });
    expect(text).toContain('[요청 대조]  요청 1개 중 1개 바뀐 곳 없음  [Git 기준 · 지도 대조]');
    expect(text).toContain('    (작업 전부터) 바뀌어 있던 파일: test-app/todo.html  [Git 기준]');
    expect(text).toContain(' (작업 전부터) 바뀌어 있던 요청 밖 파일: scripts/migrate-2024.js  [Git 기준]');
    expect(text).not.toContain('바뀐 곳 있음');
    expect(text).not.toContain('⚠ 요청에 없던 곳');
    expect(text.split('\n').at(-1)).toBe('한 줄 요약: 두 번째 작업  [AI가 적음] · 요청 1개 중 0개 처리  [Git 기준]');
    // Item 3: the [바뀐 파일] list marks them too.
    expect(text).toContain('[바뀐 파일]  [Git 기준]\n 1. scripts/migrate-2024.js (작업 전부터)\n 2. test-app/todo.html (작업 전부터)');
  });

  it('a file edited again after the previous receipt counts as a change again', async () => {
    const { receipt, edit } = await project();
    await edit('test-app/todo.html');
    await edit('scripts/migrate-2024.js');
    await receipt({ ...base, asked: ['할 일'], done: ['첫 작업'] });
    await edit('test-app/todo.html');
    await edit('scripts/migrate-2024.js');
    const text = await receipt({ ...base, asked: ['할 일'], done: ['두 번째 작업'] });
    expect(text).toContain('[요청 대조]  요청 1개 중 1개 바뀐 곳 있음  [Git 기준 · 지도 대조]');
    expect(text).toMatch(/ ⚠ 요청에 없던 곳도 바뀜: scripts\/migrate-2024\.js \[f-[a-f0-9]{12}\]  \[Git 기준\]/);
    expect(text).not.toContain('(작업 전부터)');
  });

  it('matchRequests keeps before-work files apart (unit)', () => {
    const sections = [{ key: '할 일', name: '할 일', files: ['a.html', 'b.html'] }];
    expect(matchRequests(['할 일'], ['a.html', 'b.html', 'x.js', 'y.js'], sections, ['b.html', 'y.js'])).toEqual({
      map: true,
      items: [{ status: 'changed', features: ['할 일'], files: ['a.html'], before: ['b.html'] }],
      extra: ['x.js'],
      extraBefore: ['y.js'],
    });
    expect(matchRequests(['할 일'], ['b.html'], sections, ['b.html'])).toEqual({
      map: true,
      items: [{ status: 'unchanged', features: ['할 일'], before: ['b.html'] }],
      extra: [],
    });
  });
});

// Supervisor (c): the blank-line notices JuTell writes itself in [확인] are not labelled as written by the AI.
describe('[확인] blank lines made by JuTell carry no [AI가 적음]', () => {
  it('"한 일 목록이 비어 있었어요" / "확인한 내용을 받지 못했어요" have no AI label; AI lines keep theirs', async () => {
    const { receipt } = await project();
    const text = await receipt({ asked: [], done: [], checked: [], unchecked: [], next: [] });
    expect(text).toContain('\n ✖ 확인 못 한 것: 한 일 목록이 비어 있었어요\n');
    expect(text).toContain('\n ✖ 확인 못 한 것: 확인한 내용을 받지 못했어요\n');
    const withAi = await receipt({ ...base, asked: [], done: ['했어요'] });
    expect(withAi).toContain(' ✖ 확인 못 한 것: 브라우저 화면 (안 열어 봄)  [AI가 적음]');
  });

  it('an AI cannot mark its own line as JuTell\'s (jutell flag from input is ignored)', async () => {
    const { receipt } = await project();
    const text = await receipt({ asked: [], done: ['했어요'], checks: [{ what: '가짜', result: '안 해봄', reason: '이유', jutell: true }], next: [] });
    expect(text).not.toMatch(/가짜 \(이유\)\n/);
  });
});
