import path from 'node:path';
import { promises as fs } from 'node:fs';
import { assets, codexScopedPaths, packageRoot, safeLocation } from '../config/paths.js';
import { readBridgeConfig, readCodexRegistration, snapshot, restore } from '../config/managed.js';
import { ensureBridgeConfig, setMcpDisabled, setMcpEnabled } from '../installer/config.js';
import { installSkill, recordSkillFiles, removeAddedSkillFiles, removeManagedSkillFiles, skillConflictMessage, skillRefreshMessage } from '../installer/skill.js';
import { agentsFile, ensureJuTellAgentsBlock, removeJuTellAgentsBlock } from '../installer/agents.js';
import { recordReceiptBaseline } from './receipt/index.js';
import { codexUninstallBlocker, managedCodexServerFile, readText, registerMcp, removeMcp, userKeysInManagedBlock } from '../config/managed.js';
import { removeOpenCodeMcp, readOpenCodeRegistration, setOpenCodeEnabled } from '../installer/opencode.js';
import { removeClaudeMcp } from '../installer/claude.js';
import { scopeLabel } from '../output/format.js';
import { offerMap } from '../map/write.js';
import { removeGitExclude, shownExcludePath } from '../map/git-exclude.js';
import { codexDetected, nodeMajorVersion, operatingSystem } from '../process/system.js';
import type { CliIo, CliOptions, ScopePaths } from '../types.js';

function validProfile(value: string | undefined) {
  return !value || ['minimal', 'balanced', 'learning', 'detailed'].includes(value);
}

export async function setupCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  if (!validProfile(options.profile)) throw new Error('Profile은 minimal, balanced, learning, detailed 중 하나여야 합니다.');
  const currentConfig = await readBridgeConfig(paths);
  const plannedProfile = options.profile ?? currentConfig.config.profile;
  const migrationNote = currentConfig.source === 'legacy' ? '\n기존 설정을 읽었습니다. 승인하면 .jutell.json을 만들고 기존 파일은 보존합니다.\n' : '';
  if (!options.oneCommand) io.write(`JuTell 설치 미리보기\n${migrationNote}\n\n운영체제: ${operatingSystem()}\nNode: ${process.versions.node} (${nodeMajorVersion() >= 18 ? '지원 범위' : '낮은 버전'})\nAI Agent Provider 감지: ${codexDetected() ? '현재 지원 Provider 확인' : '직접 확인 필요'}\n설치 범위: ${scopeLabel(paths.scope)}\nProfile: ${plannedProfile}\nSkill: ${options.mcpOnly ? '변경하지 않음' : '설치 (JuTell이 설치한 예전 안내 파일은 새 버전으로 바꾸고, 직접 고친 것은 .jutell-local/backups에 보관. 직접 만든 파일과 링크는 그대로 둠)'}\nMCP: ${options.skillOnly ? '변경하지 않음' : '기존 설정을 보존하고 관리 블록 등록'}\n기본 자동 시작: OFF\n`);
  if (!options.yes && !(await io.ask('위 변경을 진행할까요?'))) return { cancelled: true };

  const configSnapshot = await snapshot(paths.configFile);
  const codexSnapshot = await snapshot(codexScopedPaths(paths).codexConfigFile);
  const agentsSnapshot = paths.scope === 'project' ? await snapshot(agentsFile(paths.targetRoot)) : undefined;
  let skillResult: Awaited<ReturnType<typeof installSkill>> = { conflicts: [], changed: [], replaced: [], backedUp: [], backedUpLegacy: [], backupDir: undefined };
  try {
    skillResult = options.mcpOnly ? skillResult : await installSkill(assets().skill, paths.skillRoot, paths);
    const ensured = await ensureBridgeConfig(paths, options.profile);
    if (paths.scope === 'project' && !options.mcpOnly) await ensureJuTellAgentsBlock(paths.targetRoot);
    if (!options.skillOnly) {
      if (options.activateMcp) await setMcpEnabled(paths, true);
      // Codex only reads MCP servers from its global config, so registration
      // always targets that file regardless of --project/--global (see
      // codexScopedPaths). .jutell.json/Skill/AGENTS.md above stay scoped
      // to what the user requested.
      const installationRegistration = await registerMcp(codexScopedPaths(paths), packageRoot(), options.activateMcp || ensured.config.mcp?.enabled === true);
      if (installationRegistration.restoredHint) io.write("이전에 직접 넣은 jutell 설정이 config.toml에 주석으로 남아 있어요. 다시 쓰려면 '# jutell 제거로 주석 처리됨' 아래 줄 맨 앞의 '# '을 지우세요.");
    }
    await recordSkillFiles(paths, [...skillResult.changed, ...skillResult.replaced]);
    if (!options.oneCommand) {
      io.write(`설치가 완료되었습니다.\n\n설치 범위: ${scopeLabel(paths.scope)}\nProfile: ${ensured.config.profile}\nSkill: ${skillResult.replaced.length ? '새 버전으로 바꿈' : skillResult.conflicts.length ? '직접 만든 파일은 그대로 둠' : '설치됨'}\nMCP: ${options.skillOnly ? '변경하지 않음' : `등록됨 (${options.activateMcp ? '활성화' : '기본 활성화: 꺼짐'})`}\n설정: ${safeLocation(paths.scope, 'config')}${options.skillOnly ? '' : `\nCodex MCP: ${safeLocation(paths.scope, 'codex')} (Codex는 전역 설정만 읽습니다)`}\n\n다음 실행: jutell`);
      const refreshed = skillRefreshMessage(skillResult, paths);
      if (refreshed) io.write(`\n${refreshed}`);
      const kept = skillConflictMessage(skillResult);
      if (kept) io.write(`\n주의: ${kept}`);
    }
  } catch (error) {
    await restore(configSnapshot);
    await restore(codexSnapshot);
    if (agentsSnapshot) await restore(agentsSnapshot);
    await removeAddedSkillFiles(paths.skillRoot, skillResult.changed);
    throw error;
  }
  // The install's own changes (package.json, lockfile…) become the receipt's 'before work' baseline.
  await recordReceiptBaseline(paths).catch(() => undefined);
  // Asked after a successful install only (a map problem never rolls the install back).
  if (!options.oneCommand && !options.mcpOnly) await offerMap(paths, options, io, process.stdin.isTTY === true);
  return { cancelled: false, skillResult };
}

