import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(import.meta.dirname, '..');
const entry = path.join(packageRoot, 'dist', 'index.js');
const temporaryRoots: string[] = [];

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function todayStamp(now = new Date()) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-session-'));
  temporaryRoots.push(root);
  const project = path.join(root, 'project');
  const home = path.join(root, 'home');
  await fs.mkdir(project, { recursive: true });
  await fs.mkdir(home, { recursive: true });
  return { root, project, home, env: { ...process.env, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex') } };
}

async function runCli(args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  try {
    const result = await execFileAsync(process.execPath, [entry, ...args], { cwd, env, windowsHide: true, maxBuffer: 1024 * 1024 });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    return { code: failure.code ?? 1, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' };
  }
}

function sessionsDir(project: string) {
  return path.join(project, '.jutell-local', 'collaboration-sessions', todayStamp());
}

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) await fs.rm(root, { recursive: true, force: true });
});

describe('SESSION CLI (Session=하루 폴더, Page=별도 파일, Work=작업 블록)', () => {
  it('1. session new가 날짜 폴더와 session.json을 만든다', async () => {
    const { project, env } = await fixture();
    const result = await runCli(['session', 'new'], project, env);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Session 생성 완료');
    const meta = JSON.parse(await fs.readFile(path.join(sessionsDir(project), 'session.json'), 'utf8'));
    expect(meta.date).toBe(todayStamp());
    expect(meta.status).toBe('active');
    expect(meta.currentPage).toBeNull();
    expect(meta.pages).toEqual([]);
  });

  it('2. 같은 날짜 중복 생성은 기존 Session을 이어간다', async () => {
    const { project, env } = await fixture();
    await runCli(['session', 'new'], project, env);
    const second = await runCli(['session', 'new'], project, env);
    expect(second.code).toBe(0);
    expect(second.stdout).toContain('이미 있습니다');
    const dir = await fs.readdir(sessionsDir(project));
    expect(dir.filter((f) => f === 'session.json')).toHaveLength(1);
  });

  it('3. session page --agent로 별도 Page 파일을 만들고 currentPage를 갱신한다', async () => {
    const { project, env } = await fixture();
    await runCli(['session', 'new'], project, env);
    await runCli(['session', 'page', '--agent', 'OpenCode', '--role', 'juTell 규칙 정리', '--title', 'OpenCode Page'], project, env);
    const meta = JSON.parse(await fs.readFile(path.join(sessionsDir(project), 'session.json'), 'utf8'));
    expect(meta.currentPage).toBe(1);
    expect(meta.pages).toHaveLength(1);
    expect(meta.pages[0].agent).toBe('OpenCode');
    const files = await fs.readdir(sessionsDir(project));
    expect(files).toContain('page-01-opencode-opencode-page.md');
  });

  it('4. Agent·역할별 별도 Markdown 파일로 분리된다', async () => {
    const { project, env } = await fixture();
    await runCli(['session', 'new'], project, env);
    await runCli(['session', 'page', '--agent', 'OpenCode', '--role', 'file1', '--title', 'OpenCode Page'], project, env);
    await runCli(['session', 'page', '--agent', 'Codex', '--role', 'file2', '--title', 'Codex Page'], project, env);
    await runCli(['session', 'page', '--agent', 'Claude Code', '--role', 'file3', '--title', 'Claude Page'], project, env);
    const files = await fs.readdir(sessionsDir(project));
    expect(files).toContain('page-01-opencode-opencode-page.md');
    expect(files).toContain('page-02-codex-codex-page.md');
    expect(files).toContain('page-03-claude-code-claude-page.md');
    const meta = JSON.parse(await fs.readFile(path.join(sessionsDir(project), 'session.json'), 'utf8'));
    expect(meta.currentPage).toBe(3);
  });

  it('4. Session 없을 때 session work는 안내하고 종료한다', async () => {
    const { project, env } = await fixture();
    const result = await runCli(['session', 'work'], project, env);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('오늘 Session이 없습니다');
  });

  it('6. session work는 현재 Page에 다음 번호 작업을 추가한다', async () => {
    const { project, env } = await fixture();
    await runCli(['session', 'new'], project, env);
    await runCli(['session', 'page', '--agent', 'OpenCode', '--role', 'role', '--title', 'Page A'], project, env);
    const work = await runCli(['session', 'work'], project, env);
    expect(work.code).toBe(0);
    const content = await fs.readFile(path.join(sessionsDir(project), 'page-01-opencode-page-a.md'), 'utf8');
    expect(content).toContain('## 작업 01');
    expect(content).toContain('## 작업 02');
  });

  it('7. session move --page로 다른 Page로 이동하고 작업을 그 Page에만 추가한다', async () => {
    const { project, env } = await fixture();
    await runCli(['session', 'new'], project, env);
    await runCli(['session', 'page', '--agent', 'OpenCode', '--role', 'roleA', '--title', 'Page A'], project, env);
    await runCli(['session', 'page', '--agent', 'Codex', '--role', 'roleB', '--title', 'Page B'], project, env);
    await runCli(['session', 'move', '--page', '1'], project, env);
    const work = await runCli(['session', 'work'], project, env);
    expect(work.code).toBe(0);
    const meta = JSON.parse(await fs.readFile(path.join(sessionsDir(project), 'session.json'), 'utf8'));
    expect(meta.currentPage).toBe(1);
    const pageA = await fs.readFile(path.join(sessionsDir(project), 'page-01-opencode-page-a.md'), 'utf8');
    const pageB = await fs.readFile(path.join(sessionsDir(project), 'page-02-codex-page-b.md'), 'utf8');
    expect(pageA).toContain('## 작업 02');
    expect(pageB).not.toContain('## 작업 02');
  });

  it('8. 작업 번호는 Page마다 독립적으로 매긴다', async () => {
    const { project, env } = await fixture();
    await runCli(['session', 'new'], project, env);
    await runCli(['session', 'page', '--agent', 'OpenCode', '--role', 'roleA', '--title', 'Page A'], project, env);
    await runCli(['session', 'page', '--agent', 'Codex', '--role', 'roleB', '--title', 'Page B'], project, env);
    await runCli(['session', 'work'], project, env);
    await runCli(['session', 'move', '--page', '1'], project, env);
    await runCli(['session', 'work'], project, env);
    const pageA = await fs.readFile(path.join(sessionsDir(project), 'page-01-opencode-page-a.md'), 'utf8');
    const pageB = await fs.readFile(path.join(sessionsDir(project), 'page-02-codex-page-b.md'), 'utf8');
    expect(pageA).toContain('## 작업 02');
    expect(pageB).toContain('## 작업 02');
  });

  it('9. 사용자가 이미 쓴 내용은 유지한다 (작업 추가는 덧붙이기만 함)', async () => {
    const { project, env } = await fixture();
    await runCli(['session', 'new'], project, env);
    await runCli(['session', 'page', '--agent', 'OpenCode', '--role', 'role', '--title', 'Page A'], project, env);
    const dir = sessionsDir(project);
    const filePath = path.join(dir, (await fs.readdir(dir)).find((f) => f.endsWith('.md')) as string);
    const before = await fs.readFile(filePath, 'utf8');
    await runCli(['session', 'work'], project, env);
    const after = await fs.readFile(filePath, 'utf8');
    expect(after).toContain(before.replace(/\s+$/, ''));
    expect(after).toContain('## 작업 02');
  });

  it('10. 연속 page 생성 후 session.json에 임시 파일(.tmp)이 남지 않는다', async () => {
    const { project, env } = await fixture();
    await runCli(['session', 'new'], project, env);
    for (let i = 1; i <= 3; i += 1) {
      await runCli(['session', 'page', '--agent', 'Codex', '--role', `role-${i}`, '--title', `Page ${i}`], project, env);
    }
    const meta = JSON.parse(await fs.readFile(path.join(sessionsDir(project), 'session.json'), 'utf8'));
    expect(meta.pages).toHaveLength(3);
    const files = await fs.readdir(sessionsDir(project));
    expect(files.filter((f) => f.endsWith('.tmp'))).toHaveLength(0);
  });

  it('11. finish가 SESSION_SUMMARY.md를 한 번만 만들고 중복 생성을 막는다', async () => {
    const { project, env } = await fixture();
    await runCli(['session', 'new'], project, env);
    await runCli(['session', 'page', '--agent', 'OpenCode', '--role', 'role', '--title', 'Page A'], project, env);
    const first = await runCli(['session', 'finish'], project, env);
    expect(first.code).toBe(0);
    expect(first.stdout).toContain('Session 마감 완료');
    const meta = JSON.parse(await fs.readFile(path.join(sessionsDir(project), 'session.json'), 'utf8'));
    expect(meta.status).toBe('finished');
    const second = await runCli(['session', 'finish'], project, env);
    expect(second.code).toBe(0);
    expect(second.stdout).toContain('이미 마감');
    const dir = await fs.readdir(sessionsDir(project));
    expect(dir.filter((f) => f === 'SESSION_SUMMARY.md')).toHaveLength(1);
  });

  it('12. 기존 레거시 단일 파일 기록은 건드리지 않고 그대로 둔다', async () => {
    const { project, env } = await fixture();
    const dataRoot = path.join(project, '.jutell-local', 'collaboration-sessions');
    await fs.mkdir(dataRoot, { recursive: true });
    const legacy = path.join(dataRoot, `${todayStamp()}-session-01.md`);
    const legacyContent = '# 레거시 기록\n유지되어야 합니다.\n';
    await fs.writeFile(legacy, legacyContent, 'utf8');
    const result = await runCli(['session', 'new'], project, env);
    expect(result.code).toBe(0);
    const after = await fs.readFile(legacy, 'utf8');
    expect(after).toBe(legacyContent);
  });

  it('13. session 명령 없이 실행하면 상태를 보여준다', async () => {
    const { project, env } = await fixture();
    const before = await runCli(['session'], project, env);
    expect(before.code).toBe(0);
    expect(before.stdout).toContain('오늘 Session이 없습니다');
    await runCli(['session', 'new'], project, env);
    await runCli(['session', 'page', '--agent', 'OpenCode', '--role', 'role', '--title', 'Page A'], project, env);
    const after = await runCli(['session'], project, env);
    expect(after.stdout).toContain('진행 중');
    expect(after.stdout).toContain('OpenCode');
  });

  it('14. 잘못된 하위 명령은 오류를 보여준다', async () => {
    const { project, env } = await fixture();
    const result = await runCli(['session', 'unknown'], project, env);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('알 수 없는 session 하위 명령');
  });
});