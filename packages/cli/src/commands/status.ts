import { promises as fs } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { assets, packageRoot, safeLocation } from '../config/paths.js';
import { codexDetected, nodeMajorVersion, operatingSystem } from '../process/system.js';
import { exists, readBridgeConfig, readCodexRegistration, readText, readVersionInfo } from '../config/managed.js';
import { setupCommand } from './lifecycle.js';
import { hasJuTellAgentsBlock } from '../installer/agents.js';
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
  const agentsManaged = await hasJuTellAgentsBlock(paths.targetRoot);
  const codexPreparation = registration.conflict ? 'error' : !registration.registered ? 'not_registered' : config.config.mcp?.enabled === true ? 'enabled' : 'registered';
  const warnings: string[] = [];
  if (!config.valid) warnings.push('설정 파일을 읽지 못해 balanced 기본값을 사용 중입니다.');
  if (registration.conflict) warnings.push('같은 이름의 관리되지 않는 MCP 설정이 있어 자동 변경하지 않았습니다.');
  if (config.config.mcp?.enabled && !registration.registered) warnings.push('MCP가 켜져 있지만 AI Agent Provider 설정이 등록되지 않았습니다.');
  return {
    cliVersion: versions.cli,
    skillVersion: await exists(path.join(paths.skillRoot, 'SKILL.md')) ? versions.skill : '설치되지 않음',
    mcpVersion: versions.mcp,
    adminVersion: versions.admin,
    installationScope: paths.scope,
    configExists: config.exists,
    configValid: config.valid,
    codexDetected: codexDetected(),
    skillInstalled,
    agentsManaged,
    mcpRegistered: registration.registered,
    mcpEnabled: config.config.mcp?.enabled === true,
    codexPreparation,
    actualConnection: 'not_checked',
    profile: config.config.profile,
    activeFeatureCount: Object.values(config.config.features).filter(Boolean).length,
    configLocation: config.source === 'legacy' ? '기존 설정(.beginner-bridge.json)' : safeLocation(paths.scope, 'config'),
    localAdmin: await adminState(paths),
    telemetry: '비활성화',
    externalTransmission: '없음',
    warnings,
  };
}

export async function statusCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  const status = await getStatus(paths);
  if (options.json) { io.write(JSON.stringify(status, null, 2)); return status; }
  const preparation = { not_registered: '설정 미등록', registered: '등록됨', enabled: '활성화됨', error: '오류' }[status.codexPreparation];
  const actual = { not_checked: '확인하지 않음', success: '마지막 확인 성공', failure: '마지막 확인 실패' }[status.actualConnection];
  io.write(`JuTell 상태\n\nCLI: ${status.cliVersion}\nSkill: ${status.skillInstalled ? '설치됨' : '설치되지 않음'}\nAGENTS.md: ${status.agentsManaged ? 'JuTell 블록 있음' : 'JuTell 블록 없음'}\nMCP: ${status.mcpRegistered ? '등록됨' : '등록되지 않음'} / ${status.mcpEnabled ? '활성화' : '비활성화'}\nAI Agent Provider: Codex (현재 지원)\nAI Agent 연결 준비: ${preparation}\n실제 도구 호출: ${actual}\nProfile: ${status.profile}\n활성 Feature: ${status.activeFeatureCount}개\n설치 범위: ${status.installationScope === 'global' ? '사용자 전역' : '현재 프로젝트'}\nAI Agent 감지: ${status.codexDetected ? '예' : '직접 확인 필요'}\n로컬 관리자: ${status.localAdmin}\nTelemetry: ${status.telemetry}\n외부 전송: ${status.externalTransmission}\n설정 위치: ${status.configLocation}`);
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
  const skillFile = path.join(paths.skillRoot, 'SKILL.md');
  const skillText = await readText(skillFile);
  const mcpEntry = path.join(assets().mcpServer, 'index.js');
  const adminEntry = path.join(assets().localAdmin, 'index.html');
  const mcpText = await readText(mcpEntry) ?? '';
  const checks: CheckResult[] = [];
  checks.push({ name: 'Node 버전', status: nodeMajorVersion() >= 18 ? '정상' : '오류', detail: `현재 Node ${process.versions.node}` });
  checks.push({ name: '운영체제', status: ['Windows', 'macOS', 'Linux'].includes(operatingSystem()) ? '정상' : '직접 확인 필요', detail: operatingSystem() });
  checks.push({ name: 'AI Agent Provider 설치 또는 설정', status: codexDetected() || await exists(paths.codexConfigFile) ? '정상' : '직접 확인 필요', detail: codexDetected() ? '현재 지원 Provider 명령을 확인했습니다.' : 'Provider 명령 또는 설정을 자동 확인하지 못했습니다.' });
  checks.push({ name: 'Skill 파일', status: skillText?.includes('name: beginner-bridge') ? '정상' : '오류', detail: skillText ? 'Skill 파일을 확인했습니다.' : 'Skill 파일이 없습니다.' });
  checks.push({ name: 'MCP 빌드 파일', status: await exists(mcpEntry) ? '정상' : '오류', detail: await exists(mcpEntry) ? '패키지에 포함되어 있습니다.' : 'MCP 빌드 파일이 없습니다.' });
  checks.push({ name: 'MCP 설정', status: registration.conflict ? '오류' : registration.registered ? '정상' : '주의', detail: registration.conflict ? '관리되지 않는 동일 이름 설정이 있습니다.' : registration.registered ? 'JuTell 관리 블록을 확인했습니다.' : '등록되지 않았습니다.' });
  checks.push({ name: '.jutell.json', status: config.valid ? '정상' : '오류', detail: config.exists ? (config.valid ? '설정 형식을 확인했습니다.' : '설정이 올바르지 않아 기본값을 사용합니다.') : '없으면 기본 설정을 사용합니다.' });
  const featuresValid = Object.keys(config.config.features).every((id) => ['changeSummary', 'userVisibleChanges', 'internalChanges', 'mainFiles', 'glossary', 'validationResults', 'riskAssessment', 'userActions'].includes(id));
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
  return checks;
}

export async function doctorCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  let checks = await getDoctorResults(paths);
  if (options.fix && checks.some((check) => check.status === '오류')) {
    await setupCommand(paths, { ...options, yes: true }, io);
    checks = await getDoctorResults(paths);
  }
  if (options.json) { io.write(JSON.stringify(checks, null, 2)); return checks; }
  io.write('JuTell 점검 결과');
  for (const check of checks) io.write(`${check.status}  ${check.name}: ${check.detail}`);
  return checks;
}
