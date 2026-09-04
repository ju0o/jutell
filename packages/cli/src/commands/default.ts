import { stdin } from 'node:process';
import { dashboardCommand } from './dashboard.js';
import { enableCommand } from './lifecycle.js';
import { getStatus } from './status.js';
import { useCommand } from './use.js';
import { AGENT_PROVIDERS, type AgentProvider, type AgentProviderId } from '../installer/providers.js';
import type { CliIo, CliOptions, ScopePaths, StatusResult } from '../types.js';

const profileLabels: Record<StatusResult['profile'], string> = {
  minimal: '최소 보고',
  balanced: '균형 보고',
  learning: '학습 보고',
  detailed: '상세 보고',
};

function needsRepair(status: StatusResult) {
  return !status.configValid || !status.skillInstalled || !status.agentsManaged || status.codexPreparation !== 'enabled';
}

function readyMessage(status: StatusResult) {
  const ready = status.configValid && status.skillInstalled && status.agentsManaged && status.codexPreparation === 'enabled';
  if (!ready) {
    return `JuTell 연결이 일부 준비되지 않았습니다.

설정과 Skill을 확인했지만 AI Agent Provider 연결 준비가 완료되지 않았습니다.
관리자 화면에서 현재 상태를 확인할 수 있습니다.`;
  }
  return `JuTell 준비 완료

✓ 설정 연결됨
✓ Skill 연결됨
✓ AI Agent 연결 준비 완료
✓ 안전 보고 규칙 적용됨

현재 보고 방식: ${profileLabels[status.profile]}
활성 기능: ${status.activeFeatureCount}개

새 AI Agent 세션부터 사용할 수 있습니다.
실제 도구 호출 여부는 해당 Provider에서 확인할 수 있습니다.`;
}

// One row per provider JuTell can actually connect to today (excludes
// status === 'planned' entries like Cline - nothing to detect/offer for those).
type ProviderRuntimeStatus = {
  provider: AgentProvider;
  detected: boolean;
  connected: boolean;
  conflict: boolean;
};

export function providerRuntimeStatuses(status: StatusResult): ProviderRuntimeStatus[] {
  const byId = (id: AgentProviderId) => AGENT_PROVIDERS.find((provider) => provider.id === id);
  const rows: Array<[AgentProviderId, boolean, boolean, boolean]> = [
    ['codex', status.codexDetected, status.codexPreparation === 'enabled', status.codexPreparation === 'error'],
    ['opencode', status.opencodeDetected, status.opencodePreparation === 'enabled', status.opencode.conflict],
    ['claude-code', status.claudeDetected, status.claudePreparation === 'enabled', status.claude.conflict],
  ];
  return rows
    .map(([id, detected, connected, conflict]) => {
      const provider = byId(id);
      return provider ? { provider, detected, connected, conflict } : undefined;
    })
    .filter((row): row is ProviderRuntimeStatus => row !== undefined);
}

function padLabel(label: string, width: number) {
  return label + ' '.repeat(Math.max(1, width - label.length + 2));
}

const noProvidersMessage = `JuTell이 이 컴퓨터에서 지원하는 Coding Agent(Codex, OpenCode, Claude Code)를 찾지 못했습니다.

Codex, OpenCode, Claude Code 중 하나를 설치한 뒤 'jutell'을 다시 실행해 주세요.
이미 설치했다면 PATH에서 실행 파일을 찾을 수 있는지 'jutell doctor'로 확인해 주세요.`;

function alreadyConfiguredMessage(statuses: ProviderRuntimeStatus[]) {
  const width = Math.max(...statuses.map((row) => row.provider.label.length));
  const lines = statuses.map((row) => `${padLabel(row.provider.label, width)}${row.detected ? '연결됨' : '미감지'}`);
  return `JuTell

${lines.join('\n')}

JuTell 준비 완료.

명령 목록: jutell --help`;
}

// Printed once, after offerAutoConnect() finishes successfully, instead of auto-launching
// the dashboard (see JUTELL-V1.X-AUTO-SETUP-FOUNDATION-01B - the user asked to connect,
// not to open a browser/local-server session; `jutell dashboard` remains the explicit,
// opt-in way to do that). Lists every currently-connected provider, not just the ones
// connected in this run, so a partial-catch-up run still shows the full accurate picture.
function connectedSummaryMessage(statuses: ProviderRuntimeStatus[]) {
  const connectedLines = statuses.filter((row) => row.connected).map((row) => `✓ ${row.provider.label} 연결됨`);
  return `JuTell 준비 완료.

${connectedLines.join('\n')}

새 Coding Agent 세션을 열고 평소처럼 사용하세요.

'jutell' — 상태/설정
'jutell --help' — 명령어 보기`;
}