export async function enableCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  if (!options.yes && !(await io.ask(`JuTell을 ${scopeLabel(paths.scope)}에서 활성화할까요?`))) return { cancelled: true };
  const configSnapshot = await snapshot(paths.configFile);
  const codexSnapshot = await snapshot(codexScopedPaths(paths).codexConfigFile);
  const agentsSnapshot = paths.scope === 'project' ? await snapshot(agentsFile(paths.targetRoot)) : undefined;
  let skillResult: Awaited<ReturnType<typeof installSkill>> = { conflicts: [], changed: [], replaced: [], backedUp: [], backedUpLegacy: [], backupDir: undefined };
  try {
    skillResult = options.mcpOnly ? skillResult : await installSkill(assets().skill, paths.skillRoot, paths);
    const config = await ensureBridgeConfig(paths, undefined);
    if (paths.scope === 'project' && !options.mcpOnly) await ensureJuTellAgentsBlock(paths.targetRoot);
    if (!options.skillOnly) {
      const enabled = await setMcpEnabled(paths, true);
      // Codex MCP registration always targets the global config (see codexScopedPaths).
      const enableRegistration = await registerMcp(codexScopedPaths(paths), packageRoot(), enabled.mcp?.enabled === true);
      if (enableRegistration.restoredHint) io.write("이전에 직접 넣은 jutell 설정이 config.toml에 주석으로 남아 있어요. 다시 쓰려면 '# jutell 제거로 주석 처리됨' 아래 줄 맨 앞의 '# '을 지우세요.");
      const opencode = await readOpenCodeRegistration(paths, packageRoot(), enabled.mcp?.enabled === true);
      if (opencode.registered) await setOpenCodeEnabled(paths, packageRoot(), true);
    }
    await recordSkillFiles(paths, [...skillResult.changed, ...skillResult.replaced]);
    if (!options.oneCommand) {
      io.write(`활성화했습니다. Skill: ${options.mcpOnly ? '변경하지 않음' : '사용 가능'}, MCP: ${options.skillOnly ? '변경하지 않음' : '활성화됨'}.`);
      if (!options.skillOnly) io.write('새 AI Agent 세션 또는 재시작이 필요할 수 있습니다.');
      const refreshed = skillRefreshMessage(skillResult, paths);
      if (refreshed) io.write(refreshed);
      const kept = skillConflictMessage(skillResult);
      if (kept) io.write(`주의: ${kept}`);
    }
    return { cancelled: false, config };
  } catch (error) {
    await restore(configSnapshot);
    await restore(codexSnapshot);
    if (agentsSnapshot) await restore(agentsSnapshot);
    await removeAddedSkillFiles(paths.skillRoot, skillResult.changed);
    throw error;
  }
}

