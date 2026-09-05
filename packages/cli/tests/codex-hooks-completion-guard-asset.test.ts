import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BLOCK_REASON } from '../src/codex-hooks/completion-guard.js';

// JUTELL-V2.3-CODEX-DETERMINISTIC-COMPLETION-GUARD-PROTOTYPE-01
//
// The shipped hook asset (src/codex-hooks/asset/completion-guard-stop.mjs) intentionally
// duplicates the TS module's logic (see its header comment for why: a prototype-scoped
// dependency-free single file, not bundled). This test is the drift trip-wire: it spawns the
// *actual asset file* exactly as Codex would (subprocess, JSON on stdin, JSON-or-nothing on
// stdout) and asserts the same canonical outcomes as the unit tests, so the TS module and the
// shipped asset can't silently disagree. It also locks in the self-executing convention itself
// — this file must be directly executable with a shebang, never invoked as `command` + a
// separate `args` array (see JUTELL-V2.3-CODEX-HOOK-TRUST-AND-BLOCK-LIVE-01: args were
// silently dropped on Codex CLI 0.153.2, which made the intended script never run at all).

const SCRIPT_PATH = path.join(__dirname, '..', 'src', 'codex-hooks', 'asset', 'completion-guard-stop.mjs');

function runHookRaw(rawStdin: string): Promise<{ stdout: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(SCRIPT_PATH, []); // spawned directly — no interpreter, no args array
    let stdout = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ stdout, exitCode: code ?? -1 }));
    child.stdin.write(rawStdin);
    child.stdin.end();
  });
}

function runHook(input: unknown) {
  return runHookRaw(JSON.stringify(input));
}

describe('completion-guard-stop.mjs — self-executing asset convention', () => {
  it('has a shebang line and is independently executable (no interpreter/args indirection needed)', async () => {
    const content = await fs.readFile(SCRIPT_PATH, 'utf8');
    expect(content.startsWith('#!/usr/bin/env node\n')).toBe(true);
    const stat = await fs.stat(SCRIPT_PATH);
    expect(stat.mode & 0o111).not.toBe(0); // some execute bit is set
  });

  it('exits 0 and prints nothing for an allow case (Case A shape)', async () => {
    const result = await runHook({
      hook_event_name: 'Stop',
      last_assistant_message: '- 근거: README.md diff 확인\n- 보고서 상태: 확인 완료',
      stop_hook_active: false,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('exits 0 and prints the block decision for the Case D contradiction', async () => {
    const result = await runHook({
      hook_event_name: 'Stop',
      last_assistant_message: [
        '- 완료에 필수적인 미확인: 외부 신원 인증 서비스 실제 연결',
        '- 보고서 상태: 확인 완료',
      ].join('\n'),
      stop_hook_active: false,
    });
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ decision: 'block', reason: BLOCK_REASON });
  });

  it('exits 0 and prints nothing when stop_hook_active is already true (loop safety)', async () => {
    const result = await runHook({
      hook_event_name: 'Stop',
      last_assistant_message: [
        '- 완료에 필수적인 미확인: 외부 신원 인증 서비스 실제 연결',
        '- 보고서 상태: 확인 완료',
      ].join('\n'),
      stop_hook_active: true,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('exits 0 and prints nothing on malformed stdin (fail open, never crashes)', async () => {
    const result = await runHookRaw('not valid json {{{');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('exits 0 and prints nothing on empty stdin', async () => {
    const result = await runHookRaw('');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});
