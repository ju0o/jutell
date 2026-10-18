import { PassThrough } from 'node:stream';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { receiptCommand } from '../src/commands/receipt/index.js';
import { NEXT_GROUPS, RECEIPT_SECTIONS, renderReceipt } from '../src/commands/receipt/render.js';
import { resolveScope } from '../src/config/paths.js';
import { run } from '../src/cli.js';
import type { CliIo, ScopePaths } from '../src/types.js';

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
      ' ✔ 확인함: 파일에서 두 제목이 바뀐 것 (파일 내용을 읽음)',
      ' ✖ 안 해봄: 브라우저로 열어보기 (이 환경에서 화면을 못 열어서)',
      '------------------------------',
      '[다음 추천]',
      ' ▶ 계속 진행',
      '   - 없음',
      ' ○ 해두면 좋은 것',
      '   - 페이지를 한 번 열어 제목만 봐 주세요',
      ' ■ 여기서 멈춰도 됨',
      '   - 부탁한 일은 끝났어요',
      '------------------------------',
      ' 저장됨: .jutell-local/reports/2026-10-18-164012.md',
      '==============================',
    ].join('\n'));
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

  it('prints 없음 for empty groups and masks absolute paths in text', () => {
    const output = renderReceipt({
      done: ['/home/jo/sample.ts'],
      checks: [{ what: '파일 확인', result: '확인함', how: 'C:\\Users\\jo\\sample.ts' }],
      next: { continue: [], nice: [], stop: [] },
    }, timestamp);

    expect(output).toContain(' 1. [경로]');
    expect(output).toContain(' ✔ 확인함: 파일 확인 ([경로])');
    expect(output.match(/- 없음/g)).toHaveLength(3);
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

  it('keeps every section and next group in order when all lists are empty', () => {
    const output = renderReceipt({
      done: [],
      checks: [],
      next: { continue: [], nice: [], stop: [] },
    }, timestamp);
    const headings = [
      '[이번에 한 작업]',
      '[확인]',
      '[다음 추천]',
      ' ▶ 계속 진행',
      ' ○ 해두면 좋은 것',
      ' ■ 여기서 멈춰도 됨',
    ];
    const lines = output.split('\n');

    expect(RECEIPT_SECTIONS).toEqual(['[이번에 한 작업]', '[확인]', '[다음 추천]']);
    expect(NEXT_GROUPS).toEqual([' ▶ 계속 진행', ' ○ 해두면 좋은 것', ' ■ 여기서 멈춰도 됨']);
    expect(lines.filter((line) => headings.includes(line))).toEqual(headings);
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
    const report = path.join(paths.dataRoot, 'reports', reportFiles[0]);
    expect(await fs.readFile(report, 'utf8')).toBe(`${output[0]}\n`);
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

  it('rejects invalid receipt data before saving and removes only the default input', async () => {
    await setup();
    await fs.mkdir(paths.dataRoot, { recursive: true });
    const defaultInput = path.join(paths.dataRoot, 'receipt.json');
    await fs.writeFile(defaultInput, JSON.stringify({ ...sample, status: '확인 완료' }), 'utf8');

    expect(await runInProject(['receipt'])).toBe(1);
    expect(errors).toEqual(['오류: status 항목은 영수증 입력에 넣을 수 없어요.']);

    await expect(fs.access(defaultInput)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.access(path.join(paths.dataRoot, 'reports'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.access(path.join(paths.dataRoot, '.gitignore'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not accept inline JSON or incomplete --file arguments', async () => {
    await setup();

    await expect(receiptCommand(paths, [JSON.stringify(sample)], io))
      .rejects.toThrow('사용법: jutell receipt');
    await expect(receiptCommand(paths, ['--file'], io))
      .rejects.toThrow('사용법: jutell receipt');
    await expect(fs.access(paths.dataRoot)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
