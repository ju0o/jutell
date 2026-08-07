import { promises as fs } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { assets, packageRoot, safeLocation } from '../config/paths.js';
import { codexDetected, nodeMajorVersion, operatingSystem } from '../process/system.js';
import { exists, parseSkillVersion, readBridgeConfig, readCodexRegistration, readText, readVersionInfo, FEATURE_IDS } from '../config/managed.js';
import { setupCommand } from './lifecycle.js';
import { hasJuTellAgentsBlock } from '../installer/agents.js';
import { opencodeDetected, readOpenCodeRegistration } from '../installer/opencode.js';
import { probeMcpServer } from '../process/mcpProbe.js';
import type { CheckResult, CliIo, CliOptions, ScopePaths, StatusResult } from '../types.js';

async function processAlive(pid: number) {
  try { process.kill(pid, 0); return true; } catch { return false; }
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
  const config = await readBridgeConfig(paths);
  const registration = await readCodexRegistration(paths, packageRoot(), config.config.mcp?.enabled === true);
  const versions = await readVersionInfo();
  const skillInstalled = await exists(path.join(paths.skillRoot, 'SKILL.md'));
  const installedSkillText = await readText(path.join(paths.skillRoot, 'SKILL.md'));
  const agentsManaged = await hasJuTellAgentsBlock(paths.targetRoot);
  const opencode = await readOpenCodeRegistration(paths, packageRoot(), false);
  const codexPreparation = registration.conflict ? 'error' : !registration.registered ? 'not_registered' : registration.enabled ? 'enabled' : 'registered';
  const opencodePreparation = opencode.conflict ? 'conflict' : !opencode.registered ? 'not_registered' : opencode.enabled ? 'enabled' : 'registered';
  const anyProviderRegistered = registration.registered || opencode.registered;
  const anyProviderEnabled = registration.enabled || opencode.enabled;
  const warnings: string[] = [];
  if (!config.valid) warnings.push('설정 파일을 읽지 못해 balanced 기본값을 사용 중입니다.');
  if (registration.conflict) warnings.push('같은 이름의 관리되지 않는 Codex MCP 설정이 있어 자동 변경하지 않았습니다.');
  if (opencode.conflict) warnings.push('OpenCode 설정에 같은 이름의 관리되지 않는 MCP 항목이 있어 자동 변경하지 않았습니다.');
  if (config.config.mcp?.enabled && !anyProviderRegistered) warnings.push('MCP 연결 정책은 켜져 있지만 Codex·OpenCode 어느 Provider에도 JuTell MCP가 등록되지 않았습니다. jutell use <agent> 를 실행해 주세요.');
  if (config.config.mcp?.enabled && anyProviderRegistered && !anyProviderEnabled) warnings.push('연결 정책(.jutell.json)은 켜져 있지만 새 세션에서 자동 시작할 활성 Provider 항목이 없습니다. jutell use <agent> 를 실행해 주세요.');
  if (!config.config.mcp?.enabled && anyProviderEnabled) warnings.push('연결 정책(.jutell.json)은 꺼져 있지만 Provider 자동 시작은 켜져 있습니다. 일치시키려면 jutell use <agent> 또는 jutell off을 실행해 주세요.');
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
    skillInstalled,
    agentsManaged,
    mcpRegistered: anyProviderRegistered,
    mcpEnabled: config.config.mcp?.enabled === true,
    codexPreparation,
    opencodePreparation,
    anyProviderRegistered,
    anyProviderEnabled,
    actualConnection: 'not_checked',
    opencode: { registered: opencode.registered, conflict: opencode.conflict, enabled: opencode.enabled },
    profile: config.config.profile,
    activeFeatureCount: Object.values(config.config.features).filter(Boolean).length,
    configLocation: config.source === 'legacy' ? '기존 설정(.beginner-bridge.json)' : safeLocation(paths.scope, 'config'),
    localAdmin: await adminState(paths),
    usageCountersEnabled: config.config.usageMeasurement?.localCountersEnabled === true,
    telemetry: '비활성화',
    externalTransmission: '없음',
    warnings,
  };
}