export async function disableCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  const disableSkill = options.disableSkill;
  const disableMcp = options.disableMcp || (!disableSkill && !options.disableAll);
  if (!options.yes && !(await io.ask(`JuTell 연결을 ${scopeLabel(paths.scope)}에서 비활성화할까요?`))) return { cancelled: true };
  let codexSkipped = false;
  if (disableMcp) {
    const config = await setMcpDisabled(paths);
    // Codex MCP registration is a single global entry shared by every
    // project on this machine (see codexScopedPaths). A project-scoped
    // disable only turns off *this project's* connection policy; it does
    // not reach into that shared global entry unless the user explicitly
    // asked for --global, so other projects using Codex + JuTell keep working.
    if (paths.scope === 'global') {
      const disableRegistration = await registerMcp(codexScopedPaths(paths), packageRoot(), config.mcp?.enabled === true);
      if (disableRegistration.restoredHint) io.write("이전에 직접 넣은 jutell 설정이 config.toml에 주석으로 남아 있어요. 다시 쓰려면 '# jutell 제거로 주석 처리됨' 아래 줄 맨 앞의 '# '을 지우세요.");
    }
    else codexSkipped = true;
    await setOpenCodeEnabled(paths, packageRoot(), false);
    // Claude's own local/project scope is already correctly per-project
    // (unlike Codex's forced-global registration), so removing it here has
    // no cross-project blast radius - safe to always do, no scope gate needed.
    await removeClaudeMcp(paths, packageRoot());
  }
  if (disableSkill) await removeManagedSkillFiles(assets().skill, paths.skillRoot, paths);
  if (disableSkill && paths.scope === 'project') await removeJuTellAgentsBlock(paths.targetRoot);
  io.write(`비활성화했습니다. Skill: ${disableSkill ? '비활성화됨' : '유지됨'}, MCP: ${disableMcp ? '비활성화됨' : '유지됨'}.`);
  io.write('설정과 Beta Journal 데이터는 보존했습니다.');
  if (codexSkipped) io.write('Codex MCP 연결(전역 설정)은 다른 프로젝트와 공유되어 그대로 두었습니다. 모든 프로젝트에서 끄려면 jutell disable --global 을 실행하세요.');
  return { cancelled: false };
}

async function runsFromProject(codexPaths: ScopePaths, projectRoot: string) {
  const server = await managedCodexServerFile(codexPaths).catch(() => undefined);
  if (!server) return false;
  const real = async (file: string) => (await fs.realpath(file).catch(() => path.resolve(file))).replaceAll('\\', '/');
  const [serverPath, root] = await Promise.all([real(path.dirname(server)), real(projectRoot)]);
  // Only JuTell's own local install counts (<project>/node_modules/jutell/assets/mcp-server);
  // other in-project paths such as vendor/…/jutell or a checkout of JuTell itself do not.
  return serverPath === `${root}/node_modules/jutell/assets/mcp-server`;
}

