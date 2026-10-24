import { mapFreshnessCheck } from './map.js';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { assets, codexScopedPaths, packageRoot, safeLocation, resolveScope as resolveGuiScope } from '../config/paths.js';
import { claudeDetected, codexDetected, nodeMajorVersion, operatingSystem } from '../process/system.js';
import { exists, parseSkillVersion, readBridgeConfig, readCodexRegistration, readText, unreadableWarning, withReadOnlyReads, readVersionInfo, FEATURE_IDS } from '../config/managed.js';
import { setupCommand } from './lifecycle.js';
import { hasJuTellAgentsBlock, receiptCommandFor, writtenReceiptCommands } from '../installer/agents.js';
import { differingSkillFiles } from '../installer/skill.js';
import { opencodeDetected, readOpenCodeRegistration } from '../installer/opencode.js';
import { readClaudeRegistration } from '../installer/claude.js';
import { probeMcpServer } from '../process/mcpProbe.js';
import { GUI_CHECK_PREFIX, guiStatusCheck, readGuiStatuses, vscodeDuplicateNote } from '../installer/gui-apps.js';
import type { CheckResult, CliIo, CliOptions, ScopePaths, StatusResult } from '../types.js';

async function processAlive(pid: number) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

const CODEX_APPROVAL_MODES = ['approve', 'prompt', 'auto', 'writes'] as const;
type UserApprovalOverride = { tool: string; mode: string };
const USER_APPROVAL_NOTE = '이 도구는 직접 정한 대로 매번 승인을 물어요. 자동 실행(codex exec)에서는 이 도구가 멈출 수 있어요. 바꾸려면 config.toml의 해당 줄을 지우세요.';

// The approval conflict comes only from the user's own non-approve tool settings outside
// the managed block (JuTell's block itself is current): a deliberate choice, not an error.
function isUserOnlyApprovalOverride(registration: { userApprovalOverride?: boolean; userApprovalOverrides?: UserApprovalOverride[]; canonicalUpToDate?: boolean }) {
  return Boolean(registration.userApprovalOverride && registration.canonicalUpToDate);
}

function codexApprovalWarning(approvalPolicyNever: boolean, userOnlyOverride = false, userApprovalOverrides: UserApprovalOverride[] = []) {
  const invalidOverride = userOnlyOverride
    ? userApprovalOverrides.find(({ mode }) => !CODEX_APPROVAL_MODES.includes(mode as (typeof CODEX_APPROVAL_MODES)[number]))
    : undefined;
  const promptOverride = userOnlyOverride && userApprovalOverrides.some(({ mode }) => mode === 'prompt');
  const selectedOverride = userApprovalOverrides[0];
  const warning = !userOnlyOverride
    ? '자동 실행에서는 jutell 도구가 막힙니다. `jutell use codex`로 고칠 수 있어요'
    : invalidOverride
      ? `config.toml의 ${invalidOverride.tool} approval_mode 값("${invalidOverride.mode}")을 Codex가 읽지 못해요. 그 줄을 고치거나 지우세요.`
      : promptOverride
        ? USER_APPROVAL_NOTE
        : `이 도구는 직접 정한 승인 방식("${selectedOverride?.mode ?? 'prompt'}")을 따라요. 자동 실행(codex exec)에서는 멈출 수 있어요. 바꾸려면 config.toml의 해당 줄을 지우세요.`;
  return approvalPolicyNever ? `${warning} 대화형 Codex에서도 jutell 도구 호출이 차단됩니다.` : warning;
}

async function adminState(paths: ScopePaths) {
  const marker = path.join(paths.dataRoot, 'dashboard.json');
  const raw = await readText(marker);
  if (!raw) return '중지됨' as const;
  try {
    const value = JSON.parse(raw) as { pid?: number };
    if (typeof value.pid === 'number' && await processAlive(value.pid)) return '실행 중' as const;
    await fs.rm(marker, { force: true });
  } catch { return '확인 필요' as const; }
  return '중지됨' as const;
}

export async function getStatus(paths: ScopePaths): Promise<StatusResult> {
  const { result, unreadable } = await withReadOnlyReads(() => collectStatus(paths));
  for (const { file, code } of unreadable) result.warnings.push(unreadableWarning(displayPath(paths, file), code));
  return result;
}