export async function statusCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  const status = await getStatus(paths);
  if (options.json) { io.write(JSON.stringify(status, null, 2)); return status; }
  const codexLabel = { not_registered: '미등록', registered: '등록됨', enabled: '활성화됨', error: '오류' }[status.codexPreparation];
  const opencodeLabel = { not_registered: '미등록', registered: '등록됨', enabled: '활성화됨', conflict: '충돌' }[status.opencodePreparation];
  const actual = { not_checked: '확인하지 않음', success: '마지막 확인 성공', failure: '마지막 확인 실패' }[status.actualConnection];
  const codexDetectedLabel = status.codexDetected ? '감지됨' : '미감지';
  const opencodeDetectedLabel = status.opencodeDetected ? '감지됨' : status.opencode.registered ? '설정 있음(명령 미감지)' : '미감지';
  io.write(`JuTell 상태\n\nCLI: ${status.cliVersion}\nSkill: ${status.skillInstalled ? '설치됨' : '설치되지 않음'}\nAGENTS.md: ${status.agentsManaged ? 'JuTell 블록 있음' : 'JuTell 블록 없음'}\nJuTell 연결 정책: ${status.mcpEnabled ? '켜짐' : '꺼짐'}\nCodex MCP: ${codexLabel}${status.codexDetected ? ` (명령 ${codexDetectedLabel})` : ''}\nOpenCode MCP: ${opencodeLabel}${status.opencode.enabled ? ' (새 세션 자동 시작 켜짐)' : ''}${status.opencodeDetected ? '' : ` (명령 ${opencodeDetectedLabel})`}\nMCP 서버 응답: ${actual}\n현재 Agent 세션 적용: 직접 확인 필요\nProfile: ${status.profile}\n활성 Feature: ${status.activeFeatureCount}개\n설치 범위: ${status.installationScope === 'global' ? '사용자 전역' : '현재 프로젝트'}\n로컬 관리자: ${status.localAdmin}\n로컬 사용량 카운터: ${status.usageCountersEnabled ? '켜짐' : '꺼짐'}\nTelemetry: ${status.telemetry}\n외부 전송: ${status.externalTransmission}\n설정 위치: ${status.configLocation}`);
  for (const warning of status.warnings) io.write(`주의: ${warning}`);
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

