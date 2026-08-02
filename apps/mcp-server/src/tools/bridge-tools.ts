import type { BridgeConfig, FeatureId } from '../config/bridge-config.js';
import { FEATURE_CATALOG, SAFETY_REQUIREMENTS } from './catalog.js';

const profileLabel: Record<BridgeConfig['profile'], string> = { minimal: '최소 보고', balanced: '균형 보고', learning: '학습 보고', detailed: '상세 보고' };
const reportLength = (value: number) => value <= 8 ? '짧음' : value <= 12 ? '보통' : '자세함';

export function bridgeStatus(context: { config: BridgeConfig; configExists: boolean; skillExists: boolean; agentsExists: boolean }) {
  return {
    configFileExists: context.configExists,
    skillFileExists: context.skillExists,
    agentsFileExists: context.agentsExists,
    profile: context.config.profile,
    activeFeatureCount: Object.values(context.config.features).filter(Boolean).length,
    configVersion: context.config.version,
    skillVersion: 'not-recorded',
    externalTransmission: false,
    telemetryEnabled: false,
    mcpEnabled: context.config.mcp.enabled,
    autoStart: context.config.mcp.autoStart,
  };
}

export function activeFeatures(config: BridgeConfig) {
  return (Object.keys(FEATURE_CATALOG) as FeatureId[]).map((id) => ({ id, name: FEATURE_CATALOG[id].label, active: config.features[id], omittedWhenOff: FEATURE_CATALOG[id].omitted, alwaysReported: FEATURE_CATALOG[id].forced }));
}

export function reportPreferences(config: BridgeConfig) {
  return {
    profile: config.profile,
    profileName: profileLabel[config.profile],
    mainFilesLevel: config.limits.maxMainFiles <= 3 ? '최소' : config.limits.maxMainFiles <= 5 ? '보통' : '많이',
    glossaryLevel: config.limits.maxGlossaryTerms === 0 ? '사용 안 함' : config.limits.maxGlossaryTerms <= 1 ? '조금' : config.limits.maxGlossaryTerms <= 3 ? '보통' : '많이',
    reportLengthLevel: reportLength(config.limits.compactReportMaxSentences),
    limits: config.limits,
  };
}

export function beginnerReportRules(config: BridgeConfig) {
  const active = Object.entries(config.features).filter(([, enabled]) => enabled).map(([id]) => FEATURE_CATALOG[id as FeatureId].label);
  return {
    language: '비개발자가 이해할 수 있는 쉬운 한국어',
    activeReportSections: active,
    limits: config.limits,
    evidenceRule: '실제로 확인한 사실, 코드만 보고 예상한 내용, 확인하지 못한 내용을 구분합니다.',
    statusRule: '검증 결과와 보고서 상태를 일치시킵니다.',
    safetyRequirements: SAFETY_REQUIREMENTS,
    notCollected: ['프로젝트 코드', 'Git diff', 'Prompt', 'AI 답변 원문', '파일 경로', '비밀정보'],
  };
}

export function safeReportRequirements() {
  return { alwaysReport: SAFETY_REQUIREMENTS, note: '활성 Feature가 꺼져 있어도 위 정보는 숨기지 않습니다.' };
}