function displayPath(paths: ScopePaths, file: string) {
  const relative = path.relative(paths.targetRoot, file);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? relative : file;
}

async function collectStatus(paths: ScopePaths): Promise<StatusResult> {
  const config = await readBridgeConfig(paths);
  // Codex only reads MCP servers from its global config, so status always
  // checks that real file regardless of the invocation's scope (see
  // codexScopedPaths) — otherwise a project-scope status could report
  // "등록됨" for a file Codex never actually consumes.
  const registration = await readCodexRegistration(codexScopedPaths(paths), packageRoot(), config.config.mcp?.enabled === true);
  const versions = await readVersionInfo();
  const skillInstalled = await exists(path.join(paths.skillRoot, 'SKILL.md'));
  const installedSkillText = await readText(path.join(paths.skillRoot, 'SKILL.md'));
  const agentsManaged = await hasJuTellAgentsBlock(paths.targetRoot);
  const opencode = await readOpenCodeRegistration(paths, packageRoot(), false);
  const claude = await readClaudeRegistration(paths, packageRoot(), false);
  const codexPreparation = registration.conflict ? 'error' : !registration.registered ? 'not_registered' : registration.enabled ? 'enabled' : 'registered';
  const opencodePreparation = opencode.conflict ? 'conflict' : !opencode.registered ? 'not_registered' : opencode.enabled ? 'enabled' : 'registered';
  const claudePreparation = claude.conflict ? 'conflict' : !claude.registered ? 'not_registered' : claude.enabled ? 'enabled' : 'registered';
  const anyProviderRegistered = registration.registered || opencode.registered || claude.registered;
  const anyProviderEnabled = registration.enabled || opencode.enabled || claude.enabled;
  const warnings: string[] = [];
  if (!config.valid) warnings.push('설정 파일을 읽지 못해 balanced 기본값을 사용 중입니다.');
  if (config.invalidLimitsFields.length) warnings.push(`.jutell.json의 limits 값 중 숫자가 아닌 항목이 있어 기본값을 대신 사용했습니다: ${config.invalidLimitsFields.join(', ')}. 실제 파일 값은 바뀌지 않았으니 직접 고쳐주세요.`);
  if (registration.conflict) warnings.push('같은 이름의 관리되지 않는 Codex MCP 설정이 있어 자동 변경하지 않았습니다.');
  if (registration.approvalConflict) warnings.push(codexApprovalWarning(registration.approvalPolicyNever, isUserOnlyApprovalOverride(registration), registration.userApprovalOverrides));
  if (opencode.conflict) warnings.push('OpenCode 설정에 같은 이름의 관리되지 않는 MCP 항목이 있어 자동 변경하지 않았습니다.');
  if (registration.bothRegistered) warnings.push('Codex에 canonical jutell과 legacy beginner_bridge MCP가 모두 있습니다. 자동 정리하지 않았습니다. 이전 항목을 정리하려면 jutell migrate --clean 을 실행하세요.');
  if (opencode.bothRegistered) warnings.push('OpenCode에 canonical jutell과 legacy beginner_bridge MCP가 모두 있습니다. 자동 정리하지 않았습니다. 이전 항목을 정리하려면 jutell migrate --clean 을 실행하세요.');
  if (registration.legacyRegistered && !registration.canonicalRegistered) warnings.push('Codex에 이전 beginner_bridge 항목만 있습니다. jutell use codex 를 실행하면 보존하면서 새 jutell 항목을 추가합니다.');
  if (opencode.legacyRegistered && !opencode.canonicalRegistered) warnings.push('OpenCode에 이전 beginner_bridge 항목만 있습니다. jutell use opencode 를 실행하면 보존하면서 새 jutell 항목을 추가합니다.');
  const apps = await readGuiStatuses(guiProjectRoot(paths));
  const guiRegistered = apps.some((app) => app.writable && app.registered);
  if (config.config.mcp?.enabled && !anyProviderRegistered && !guiRegistered) warnings.push('MCP 연결 정책은 켜져 있지만 Codex·OpenCode·Claude Code 어느 Provider에도 JuTell MCP가 등록되지 않았습니다. jutell use <agent> 를 실행해 주세요.');
  if (config.config.mcp?.enabled && anyProviderRegistered && !anyProviderEnabled) warnings.push('연결 정책(.jutell.json)은 켜져 있지만 새 세션에서 자동 시작할 활성 Provider 항목이 없습니다. jutell use <agent> 를 실행해 주세요.');
  if (!config.config.mcp?.enabled && anyProviderEnabled) warnings.push('연결 정책(.jutell.json)은 꺼져 있지만 Provider 자동 시작은 켜져 있습니다. jutell off 뒤라면 정상이에요: Codex 연결은 다른 프로젝트와 함께 쓰는 전역 설정이라 남아 있어요. 모든 프로젝트에서 끄려면 jutell disable --global, 다시 켜려면 jutell use <agent>를 실행하세요.');
  return {
    cliVersion: versions.cli,
    skillVersion: skillInstalled ? (parseSkillVersion(installedSkillText) ?? versions.skill) : '설치되지 않음',
    mcpVersion: versions.mcp,
    adminVersion: versions.admin,
    installationScope: paths.scope,
    configExists: config.exists,
    configValid: config.valid,
    codexDetected: codexDetected(),
    opencodeDetected: opencodeDetected(),
    claudeDetected: claudeDetected(),
    skillInstalled,
    agentsManaged,
    mcpRegistered: anyProviderRegistered,
    mcpEnabled: config.config.mcp?.enabled === true,
    codexPreparation,
    opencodePreparation,
    claudePreparation,
    anyProviderRegistered,
    anyProviderEnabled,
    actualConnection: 'not_checked',
    opencode: { registered: opencode.registered, conflict: opencode.conflict, enabled: opencode.enabled },
    claude: { registered: claude.registered, conflict: claude.conflict, enabled: claude.enabled },
    profile: config.config.profile,
    activeFeatureCount: Object.values(config.config.features).filter(Boolean).length,
    configLocation: config.source === 'legacy' ? '기존 설정(.beginner-bridge.json)' : safeLocation(paths.scope, 'config'),
    localAdmin: await adminState(paths),
    usageCountersEnabled: config.config.usageMeasurement?.localCountersEnabled === true,
    telemetry: '비활성화',
    externalTransmission: '없음',
    warnings,
    apps,
  };
}

