import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { doctorCommand, statusCommand } from '../dist/commands/status.js';
import { resolveScope } from '../dist/config/paths.js';
import type { CliIo, CliOptions, ScopePaths } from '../src/types.js';

const temporaryRoots: string[] = [];
const tools = [
  'get_bridge_status',
  'get_active_features',
  'get_report_preferences',
  'get_beginner_report_rules',
  'get_safe_report_requirements',
];
const warning = '자동 실행에서는 jutell 도구가 막힙니다. `jutell use codex`로 고칠 수 있어요';

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-codex-approval-'));
  temporaryRoots.push(root);
  const project = path.join(root, 'project');
  const home = path.join(root, 'home');
  await fs.mkdir(project, { recursive: true });
  await fs.mkdir(home, { recursive: true });
  vi.stubEnv('BEGINNER_BRIDGE_HOME', home);
  vi.stubEnv('CODEX_HOME', path.join(home, '.codex'));
  vi.stubEnv('CLAUDE_CONFIG_DIR', home);
  vi.stubEnv('NO_COLOR', '');
  const paths = resolveScope('project', project);
  const codexConfig = path.join(home, '.codex', 'config.toml');
  await fs.mkdir(path.dirname(codexConfig), { recursive: true });
  return { paths, codexConfig };
}

function codexConfigText(defaultMode: string, perToolApprove: boolean, approvalPolicyNever = false) {
  const lines = [
    ...(approvalPolicyNever ? ['approval_policy = "never"', ''] : []),
    '[mcp_servers.jutell]',
    'command = "node"',
    `args = [${JSON.stringify(path.join('/tmp', 'assets', 'mcp-server', 'index.js'))}]`,
    'enabled = true',
    'required = false',
    `default_tools_approval_mode = "${defaultMode}"`,
  ];
  if (perToolApprove) {
    for (const tool of tools) lines.push('', `[mcp_servers.jutell.tools.${tool}]`, 'approval_mode = "approve"');
  }
  return `${lines.join('\n')}\n`;
}

function createIo(lines: string[]): CliIo {
  return { write: (message) => lines.push(message), error: () => {}, ask: async () => false, choose: async () => undefined };
}

const options = (json = false) => ({ json, fix: false } as CliOptions);

async function runDoctor(paths: ScopePaths, json = false, isTTY = false) {
  const lines: string[] = [];
  const stdout = process.stdout;
  const originalIsTTY = Object.getOwnPropertyDescriptor(stdout, 'isTTY');
  Object.defineProperty(stdout, 'isTTY', { value: isTTY, configurable: true });
  try {
    const checks = await doctorCommand(paths, options(json), createIo(lines));
    return { checks, output: lines.join('\n') };
  } finally {
    if (originalIsTTY) Object.defineProperty(stdout, 'isTTY', originalIsTTY);
    else delete (stdout as unknown as Record<string, unknown>).isTTY;
  }
}

async function runStatus(paths: ScopePaths, json = false) {
  const lines: string[] = [];
  const status = await statusCommand(paths, options(json), createIo(lines));
  return { status, output: lines.join('\n') };
}

afterEach(async () => {
  vi.unstubAllEnvs();
  for (const root of temporaryRoots.splice(0)) await fs.rm(root, { recursive: true, force: true });
});

describe('Codex jutell approval check', () => {
  it('server prompt default without per-tool overrides is an error and adds the same status warning', async () => {
    const { paths, codexConfig } = await fixture();
    await fs.writeFile(codexConfig, codexConfigText('prompt', false), 'utf8');

    const doctor = await runDoctor(paths, true);
    const check = (doctor.checks as Array<{ name: string; status: string; detail: string }>).find((result) => result.name === '자동 실행(codex exec)에서 jutell 도구 호출');
    expect(check?.status).toBe('오류');
    expect(check?.detail).toBe(warning);

    const status = await runStatus(paths, true);
    expect((status.status as { warnings: string[] }).warnings).toContain(warning);
    const plainStatus = await runStatus(paths);
    expect(plainStatus.output.split('\n')).toContain(`주의: ${warning}`);
  });

  it('per-tool approve settings make the check normal', async () => {
    const { paths, codexConfig } = await fixture();
    await fs.writeFile(codexConfig, codexConfigText('prompt', true), 'utf8');

    const doctor = await runDoctor(paths, true);
    expect((doctor.checks as Array<{ name: string; status: string }>).find((result) => result.name === '자동 실행(codex exec)에서 jutell 도구 호출')?.status).toBe('정상');
    const status = await runStatus(paths, true);
    expect((status.status as { warnings: string[] }).warnings).not.toContain(warning);
  });

  it('top-level approval_policy never adds the interactive Codex warning', async () => {
    const { paths, codexConfig } = await fixture();
    await fs.writeFile(codexConfig, codexConfigText('prompt', false, true), 'utf8');

    const doctor = await runDoctor(paths, true);
    const detail = (doctor.checks as Array<{ name: string; detail: string }>).find((result) => result.name === '자동 실행(codex exec)에서 jutell 도구 호출')?.detail;
    expect(detail).toBe(`${warning} 대화형 Codex에서도 jutell 도구 호출이 차단됩니다.`);
  });

  it('only colors TTY doctor errors, with JSON and NO_COLOR always uncolored', async () => {
    const { paths, codexConfig } = await fixture();
    await fs.writeFile(codexConfig, codexConfigText('prompt', false), 'utf8');

    delete process.env.NO_COLOR;
    const ttyDoctor = await runDoctor(paths, false, true);
    expect(ttyDoctor.output).toContain('\u001b[31m오류  자동 실행(codex exec)에서 jutell 도구 호출');

    const plainDoctor = await runDoctor(paths, false, false);
    expect(plainDoctor.output).not.toMatch(/\u001b\[[0-9;]*m/);
    const ttyJsonDoctor = await runDoctor(paths, true, true);
    expect(ttyJsonDoctor.output).not.toMatch(/\u001b\[[0-9;]*m/);

    vi.stubEnv('NO_COLOR', '');
    const noColorDoctor = await runDoctor(paths, false, true);
    expect(noColorDoctor.output).not.toMatch(/\u001b\[[0-9;]*m/);
  }, 15000);
});
