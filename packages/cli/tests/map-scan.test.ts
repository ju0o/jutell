import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { scanProject, WALK_MAX_FILES } from '../src/map/scan.js';
import { classifyFile, classifyFiles, ESTIMATED_LABEL, GENERIC_FOLDERS, UNCLASSIFIED } from '../src/map/classify.js';

const roots: string[] = [];
/** Empty files, 256 at a time (macOS CI's open-file limit is low: EMFILE with 10k parallel writes). */
async function writeInBatches(files: string[]) {
  for (let index = 0; index < files.length; index += 256) await Promise.all(files.slice(index, index + 256).map((file) => fs.writeFile(file, '')));
}
afterAll(async () => { await Promise.all(roots.map((root) => fs.rm(root, { recursive: true, force: true }))); });

async function project(name = 'proj') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-map-'));
  roots.push(root);
  const dir = path.join(root, name);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
async function write(root: string, files: string[]) {
  for (const file of files) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), 'x');
  }
}
const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, stdio: 'ignore' });

describe('map scanner (W1)', () => {
  it('git repo: tracked + untracked-not-ignored files, ignored and hidden-folder files left out', async () => {
    const root = await project();
    git(root, 'init', '-q');
    await write(root, ['src/a.ts', 'README.md', 'ignored/x.log', 'new.txt', '.github/workflows/ci.yml', '.gitignore']);
    await fs.writeFile(path.join(root, '.gitignore'), 'ignored/\n');
    git(root, 'add', 'src/a.ts', 'README.md', '.gitignore', '.github');
    git(root, 'commit', '-qm', 'init');
    const scan = await scanProject(root);
    expect(scan.source).toBe('git');
    expect(scan.files).toEqual(['.gitignore', 'README.md', 'new.txt', 'src/a.ts']);
  });

  it('git repo: links are not followed or listed; deleted tracked files are dropped', async () => {
    const root = await project();
    const outside = await project('outside');
    await write(outside, ['secret/s.txt']);
    git(root, 'init', '-q');
    await write(root, ['a.ts', 'gone.ts']);
    await fs.symlink(path.join(outside, 'secret'), path.join(root, 'linkdir'));
    await fs.symlink(path.join(root, 'a.ts'), path.join(root, 'link.ts'));
    git(root, 'add', '-A');
    git(root, 'commit', '-qm', 'init');
    await fs.rm(path.join(root, 'gone.ts'));
    expect((await scanProject(root)).files).toEqual(['a.ts']);
  });

  it('not a git repo: walks the folder, skips excluded/hidden folders and links', async () => {
    const root = await project();
    await write(root, ['src/b.ts', 'node_modules/p/index.js', 'dist/out.js', '.cache/c.txt', 'a.md']);
    await fs.symlink(path.join(root, 'src'), path.join(root, 'srclink'));
    const scan = await scanProject(root);
    expect(scan.source).toBe('walk');
    expect(scan.files).toEqual(['a.md', 'src/b.ts']);
    expect(scan.truncated).toBe(false);
  });

  it('not a git repo: stops at the file count cap and says so', async () => {
    const root = await project();
    const many = Array.from({ length: WALK_MAX_FILES + 5 }, (_, i) => `f${i}.txt`);
    await writeInBatches(many.map((file) => path.join(root, file)));
    const scan = await scanProject(root);
    expect(scan.truncated).toBe(true);
    expect(scan.files).toHaveLength(WALK_MAX_FILES);
  }, 60000);

  it('removes control characters from file names', async () => {
    const root = await project();
    await write(root, ['bad\u001b[31mname.ts', 'rtl\u202eevil.ts']);
    expect((await scanProject(root)).files).toEqual(['bad[31mname.ts', 'rtlevil.ts']);
  });

  it('same input → same order, in git and walk mode (code-point order)', async () => {
    const root = await project();
    await write(root, ['b/z.ts', 'B/a.ts', 'a.ts', '한글/파일.ts', 'a b/c.ts']);
    const first = await scanProject(root);
    expect((await scanProject(root)).files).toEqual(first.files);
    expect(first.files).toEqual([...first.files].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)));
    git(root, 'init', '-q');
    expect((await scanProject(root)).files).toEqual(first.files);
  });

  it('works in a Korean path with spaces', async () => {
    const root = await project('한글 폴더/내 프로젝트');
    git(root, 'init', '-q');
    await write(root, ['src/로그인 화면.tsx', 'docs/설명 문서.md']);
    const scan = await scanProject(root);
    expect(scan.files).toEqual(['docs/설명 문서.md', 'src/로그인 화면.tsx']);
    expect(classifyFiles(scan.files).map((c) => c.role)).toEqual(['문서', '화면']);
  });

  for (const mode of ['git', 'walk'] as const) {
    it(`10,000 files are scanned and classified in ≤ 2 s (${mode})`, async () => {
      const root = await project();
      const dirs = Array.from({ length: 100 }, (_, i) => `src/feature${i}`);
      await Promise.all(dirs.map((dir) => fs.mkdir(path.join(root, dir), { recursive: true })));
      await writeInBatches(Array.from({ length: 10000 }, (_, i) => path.join(root, dirs[i % 100], `file${i}.ts`)));
      if (mode === 'git') git(root, 'init', '-q');
      const start = performance.now();
      const scan = await scanProject(root);
      const classified = classifyFiles(scan.files);
      const ms = performance.now() - start;
      console.log(`[perf] map scan+classify 10,000 files (${mode}): ${ms.toFixed(0)} ms`);
      expect(scan.source).toBe(mode);
      expect(classified).toHaveLength(10000);
      expect(ms).toBeLessThanOrEqual(2000);
    }, 60000);
  }
});

