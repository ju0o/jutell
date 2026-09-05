import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readCodexStopHookStatus, registerCodexStopHook, removeCodexStopHook } from '../src/codex-hooks/register.js';

// JUTELL-V2.3-CODEX-DETERMINISTIC-COMPLETION-GUARD-PROTOTYPE-01
//
// Registration must be additive (never touches unrelated events/groups), idempotent (no-op if
// already registered), removable (strips only our own group), and conflict-aware (refuses to
// touch a hooks.json it can't parse as the expected shape) — mirroring the safety pattern
// `config/managed.ts` already uses for the Codex MCP `config.toml` registration.

const temporaryRoots: string[] = [];

async function mkdtemp() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-codex-hooks-'));
  temporaryRoots.push(dir);
  return dir;
}

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) await fs.rm(root, { recursive: true, force: true });
});

const SCRIPT_PATH = '/opt/fake-jutell/assets/codex-hooks/completion-guard-stop.mjs';

describe('registerCodexStopHook — additive and idempotent', () => {
  it('creates hooks.json from scratch when none exists', async () => {
    const dir = await mkdtemp();
    const hooksJsonPath = path.join(dir, 'hooks.json');
    const status = await registerCodexStopHook(hooksJsonPath, SCRIPT_PATH);
    expect(status.registered).toBe(true);
    const written = JSON.parse(await fs.readFile(hooksJsonPath, 'utf8'));
    expect(written.hooks.Stop).toHaveLength(1);
    expect(written.hooks.Stop[0].hooks[0].command).toBe(SCRIPT_PATH);
    // No separate args/interpreter indirection — see JUTELL-V2.3-CODEX-HOOK-TRUST-AND-BLOCK-LIVE-01.
    expect(written.hooks.Stop[0].hooks[0].args).toEqual([]);
  });

  it('preserves an existing unrelated Stop hook and every other event untouched', async () => {
    const dir = await mkdtemp();
    const hooksJsonPath = path.join(dir, 'hooks.json');
    const existing = {
      hooks: {
        Stop: [{ hooks: [{ command: 'C:\\Users\\someone\\ai-usage.exe', args: ['codex-runtime-hook'], type: 'command', async: true }] }],
        SessionEnd: [{ hooks: [{ command: 'C:\\Users\\someone\\ai-usage.exe', args: ['codex-runtime-hook'], type: 'command', async: true }] }],
      },
    };
    await fs.writeFile(hooksJsonPath, JSON.stringify(existing, null, 2), 'utf8');

    await registerCodexStopHook(hooksJsonPath, SCRIPT_PATH);

    const written = JSON.parse(await fs.readFile(hooksJsonPath, 'utf8'));
    expect(written.hooks.Stop).toHaveLength(2);
    expect(written.hooks.Stop[0]).toEqual(existing.hooks.Stop[0]); // untouched, same position
    expect(written.hooks.Stop[1].hooks[0].command).toBe(SCRIPT_PATH); // appended, not inserted/replacing
    expect(written.hooks.SessionEnd).toEqual(existing.hooks.SessionEnd); // other events untouched
  });

  it('is idempotent: registering twice does not duplicate the group', async () => {
    const dir = await mkdtemp();
    const hooksJsonPath = path.join(dir, 'hooks.json');
    await registerCodexStopHook(hooksJsonPath, SCRIPT_PATH);
    await registerCodexStopHook(hooksJsonPath, SCRIPT_PATH);
    const written = JSON.parse(await fs.readFile(hooksJsonPath, 'utf8'));
    expect(written.hooks.Stop).toHaveLength(1);
  });

  it('backs up hooks.json before modifying an existing file', async () => {
    const dir = await mkdtemp();
    const hooksJsonPath = path.join(dir, 'hooks.json');
    await fs.writeFile(hooksJsonPath, JSON.stringify({ hooks: { Stop: [] } }), 'utf8');
    await registerCodexStopHook(hooksJsonPath, SCRIPT_PATH);
    await expect(fs.access(`${hooksJsonPath}.previous`)).resolves.toBeUndefined();
  });

  it('never writes a hooks.state / trusted_hash — trust is left entirely to Codex', async () => {
    const dir = await mkdtemp();
    const hooksJsonPath = path.join(dir, 'hooks.json');
    await registerCodexStopHook(hooksJsonPath, SCRIPT_PATH);
    const written = await fs.readFile(hooksJsonPath, 'utf8');
    expect(written).not.toMatch(/trusted_hash|hooks\.state/);
  });

  it('refuses to touch a hooks.json that is not the expected JSON object shape', async () => {
    const dir = await mkdtemp();
    const hooksJsonPath = path.join(dir, 'hooks.json');
    await fs.writeFile(hooksJsonPath, 'not valid json {{{', 'utf8');
    await expect(registerCodexStopHook(hooksJsonPath, SCRIPT_PATH)).rejects.toThrow();
    // Untouched — no backup, no rewrite attempt on a file we couldn't safely parse.
    expect(await fs.readFile(hooksJsonPath, 'utf8')).toBe('not valid json {{{');
    await expect(fs.access(`${hooksJsonPath}.previous`)).rejects.toThrow();
  });
});

