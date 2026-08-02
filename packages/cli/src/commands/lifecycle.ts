import { promises as fs } from 'node:fs';
import { assets, packageRoot, safeLocation } from '../config/paths.js';
import { readBridgeConfig, readCodexRegistration, snapshot, restore } from '../config/managed.js';
import { ensureBridgeConfig, setMcpDisabled, setMcpEnabled } from '../installer/config.js';
import { installSkill, recordSkillFiles, removeAddedSkillFiles, removeManagedSkillFiles } from '../installer/skill.js';
import { registerMcp, removeMcp } from '../config/managed.js';
import { scopeLabel } from '../output/format.js';
import { codexDetected, nodeMajorVersion, operatingSystem } from '../process/system.js';
import type { CliIo, CliOptions, ScopePaths } from '../types.js';

function validProfile(value: string | undefined) {
  return !value || ['minimal', 'balanced', 'learning', 'detailed'].includes(value);
}

export async function setupCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  if (!validProfile(options.profile)) throw new Error('Profile은 minimal, balanced, learning, detailed 중 하나여야 합니다.');
  const currentConfig = await readBridgeConfig(paths);
  const plannedProfile = options.profile ?? currentConfig.config.profile;
  io.write(`Beginner Bridge 설치 미리보기\n\n운영체제: ${operatingSystem()}\nNode: ${process.versions.node} (${nodeMajorVersion() >= 18 ? '지원 범위' : '낮은 버전'})\nCodex 감지: ${codexDetected() ? '예' : '직접 확인 필요'}\n설치 범위: ${scopeLabel(paths.scope)}\nProfile: ${plannedProfile}\nSkill: ${options.mcpOnly ? '변경하지 않음' : '설치 또는 기존 파일 유지'}\nMCP: ${options.skillOnly ? '변경하지 않음' : '기존 설정을 보존하고 관리 블록 등록'}\n기본 자동 시작: OFF\n`);
  if (!options.yes && !(await io.ask('위 변경을 진행할까요?'))) return { cancelled: true };

  const configSnapshot = await snapshot(paths.configFile);
  const codexSnapshot = await snapshot(paths.codexConfigFile);
  let skillResult: { conflicts: string[]; changed: string[] } = { conflicts: [], changed: [] };
  try {
    skillResult = options.mcpOnly ? { conflicts: [], changed: [] } : await installSkill(assets().skill, paths.skillRoot);
    const ensured = await ensureBridgeConfig(paths, options.profile);
    if (!options.skillOnly) {
      await registerMcp(paths, packageRoot(), ensured.config.mcp?.enabled === true);
    }
    await recordSkillFiles(paths, skillResult.changed);
    io.write(`설치가 완료되었습니다.\n\n설치 범위: ${scopeLabel(paths.scope)}\nProfile: ${ensured.config.profile}\nSkill: ${skillResult.conflicts.length ? '충돌 파일을 보존함' : '설치됨'}\nMCP: ${options.skillOnly ? '변경하지 않음' : '등록됨 (기본 활성화: 꺼짐)'}\n설정: ${safeLocation(paths.scope, 'config')}\n\n다음 실행: beginner-bridge`);
    if (skillResult.conflicts.length) io.write(`\n주의: 기존 파일을 덮어쓰지 않았습니다: ${skillResult.conflicts.join(', ')}`);
    return { cancelled: false, skillResult };
  } catch (error) {
    await restore(configSnapshot);
    await restore(codexSnapshot);
    await removeAddedSkillFiles(paths.skillRoot, skillResult.changed);
    throw error;
  }
}

export async function enableCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  if (!options.yes && !(await io.ask(`Beginner Bridge를 ${scopeLabel(paths.scope)}에서 활성화할까요?`))) return { cancelled: true };
  const configSnapshot = await snapshot(paths.configFile);
  const codexSnapshot = await snapshot(paths.codexConfigFile);
  let skillResult: { conflicts: string[]; changed: string[] } = { conflicts: [], changed: [] };
  try {
    skillResult = options.mcpOnly ? { conflicts: [], changed: [] } : await installSkill(assets().skill, paths.skillRoot);
    const config = await ensureBridgeConfig(paths, undefined);
    if (!options.skillOnly) {
      const enabled = await setMcpEnabled(paths, true);
      await registerMcp(paths, packageRoot(), enabled.mcp?.enabled === true);
    }
    await recordSkillFiles(paths, skillResult.changed);
    io.write(`활성화했습니다. Skill: ${options.mcpOnly ? '변경하지 않음' : '사용 가능'}, MCP: ${options.skillOnly ? '변경하지 않음' : '활성화됨'}.`);
    if (!options.skillOnly) io.write('새 Codex 세션 또는 재시작이 필요할 수 있습니다.');
    if (skillResult.conflicts.length) io.write(`주의: 기존 Skill 파일은 덮어쓰지 않았습니다: ${skillResult.conflicts.join(', ')}`);
    return { cancelled: false, config };
  } catch (error) {
    await restore(configSnapshot);
    await restore(codexSnapshot);
    await removeAddedSkillFiles(paths.skillRoot, skillResult.changed);
    throw error;
  }
}

export async function disableCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  const disableSkill = options.disableSkill;
  const disableMcp = options.disableMcp || (!disableSkill && !options.disableAll);
  if (!options.yes && !(await io.ask(`Beginner Bridge 연결을 ${scopeLabel(paths.scope)}에서 비활성화할까요?`))) return { cancelled: true };
  if (disableMcp) {
    const config = await setMcpDisabled(paths);
    await registerMcp(paths, packageRoot(), config.mcp?.enabled === true);
  }
  if (disableSkill) await removeManagedSkillFiles(assets().skill, paths.skillRoot, paths);
  io.write(`비활성화했습니다. Skill: ${disableSkill ? '비활성화됨' : '유지됨'}, MCP: ${disableMcp ? '비활성화됨' : '유지됨'}.`);
  io.write('설정과 Beta Journal 데이터는 보존했습니다.');
  return { cancelled: false };
}

export async function uninstallCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  const removeData = options.removeData;
  const dataMessage = removeData ? '설정과 Beta Journal도 삭제합니다.' : '설정과 Beta Journal은 보존합니다.';
  if (!options.yes && !(await io.ask(`Beginner Bridge를 제거할까요? ${dataMessage}`))) return { cancelled: true };
  await removeMcp(paths, packageRoot());
  await removeManagedSkillFiles(assets().skill, paths.skillRoot, paths);
  if (removeData) {
    await fs.rm(paths.configFile, { force: true });
    await fs.rm(paths.dataRoot, { recursive: true, force: true });
  }
  io.write(`제거했습니다. ${removeData ? '설정과 Beta Journal도 삭제했습니다.' : '설정과 Beta Journal은 보존했습니다.'}`);
  return { cancelled: false };
}
