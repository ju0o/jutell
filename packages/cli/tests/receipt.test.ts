import { PassThrough } from 'node:stream';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { receiptCommand } from '../src/commands/receipt/index.js';
import { NEXT_GROUPS, RECEIPT_SECTIONS, normalizeReceipt, renderReceipt } from '../src/commands/receipt/render.js';
import { resolveScope } from '../src/config/paths.js';
import { run } from '../src/cli.js';
import { ensureBridgeConfig } from '../src/installer/config.js';
import { ensureDataRoot } from '../src/config/managed.js';
import type { CliIo, ScopePaths } from '../src/types.js';

const execFileAsync = promisify(execFile);

const timestamp = '2026-10-18 16:40';
const sample = {
  done: ['브라우저 탭 이름: 할 일 목록 → 오늘 할 일', '화면 맨 위 큰 글씨: 할 일 목록 → 오늘 할 일'],
  checks: [
    { what: '파일에서 두 제목이 바뀐 것', result: '확인함', how: '파일 내용을 읽음' },
    { what: '브라우저로 열어보기', result: '안 해봄', reason: '이 환경에서 화면을 못 열어서' },
  ],
  next: {
    continue: [],
    nice: ['페이지를 한 번 열어 제목만 봐 주세요'],
    stop: ['부탁한 일은 끝났어요'],
  },
};