describe('map classification (W1, plan.md §1)', () => {
  it('① dictionary match → dictionary feature name, labelled as an estimate', () => {
    expect(classifyFile('src/auth/LoginForm.tsx')).toEqual({ path: 'src/auth/LoginForm.tsx', feature: '로그인', estimated: true, role: '화면' });
    expect(classifyFile('web/checkout.ts')).toMatchObject({ feature: '결제', estimated: true });
  });

  it('② meaningful folder → first non-generic folder name, labelled as an estimate', () => {
    expect(classifyFile('src/payments/x.ts')).toMatchObject({ feature: '결제', estimated: true });
    expect(classifyFile('packages/cli/src/x.ts')).toMatchObject({ feature: 'cli', estimated: true });
    expect(ESTIMATED_LABEL).toBe('[지도로 짐작]');
  });

  it('test folders do not become feature names when the file name identifies a feature', () => {
    expect(classifyFile('tests/payments.test.ts')).toEqual({ path: 'tests/payments.test.ts', feature: '결제', estimated: true, role: '테스트' });
  });

  it('③ only generic folders → not yet classified', () => {
    expect(classifyFile('scripts/migrate-2024.js')).toMatchObject({ feature: UNCLASSIFIED, estimated: false });
    expect(classifyFile('src/lib/utils/x.ts').feature).toBe(UNCLASSIFIED);
  });

  it('③ root file → not yet classified', () => {
    expect(classifyFile('index.js').feature).toBe(UNCLASSIFIED);
    expect(UNCLASSIFIED).toBe('아직 분류 안 된 파일');
  });

  it('mixed case: generic folders and dictionary words match case-insensitively; folder names keep their case', () => {
    expect(classifyFile('Src/Auth/x.ts')).toMatchObject({ feature: '로그인', estimated: true });
    expect(classifyFile('SRC/Lib/Payments/X.ts')).toMatchObject({ feature: '결제', estimated: true });
    expect(classifyFile('Scripts/Run.js').feature).toBe(UNCLASSIFIED);
    expect(classifyFile('src/userLoginPanel.ts')).toMatchObject({ feature: '로그인', estimated: true });
  });

  it('generic folder list is exactly the decided one', () => {
    expect([...GENERIC_FOLDERS].sort()).toEqual(['__tests__', 'app', 'apps', 'bin', 'common', 'e2e', 'helpers', 'internal', 'lib', 'misc', 'packages', 'scripts', 'shared', 'spec', 'specs', 'src', 'test', 'tests', 'tools', 'util', 'utils']);
  });

  it('roles from extension and folder: 화면·기능·테스트·설정·문서', () => {
    expect(classifyFile('test-app/todo.html')).toMatchObject({ feature: '할 일', role: '화면' });
    expect(classifyFile('src/auth/session.ts').role).toBe('기능');
    expect(classifyFile('tests/auth.test.ts').role).toBe('테스트');
    expect(classifyFile('package.json').role).toBe('설정');
    expect(classifyFile('docs/guide.md').role).toBe('문서');
  });
});