function guiProjectRoot(paths: ScopePaths) {
  return paths.scope === 'project' ? paths.targetRoot : resolveGuiScope('project').targetRoot;
}

export async function statusCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  const status = await getStatus(paths);
  if (options.json) { io.write(JSON.stringify(status, null, 2)); return status; }
  const codexLabel = { not_registered: '미등록', registered: '등록됨', enabled: '활성화됨', error: '오류' }[status.codexPreparation];
  const opencodeLabel = { not_registered: '미등록', registered: '등록됨', enabled: '활성화됨', conflict: '충돌' }[status.opencodePreparation];
  const claudeLabel = { not_registered: '미등록', registered: '등록됨', enabled: '활성화됨', conflict: '충돌' }[status.claudePreparation];
  const actual = { not_checked: '확인하지 않음', success: '마지막 확인 성공', failure: '마지막 확인 실패' }[status.actualConnection];
  const codexDetectedLabel = status.codexDetected ? '감지됨' : '미감지';
  const opencodeDetectedLabel = status.opencodeDetected ? '감지됨' : status.opencode.registered ? '설정 있음(명령 미감지)' : '미감지';
  const claudeDetectedLabel = status.claudeDetected ? '감지됨' : status.claude.registered ? '설정 있음(명령 미감지)' : '미감지';
  const claudeScopeNote = status.installationScope === 'global' ? '사용자 전역(user)' : '현재 프로젝트(local)';
  io.write(`JuTell 상태\n\nCLI: ${status.cliVersion}\nSkill: ${status.skillInstalled ? '설치됨' : '설치되지 않음'}\nAGENTS.md: ${status.agentsManaged ? 'JuTell 블록 있음' : 'JuTell 블록 없음'}\nJuTell 연결 정책: ${status.mcpEnabled ? '켜짐' : '꺼짐'}\nCodex MCP (전역, Codex는 프로젝트 설정을 읽지 않음): ${codexLabel}${status.codexDetected ? ` (명령 ${codexDetectedLabel})` : ''}\nCodex (CLI·앱·IDE 확장 공용 설정): ChatGPT 데스크톱 앱과 IDE 확장도 위 Codex 설정을 같이 씁니다. 바꾼 뒤 앱은 설정 → MCP servers → Restart, IDE는 Restart extension\nOpenCode MCP: ${opencodeLabel}${status.opencode.enabled ? ' (새 세션 자동 시작 켜짐)' : ''}${status.opencodeDetected ? '' : ` (명령 ${opencodeDetectedLabel})`}\nClaude Code MCP (${claudeScopeNote}): ${claudeLabel}${status.claudeDetected ? '' : ` (명령 ${claudeDetectedLabel})`}\nMCP 서버 응답: ${actual}\n현재 Agent 세션 적용: 직접 확인 필요\nProfile: ${status.profile}\n활성 Feature: ${status.activeFeatureCount}개\n설치 범위 (설정·Skill·AGENTS.md): ${status.installationScope === 'global' ? '사용자 전역' : '현재 프로젝트'}\n로컬 관리자: ${status.localAdmin}\n로컬 사용량 카운터: ${status.usageCountersEnabled ? '켜짐' : '꺼짐'}\nTelemetry: ${status.telemetry}\n외부 전송: ${status.externalTransmission}\n설정 위치: ${status.configLocation}`);
  for (const app of status.apps) {
    const check = guiStatusCheck(app);
    io.write(`${check.label}: ${check.status === '정상' ? '' : `${check.status} — `}${check.detail}`);
  }
  for (const warning of status.warnings) io.write(`주의: ${warning}`);
  const duplicate = vscodeDuplicateNote(status.apps);
  if (duplicate) io.write(`참고: ${duplicate}`);
  const map = await mapFreshnessCheck(paths);
  // Always one map line in a project (dogfood #37): fresh, missing, or the stale warning.
  if (map?.status === '주의') io.write(`주의: ${map.detail}`);
  else if (map) io.write(`지도: ${map.detail}`);
  return status;
}