describe('receipt renderer', () => {
  it('renders the fixed receipt layout and optional saved path', () => {
    expect(renderReceipt(sample, timestamp, '.jutell-local/reports/2026-10-18-164012.md')).toBe([
      '==============================',
      '  JuTell 작업 영수증',
      '  2026-10-18 16:40',
      '==============================',
      '[이번에 한 작업]',
      ' 1. 브라우저 탭 이름: 할 일 목록 → 오늘 할 일',
      ' 2. 화면 맨 위 큰 글씨: 할 일 목록 → 오늘 할 일',
      '',
      '[확인]',
      ' ✔ 직접 확인한 것: 파일에서 두 제목이 바뀐 것 (파일 내용을 읽음)',
      ' ✖ 확인 못 한 것: 브라우저로 열어보기 (이 환경에서 화면을 못 열어서)',
      '------------------------------',
      '[다음 추천]',
      ' ○ 추천',
      '   - 페이지를 한 번 열어 제목만 봐 주세요',
      ' ■ 여기서 멈춰도 됨',
      '   - 부탁한 일은 끝났어요',
      '------------------------------',
      ' 저장됨: .jutell-local/reports/2026-10-18-164012.md',
      '==============================',
      '한 줄 요약: 브라우저 탭 이름: 할 일 목록 → 오늘 할 일 외 1건',
    ].join('\n'));
  });

  it('uses the summary field as the very last line, after the save path and separator', () => {
    const output = renderReceipt(normalizeReceipt({ done: ['제목 변경'], checked: ['파일 확인'], summary: '제목을 바꿨고 끝났어요' }), timestamp, '.jutell-local/reports/x.md');
    const lines = output.split('\n');
    expect(lines.at(-1)).toBe('한 줄 요약: 제목을 바꿨고 끝났어요');
    expect(lines.at(-2)).toBe('==============================');
    expect(lines.at(-3)).toBe(' 저장됨: .jutell-local/reports/x.md');
  });

  it('is deterministic and does not print optional risk or next-message fields', () => {
    const input = { ...sample, risk: '민감한 내용', nextMessage: '다음에 보낼 말' };
    const first = renderReceipt(input, timestamp);
    expect(renderReceipt(input, timestamp)).toBe(first);
    expect(first).not.toContain('민감한 내용');
    expect(first).not.toContain('다음에 보낼 말');
    expect(first).not.toContain('저장됨:');
    expect(first).not.toMatch(/확인 완료|일부 확인|추가 확인 필요/);
  });

  it('rejects each forbidden phrase when it appears in receipt text', () => {
    for (const phrase of ['확인 완료', '일부 확인', '추가 확인 필요']) {
      expect(() => renderReceipt({ ...sample, done: [phrase] }, timestamp)).toThrow();
    }
  });

  it('prints 없음 for empty groups and masks absolute paths in text', () => {
    const output = renderReceipt({
      done: ['/home/jo/sample.ts'],
      checks: [{ what: '파일 확인', result: '확인함', how: 'C:\\Users\\jo\\sample.ts' }],
      next: { continue: [], nice: [], stop: [] },
    }, timestamp);

    expect(output).toContain(' 1. [경로]');
    expect(output).toContain(' ✔ 직접 확인한 것: 파일 확인 ([경로])');
    expect(output).not.toContain('- 없음');
    expect(output).toContain(' 여기서 멈춰도 됩니다 – 요청한 작업이 끝났어요');
    expect(output.split('\n').at(-1)).toBe('한 줄 요약: [경로]');
    expect(output).not.toContain('/home/jo/sample.ts');
    expect(output).not.toContain('C:\\Users');
  });

  it('rejects raw commands and accepts plain language in receipt text', () => {
    expect(() => renderReceipt({
      ...sample,
      checks: [{ what: '변경 내용', result: '확인함', how: 'git diff --check 통과' }],
    }, timestamp)).toThrow('명령어를 그대로 쓰지 말고, 무엇을 확인했는지 쉬운 말로 써 주세요: 확인 항목 1번의 확인 방법');
    expect(() => renderReceipt({ ...sample, done: ['변경 사항을 `git diff`로 확인함'] }, timestamp))
      .toThrow('명령어를 그대로 쓰지 말고');

    const output = renderReceipt({
      ...sample,
      checks: [{ what: '바뀐 줄', result: '확인함', how: '바뀐 줄에 쓸데없는 빈칸이 없는지 검사함' }],
    }, timestamp);
    expect(output).toContain('바뀐 줄에 쓸데없는 빈칸이 없는지 검사함');
  });

  it('hides empty sections, shows one stop line instead of three 없음 lines, and ends with the default summary', () => {
    const output = renderReceipt({
      done: [],
      checks: [],
      next: { continue: [], nice: [], stop: [] },
    }, timestamp);
    const headings = [
      '[이번에 한 작업]',
      '[확인]',
      '[다음 추천]',
      ' 여기서 멈춰도 됩니다 – 요청한 작업이 끝났어요',
    ];
    const lines = output.split('\n');

    expect(RECEIPT_SECTIONS).toEqual(['[요청한 것]', '[이번에 한 작업]', '[바뀐 파일]', '[확인]', '[다음 추천]']);
    expect(NEXT_GROUPS).toEqual([' ▶ 계속', ' ○ 추천', ' ■ 여기서 멈춰도 됨']);
    expect(lines.filter((line) => headings.includes(line))).toEqual(headings);
    expect(output).not.toContain('[요청한 것]');
    expect(output).not.toContain('[바뀐 파일]');
    expect(output).not.toMatch(/- 없음/);
    expect(lines.at(-1)).toBe('한 줄 요약: 요청한 작업을 마쳤어요.');
  });

  it('rejects unsupported results, missing detail, and status fields', () => {
    expect(() => renderReceipt({ ...sample, checks: [{ what: '화면', result: '미확인' }] }, timestamp))
      .toThrow('결과는');
    expect(() => renderReceipt({ ...sample, checks: [{ what: '화면', result: '확인함' }] }, timestamp))
      .toThrow('확인 방법');
    expect(() => renderReceipt({ ...sample, checks: [{ what: '화면', result: '안 해봄' }] }, timestamp))
      .toThrow('이유');
    expect(() => renderReceipt({ ...sample, status: '확인 완료' }, timestamp))
      .toThrow('status 항목');
  });

  it('rejects groups that exceed their entry limits', () => {
    expect(() => renderReceipt({ ...sample, done: ['1', '2', '3', '4', '5', '6'] }, timestamp))
      .toThrow('최대 5개');
    expect(() => renderReceipt({ ...sample, checks: Array.from({ length: 5 }, () => sample.checks[0]) }, timestamp))
      .toThrow('최대 4개');
    expect(() => renderReceipt({
      ...sample,
      next: { continue: ['1'], nice: ['2'], stop: ['3', '4'] },
    }, timestamp)).toThrow('최대 3개');
  });

  it('does not print the save line for an absolute saved path', () => {
    expect(renderReceipt({ done: [], checks: [], next: { continue: [], nice: [], stop: [] } }, timestamp, '/tmp/report.md'))
      .not.toContain('저장됨:');
  });
});

