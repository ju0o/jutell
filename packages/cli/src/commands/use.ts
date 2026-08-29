import { assets, codexScopedPaths, packageRoot } from '../config/paths.js';
import { readCodexRegistration, registerMcp, snapshot, restore } from '../config/managed.js';
import { ensureBridgeConfig, setMcpEnabled } from '../installer/config.js';
import { installSkill, recordSkillFiles, removeAddedSkillFiles } from '../installer/skill.js';
import { agentsFile, ensureJuTellAgentsBlock } from '../installer/agents.js';
import { opencodeDetected, readOpenCodeRegistration, registerOpenCodeMcp, setOpenCodeEnabled } from '../installer/opencode.js';
import { readClaudeRegistration, registerClaudeMcp, removeClaudeMcp } from '../installer/claude.js';
import { findProvider, supportedProviderNames, type AgentProvider, type AgentProviderId } from '../installer/providers.js';
import { claudeDetected, codexDetected } from '../process/system.js';
import type { CliIo, CliOptions, FileSnapshot, ScopePaths } from '../types.js';

type Registration = { registered: boolean; enabled: boolean; conflict: boolean; canonicalRegistered: boolean; legacyRegistered: boolean };

type ProviderAdapter = {
  detected(): boolean;
  read(paths: ScopePaths, enabled: boolean): Promise<Registration>;
  register(paths: ScopePaths, enabled: boolean): Promise<Registration>;
  /** Turn this provider's JuTell connection off - used by `disconnect <provider>` and by `switch` for whichever provider is not the target. */
  deactivate(paths: ScopePaths): Promise<Registration>;
  notConnectedMessage: string;
};

function adapterFor(id: AgentProviderId): ProviderAdapter {
  if (id === 'codex') {
    // Codex only reads MCP servers from its global config (see
    // codexScopedPaths), regardless of --project/--global.
    return {
      detected: codexDetected,
      read: (paths, enabled) => readCodexRegistration(codexScopedPaths(paths), packageRoot(), enabled),
      register: (paths, enabled) => registerMcp(codexScopedPaths(paths), packageRoot(), enabled),
      deactivate: (paths) => registerMcp(codexScopedPaths(paths), packageRoot(), false),
      notConnectedMessage: '연결된 Codex JuTell MCP가 없습니다. 먼저 jutell use codex 를 실행하세요.',
    };
  }
  if (id === 'claude-code') {
    // Claude's own scope (local/user) already follows paths.scope directly -
    // no forced-scope helper needed, unlike Codex.
    return {
      detected: claudeDetected,
      read: (paths, enabled) => readClaudeRegistration(paths, packageRoot(), enabled),
      register: (paths, enabled) => registerClaudeMcp(paths, packageRoot(), enabled),
      deactivate: (paths) => removeClaudeMcp(paths, packageRoot()),
      notConnectedMessage: '연결된 Claude Code JuTell MCP가 없습니다. 먼저 jutell use claude 를 실행하세요.',
    };
  }
  return {
    detected: opencodeDetected,
    read: (paths, enabled) => readOpenCodeRegistration(paths, packageRoot(), enabled),
    register: (paths, enabled) => registerOpenCodeMcp(paths, packageRoot(), enabled),
    deactivate: (paths) => setOpenCodeEnabled(paths, packageRoot(), false),
    notConnectedMessage: '연결된 OpenCode JuTell MCP가 없습니다. 먼저 jutell use opencode 를 실행하세요.',
  };
}

async function resolveTarget(args: string[], io: CliIo): Promise<AgentProvider | undefined> {
  const target = args[1];
  if (!target) throw new Error('Agent 이름이 필요합니다. 예: jutell use opencode');
  const provider = findProvider(target);
  if (!provider) throw new Error(`알 수 없는 Agent입니다: ${target}\n현재 사용할 수 있는 Agent는 ${supportedProviderNames()}입니다.`);
  if (provider.status === 'planned') {
    io.write(`${provider.label} 연결은 아직 준비 중입니다.\n현재 사용할 수 있는 Agent는 ${supportedProviderNames()}입니다.`);
    return undefined;
  }
  return provider;
}

async function registrationSnapshots(paths: ScopePaths): Promise<FileSnapshot[]> {
  const opencode = await readOpenCodeRegistration(paths, packageRoot(), false);
  const files = [paths.configFile, paths.codexConfigFile, codexScopedPaths(paths).codexConfigFile, opencode.file, paths.claudeConfigFile];
  if (paths.scope === 'project') files.push(agentsFile(paths.targetRoot));
  return Promise.all(files.map((file) => snapshot(file)));
}

async function registerProviderEnabled(paths: ScopePaths, provider: AgentProvider, io: CliIo) {
  const adapter = adapterFor(provider.id);
  await adapter.register(paths, true);
  const current = await adapter.read(paths, true);
  if (current.canonicalRegistered && current.legacyRegistered) {
    io.write('\n이전 beginner_bridge 항목을 그대로 두고 새 jutell 항목을 추가했습니다.\n이전 항목은 자동으로 삭제하지 않습니다. 제거는 추후 안전한 마이그레이션에서 안내합니다.');
  }
  if (provider.id === 'codex') {
    io.write('\nCodex는 MCP 서버 목록을 사용자 전역 설정에서만 읽습니다.\nJuTell 프로젝트 규칙(AGENTS.md, Skill, 설정)은 이 프로젝트에 그대로 두고,\nCodex MCP 연결만 사용자 전역 설정(Codex 홈)에 등록했습니다.');
  }
}