/**
 * Multi-provider auto-detect-and-connect for bare `jutell`. Reuses the exact
 * same per-provider detection (via getStatus, which already wraps
 * codexDetected/opencodeDetected/claudeDetected) and the exact same atomic,
 * idempotent, rollback-safe registration path `jutell use <provider>` already
 * uses (useCommand) - this intentionally does not implement a second
 * detection or registration system.
 */
export async function offerAutoConnect(paths: ScopePaths, options: CliOptions, io: CliIo, statuses: ProviderRuntimeStatus[]): Promise<{ cancelled: boolean }> {
  const detected = statuses.filter((row) => row.detected);
  const toConnect = detected.filter((row) => !row.connected);
  const offerable = toConnect.filter((row) => !row.conflict);
  const conflicted = toConnect.filter((row) => row.conflict);

  const width = Math.max(...statuses.map((row) => row.provider.label.length));
  const foundList = statuses
    .map((row) => `${padLabel(row.provider.label, width)}${row.detected ? (row.connected ? '찾음 (이미 연결됨)' : '찾음') : '미감지'}`)
    .join('\n');
  io.write(`JuTell\n\n찾은 Coding Agent:\n\n${foundList}`);

  if (offerable.length === 0) {
    if (conflicted.length) {
      io.write(`\n주의: ${conflicted.map((row) => row.provider.label).join(', ')}에 관리되지 않는 기존 MCP 설정이 있어 자동으로 연결하지 않았습니다. 'jutell use <agent>'로 직접 확인해 주세요.`);
    }
    return { cancelled: true };
  }

  io.write('\nJuTell을 이 Agent들에 연결할 수 있습니다.');

  if (!options.yes) {
    if (stdin.isTTY !== true) {
      io.write("\n대화형 터미널이 아니어서 확인 없이 연결하지 않았습니다.\n자동으로 연결하려면 'jutell --yes'를 실행하거나, 대화형 터미널에서 'jutell'을 다시 실행해 주세요.");
      return { cancelled: true };
    }
    const confirmed = await io.ask('JuTell을 지금 연결할까요?', true);
    if (!confirmed) {
      io.write("\nJuTell을 연결하지 않았습니다.\n나중에 다시 'jutell'을 실행하면 같은 안내를 볼 수 있습니다.");
      return { cancelled: true };
    }
  }

  io.write('\nJuTell을 연결하는 중...\n');
  for (const row of offerable) {
    await useCommand(paths, { ...options, yes: true }, io, ['use', row.provider.id]);
  }
  if (conflicted.length) {
    io.write(`주의: ${conflicted.map((row) => row.provider.label).join(', ')}에 관리되지 않는 기존 MCP 설정이 있어 자동으로 연결하지 않았습니다. 'jutell use <agent>'로 직접 확인해 주세요.`);
  }
  return { cancelled: false };
}

export async function defaultCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  const status = await getStatus(paths);
  const statuses = providerRuntimeStatuses(status);
  const detected = statuses.filter((row) => row.detected);
  const toConnect = detected.filter((row) => !row.connected);

  if (detected.length === 0) {
    io.write(noProvidersMessage);
    return { cancelled: true };
  }

  if (toConnect.length > 0) {
    const result = await offerAutoConnect(paths, options, io, statuses);
    if (result.cancelled) return result;
    // Connected - print a concise summary and return to the shell. Does NOT
    // auto-launch the dashboard (JUTELL-V1.X-AUTO-SETUP-FOUNDATION-01B): the
    // user asked to connect, not to open a local browser/server session.
    // `jutell dashboard` remains the explicit, unchanged, opt-in way to do that.
    io.write(connectedSummaryMessage(providerRuntimeStatuses(await getStatus(paths))));
    return { cancelled: false };
  }

  if (needsRepair(status)) {
    io.write('JuTell 연결이 일부 준비되지 않았습니다.\nSkill, AGENTS.md, AI Agent Provider 연결 준비를 안전하게 확인할 수 있습니다.');
    if (!options.yes && !(await io.ask('다시 켜고 관리자 화면을 열까요?', true))) {
      io.write('현재 설정을 그대로 두고 관리자 화면을 엽니다.');
    } else {
      await enableCommand(paths, { ...options, yes: true, oneCommand: true }, io);
    }
    io.write(readyMessage(await getStatus(paths)));
    return dashboardCommand(paths, options, io);
  }

  // Every detected provider is already connected and nothing needs repair -
  // this is a repeat run, not onboarding. Keep it minimal: no wizard, no
  // dashboard auto-launch, just a status line and a pointer to --help.
  io.write(alreadyConfiguredMessage(statuses));
  return { cancelled: false };
}