describe('receipt command', () => {
  let temporaryRoot: string;
  let paths: ScopePaths;
  let output: string[];
  let errors: string[];
  let io: CliIo;

  async function setup() {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-receipt-'));
    const project = path.join(temporaryRoot, 'project');
    await fs.mkdir(project, { recursive: true });
    paths = resolveScope('project', project);
    output = [];
    errors = [];
    io = {
      write: (message) => output.push(message),
      error: (message) => errors.push(message),
      ask: async () => false,
      choose: async () => undefined,
    };
  }

  async function runInProject(args: string[]) {
    const previousDirectory = process.cwd();
    process.chdir(paths.targetRoot);
    try {
      return await run(args, io);
    } finally {
      process.chdir(previousDirectory);
    }
  }

  afterEach(async () => {
    if (temporaryRoot) await fs.rm(temporaryRoot, { recursive: true, force: true });
  });

  it('creates .jutell-local/.gitignore at setup, before any receipt.json is written, and never overwrites it', async () => {
    await setup();
    await ensureBridgeConfig(paths, undefined);
    expect(await fs.readFile(path.join(paths.dataRoot, '.gitignore'), 'utf8')).toBe('*\n');
    await expect(fs.access(path.join(paths.dataRoot, 'receipt.json'))).rejects.toMatchObject({ code: 'ENOENT' });
    await fs.writeFile(path.join(paths.dataRoot, '.gitignore'), 'mine\n');
    await ensureDataRoot(paths);
    expect(await fs.readFile(path.join(paths.dataRoot, '.gitignore'), 'utf8')).toBe('mine\n');
  });

  it('shows the receipt input example for --help without creating reports', async () => {
    await setup();

    expect(await runInProject(['receipt', '--help'])).toBe(0);
    expect(output).toHaveLength(1);
    expect(output[0]).toContain('표준 입력으로 전달하는 방식을 권장합니다:');
    expect(output[0]).toContain('... | jutell receipt --file -');
    expect(output[0]).toContain('"checked"');
    await expect(fs.access(path.join(paths.dataRoot, 'reports'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('saves a report with gaps when receipt.json is missing', async () => {
    await setup();
    expect(await receiptCommand(paths, [], io)).toBe(0);
    expect(errors).toEqual([]);
    expect(output[0]).toContain('✖ 확인 못 한 것: 입력을 읽지 못했어요');
    expect(await fs.readdir(path.join(paths.dataRoot, 'reports'))).toHaveLength(1);
  });

  it('keeps quotes and shell metacharacters as plain text when read from receipt.json (no shell involved)', async () => {
    await setup();
    const marker = path.join(paths.targetRoot, 'pwned');
    await fs.mkdir(paths.dataRoot, { recursive: true });
    await fs.writeFile(path.join(paths.dataRoot, 'receipt.json'), JSON.stringify({
      done: ["버튼 이름을 'Save'에서 '저장'으로 바꿈", "don't break", `a'; touch ${marker}; echo '`],
      checked: ['파일을 읽음'],
    }), 'utf8');

    expect(await runInProject(['receipt'])).toBe(0);
    expect(output[0]).toContain("버튼 이름을 'Save'에서 '저장'으로 바꿈");
    expect(output[0]).toContain("don't break");
    await expect(fs.access(marker)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await fs.readdir(path.join(paths.dataRoot, 'reports'))).toHaveLength(1);
  });

  it('reads and removes the default input, saves the report, and creates only the local ignore file', async () => {
    await setup();
    const defaultInput = path.join(paths.dataRoot, 'receipt.json');
    await fs.mkdir(paths.dataRoot, { recursive: true });
    await fs.writeFile(defaultInput, JSON.stringify(sample), 'utf8');
    await fs.writeFile(path.join(paths.targetRoot, '.gitignore'), 'keep-me\n', 'utf8');

    expect(await runInProject(['receipt'])).toBe(0);

    const reportFiles = await fs.readdir(path.join(paths.dataRoot, 'reports'));
    expect(reportFiles).toHaveLength(1);
    expect(reportFiles[0]).toMatch(/^\d{4}-\d{2}-\d{2}-\d{6}\.md$/);
    expect(output).toHaveLength(1);
    expect(output[0]).toContain(`저장됨: .jutell-local/reports/${reportFiles[0]}`);
    expect(output[0].split('\n').map((line) => line.trim()).filter((line) => line.startsWith('저장됨: '))).toEqual([
      `저장됨: .jutell-local/reports/${reportFiles[0]}`,
    ]);
    expect(output[0]).not.toContain(path.join(paths.dataRoot, 'reports'));
    const report = path.join(paths.dataRoot, 'reports', reportFiles[0]);
    const saved = await fs.readFile(report, 'utf8');
    expect(saved).toBe(`# JuTell 작업 영수증\n\n\`\`\`text\n${output[0].split('\n').slice(0, -1).join('\n')}\n\`\`\`\n\n${output[0].split('\n').at(-1)}\n`);
    expect(saved.match(/^```/gm)).toHaveLength(2);
    expect(saved.trimEnd().split('\n').at(-1)).toMatch(/^한 줄 요약: /);
    await expect(fs.access(defaultInput)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await fs.readFile(path.join(paths.dataRoot, '.gitignore'), 'utf8')).toBe('*\n');
    expect(await fs.readFile(path.join(paths.targetRoot, '.gitignore'), 'utf8')).toBe('keep-me\n');
  });

  it('prints one line and saves nothing when receiptReport is disabled', async () => {
    await setup();
    await fs.writeFile(paths.configFile, JSON.stringify({
      version: 1,
      profile: 'minimal',
      features: { receiptReport: false },
      limits: { maxMainFiles: 3, maxGlossaryTerms: 1, compactReportMaxSentences: 8 },
    }), 'utf8');
    await fs.mkdir(paths.dataRoot, { recursive: true });
    const defaultInput = path.join(paths.dataRoot, 'receipt.json');
    await fs.writeFile(defaultInput, JSON.stringify(sample), 'utf8');

    expect(await runInProject(['receipt'])).toBe(0);

    expect(output).toEqual(['영수증이 꺼져 있어요']);
    expect(errors).toEqual([]);
    expect(await fs.readFile(defaultInput, 'utf8')).toBe(JSON.stringify(sample));
    await expect(fs.access(path.join(paths.dataRoot, 'reports'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.access(path.join(paths.dataRoot, '.gitignore'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('adds numeric suffixes when report names already exist', async () => {
    await setup();
    const source = path.join(temporaryRoot, 'input.json');
    await fs.writeFile(source, JSON.stringify(sample), 'utf8');
    const now = new Date(2026, 9, 18, 16, 40, 12);

    await receiptCommand(paths, ['--file', source], io, new PassThrough(), now);
    await receiptCommand(paths, ['--file', source], io, new PassThrough(), now);
    await receiptCommand(paths, ['--file', source], io, new PassThrough(), now);

    expect(output[0]).toContain('저장됨: .jutell-local/reports/2026-10-18-164012.md');
    expect(output[1]).toContain('저장됨: .jutell-local/reports/2026-10-18-164012-2.md');
    expect(output[2]).toContain('저장됨: .jutell-local/reports/2026-10-18-164012-3.md');
    expect(await fs.readFile(source, 'utf8')).toBe(JSON.stringify(sample));
  });

  it('reads JSON from stdin with --file -', async () => {
    await setup();
    const stdin = new PassThrough();
    stdin.end(JSON.stringify(sample));

    await receiptCommand(paths, ['--file', '-'], io, stdin, new Date(2026, 9, 18, 16, 40, 12));

    expect(output[0]).toContain('저장됨: .jutell-local/reports/2026-10-18-164012.md');
  });

  it('saves an incomplete receipt and removes only the default input', async () => {
    await setup();
    await fs.mkdir(paths.dataRoot, { recursive: true });
    const defaultInput = path.join(paths.dataRoot, 'receipt.json');
    await fs.writeFile(defaultInput, JSON.stringify({ ...sample, status: '확인 완료' }), 'utf8');

    expect(await runInProject(['receipt'])).toBe(0);
    expect(errors).toEqual([]);
    expect(output[0]).toContain('[이번에 한 작업]');

    await expect(fs.access(defaultInput)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await fs.readdir(path.join(paths.dataRoot, 'reports'))).toHaveLength(1);
    expect(await fs.readFile(path.join(paths.dataRoot, '.gitignore'), 'utf8')).toBe('*\n');
  });

  it('renders and saves all five sections for the minimal stdin shape', async () => {
    await setup();
    const stdin = new PassThrough();
    stdin.end(JSON.stringify({
      asked: ['요청한 것'],
      done: ['한 일'],
      checked: ['직접 확인한 것'],
      unchecked: ['확인 못 한 것 (이유)'],
      next: ['다음 추천'],
    }));

    expect(await receiptCommand(paths, ['--file', '-'], io, stdin, new Date(2026, 9, 18, 16, 40, 12))).toBe(0);

    const sectionPositions = RECEIPT_SECTIONS.filter((section) => section !== '[바뀐 파일]').map((section) => output[0].indexOf(section));
    expect(output[0]).toContain(' ○ 추천\n   - 다음 추천');
    expect(output[0]).not.toContain(' ▶ 계속');
    expect(output[0].split('\n').at(-1)).toBe('한 줄 요약: 한 일');
    expect(sectionPositions.every((position) => position >= 0)).toBe(true);
    expect(sectionPositions).toEqual([...sectionPositions].sort((a, b) => a - b));
    expect(output[0]).toContain('요청한 것');
    expect(output[0]).toContain('한 일');
    expect(output[0]).toContain('✔ 직접 확인한 것: 직접 확인한 것');
    expect(output[0]).toContain('✖ 확인 못 한 것: 확인 못 한 것 (이유)');
    expect(output[0]).toContain('다음 추천');
    expect(await fs.readdir(path.join(paths.dataRoot, 'reports'))).toHaveLength(1);
  });

  it('saves reports for invalid JSON and malformed receipt shapes', async () => {
    await setup();

    for (const raw of ['{', JSON.stringify({ done: 'x', checks: 5 })]) {
      const stdin = new PassThrough();
      stdin.end(raw);
      expect(await receiptCommand(paths, ['--file', '-'], io, stdin)).toBe(0);
    }

    expect(output).toHaveLength(2);
    expect(output.join('\n')).toContain('✖ 확인 못 한 것:');
    expect(await fs.readdir(path.join(paths.dataRoot, 'reports'))).toHaveLength(2);
  });

  it('does not print raw command text from checked items', async () => {
    await setup();
    const stdin = new PassThrough();
    stdin.end(JSON.stringify({ done: ['한 일'], checked: ['npm test'] }));

    expect(await receiptCommand(paths, ['--file', '-'], io, stdin)).toBe(0);
    expect(output[0]).not.toContain('npm test');
    expect(output[0]).toContain('명령어 줄은 쉬운 말로 바꾸지 못해 뺐어요');
  });

  it('lists modified and untracked files while excluding .jutell-local', async () => {
    await setup();
    await execFileAsync('git', ['init', '-q'], { cwd: paths.targetRoot });
    await execFileAsync('git', ['config', 'user.name', 'JuTell Test'], { cwd: paths.targetRoot });
    await execFileAsync('git', ['config', 'user.email', 'jutell-test@example.invalid'], { cwd: paths.targetRoot });
    await fs.writeFile(path.join(paths.targetRoot, 'tracked.txt'), 'before\n', 'utf8');
    await execFileAsync('git', ['add', 'tracked.txt'], { cwd: paths.targetRoot });
    await execFileAsync('git', ['commit', '-m', 'initial'], { cwd: paths.targetRoot });
    await fs.writeFile(path.join(paths.targetRoot, 'tracked.txt'), 'after\n', 'utf8');
    await fs.writeFile(path.join(paths.targetRoot, 'new-file.txt'), 'new\n', 'utf8');
    await fs.mkdir(path.join(paths.targetRoot, '.jutell-local'), { recursive: true });
    await fs.writeFile(path.join(paths.targetRoot, '.jutell-local', 'private.txt'), 'local\n', 'utf8');
    await fs.mkdir(path.join(paths.targetRoot, '.agents', 'skills', 'beginner-bridge'), { recursive: true });
    await fs.writeFile(path.join(paths.targetRoot, '.agents', 'skills', 'beginner-bridge', 'SKILL.md'), 'x\n', 'utf8');
    await fs.writeFile(path.join(paths.targetRoot, '.jutell.json'), '{}\n', 'utf8');
    await fs.writeFile(path.join(paths.targetRoot, 'AGENTS.md'), 'x\n', 'utf8');
    const stdin = new PassThrough();
    stdin.end(JSON.stringify({ done: ['한 일'] }));

    expect(await receiptCommand(paths, ['--file', '-'], io, stdin)).toBe(0);

    const start = output[0].indexOf('[바뀐 파일]');
    const end = output[0].indexOf('[확인]', start);
    const changedFiles = output[0].slice(start, end);
    expect(changedFiles).toContain('tracked.txt');
    expect(changedFiles).toContain('new-file.txt');
    expect(changedFiles).not.toContain('.jutell-local');
    expect(changedFiles).not.toContain('beginner-bridge');
    expect(changedFiles).not.toContain('.jutell.json');
    expect(changedFiles).not.toContain('AGENTS.md');
  });

  it('does not accept inline JSON or incomplete --file arguments', async () => {
    await setup();

    await expect(receiptCommand(paths, [JSON.stringify(sample)], io))
      .rejects.toThrow('사용법: jutell receipt');
    await expect(receiptCommand(paths, ['--file'], io))
      .rejects.toThrow('사용법: jutell receipt');
    await expect(fs.access(paths.dataRoot)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('lists git filenames as data, including spaces, options, phrases, and rename markers', async () => {
    await setup();
    await execFileAsync('git', ['init', '-q'], { cwd: paths.targetRoot });
    const names = [
      'my git notes.md',
      'src/npm run.txt',
      '-r',
      'a --force b.txt',
      'back`tick.txt',
      '확인 완료.md',
      'a -> b.txt',
      '한글 공백 파일.txt',
    ];
    for (const name of names) {
      const file = path.join(paths.targetRoot, name);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, 'file\n', 'utf8');
    }
    const stdin = new PassThrough();
    stdin.end(JSON.stringify({ done: ['한 일'], checked: ['확인'], next: [] }));

    expect(await receiptCommand(paths, ['--file', '-'], io, stdin)).toBe(0);
    for (const name of names) expect(output[0]).toContain(name);
    const reports = await fs.readdir(path.join(paths.dataRoot, 'reports'));
    expect(reports).toHaveLength(1);
    const saved = await fs.readFile(path.join(paths.dataRoot, 'reports', reports[0]), 'utf8');
    for (const name of names) expect(saved).toContain(name);
  });

  it('refuses a reports symlink without writing into its target', async () => {
    await setup();
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-receipt-outside-'));
    try {
      await fs.mkdir(paths.dataRoot, { recursive: true });
      await fs.symlink(outside, path.join(paths.dataRoot, 'reports'), 'dir');
      const stdin = new PassThrough();
      stdin.end(JSON.stringify({ done: ['한 일'], checked: ['확인'], next: [] }));

      await expect(receiptCommand(paths, ['--file', '-'], io, stdin))
        .rejects.toThrow('.jutell-local 또는 reports가 링크라서 영수증을 저장하지 않았어요.');
      expect(await fs.readdir(outside)).toEqual([]);
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it('refuses a .jutell-local symlink without writing into its target', async () => {
    await setup();
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-receipt-outside-'));
    try {
      await fs.symlink(outside, paths.dataRoot, 'dir');
      const stdin = new PassThrough();
      stdin.end(JSON.stringify({ done: ['한 일'], checked: ['확인'], next: [] }));

      await expect(receiptCommand(paths, ['--file', '-'], io, stdin))
        .rejects.toThrow('.jutell-local 또는 reports가 링크라서 영수증을 저장하지 않았어요.');
      expect(await fs.readdir(outside)).toEqual([]);
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it('shows an unavailable changed-file list outside a git repository', async () => {
    await setup();
    const stdin = new PassThrough();
    stdin.end(JSON.stringify({ done: ['한 일'], checked: ['확인'], next: [] }));

    expect(await receiptCommand(paths, ['--file', '-'], io, stdin)).toBe(0);
    const start = output[0].indexOf('[바뀐 파일]');
    const end = output[0].indexOf('[확인]', start);
    const section = output[0].slice(start, end);
    expect(section).toContain('확인 못 함');
    expect(section).not.toContain(' 없음');
    expect(await fs.readdir(path.join(paths.dataRoot, 'reports'))).toHaveLength(1);
  });

  it('saves a receipt for stdin larger than 64 KiB and records the truncation', async () => {
    await setup();
    const stdin = new PassThrough();
    stdin.end('x'.repeat(64 * 1024 + 100));

    expect(await receiptCommand(paths, ['--file', '-'], io, stdin)).toBe(0);
    expect(output[0]).toContain('입력이 너무 커서 읽지 못했어요');
    expect(output[0]).not.toContain('앞부분만 읽었어요');
    expect(await fs.readdir(path.join(paths.dataRoot, 'reports'))).toHaveLength(1);
  });

  it.skipIf(process.platform === 'win32')('does not read or delete a receipt.json symlink that points outside the project (B5)', async () => {
    await setup();
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-receipt-outside-'));
    try {
      const secret = path.join(outside, 'secret.json');
      await fs.writeFile(secret, JSON.stringify({ done: ['바깥 파일 내용'] }), 'utf8');
      await fs.mkdir(paths.dataRoot, { recursive: true });
      await fs.symlink(secret, path.join(paths.dataRoot, 'receipt.json'));

      expect(await runInProject(['receipt'])).toBe(0);
      expect(output[0]).not.toContain('바깥 파일 내용');
      expect(output[0]).toContain('receipt.json 확인 못 함');
      expect((await fs.lstat(path.join(paths.dataRoot, 'receipt.json'))).isSymbolicLink()).toBe(true);
      expect(await fs.readFile(secret, 'utf8')).toContain('바깥 파일 내용');
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform === 'win32')('does not block on or delete a receipt.json FIFO (B5)', async () => {
    await setup();
    await fs.mkdir(paths.dataRoot, { recursive: true });
    const fifo = path.join(paths.dataRoot, 'receipt.json');
    await execFileAsync('mkfifo', [fifo]);

    expect(await runInProject(['receipt'])).toBe(0);
    expect(output[0]).toContain('receipt.json 확인 못 함');
    expect((await fs.lstat(fifo)).isFIFO()).toBe(true);
  }, 10000);

  it.skipIf(process.platform === 'win32')('does not read receipt.json through a .jutell-local symlink (B5)', async () => {
    await setup();
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-receipt-outside-'));
    try {
      await fs.writeFile(path.join(outside, 'receipt.json'), JSON.stringify({ done: ['바깥 파일 내용'] }), 'utf8');
      await fs.symlink(outside, paths.dataRoot, 'dir');

      expect(await runInProject(['receipt'])).toBe(1);
      expect(await fs.readdir(outside)).toEqual(['receipt.json']);
      expect(output.join('\n')).not.toContain('바깥 파일 내용');
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it('strips bidi and zero-width characters, and shows 5 requested items then 외 N개', async () => {
    await setup();
    const stdin = new PassThrough();
    stdin.end(JSON.stringify({
      asked: ['요청1\u202e뒤집기', '요청2\u200b', '요청3\u2066', '요청4\ufeff', '요청5\u061c', '요청6', '요청7'],
      done: ['한\u200d일\u2060'],
      checked: ['확인\u200e\u200f'],
    }));

    expect(await receiptCommand(paths, ['--file', '-'], io, stdin)).toBe(0);
    expect(output[0]).not.toMatch(/[\u202a-\u202e\u2066-\u2069\u200e\u200f\u061c\u200b-\u200d\u2060\ufeff]/);
    expect(output[0]).toContain(' 5. 요청5\n 외 2개');
    expect(output[0]).not.toContain('요청6');
    expect(output[0]).toContain('한일');
  });

  it('strips ESC and NUL from receipt text before printing and saving', async () => {
    await setup();
    const stdin = new PassThrough();
    stdin.end(JSON.stringify({ done: ['안전\u001b숨김\u0000문장'], checked: ['확인'], next: [] }));

    expect(await receiptCommand(paths, ['--file', '-'], io, stdin)).toBe(0);
    expect(output[0]).not.toContain('\u001b');
    expect(output[0]).not.toContain('\u0000');
    const reports = await fs.readdir(path.join(paths.dataRoot, 'reports'));
    const saved = await fs.readFile(path.join(paths.dataRoot, 'reports', reports[0]), 'utf8');
    expect(saved).not.toContain('\u001b');
    expect(saved).not.toContain('\u0000');
    expect(output[0]).toContain('안전숨김문장');
  });

  it('does not update the git index while listing changed files', async () => {
    await setup();
    await execFileAsync('git', ['init', '-q'], { cwd: paths.targetRoot });
    await execFileAsync('git', ['config', 'user.name', 'JuTell Test'], { cwd: paths.targetRoot });
    await execFileAsync('git', ['config', 'user.email', 'jutell-test@example.invalid'], { cwd: paths.targetRoot });
    const tracked = path.join(paths.targetRoot, 'tracked.txt');
    await fs.writeFile(tracked, 'tracked\n', 'utf8');
    await execFileAsync('git', ['add', 'tracked.txt'], { cwd: paths.targetRoot });
    await execFileAsync('git', ['commit', '-m', 'initial'], { cwd: paths.targetRoot });
    const indexFile = path.join(paths.targetRoot, '.git', 'index');
    const before = await fs.readFile(indexFile);
    const later = new Date(Date.now() + 10_000);
    await fs.utimes(tracked, later, later);
    const stdin = new PassThrough();
    stdin.end(JSON.stringify({ done: ['한 일'], checked: ['확인'], next: [] }));

    expect(await receiptCommand(paths, ['--file', '-'], io, stdin)).toBe(0);
    expect(await fs.readFile(indexFile)).toEqual(before);
  });
});