export async function getDoctorResults(paths: ScopePaths): Promise<CheckResult[]> {
  const config = await readBridgeConfig(paths);
  const registration = await readCodexRegistration(paths, packageRoot(), config.config.mcp?.enabled === true);
  const opencode = await readOpenCodeRegistration(paths, packageRoot(), false);
  const skillFile = path.join(paths.skillRoot, 'SKILL.md');
  const skillText = await readText(skillFile);
  const mcpEntry = path.join(assets().mcpServer, 'index.js');
  const adminEntry = path.join(assets().localAdmin, 'index.html');
  const mcpText = await readText(mcpEntry) ?? '';
  const checks: CheckResult[] = [];
  checks.push({ name: 'Node 버전', status: nodeMajorVersion() >= 18 ? '정상' : '오류', detail: `현재 Node ${process.versions.node}` });
  checks.push({ name: '운영체제', status: ['Windows', 'macOS', 'Linux'].includes(operatingSystem()) ? '정상' : '직접 확인 필요', detail: operatingSystem() });
  checks.push({ name: 'AI Agent Provider 설치 또는 설정', status: codexDetected() || opencodeDetected() || await exists(paths.codexConfigFile) || await exists(paths.opencodeConfigFile) ? '정상' : '직접 확인 필요', detail: codexDetected() || await exists(paths.codexConfigFile) || opencodeDetected() || await exists(paths.opencodeConfigFile) ? 'Provider 명령 또는 설정을 확인했습니다.' : 'Provider 명령과 설정을 모두 자동 확인하지 못했습니다.' });
  checks.push({ name: 'OpenCode 명령 감지', status: opencodeDetected() ? '정상' : '직접 확인 필요', detail: opencodeDetected() ? 'opencode --version 명령을 확인했습니다.' : 'opencode 명령을 자동 확인하지 못했습니다. PATH·shell 실행 권한을 확인해 주세요.' });
  checks.push({ name: 'Skill 파일', status: skillText?.includes('name: beginner-bridge') ? '정상' : '오류', detail: skillText ? 'Skill 파일을 확인했습니다.' : 'Skill 파일이 없습니다.' });
  const skillVersion = parseSkillVersion(skillText);
  const sourceSkillText = await readText(path.join(assets().skill, 'SKILL.md'));
  const sourceVersion = parseSkillVersion(sourceSkillText);
  const skillMatch = Boolean(skillText && sourceSkillText && skillText === sourceSkillText);
  checks.push({ name: 'Skill 버전', status: skillMatch ? '정상' : skillVersion ? '주의' : '직접 확인 필요', detail: skillMatch ? `스킬 버전 ${sourceVersion ?? '(버전 기록 없음)'} (설치 사본 일치).` : skillVersion ? `설치 사본 버전 ${skillVersion}이 원본과 다릅니다. jutell use <agent> 로 재설치하세요.` : '설치된 Skill에 버전 기록이 없습니다.' });
  checks.push({ name: '현재 Agent 세션 적용', status: '직접 확인 필요', detail: '실제로 Skill과 규칙을 읽었는지 여부는 해당 Agent 세션에서 직접 확인해야 합니다.' });
  checks.push({ name: 'MCP 빌드 파일', status: await exists(mcpEntry) ? '정상' : '오류', detail: await exists(mcpEntry) ? '패키지에 포함되어 있습니다.' : 'MCP 빌드 파일이 없습니다.' });
  checks.push({ name: 'Codex MCP', status: registration.conflict ? '오류' : registration.registered ? '정상' : '주의', detail: registration.conflict ? '관리되지 않는 동일 이름 설정이 있습니다.' : registration.registered ? `JuTell 관리 블록을 확인했습니다. 새 세션 자동 시작: ${registration.enabled ? '켜짐' : '꺼짐'}.` : '등록되지 않았습니다.' });
  checks.push({ name: 'OpenCode MCP', status: opencode.conflict ? '오류' : opencode.registered ? (opencode.enabled ? '정상' : '주의') : '주의', detail: opencode.conflict ? '관리되지 않는 동일 이름 항목이 있습니다.' : opencode.registered ? `JuTell 관리 블록을 확인했습니다. 새 세션 자동 시작: ${opencode.enabled ? '켜짐' : '꺼짐'}.` : 'OpenCode MCP가 등록되지 않았습니다.' });
  checks.push({ name: '.jutell.json', status: config.valid ? '정상' : '오류', detail: config.exists ? (config.valid ? '설정 형식을 확인했습니다.' : '설정이 올바르지 않아 기본값을 사용합니다.') : '없으면 기본 설정을 사용합니다.' });
  const featuresValid = Object.keys(config.config.features).every((id) => FEATURE_IDS.includes(id));
  const limitsValid = config.config.limits.maxMainFiles >= 1 && config.config.limits.maxMainFiles <= 10 && config.config.limits.maxGlossaryTerms >= 0 && config.config.limits.maxGlossaryTerms <= 10 && config.config.limits.compactReportMaxSentences >= 4 && config.config.limits.compactReportMaxSentences <= 30;
  checks.push({ name: '공식 Feature ID', status: featuresValid ? '정상' : '오류', detail: featuresValid ? '현재 공식 ID만 확인했습니다.' : '지원하지 않는 Feature ID가 있습니다.' });
  checks.push({ name: 'limits', status: limitsValid ? '정상' : '오류', detail: limitsValid ? '허용 범위를 확인했습니다.' : '허용 범위를 벗어난 값이 있습니다.' });
  checks.push({ name: '로컬 관리자 빌드', status: await exists(adminEntry) ? '정상' : '오류', detail: await exists(adminEntry) ? '관리자 화면 파일을 확인했습니다.' : '관리자 화면 파일이 없습니다.' });
  checks.push({ name: '포트 사용 가능 여부', status: await portAvailable() ? '정상' : '주의', detail: '127.0.0.1의 임시 포트를 확인했습니다.' });
  checks.push({ name: '쓰기 권한', status: await writeCheck(paths) ? '정상' : '오류', detail: '로컬 상태 폴더에 임시 파일을 만들고 삭제했습니다.' });
  const backupExists = await exists(`${paths.codexConfigFile}.previous`);
  checks.push({ name: '설정 백업 상태', status: !await exists(paths.codexConfigFile) || backupExists ? '정상' : '주의', detail: !await exists(paths.codexConfigFile) ? '아직 Provider 설정을 변경하지 않았습니다.' : backupExists ? '이전 설정 백업을 확인했습니다.' : '기존 Provider 설정 백업이 없습니다.' });
  const externalCode = /(?:https?:\/\/(?!127\.0\.0\.1)|https?\.request|net\.connect)/i.test(mcpText);
  checks.push({ name: '외부 전송 코드', status: externalCode ? '오류' : '정상', detail: externalCode ? 'MCP 빌드에서 외부 네트워크 관련 코드를 찾았습니다.' : 'MCP 빌드에 외부 전송 패턴이 없습니다.' });
  const probe = await probeMcpServer(mcpEntry);
  checks.push({ name: 'MCP 서버 실제 연결 (Stdio)', status: probe.ok ? '정상' : '오류', detail: probe.ok ? `${probe.serverName || 'JuTell'} 서버가 응답하고 ${probe.toolCount}개 도구를 제공합니다.` : `서버 응답 실패: ${probe.error ?? '알 수 없는 오류'}` });
  return checks;
}

export async function doctorCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  let checks = await getDoctorResults(paths);
  const fixableError = checks.some((check) => check.status === '오류' && check.name !== 'MCP 서버 실제 연결 (Stdio)');
  if (options.fix && fixableError) {
    await setupCommand(paths, { ...options, yes: true }, io);
    checks = await getDoctorResults(paths);
  }
  if (options.json) { io.write(JSON.stringify(checks, null, 2)); return checks; }
  io.write('JuTell 점검 결과');
  for (const check of checks) io.write(`${check.status}  ${check.name}: ${check.detail}`);
  return checks;
}
