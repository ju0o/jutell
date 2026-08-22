import type { BridgeConfig, FeatureId } from '../config/bridge-config.js';
import { FEATURE_CATALOG, SAFETY_REQUIREMENTS } from './catalog.js';

const profileLabel: Record<BridgeConfig['profile'], string> = { minimal: '최소 보고', balanced: '균형 보고', learning: '학습 보고', detailed: '상세 보고' };
const reportLength = (value: number) => value <= 8 ? '짧음' : value <= 12 ? '보통' : '자세함';

export function parseSkillVersion(skillText: string | undefined) {
  if (!skillText) return undefined;
  const match = skillText.match(/jutellSkillVersion\s*:\s*["']?([0-9A-Za-z.\-]+)/);
  return match ? match[1] : undefined;
}

export function bridgeStatus(context: { config: BridgeConfig; configExists: boolean; skillExists: boolean; agentsExists: boolean; skillText: string | undefined }) {
  return {
    configFileExists: context.configExists,
    skillFileExists: context.skillExists,
    agentsFileExists: context.agentsExists,
    profile: context.config.profile,
    activeFeatureCount: Object.values(context.config.features).filter(Boolean).length,
    configVersion: context.config.version,
    skillVersion: parseSkillVersion(context.skillText),
    externalTransmission: false,
    telemetryEnabled: false,
    mcpEnabled: context.config.mcp.enabled,
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

export const EXPLAINED_DIFF_SECTIONS = ['무엇을 바꿨나요?', '왜 바꿨나요?', '어디를 바꿨나요?', '실제 중요한 변경', '내가 직접 다듬고 싶다면?'] as const;

const explainedDiffRule = {
  when: '의미 있는 변경(기능 동작·화면 변화·데이터 처리 변화)을 보고할 때',
  sections: EXPLAINED_DIFF_SECTIONS,
  groupingRule: '관련된 파일과 변경은 기능 단위로 묶어 설명하고 전체 Diff 원문을 반복하지 않습니다.',
  noEvidenceRules: {
    why: '변경 이유의 근거가 없으면 추측하지 않고 "변경 이유는 Agent 결과에서 확인되지 않았습니다."로 표시합니다.',
    customization: '문구·색상·여백·이동 경로처럼 직접 다듬을 수 있는 위치의 코드 근거가 없으면 "내가 직접 다듬고 싶다면?" 섹션을 만들지 않습니다.',
    riskyArea: '인증·권한·결제·데이터베이스처럼 위험한 영역은 간단한 화면 다듬기 대상으로 제시하지 않고 주의가 필요하다고 표시합니다.',
  },
} as const;

export function beginnerReportRules(config: BridgeConfig) {
  const active = Object.entries(config.features).filter(([, enabled]) => enabled).map(([id]) => FEATURE_CATALOG[id as FeatureId].label);
  return {
    language: '비개발자가 이해할 수 있는 쉬운 한국어',
    activeReportSections: active,
    limits: config.limits,
    evidenceRule: '실제로 확인한 사실, 코드만 보고 예상한 내용, 확인하지 못한 내용을 구분합니다.',
    statusRule: '검증 결과와 보고서 상태를 일치시킵니다.',
    diffRule: '코드 또는 Diff를 사용자에게 보여줄 경우, 바로 뒤에 무엇을 수정했고 사용자에게 어떤 영향이 있는지 기능 단위로 설명합니다.',
    ...(config.features.explainedDiff ? { explainedDiffRule } : {}),
    safetyRequirements: SAFETY_REQUIREMENTS,
    notCollected: ['프로젝트 코드', 'Git diff', 'Prompt', 'AI 답변 원문', '파일 경로', '비밀정보'],
  };
}

export function safeReportRequirements() {
  return { alwaysReport: SAFETY_REQUIREMENTS, note: '활성 Feature가 꺼져 있어도 위 정보는 숨기지 않습니다.' };
}
