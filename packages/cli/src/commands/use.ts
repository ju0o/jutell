import { assets, packageRoot } from '../config/paths.js';
import { readCodexRegistration, registerMcp, snapshot, restore } from '../config/managed.js';
import { ensureBridgeConfig, setMcpEnabled } from '../installer/config.js';
import { installSkill, recordSkillFiles, removeAddedSkillFiles } from '../installer/skill.js';
import { agentsFile, ensureJuTellAgentsBlock } from '../installer/agents.js';
import { opencodeDetected, readOpenCodeRegistration, registerOpenCodeMcp, setOpenCodeEnabled } from '../installer/opencode.js';
import { findProvider, supportedProviderNames, type AgentProvider } from '../installer/providers.js';
import { codexDetected } from '../process/system.js';
import type { CliIo, CliOptions, FileSnapshot, ScopePaths } from '../types.js';

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

function detectProvider(provider: AgentProvider) {
  return provider.id === 'codex' ? codexDetected() : opencodeDetected();
}

async function registrationSnapshots(paths: ScopePaths): Promise<FileSnapshot[]> {
  const opencode = await readOpenCodeRegistration(paths, packageRoot(), false);
  const files = [paths.configFile, paths.codexConfigFile, opencode.file];
  if (paths.scope === 'project') files.push(agentsFile(paths.targetRoot));
  return Promise.all(files.map((file) => snapshot(file)));
}

async function registerProviderEnabled(paths: ScopePaths, provider: AgentProvider, io: CliIo) {
  if (provider.id === 'codex') await registerMcp(paths, packageRoot(), true);
  else await registerOpenCodeMcp(paths, packageRoot(), true);
  const current = provider.id === 'codex'
    ? await readCodexRegistration(paths, packageRoot(), true)
    : await readOpenCodeRegistration(paths, packageRoot(), true);
  if (current.canonicalRegistered && current.legacyRegistered) {
    io.write('\n이전 beginner_bridge 항목을 그대로 두고 새 jutell 항목을 추가했습니다.\n이전 항목은 자동으로 삭제하지 않습니다. 제거는 추후 안전한 마이그레이션에서 안내합니다.');
  }
}

async function verifyRegistration(paths: ScopePaths, provider: AgentProvider) {
  const current = provider.id === 'codex'
    ? await readCodexRegistration(paths, packageRoot(), true)
    : await readOpenCodeRegistration(paths, packageRoot(), true);
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
  const detected = detectProvider(provider);
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
  const detected = detectProvider(provider);
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
  if (provider.id === 'codex') {
    const current = await readCodexRegistration(paths, packageRoot(), false);
    if (current.conflict) throw new Error('Codex 설정에 같은 이름의 관리되지 않는 MCP 항목이 있어 자동 변경하지 않았습니다.');
    if (!current.registered) { io.write('연결된 Codex JuTell MCP가 없습니다. 먼저 jutell use codex 를 실행하세요.'); return { cancelled: false }; }
    await registerMcp(paths, packageRoot(), false);
  } else {
    const current = await readOpenCodeRegistration(paths, packageRoot(), false);
    if (current.conflict) throw new Error('OpenCode 설정에 같은 이름의 관리되지 않는 MCP 항목이 있어 자동 변경하지 않았습니다.');
    if (!current.registered) { io.write('연결된 OpenCode JuTell MCP가 없습니다. 먼저 jutell use opencode 를 실행하세요.'); return { cancelled: false }; }
    await setOpenCodeEnabled(paths, packageRoot(), false);
  }
  io.write(`${provider.label} 연결을 끊었습니다.\nJuTell MCP는 비활성화했고 설정 항목은 유지됩니다. 새 ${provider.label} 세션부터 사용되지 않습니다.`);
  return { cancelled: false };
}

export async function switchCommand(paths: ScopePaths, options: CliOptions, io: CliIo, args: string[]) {
  const provider = await resolveTarget(args, io);
  if (!provider) return { cancelled: true };
  const detected = detectProvider(provider);
  const snapshots = await registrationSnapshots(paths);
  try {
    if (provider.id !== 'codex') {
      const codex = await readCodexRegistration(paths, packageRoot(), false);
      if (codex.conflict) throw new Error('Codex 설정에 같은 이름의 관리되지 않는 MCP 항목이 있어 자동 변경하지 않았습니다.');
      if (codex.registered && codex.enabled) await registerMcp(paths, packageRoot(), false);
    }
    if (provider.id !== 'opencode') {
      const opencode = await readOpenCodeRegistration(paths, packageRoot(), false);
      if (opencode.conflict) throw new Error('OpenCode 설정에 같은 이름의 관리되지 않는 MCP 항목이 있어 자동 변경하지 않았습니다.');
      if (opencode.registered && opencode.enabled) await setOpenCodeEnabled(paths, packageRoot(), false);
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