describe('removeCodexStopHook — removable, additive-safe', () => {
  it('removes only our own group and leaves unrelated hooks and events untouched', async () => {
    const dir = await mkdtemp();
    const hooksJsonPath = path.join(dir, 'hooks.json');
    await registerCodexStopHook(hooksJsonPath, SCRIPT_PATH);
    const existing = JSON.parse(await fs.readFile(hooksJsonPath, 'utf8'));
    existing.hooks.Stop.unshift({ hooks: [{ command: 'C:\\Users\\someone\\ai-usage.exe', args: ['codex-runtime-hook'], type: 'command', async: true }] });
    existing.hooks.SessionEnd = [{ hooks: [{ command: 'C:\\Users\\someone\\ai-usage.exe', args: ['codex-runtime-hook'], type: 'command', async: true }] }];
    await fs.writeFile(hooksJsonPath, JSON.stringify(existing, null, 2), 'utf8');

    const status = await removeCodexStopHook(hooksJsonPath, SCRIPT_PATH);
    expect(status.registered).toBe(false);

    const written = JSON.parse(await fs.readFile(hooksJsonPath, 'utf8'));
    expect(written.hooks.Stop).toHaveLength(1);
    expect(written.hooks.Stop[0].hooks[0].command).toBe('C:\\Users\\someone\\ai-usage.exe');
    expect(written.hooks.SessionEnd).toEqual(existing.hooks.SessionEnd);
  });

  it('is a no-op when not registered', async () => {
    const dir = await mkdtemp();
    const hooksJsonPath = path.join(dir, 'hooks.json');
    const status = await removeCodexStopHook(hooksJsonPath, SCRIPT_PATH);
    expect(status.exists).toBe(false);
    expect(status.registered).toBe(false);
  });
});

describe('readCodexStopHookStatus', () => {
  it('reports not-registered and not-existing for a missing file', async () => {
    const dir = await mkdtemp();
    const status = await readCodexStopHookStatus(path.join(dir, 'hooks.json'), SCRIPT_PATH);
    expect(status).toEqual({ hooksJsonPath: path.join(dir, 'hooks.json'), exists: false, registered: false, conflict: false });
  });

  it('flags conflict for an unparsable existing file without throwing', async () => {
    const dir = await mkdtemp();
    const hooksJsonPath = path.join(dir, 'hooks.json');
    await fs.writeFile(hooksJsonPath, '[]', 'utf8'); // valid JSON, but not the expected object shape
    const status = await readCodexStopHookStatus(hooksJsonPath, SCRIPT_PATH);
    expect(status.conflict).toBe(true);
  });
});