async function portAvailable() {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(0, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}

async function writeCheck(paths: ScopePaths) {
  const directory = paths.dataRoot;
  const file = path.join(directory, `.doctor-${process.pid}.tmp`);
  try { await fs.mkdir(directory, { recursive: true }); await fs.writeFile(file, 'ok', 'utf8'); await fs.rm(file, { force: true }); return true; } catch { await fs.rm(file, { force: true }); return false; }
}

// Codex runs commands through the user's login shell. Accept either the old
// globally exposed command or this project's local npm bin, without changing PATH.
// Only a receipt needs the CLI from Codex's shell: with receiptReport off a miss is 주의 (B7).
export async function loginShellJutellCheck(
  receiptReport = true,
  env: NodeJS.ProcessEnv = process.env,
  projectRoot = process.cwd(),
): Promise<CheckResult> {
  const name = 'Codex에서 jutell 명령 찾기';
  const loginShell = env.SHELL && path.isAbsolute(env.SHELL) ? env.SHELL : 'bash';
  const run = (file: string, args: string[], runEnv = env, cwd = projectRoot) => new Promise<string | undefined>((resolve) => {
    execFile(file, args, { timeout: 10000, env: runEnv, cwd }, (error, stdout) => resolve(error ? undefined : stdout.trim()));
  });
  if (await run(loginShell, ['-lc', 'command -v jutell'])) {
    return { name, status: '정상', detail: 'Codex가 명령을 실행하는 셸에서 jutell을 찾았습니다.' };
  }
  // npm exec resolves the project's local bin without adding it to a global PATH.
  // Pass the root as a quoted environment value so spaces and shell metacharacters
  // in the path do not become shell syntax; execute from that same project root.
  const localEnv = { ...env, JUTELL_PROJECT_ROOT: path.resolve(projectRoot) };
  const local = await run(
    loginShell,
    ['-lc', 'npm exec --offline --no --prefix "$JUTELL_PROJECT_ROOT" -- jutell --version'],
    localEnv,
    path.resolve(projectRoot),
  );
  if (local) {
    return { name, status: '정상', detail: 'Codex가 프로젝트에 설치된 JuTell을 npm으로 찾았습니다.' };
  }
  const prefix = await run('npm', ['prefix', '-g']);
  const profile = path.basename(loginShell) === 'zsh' ? '~/.zprofile' : '~/.profile';
  const globalFix = prefix
    ? `전역 설치를 쓰면 ${profile} 파일 맨 아래에 이 한 줄을 넣고 터미널과 Codex를 다시 여세요: export PATH="${path.join(prefix, 'bin')}:$PATH"`
    : `전역 설치를 쓰면 jutell이 들어 있는 폴더를 ${profile}의 PATH에 넣고 터미널과 Codex를 다시 여세요.`;
  // Show only the fix for how JuTell is installed here (dogfood #37: both fixes made the message long).
  const localInstall = await fs.lstat(path.join(path.resolve(projectRoot), 'node_modules', 'jutell')).then(() => true, () => false);
  const fix = localInstall
    ? '이 프로젝트에 설치된 JuTell을 쓰고 있어요. 프로젝트 폴더에서 npm install --save-dev jutell 을 다시 실행한 뒤 jutell doctor 로 확인하세요.'
    : globalFix.replace('전역 설치를 쓰면 ', '');
  return {
    name,
    status: receiptReport ? '오류' : '주의',
    detail: `Codex가 명령을 실행하는 셸에서 jutell을 찾지 못했어요. ${receiptReport ? '이대로면 작업 영수증이 저장되지 않아요. ' : ''}${fix}`,
  };
}

export async function getDoctorResults(paths: ScopePaths): Promise<CheckResult[]> {
  const { result, unreadable } = await withReadOnlyReads(() => collectDoctorResults(paths));
  for (const { file, code } of unreadable) {
    const shown = displayPath(paths, file);
    result.push({ name: `읽을 수 없는 파일: ${shown}`, status: '주의', detail: unreadableWarning(shown, code) });
  }
  return result;
}

async function collectDoctorResults(paths: ScopePaths): Promise<CheckResult[]> {
  const config = await readBridgeConfig(paths);
  const codexPaths = codexScopedPaths(paths);
  const registration = await readCodexRegistration(codexPaths, packageRoot(), config.config.mcp?.enabled === true);
  const opencode = await readOpenCodeRegistration(paths, packageRoot(), false);
  const claude = await readClaudeRegistration(paths, packageRoot(), false);
  const skillFile = path.join(paths.skillRoot, 'SKILL.md');
  const skillText = await readText(skillFile);
  const mcpEntry = path.join(assets().mcpServer, 'index.js');
  const adminEntry = path.join(assets().localAdmin, 'index.html');
  const mcpText = await readText(mcpEntry) ?? '';
  const checks: CheckResult[] = [];
  checks.push({ name: 'Node 버전', status: nodeMajorVersion() >= 18 ? '정상' : '오류', detail: `현재 Node ${process.versions.node}` });
  checks.push({ name: '운영체제', status: ['Windows', 'macOS', 'Linux'].includes(operatingSystem()) ? '정상' : '직접 확인 필요', detail: operatingSystem() });
  const anyProviderDetectedOrConfigured = codexDetected() || opencodeDetected() || claudeDetected() || await exists(codexPaths.codexConfigFile) || await exists(paths.opencodeConfigFile) || claude.exists;
  checks.push({ name: 'AI Agent Provider 설치 또는 설정', status: anyProviderDetectedOrConfigured ? '정상' : '직접 확인 필요', detail: anyProviderDetectedOrConfigured ? 'Provider 명령 또는 설정을 확인했습니다.' : 'Provider 명령과 설정을 모두 자동 확인하지 못했습니다.' });
  checks.push({ name: 'OpenCode 명령 감지', status: opencodeDetected() ? '정상' : '직접 확인 필요', detail: opencodeDetected() ? 'opencode --version 명령을 확인했습니다.' : 'opencode 명령을 자동 확인하지 못했습니다. PATH·shell 실행 권한을 확인해 주세요.' });
  checks.push({
    name: 'Skill 파일',
    status: skillText === undefined ? '주의' : skillText.includes('name: beginner-bridge') ? '정상' : '오류',
    detail: skillText === undefined
      ? '아직 연결하지 않았어요. 프로젝트 폴더에서 `jutell`을 실행하세요.'
      : skillText.includes('name: beginner-bridge') ? 'Skill 파일을 확인했습니다.' : 'Skill 파일 형식이 올바르지 않습니다.',
  });
  const skillVersion = parseSkillVersion(skillText);
  const sourceSkillText = await readText(path.join(assets().skill, 'SKILL.md'));
  const sourceVersion = parseSkillVersion(sourceSkillText);
  const differing = skillText === undefined ? [] : await differingSkillFiles(assets().skill, paths.skillRoot);
  const skillMatch = Boolean(skillText && sourceSkillText && differing.length === 0);
  const differingList = `${differing.slice(0, 5).join(', ')}${differing.length > 5 ? ` 외 ${differing.length - 5}개` : ''}`;
  checks.push({ name: 'Skill 버전', status: skillMatch ? '정상' : skillVersion ? '주의' : '직접 확인 필요', detail: skillMatch ? `스킬 버전 ${sourceVersion ?? '(버전 기록 없음)'} (설치 사본 일치).` : skillVersion ? `설치된 안내 파일이 이 버전과 달라요: ${differingList}. 프로젝트 폴더에서 \`jutell\`을 실행하면 새 버전으로 바꿔요(예전 것은 .jutell-local/backups에 보관).` : '설치된 Skill에 버전 기록이 없습니다.' });
  checks.push({ name: '현재 Agent 세션 적용', status: '직접 확인 필요', detail: '실제로 Skill과 규칙을 읽었는지 여부는 해당 Agent 세션에서 직접 확인해야 합니다.' });
  checks.push({ name: 'MCP 빌드 파일', label: 'JuTell 도구 파일', status: await exists(mcpEntry) ? '정상' : '오류', detail: await exists(mcpEntry) ? 'AI가 JuTell 도구를 부를 때 실행되는 파일(MCP 서버)이 패키지에 들어 있습니다.' : 'AI가 JuTell 도구를 부를 때 실행되는 파일(MCP 서버)이 없습니다. npm install -g jutell로 다시 설치해 보세요.' });
  checks.push({ name: 'Codex MCP', status: registration.conflict ? '오류' : registration.registered ? '정상' : '주의', detail: registration.conflict ? '관리되지 않는 동일 이름 설정이 있습니다.' : registration.registered ? `Codex 설정 파일에서 JuTell이 넣은 연결 부분을 확인했습니다. 새 세션 자동 시작: ${registration.enabled ? '켜짐' : '꺼짐'}.` : '등록되지 않았습니다.' });
  const userOnlyApprovalOverride = isUserOnlyApprovalOverride(registration);
  const hasInvalidUserApprovalOverride = userOnlyApprovalOverride && registration.userApprovalOverrides?.some(({ mode }) => !CODEX_APPROVAL_MODES.includes(mode as (typeof CODEX_APPROVAL_MODES)[number]));
  const approvalCheckStatus = !registration.canonicalJuTellRegistered ? '직접 확인 필요' : registration.approvalConflict ? (hasInvalidUserApprovalOverride ? '오류' : userOnlyApprovalOverride ? '주의' : '오류') : '정상';
  const approvalCheckDetail = !registration.canonicalJuTellRegistered
    ? 'Codex jutell 등록이 없어 승인 설정을 확인할 수 없습니다.'
    : registration.approvalConflict
      ? codexApprovalWarning(registration.approvalPolicyNever, userOnlyApprovalOverride, registration.userApprovalOverrides)
      : registration.approvalPolicyNever
        ? '자동 실행에서는 모든 jutell 도구가 승인됩니다. 대화형 Codex에서도 jutell 도구 호출이 차단됩니다.'
        : '자동 실행에서 모든 jutell 도구가 승인됩니다.';
  checks.push({ name: '자동 실행(codex exec)에서 jutell 도구 호출', status: approvalCheckStatus, detail: approvalCheckDetail });
  checks.push({ name: 'OpenCode MCP', status: opencode.conflict ? '오류' : opencode.registered ? (opencode.enabled ? '정상' : '주의') : '주의', detail: opencode.conflict ? '관리되지 않는 동일 이름 항목이 있습니다.' : opencode.registered ? `OpenCode 설정에서 JuTell이 넣은 연결 부분을 확인했습니다. 새 세션 자동 시작: ${opencode.enabled ? '켜짐' : '꺼짐'}.` : 'OpenCode MCP가 등록되지 않았습니다.' });
  checks.push({ name: 'Claude Code MCP', status: claude.registered ? '정상' : '주의', detail: claude.registered ? `${claude.claudeScope} 범위(${claude.claudeScope === 'user' ? '사용자 전역' : '현재 프로젝트'})에 등록되어 있습니다.` : 'Claude Code MCP가 등록되지 않았습니다.' });
  checks.push({ name: config.source === 'legacy' ? '.beginner-bridge.json' : '.jutell.json', status: config.valid ? '정상' : '오류', detail: config.exists ? (config.valid ? (config.source === 'legacy' ? '이전 설정 파일을 읽었습니다. 새 .jutell.json이 없으면 사용합니다.' : '설정 형식을 확인했습니다.') : '설정이 올바르지 않아 기본값을 사용합니다.') : '없으면 기본 설정을 사용합니다.' });
  const featuresValid = Object.keys(config.config.features).every((id) => FEATURE_IDS.includes(id));
  // Range check runs on the already-normalized (defaulted) values, so it can never itself
  // fail - normalizeConfig() only ever produces values inside these ranges. Fold in
  // invalidLimitsFields (computed from the raw, pre-normalization file) so a malformed
  // value that got silently replaced with its default is still reported as unhealthy,
  // not "정상" for a file whose actual on-disk content doesn't match what's checked.
  const limitsValid = config.config.limits.maxMainFiles >= 1 && config.config.limits.maxMainFiles <= 10 && config.config.limits.maxGlossaryTerms >= 0 && config.config.limits.maxGlossaryTerms <= 10 && config.config.limits.compactReportMaxSentences >= 4 && config.config.limits.compactReportMaxSentences <= 30 && config.invalidLimitsFields.length === 0;
  checks.push({ name: '공식 Feature ID', status: featuresValid ? '정상' : '오류', detail: featuresValid ? '현재 공식 ID만 확인했습니다.' : '지원하지 않는 Feature ID가 있습니다.' });
  checks.push({ name: 'limits', status: limitsValid ? '정상' : '오류', detail: config.invalidLimitsFields.length ? `숫자가 아닌 값이 있어 기본값을 대신 사용했습니다: ${config.invalidLimitsFields.join(', ')}.` : limitsValid ? '허용 범위를 확인했습니다.' : '허용 범위를 벗어난 값이 있습니다.' });
  checks.push({ name: '로컬 관리자 빌드', status: await exists(adminEntry) ? '정상' : '오류', detail: await exists(adminEntry) ? '관리자 화면 파일을 확인했습니다.' : '관리자 화면 파일이 없습니다.' });
  checks.push({ name: '포트 사용 가능 여부', status: await portAvailable() ? '정상' : '주의', detail: '127.0.0.1의 임시 포트를 확인했습니다.' });
  const mapCheck = await mapFreshnessCheck(paths);
  if (mapCheck) checks.push(mapCheck);
  checks.push({ name: '쓰기 권한', status: await writeCheck(paths) ? '정상' : '오류', detail: '로컬 상태 폴더에 임시 파일을 만들고 삭제했습니다.' });
  const backupExists = await exists(`${codexPaths.codexConfigFile}.previous`);
  if (process.platform !== 'win32') checks.push(await loginShellJutellCheck(config.config.features.receiptReport !== false, process.env, paths.targetRoot));
  checks.push({ name: '설정 백업 상태', status: !await exists(codexPaths.codexConfigFile) || backupExists ? '정상' : '주의', detail: !await exists(codexPaths.codexConfigFile) ? '아직 Provider 설정을 변경하지 않았습니다.' : backupExists ? '이전 설정 백업을 확인했습니다. JuTell이 처음 바꾸기 전 원본은 config.toml.jutell-original에 그대로 남아 있습니다.' : '기존 Provider 설정 백업이 없습니다.' });
  const externalCode = /(?:https?:\/\/(?!127\.0\.0\.1)|https?\.request|net\.connect)/i.test(mcpText);
  checks.push({ name: '외부 전송 코드', status: externalCode ? '오류' : '정상', detail: externalCode ? 'JuTell 도구 파일에서 인터넷으로 보내는 코드를 찾았습니다.' : 'JuTell 도구 파일에 인터넷으로 보내는 코드가 없습니다. 작업 내용은 이 컴퓨터 밖으로 나가지 않습니다.' });
  const hasRegisteredMcp = registration.registered || opencode.registered || claude.registered;
  const probe = hasRegisteredMcp ? await probeMcpServer(mcpEntry) : undefined;
  checks.push({
    name: 'MCP 서버 실제 연결 (Stdio)',
    label: 'JuTell 도구 실제로 켜 보기',
    status: probe ? probe.ok ? '정상' : '오류' : '직접 확인 필요',
    detail: probe
      ? probe.ok ? `JuTell 도구를 실제로 켜 보니 응답했고 ${probe.toolCount}개 도구를 AI에게 줄 수 있습니다(Stdio는 AI 앱이 JuTell과 직접 주고받는 방식).` : `서버 응답 실패: ${probe.error ?? '알 수 없는 오류'}`
      : '아직 MCP를 등록하지 않아 실제 연결을 확인할 수 없습니다. 프로젝트 폴더에서 `jutell`을 실행하세요.',
  });
  const apps = await readGuiStatuses(guiProjectRoot(paths));
  for (const app of apps) checks.push(guiStatusCheck(app));
  const duplicate = vscodeDuplicateNote(apps);
  if (duplicate) checks.push({ name: `${GUI_CHECK_PREFIX}vscode-discovery`, label: 'VS Code 중복 표시', status: '정상', detail: duplicate });
  if (paths.scope === 'project') {
    // Item 12: a project-local npm install has no `jutell` on PATH, so show the exact receipt command the AI is told to use.
    const command = await receiptCommandFor(paths.targetRoot);
    // The block is written at setup; switching between a project install and a global (-g) one later makes it stale.
    const stale = (await writtenReceiptCommands(paths.targetRoot)).filter((entry) => entry.command !== command);
    checks.push(stale.length > 0
      ? { name: '영수증 명령', status: '주의', detail: `JuTell 설치 방식이 바뀌었어요(프로젝트 안 설치 ↔ 컴퓨터 전체 설치). ${stale.map((entry) => entry.file).join('·')}에는 아직 예전 영수증 명령(\`${stale[0].command}\`)이 적혀 있어 AI가 영수증을 만들지 못할 수 있어요. 프로젝트 폴더에서 \`jutell --yes\`를 다시 실행하면 지금 설치에 맞게 고쳐집니다.` }
      : { name: '영수증 명령', status: '정상', detail: command === 'jutell receipt'
        ? 'AI는 작업이 끝나면 `jutell receipt`로 영수증을 만듭니다.'
        : `이 프로젝트(또는 그 위 작업 공간)의 node_modules에 설치된 JuTell이라 AI는 \`${command}\`로 영수증을 만듭니다(AGENTS.md에 적혀 있음). 터미널에서 직접 쓸 때도 이 명령을 쓰세요.${command.includes('--prefix .') ? ' npm workspaces 멤버 폴더라 `--prefix .`로 이 폴더를 기준으로 실행해요. 이 폴더(또는 그 안)에서 실행하세요. 작업 공간 루트에서 실행하면 루트가 대상이 돼요.' : ''}` });
  }
  return checks;
}

export async function doctorCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  let checks = await getDoctorResults(paths);
  const fixableError = checks.some((check) => check.status === '오류' && check.name !== 'MCP 서버 실제 연결 (Stdio)' && !check.name.startsWith(GUI_CHECK_PREFIX));
  if (options.fix && fixableError) {
    await setupCommand(paths, { ...options, yes: true }, io);
    checks = await getDoctorResults(paths);
  }
  if (options.json) { io.write(JSON.stringify(checks.map(({ label: _label, ...check }) => check), null, 2)); return checks; }
  const colorErrors = process.stdout.isTTY === true && process.env.NO_COLOR === undefined;
  io.write('JuTell 점검 결과');
  for (const check of checks) {
    const line = `${check.status}  ${check.label ?? check.name}: ${check.detail}`;
    io.write(colorErrors && check.status === '오류' ? `\u001b[31m${line}\u001b[0m` : line);
  }
  return checks;
}
