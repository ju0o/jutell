import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { stdin as realStdin } from 'node:process';
import { afterEach, describe, expect, it } from 'vitest';
import { offerAutoConnect, providerRuntimeStatuses } from '../src/commands/default.js';
import { getStatus } from '../src/commands/status.js';
import { resolveScope } from '../src/config/paths.js';
import type { CliChoice, CliIo, CliOptions } from '../src/types.js';

// JUTELL-V1.X-AUTO-SETUP-FOUNDATION-01
//
// Bare `jutell` must auto-detect installed Coding Agent providers (reusing
// the same detection/registration JuTell already uses for `jutell use
// <provider>` - no second detection or registration system), offer to
// connect them with a single confirmation, and never hang or silently
// mutate configuration when run non-interactively.

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(import.meta.dirname, '..');
const entry = path.join(packageRoot, 'dist', 'index.js');
const temporaryRoots: string[] = [];

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-default-cmd-'));
  temporaryRoots.push(root);
  const project = path.join(root, 'project');
  const home = path.join(root, 'home');
  await fs.mkdir(project, { recursive: true });
  await fs.mkdir(home, { recursive: true });
  return { root, project, home, env: { ...process.env, BEGINNER_BRIDGE_HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: home } };
}

/** A PATH containing only the given already-installed provider binaries (by symlink), so
 * detection can be tested deterministically regardless of what else is installed on the
 * machine running this suite - without mocking process/system.js itself (reuse, not a
 * second detection system). Binaries not passed are guaranteed "not found". */
async function restrictedPath(root: string, providers: Array<'codex' | 'opencode' | 'claude'>) {
  const bin = path.join(root, 'bin');
  await fs.mkdir(bin, { recursive: true });
  for (const name of providers) {
    const real = await execFileAsync('which', [name]).then((r) => r.stdout.trim()).catch(() => undefined);
    if (real) await fs.symlink(real, path.join(bin, name));
  }
  return `${bin}${path.delimiter}/usr/bin${path.delimiter}/bin`;
}

async function runCli(args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  return execFileAsync(process.execPath, [entry, ...args], { cwd, env, windowsHide: true, maxBuffer: 1024 * 1024 });
}

/** Runs bare `jutell` non-interactively (spawned child stdin is never a TTY) and resolves
 * once the process exits on its own - used to prove it does NOT fall through to the
 * dashboard's server (which blocks until SIGINT) when there is nothing to connect or
 * nothing was confirmed (e.g. no providers found, a conflict, or a declined/non-interactive
 * run). Do not use this for a run that actually connects something - see runAndKill. */
async function runToExit(args: string[], cwd: string, env: NodeJS.ProcessEnv, timeoutMs = 8000) {
  const child = spawn(process.execPath, [entry, ...args], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error(`process did not exit on its own within ${timeoutMs}ms - likely hung or fell through to the blocking dashboard server`)); }, timeoutMs);
    child.once('exit', (code) => { clearTimeout(timer); resolve(code); });
    child.once('error', reject);
  });
  return { stdout, stderr, exitCode };
}

/** Runs bare `jutell` for a run that DOES successfully connect something, and so - by
 * design, matching the pre-existing "처음 jutell 한 번으로 기본 연결과 대시보드를 준비한다"
 * behavior in cli.test.ts - falls through to dashboardCommand()'s local admin server, which
 * blocks until SIGINT. Waits for the readyMessage() marker text to appear in stdout (proof
 * the connect step itself finished), then kills the process, exactly like that existing
 * test does for the single-provider case. */
async function runAndKill(args: string[], cwd: string, env: NodeJS.ProcessEnv, timeoutMs = 15000) {
  const child = spawn(process.execPath, [entry, ...args], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let stdout = '';
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`'JuTell 준비 완료' did not appear within ${timeoutMs}ms`)), timeoutMs);
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
        if (stdout.includes('JuTell 준비 완료')) { clearTimeout(timer); resolve(); }
      });
      child.once('exit', () => { clearTimeout(timer); resolve(); });
      child.once('error', reject);
    });
  } finally {
    child.kill();
    if (child.exitCode === null) await new Promise<void>((resolve) => child.once('exit', () => resolve()));
  }
  return { stdout };
}

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) await fs.rm(root, { recursive: true, force: true });
});

