import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { leftoverNote } from '../src/commands/lifecycle.js';
import { guiStatusCheck } from '../src/installer/gui-apps.js';

// cycle-3 PR-G: wrap-up wording from the main dogfood, with the built CLI in a temp HOME only.
const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

async function sandbox() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'jutell-prg-')));
  dirs.push(root);
  const home = path.join(root, 'home'); const project = path.join(root, 'proj');
  for (const dir of [home, project]) await mkdir(dir, { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: project });
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home, BEGINNER_BRIDGE_HOME: home, JUTELL_HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: path.join(home, '.claude'), XDG_CONFIG_HOME: path.join(home, '.config'), APPDATA: path.join(home, 'AppData', 'Roaming') };
  delete env.JUTELL_PROJECT_ROOT;
  const run = (args: string[]) => spawnSync(process.execPath, [cliEntry, ...args], { cwd: project, env, encoding: 'utf8', timeout: 60000 });
  return { run };
}

describe('PR-G wrap-up', () => {
  it('(3) use cursor names the rule files it prepares; (5) uninstall skips things that never existed', async () => {
    const { run } = await sandbox();
    const used = run(['use', 'cursor']);
    expect(used.stdout).toContain('AGENTS.md, .agents/skills/, .jutell.json, .jutell-local/');
    const status = run(['status']);
    // (4) GUI app lines sit together under one heading.
    expect(status.stdout).toMatch(/GUI 앱 연결[^\n]*\n {2}- Cursor/);
    const gone = run(['uninstall', '--yes']);
    expect(gone.stdout).not.toContain('JuTellMap.md(프로젝트 지도)');
    expect(gone.stdout).not.toContain('공유되어 제거하지 않았습니다');
  }, 60000);

  it('(5) leftoverNote lists only what is really left', () => {
    expect(leftoverNote(false, { config: true, data: true, map: false })).toBe('남겨 둔 것: .jutell.json(설정), .jutell-local/(작업 기록·영수증·지도 상세). 다시 설치하면 그대로 이어서 씁니다. 모두 지우려면 jutell uninstall --remove-data --yes 를 실행하세요.');
    expect(leftoverNote(true, { config: false, data: false, map: true })).toBe('남겨 둔 것: JuTellMap.md(프로젝트 지도). 필요 없으면 직접 지우세요.');
    expect(leftoverNote(true, { config: false, data: false, map: false })).toBeUndefined();
  });

  it('(4) an app with no documented path on this OS reads naturally', () => {
    const check = guiStatusCheck({ id: 'x', app: 'cursor', label: 'X', scope: 'project' } as never);
    expect(check.detail).toBe('이 운영체제에서는 설정 파일 위치가 공식 문서에 없어서 살펴보지 않았어요.');
  });
});
