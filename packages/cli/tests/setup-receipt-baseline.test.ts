import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveScope } from '../src/config/paths.js';
import { setupCommand } from '../src/commands/lifecycle.js';
import { receiptCommand } from '../src/commands/receipt/index.js';
import type { CliIo } from '../src/types.js';

const saved = { CODEX_HOME: process.env.CODEX_HOME, HOME: process.env.HOME };
const roots: string[] = [];
afterEach(async () => {
  process.env.CODEX_HOME = saved.CODEX_HOME; process.env.HOME = saved.HOME;
  if (saved.CODEX_HOME === undefined) delete process.env.CODEX_HOME;
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('setup records the receipt baseline', () => {
  it('package.json / package-lock.json changed by the install show as (작업 전부터), not as unrequested changes', async () => {
    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-base-')));
    roots.push(root);
    process.env.HOME = path.join(root, 'home');
    process.env.CODEX_HOME = path.join(root, 'codex');
    const project = path.join(root, 'proj');
    await fs.mkdir(path.join(project, 'src'), { recursive: true });
    await fs.writeFile(path.join(project, 'package.json'), '{"name":"app"}\n');
    await fs.writeFile(path.join(project, 'src', 'login.ts'), 'v1\n');
    const git = (...args: string[]) => execFileSync('git', args, { cwd: project });
    git('init', '-q'); git('add', '.'); git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base');
    // What `npm install jutell` leaves behind.
    await fs.writeFile(path.join(project, 'package.json'), '{"name":"app","devDependencies":{"jutell":"^2"}}\n');
    await fs.writeFile(path.join(project, 'package-lock.json'), '{}\n');
    const out: string[] = [];
    const io = { write: (m: string) => out.push(m), error: (m: string) => out.push(m), ask: async () => true } as unknown as CliIo;
    const paths = resolveScope('project', project);
    await setupCommand(paths, { yes: true, oneCommand: true, skillOnly: true } as never, io);
    // The AI's actual work.
    await fs.writeFile(path.join(project, 'src', 'login.ts'), 'v2\n');
    out.length = 0;
    const stdin = new PassThrough();
    stdin.end(JSON.stringify({ asked: ['로그인 고치기'], done: ['로그인 고침'] }));
    expect(await receiptCommand(paths, ['--file', '-'], io, stdin)).toBe(0);
    const text = out.join('\n');
    expect(text).toMatch(/package-lock\.json.*\(작업 전부터\)|\(작업 전부터\).*package-lock\.json/);
    expect(text).not.toMatch(/요청에 없던 곳도 바뀜:[^\n]*package/);
    expect(text).not.toContain('첫 영수증이라');
  });
});