async function verifyRegistration(paths: ScopePaths, provider: AgentProvider) {
  const current = await adapterFor(provider.id).read(paths, true);
  if (!current.canonicalRegistered || !current.enabled) throw new Error(`${provider.label} 연결 설정을 검증하지 못했습니다. jutell doctor를 실행해 주세요.`);
}

function printSuccess(io: CliIo, provider: AgentProvider, extra: { detected: boolean; skill?: boolean; agents?: boolean; othersDisabled?: boolean; keepNote?: boolean }) {
  io.write(`${provider.label} 연결이 끝났습니다.\n\n이제 ${provider.label}에서 새 대화를 열면\nJuTell이 자동으로 적용됩니다.\n실제 적용 여부는 새 대화에서 확인할 수 있습니다.\n\n연결 확인\n- AI 연결 설정\n- JuTell 규칙 연결\n- 기존 ${provider.label} 설정 보존`);
  if (extra.othersDisabled) io.write('\n\n다른 Agent의 JuTell 연결은 비활성화했습니다.');
  if (extra.keepNote) io.write('\n기존 다른 Agent 연결은 유지했습니다.');
  if (!extra.detected) io.write(`\n참고: ${provider.label} 명령을 찾지 못했습니다. 설치 후 다시 실행하세요.`);
}

async function rollback(snapshots: FileSnapshot[], changed: string[], paths: ScopePaths) {
  for (const item of snapshots) await restore(item);
  await removeAddedSkillFiles(paths.skillRoot, changed);
}

export async function useCommand(paths: ScopePaths, options: CliOptions, io: CliIo, args: string[]) {
  const provider = await resolveTarget(args, io);
  if (!provider) return { cancelled: true };
  const detected = adapterFor(provider.id).detected();
  const snapshots = await registrationSnapshots(paths);
  let changed: string[] = [];
  try {
    await ensureBridgeConfig(paths, options.profile);
    const skillResult = await installSkill(assets().skill, paths.skillRoot);
    changed = skillResult.changed;
    if (paths.scope === 'project') await ensureJuTellAgentsBlock(paths.targetRoot);
    await setMcpEnabled(paths, true);
    await registerProviderEnabled(paths, provider, io);
    await recordSkillFiles(paths, changed);
    await verifyRegistration(paths, provider);
    printSuccess(io, provider, { detected, skill: true, agents: paths.scope === 'project', keepNote: true });
    return { cancelled: false };
  } catch (error) {
    await rollback(snapshots, changed, paths);
    throw error;
  }
}

export async function connectCommand(paths: ScopePaths, options: CliOptions, io: CliIo, args: string[]) {
  const provider = await resolveTarget(args, io);
  if (!provider) return { cancelled: true };
  const detected = adapterFor(provider.id).detected();
  const snapshots = await registrationSnapshots(paths);
  try {
    await ensureBridgeConfig(paths, undefined);
    await setMcpEnabled(paths, true);
    await registerProviderEnabled(paths, provider, io);
    await verifyRegistration(paths, provider);
    printSuccess(io, provider, { detected, keepNote: true });
    return { cancelled: false };
  } catch (error) {
    await rollback(snapshots, [], paths);
    throw error;
  }
}

export async function disconnectCommand(paths: ScopePaths, options: CliOptions, io: CliIo, args: string[]) {
  const provider = await resolveTarget(args, io);
  if (!provider) return { cancelled: true };
  const adapter = adapterFor(provider.id);
  const current = await adapter.read(paths, false);
  if (current.conflict) throw new Error(`${provider.label} 설정에 같은 이름의 관리되지 않는 MCP 항목이 있어 자동 변경하지 않았습니다.`);
  if (!current.registered) { io.write(adapter.notConnectedMessage); return { cancelled: false }; }
  await adapter.deactivate(paths);
  io.write(`${provider.label} 연결을 끊었습니다.\nJuTell MCP는 비활성화했고 설정 항목은 유지됩니다. 새 ${provider.label} 세션부터 사용되지 않습니다.`);
  return { cancelled: false };
}

export async function switchCommand(paths: ScopePaths, options: CliOptions, io: CliIo, args: string[]) {
  const provider = await resolveTarget(args, io);
  if (!provider) return { cancelled: true };
  const detected = adapterFor(provider.id).detected();
  const snapshots = await registrationSnapshots(paths);
  try {
    for (const other of ['codex', 'opencode', 'claude-code'] as const) {
      if (other === provider.id) continue;
      const otherAdapter = adapterFor(other);
      const current = await otherAdapter.read(paths, false);
      const otherLabel = findProvider(other)?.label ?? other;
      if (current.conflict) throw new Error(`${otherLabel} 설정에 같은 이름의 관리되지 않는 MCP 항목이 있어 자동 변경하지 않았습니다.`);
      if (current.registered && current.enabled) await otherAdapter.deactivate(paths);
    }
    await ensureBridgeConfig(paths, undefined);
    await setMcpEnabled(paths, true);
    await registerProviderEnabled(paths, provider, io);
    await verifyRegistration(paths, provider);
    printSuccess(io, provider, { detected, othersDisabled: true });
    return { cancelled: false };
  } catch (error) {
    await rollback(snapshots, [], paths);
    throw error;
  }
}
