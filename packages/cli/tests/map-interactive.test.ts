import { execFileSync, spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stdin as realStdin } from 'node:process';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { defaultCommand } from '../src/commands/default.js';
import { resolveScope } from '../src/config/paths.js';
import { MAP_DECLINED_NOTE, MAP_LATER, MAP_QUESTION } from '../src/map/write.js';
import type { CliChoice, CliIo, CliOptions } from '../src/types.js';

const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const roots: string[] = [];
afterAll(async () => { await Promise.all(roots.map((root) => fs.rm(root, { recursive: true, force: true }))); });

const options: CliOptions = { scope: 'project', yes: false, activateMcp: false, oneCommand: false, statusOnly: false, json: false, verbose: false, openBrowser: false, fix: false, skillOnly: false, mcpOnly: false, disableSkill: false, disableMcp: false, disableAll: false, keepData: false, removeData: false };

// Supervisor decision (2): a person running plain `jutell` in a new project is asked the map question too.
describe('interactive `jutell` in a new project asks the map question', () => {
  it.skipIf(process.platform === 'win32')('asks once; yes makes the map, no leaves the project without one', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-mapask-'));
    roots.push(root);
    const home = path.join(root, 'home');
    const bin = path.join(root, 'bin');
    await fs.mkdir(home, { recursive: true });
    await fs.mkdir(bin, { recursive: true });
    await fs.writeFile(path.join(bin, 'codex'), '#!/bin/sh\nprintf "codex 0.1.0\\n"\n', { mode: 0o755 });
    const projects = ['first', 'yes', 'no'].map((name) => path.join(root, name));
    for (const dir of projects) {
      await fs.mkdir(path.join(dir, 'src'), { recursive: true });
      await fs.writeFile(path.join(dir, 'src', 'app.js'), 'x');
      execFileSync('git', ['init', '-q'], { cwd: dir });
    }
    const env = { HOME: home, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: home, JUTELL_NO_FUNDING: '1', PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}` };
    // Codex gets connected from another project first (shared CODEX_HOME).
    expect(spawnSync(process.execPath, [cliEntry, '--yes', '--no-funding'], { cwd: projects[0], env: { ...process.env, ...env }, encoding: 'utf8', timeout: 30000 }).status).toBe(0);

    const saved = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
    const originalIsTTY = Object.getOwnPropertyDescriptor(realStdin, 'isTTY');
    Object.assign(process.env, env);
    Object.defineProperty(realStdin, 'isTTY', { value: true, configurable: true });
    try {
      for (const [dir, answer] of [[projects[1], true], [projects[2], false]] as const) {
        const asked: string[] = [];
        const messages: string[] = [];
        const io: CliIo = {
          write: (m) => messages.push(m),
          error: (m) => messages.push(m),
          ask: async (question) => { asked.push(question); return question === MAP_QUESTION ? answer : true; },
          choose: async (_m: string, choices: CliChoice[]) => choices[0]?.value,
        };
        expect((await defaultCommand(resolveScope('project', dir), options, io)).cancelled).toBe(false);
        expect(asked.filter((q) => q === MAP_QUESTION)).toHaveLength(1);
        if (answer) {
          await expect(fs.stat(path.join(dir, 'JuTellMap.md'))).resolves.toBeTruthy();
          await expect(fs.stat(path.join(dir, '.jutell-local', 'map.html'))).resolves.toBeTruthy();
        } else {
          await expect(fs.stat(path.join(dir, 'JuTellMap.md'))).rejects.toThrow();
          expect(messages).toContain(MAP_LATER);
          // 'no' is remembered: running `jutell` again does not ask, and says `jutell map` works any time.
          const again: string[] = [];
          const notes: string[] = [];
          const io2: CliIo = { ...io, write: (m) => notes.push(m), error: (m) => notes.push(m), ask: async (question) => { again.push(question); return true; } };
          expect((await defaultCommand(resolveScope('project', dir), options, io2)).cancelled).toBe(false);
          expect(again.filter((q) => q === MAP_QUESTION)).toHaveLength(0);
          expect(notes).toContain(MAP_DECLINED_NOTE);
          await expect(fs.stat(path.join(dir, 'JuTellMap.md'))).rejects.toThrow();
        }
      }
    } finally {
      for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
      if (originalIsTTY) Object.defineProperty(realStdin, 'isTTY', originalIsTTY);
      else delete (realStdin as unknown as Record<string, unknown>).isTTY;
    }
  }, 60000);
});