export async function uninstallCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  const removeData = options.removeData;
  const dataMessage = removeData ? '설정과 Beta Journal도 삭제합니다.' : '설정과 Beta Journal은 보존합니다.';
  if (!options.yes && !(await io.ask(`JuTell을 제거할까요? ${dataMessage}`))) return { cancelled: true };
  // Codex MCP registration is a single global entry shared by every project
  // on this machine (see codexScopedPaths). Removing JuTell from one project
  // must not silently break that shared connection for other projects, so a
  // project-scoped uninstall leaves it in place unless the user asked for
  // --global.
  // Exception: when the shared entry runs THIS project's local install (node_modules inside the project),
  // it cannot work for other projects after removal, so JuTell's own entry is removed too.
  const codexLocal = paths.scope === 'project' && await runsFromProject(codexScopedPaths(paths), paths.targetRoot);
  const codexSkipped = paths.scope !== 'global' && !codexLocal;
  const codexNotes: string[] = [];
  let codexRemoved = false;
  if (!codexSkipped) {
    const codexPaths = codexScopedPaths(paths);
    // A broken or linked global file only skips the Codex step; the rest of uninstall goes on.
    const blocker = await codexUninstallBlocker(codexPaths);
    if (blocker) codexNotes.push(blocker);
    else {
      try {
        const userKeys = userKeysInManagedBlock(await readText(codexPaths.codexConfigFile) ?? '');
        const removal = await removeMcp(codexPaths, packageRoot());
        codexRemoved = true;
        if (userKeys.length > 0) codexNotes.push(`주의: JuTell이 관리하는 구역 안에 직접 넣은 값(${userKeys.join(', ')})이 있어 구역과 함께 지워졌어요. 필요하면 백업(${removal.backupPath})에서 다시 옮겨 주세요.`);
        if (removal.commentedTables.length > 0) {
          codexNotes.push(`직접 넣은 jutell 설정(${removal.commentedTables.join(', ')})은 지우지 않고 주석으로 남겼어요. 바로 전 백업: ${removal.backupPath}, 처음 원본: ${codexPaths.codexConfigFile}.jutell-original`);
        }
      } catch (error) {
        codexNotes.push(`Codex 전역 설정의 JuTell 연결은 지우지 못했어요(${(error as Error).message}). 나머지 제거는 계속했어요.`);
      }
    }
  }
  await removeManagedSkillFiles(assets().skill, paths.skillRoot, paths);
  if (paths.scope === 'project') await removeJuTellAgentsBlock(paths.targetRoot);
  // Only JuTell's two lines in .git/info/exclude; the map file itself and the user's .gitignore stay.
  const excluded = paths.scope === 'project' ? await removeGitExclude(paths.targetRoot).catch(() => undefined) : undefined;
  if (excluded?.status === 'removed') io.write(`JuTellMap.md를 git에서 빼던 줄(${shownExcludePath(excluded.file, paths.targetRoot)})을 지웠어요.`);
  await removeOpenCodeMcp(paths, packageRoot());
  // Same reasoning as disable: Claude's scope is already per-project, so no
  // shared-global-entry risk to guard against here.
  await removeClaudeMcp(paths, packageRoot());
  if (removeData) {
    await fs.rm(paths.configFile, { force: true });
    await fs.rm(paths.dataRoot, { recursive: true, force: true });
  }
  if (paths.scope === 'project') await removeEmptyFolders([paths.skillRoot, path.dirname(paths.skillRoot), path.dirname(path.dirname(paths.skillRoot))]);
  io.write(`제거했습니다. ${removeData ? '설정과 Beta Journal(JuTell이 남긴 하루 작업 기록)도 삭제했습니다.' : '설정과 Beta Journal(JuTell이 남긴 하루 작업 기록)은 보존했습니다.'}`);
  if (paths.scope === 'project') io.write(leftoverNote(removeData));
  for (const note of codexNotes) io.write(note);
  if (codexLocal && codexRemoved) io.write('Codex 전역 설정에 남아 있던 이 프로젝트용 JuTell 연결(이 폴더의 node_modules를 가리킴)도 지웠어요. 다른 설정은 그대로예요.');
  if (codexSkipped) io.write('Codex와 JuTell을 잇는 연결(MCP)은 이 컴퓨터의 모든 프로젝트가 함께 쓰는 Codex 설정 파일에 있어서, 다른 프로젝트와 공유되어 제거하지 않았습니다. 모든 프로젝트에서 지우려면 jutell uninstall --global --yes 를 실행하세요.');
  return { cancelled: false };
}

/** Folders JuTell made for its Skill (.agents/skills, .agents) are removed only when nothing else is inside. */
async function removeEmptyFolders(dirs: string[]) {
  for (const dir of dirs) {
    try { await fs.rmdir(dir); } catch { return; }
  }
}

function leftoverNote(removeData: boolean) {
  const kept = removeData
    ? 'JuTellMap.md(프로젝트 지도)'
    : '.jutell.json(설정), .jutell-local/(작업 기록·영수증·지도 상세), JuTellMap.md(프로젝트 지도)';
  const how = removeData ? '필요 없으면 직접 지우세요.' : '모두 지우려면 jutell uninstall --remove-data --yes 를 실행한 뒤 JuTellMap.md를 직접 지우세요.';
  return `남겨 둔 것: ${kept}. 다시 설치하면 그대로 이어서 씁니다. ${how}`;
}

export async function onCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  return enableCommand(paths, { ...options, skillOnly: false, mcpOnly: false }, io);
}

export async function offCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  return disableCommand(paths, { ...options, disableSkill: true, disableMcp: true, disableAll: true }, io);
}