describe('bare `jutell` - auto-detect and connect', () => {
  it('1. detects all 3 supported providers and connects all of them (--yes)', async () => {
    const { root, project, home, env } = await fixture();
    const path3 = await restrictedPath(root, ['codex', 'opencode', 'claude']);
    const result = await runAndKill(['--yes', '--no-open'], project, { ...env, PATH: path3 });
    expect(result.stdout).toContain('찾은 Coding Agent');
    expect(result.stdout).toContain('Codex');
    expect(result.stdout).toContain('OpenCode');
    expect(result.stdout).toContain('Claude Code');
    expect(result.stdout).toContain('JuTell을 연결하는 중');
    expect(result.stdout).toContain('JuTell 준비 완료');
    expect(await fs.readFile(path.join(home, '.codex', 'config.toml'), 'utf8')).toContain('enabled = true');
    // opencode.json is JSONC (allows comments, see the managed-block markers) - JSON.parse
    // rejects it, so check the managed block text directly instead of parsing.
    const opencodeText = await fs.readFile(path.join(project, 'opencode.json'), 'utf8');
    expect(opencodeText).toContain('BEGIN JUTELL MANAGED BLOCK');
    expect(opencodeText).toContain('"enabled": true');
    const claudeConfig = JSON.parse(await fs.readFile(path.join(home, '.claude.json'), 'utf8'));
    expect(claudeConfig.projects[project].mcpServers.jutell).toBeTruthy();
  }, 20000);

  it('2. detects only one installed provider and connects only that one (--yes)', async () => {
    const { root, project, home, env } = await fixture();
    const path1 = await restrictedPath(root, ['codex']);
    const result = await runAndKill(['--yes', '--no-open'], project, { ...env, PATH: path1 });
    expect(result.stdout).toContain('Codex        찾음');
    expect(result.stdout).toContain('OpenCode     미감지');
    expect(result.stdout).toContain('Claude Code  미감지');
    expect(await fs.readFile(path.join(home, '.codex', 'config.toml'), 'utf8')).toContain('enabled = true');
    await expect(fs.stat(path.join(project, 'opencode.json'))).rejects.toThrow();
    await expect(fs.stat(path.join(home, '.claude.json'))).rejects.toThrow();
  }, 20000);

  it('3. no supported providers found: explains clearly, mutates nothing, exits promptly', async () => {
    const { root, project, home, env } = await fixture();
    const pathNone = await restrictedPath(root, []);
    const result = await runToExit([], project, { ...env, PATH: pathNone });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('찾지 못했습니다');
    expect((await fs.readdir(project)).length).toBe(0);
    await expect(fs.stat(path.join(home, '.codex'))).rejects.toThrow();
  });

  it('4. user accepts the interactive confirmation: connects the detected provider', async () => {
    const { project, home } = await fixture();
    process.env.BEGINNER_BRIDGE_HOME = home;
    process.env.CODEX_HOME = path.join(home, '.codex');
    process.env.CLAUDE_CONFIG_DIR = home;
    const originalIsTTY = Object.getOwnPropertyDescriptor(realStdin, 'isTTY');
    Object.defineProperty(realStdin, 'isTTY', { value: true, configurable: true });
    try {
      const paths = resolveScope('project', project);
      const messages: string[] = [];
      const io: CliIo = {
        write: (m) => messages.push(m),
        error: (m) => messages.push(m),
        ask: async () => true,
        choose: async (_m: string, choices: CliChoice[]) => choices[0]?.value,
      };
      const options: CliOptions = { scope: 'project', yes: false, activateMcp: false, oneCommand: false, statusOnly: false, json: false, verbose: false, openBrowser: false, fix: false, skillOnly: false, mcpOnly: false, disableSkill: false, disableMcp: false, disableAll: false, keepData: false, removeData: false };
      // Force detection to a known-installed provider only, deterministically, without
      // mocking the detection module: point PATH at a dir with just `codex` symlinked.
      const bin = path.join(project, 'bin');
      await fs.mkdir(bin, { recursive: true });
      const realCodex = await execFileAsync('which', ['codex']).then((r) => r.stdout.trim()).catch(() => undefined);
      if (!realCodex) return; // environment has no codex installed at all - nothing to assert here
      await fs.symlink(realCodex, path.join(bin, 'codex'));
      const originalPath = process.env.PATH;
      process.env.PATH = `${bin}${path.delimiter}/usr/bin${path.delimiter}/bin`;
      try {
        // offerAutoConnect() directly, not defaultCommand() - the latter falls through to
        // dashboardCommand() on success, which blocks until SIGINT and would hang this
        // in-process test. offerAutoConnect() is the actual detect/confirm/connect unit;
        // defaultCommand()'s own dashboard hand-off is exercised via subprocess elsewhere.
        const statuses = providerRuntimeStatuses(await getStatus(paths));
        const result = await offerAutoConnect(paths, options, io, statuses);
        expect(result).toEqual({ cancelled: false });
      } finally {
        process.env.PATH = originalPath;
      }
      const joined = messages.join('\n');
      expect(joined).toContain('JuTell을 연결하는 중');
      expect(joined).toContain('✓ Codex 연결됨');
      expect(await fs.readFile(path.join(home, '.codex', 'config.toml'), 'utf8')).toContain('enabled = true');
    } finally {
      if (originalIsTTY) Object.defineProperty(realStdin, 'isTTY', originalIsTTY);
      else delete (realStdin as unknown as Record<string, unknown>).isTTY;
    }
  });

  it('5. user declines the interactive confirmation: mutates nothing', async () => {
    const { project, home } = await fixture();
    process.env.BEGINNER_BRIDGE_HOME = home;
    process.env.CODEX_HOME = path.join(home, '.codex');
    process.env.CLAUDE_CONFIG_DIR = home;
    const originalIsTTY = Object.getOwnPropertyDescriptor(realStdin, 'isTTY');
    Object.defineProperty(realStdin, 'isTTY', { value: true, configurable: true });
    try {
      const paths = resolveScope('project', project);
      const io: CliIo = { write: () => {}, error: () => {}, ask: async () => false, choose: async () => undefined };
      const options: CliOptions = { scope: 'project', yes: false, activateMcp: false, oneCommand: false, statusOnly: false, json: false, verbose: false, openBrowser: false, fix: false, skillOnly: false, mcpOnly: false, disableSkill: false, disableMcp: false, disableAll: false, keepData: false, removeData: false };
      const bin = path.join(project, 'bin');
      await fs.mkdir(bin, { recursive: true });
      const realCodex = await execFileAsync('which', ['codex']).then((r) => r.stdout.trim()).catch(() => undefined);
      if (!realCodex) return;
      await fs.symlink(realCodex, path.join(bin, 'codex'));
      const originalPath = process.env.PATH;
      process.env.PATH = `${bin}${path.delimiter}/usr/bin${path.delimiter}/bin`;
      try {
        const statuses = providerRuntimeStatuses(await getStatus(paths));
        const result = await offerAutoConnect(paths, options, io, statuses);
        expect(result).toEqual({ cancelled: true });
      } finally {
        process.env.PATH = originalPath;
      }
      await expect(fs.stat(path.join(home, '.codex'))).rejects.toThrow();
      await expect(fs.stat(path.join(project, '.jutell.json'))).rejects.toThrow();
    } finally {
      if (originalIsTTY) Object.defineProperty(realStdin, 'isTTY', originalIsTTY);
      else delete (realStdin as unknown as Record<string, unknown>).isTTY;
    }
  });

  it('6/7. already-configured second run: minimal status, no dashboard, no duplicate registrations', async () => {
    const { root, project, home, env } = await fixture();
    const path3 = await restrictedPath(root, ['codex', 'opencode', 'claude']);
    const envWithPath = { ...env, PATH: path3 };
    await runAndKill(['--yes', '--no-open'], project, envWithPath);

    const second = await runToExit([], project, envWithPath);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain('연결됨');
    expect(second.stdout).not.toContain('JuTell을 연결하는 중');
    expect(second.stdout).toContain('jutell --help');

    expect((await fs.readFile(path.join(home, '.codex', 'config.toml'), 'utf8')).match(/\[mcp_servers\.jutell\]/g)).toHaveLength(1);
    expect((await fs.readFile(path.join(project, 'AGENTS.md'), 'utf8')).match(/BEGIN JUTELL MANAGED BLOCK/g)).toHaveLength(1);
    const opencodeText = await fs.readFile(path.join(project, 'opencode.json'), 'utf8');
    expect(opencodeText.match(/BEGIN JUTELL MANAGED BLOCK/g)).toHaveLength(1);
  }, 20000);

  it('8. an unrelated/unmanaged existing `jutell` MCP entry is a conflict, not silently overwritten', async () => {
    const { root, project, home, env } = await fixture();
    const path1 = await restrictedPath(root, ['codex']);
    await fs.mkdir(path.join(home, '.codex'), { recursive: true });
    const unrelated = '[mcp_servers.jutell]\ncommand = "/usr/bin/some-other-tool"\nargs = ["--serve"]\nenabled = true\n';
    await fs.writeFile(path.join(home, '.codex', 'config.toml'), unrelated, 'utf8');

    const result = await runToExit(['--yes', '--no-open'], project, { ...env, PATH: path1 });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('관리되지 않는');
    // The conflicting entry must survive byte-for-byte - not overwritten, not merged.
    expect(await fs.readFile(path.join(home, '.codex', 'config.toml'), 'utf8')).toBe(unrelated);
  }, 20000);

  it('9. unrelated Codex configuration is preserved exactly across auto-connect', async () => {
    const { root, project, home, env } = await fixture();
    const path1 = await restrictedPath(root, ['codex']);
    await fs.mkdir(path.join(home, '.codex'), { recursive: true });
    const unrelatedBlock = '[plugins."notion@openai-curated"]\nenabled = true\n';
    await fs.writeFile(path.join(home, '.codex', 'config.toml'), unrelatedBlock, 'utf8');

    await runAndKill(['--yes', '--no-open'], project, { ...env, PATH: path1 });

    const finalContent = await fs.readFile(path.join(home, '.codex', 'config.toml'), 'utf8');
    expect(finalContent).toContain(unrelatedBlock.trim());
    expect(finalContent).toContain('[mcp_servers.jutell]');
  }, 20000);

  it('10. non-interactive without --yes: does not hang, does not mutate, explains what to do', async () => {
    const { root, project, home, env } = await fixture();
    const path3 = await restrictedPath(root, ['codex', 'opencode', 'claude']);
    const result = await runToExit([], project, { ...env, PATH: path3 }, 8000);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('대화형 터미널이 아니어서');
    expect(result.stdout).toContain('jutell --yes');
    await expect(fs.stat(path.join(home, '.codex'))).rejects.toThrow();
    await expect(fs.stat(path.join(project, '.jutell.json'))).rejects.toThrow();
  });

  it('11. a stale canonical Codex path is repaired through the bare-`jutell` entry point too', async () => {
    const { root, project, home, env } = await fixture();
    const path1 = await restrictedPath(root, ['codex']);
    await fs.mkdir(path.join(home, '.codex'), { recursive: true });
    const stale = '# JUTELL_CLI_MCP_BEGIN\n[mcp_servers.jutell]\ncommand = "C:/Program Files/nodejs/node.exe"\nargs = ["C:/Users/someone/AppData/Roaming/npm/node_modules/jutell/assets/mcp-server/index.js"]\nenabled = true\nrequired = false\ndefault_tools_approval_mode = "prompt"\n# JUTELL_CLI_MCP_END\n';
    await fs.writeFile(path.join(home, '.codex', 'config.toml'), stale, 'utf8');

    // Already "enabled" and "registered" -> this is the already-configured path from
    // defaultCommand's own point of view (codexPreparation === 'enabled'), but the
    // underlying registerMcp() must still repair the stale path on this run because it's
    // not canonicalUpToDate (see JUTELL-V1.0.1-CODEX-STALE-MCP-PATH-REPAIR-01). Exercise
    // this via `jutell use codex` explicitly here, since the auto-connect summary path
    // intentionally treats "enabled" providers as nothing-to-offer and would not repair
    // them proactively without a user asking for it - repair-on-drift is `use`'s job, not
    // silent auto-connect's.
    const result = await runToExit(['use', 'codex', '--yes'], project, { ...env, PATH: path1 });
    expect(result.exitCode).toBe(0);
    const finalContent = await fs.readFile(path.join(home, '.codex', 'config.toml'), 'utf8');
    expect(finalContent).not.toContain('C:/Program Files/nodejs/node.exe');
    expect(finalContent.match(/\[mcp_servers\.jutell\]/g)).toHaveLength(1);
  }, 20000);

  it('12. a legacy beginner_bridge entry survives auto-connect untouched', async () => {
    const { root, project, home, env } = await fixture();
    const path1 = await restrictedPath(root, ['codex']);
    await fs.mkdir(path.join(home, '.codex'), { recursive: true });
    // args must contain assets/mcp-server for readCodexRegistration's heuristic to
    // recognize this as JuTell's own legacy entry (see hasJuTellMcpEvidence in
    // managed.ts) - otherwise it reads as an unrelated conflict, not "legacy JuTell".
    const legacyBlock = '[mcp_servers.beginner_bridge]\ncommand = "node"\nargs = ["/opt/old-jutell/assets/mcp-server/index.js"]\nenabled = true';
    await fs.writeFile(path.join(home, '.codex', 'config.toml'), `${legacyBlock}\n`, 'utf8');

    await runAndKill(['--yes', '--no-open'], project, { ...env, PATH: path1 });

    const finalContent = await fs.readFile(path.join(home, '.codex', 'config.toml'), 'utf8');
    expect(finalContent).toContain(legacyBlock);
    expect(finalContent).toContain('[mcp_servers.jutell]');
  }, 20000);

  it('13. `jutell use <provider>` remains available and works as the manual/repair path', async () => {
    const { root, project, home, env } = await fixture();
    const path1 = await restrictedPath(root, ['codex']);
    const result = await runCli(['use', 'codex', '--yes'], project, { ...env, PATH: path1 });
    expect(result.stdout).toContain('Codex 연결이 끝났습니다');
    expect(await fs.readFile(path.join(home, '.codex', 'config.toml'), 'utf8')).toContain('enabled = true');
  }, 20000);
});
