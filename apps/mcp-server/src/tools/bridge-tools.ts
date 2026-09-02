import type { BridgeConfig, FeatureId, VoicePreset } from '../config/bridge-config.js';
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
    voicePreset: context.config.voice.preset,
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
    voicePreset: config.voice.preset,
    mainFilesLevel: config.limits.maxMainFiles <= 3 ? '최소' : config.limits.maxMainFiles <= 5 ? '보통' : '많이',
    glossaryLevel: config.limits.maxGlossaryTerms === 0 ? '사용 안 함' : config.limits.maxGlossaryTerms <= 1 ? '조금' : config.limits.maxGlossaryTerms <= 3 ? '보통' : '많이',
    reportLengthLevel: reportLength(config.limits.compactReportMaxSentences),
    limits: config.limits,
  };
}

export const EXPLAINED_DIFF_SECTIONS = ['무엇을 바꿨나요?', '왜 바꿨나요?', '어디를 바꿨나요?', '실제 중요한 변경', '내가 직접 다듬고 싶다면?'] as const;

const readableCodeRule = {
  when: '중요한 코드 블록이 이미 작업 과정에서 확인되었고, 사용자 이해에 실제 도움이 될 때만 1~2개까지 보여준다.',
  maxSnippets: 2,
  absoluteMaxSnippets: 2,
  form: ['[중요한 코드]', '짧은 코드 블록', '[쉽게 보면]', '[영향]'],
  reuseOnly: '이미 읽거나 비교한 코드만 사용한다. 이 섹션만을 위해 파일을 다시 읽거나 git diff를 다시 실행하지 않는다.',
  omitWhen: [
    '이미 확인된 코드 근거가 없다',
    '긴 raw diff를 반복하는 형태다',
    '줄별 프로그래밍 문법 강의가 된다',
  ],
  cautionAreas: '인증·권한·결제·데이터베이스처럼 민감한 영역은 코드 일부를 보여주더라도 주의가 필요하다고 표시한다.',
} as const;

const explainedDiffRule = {
  when: '의미 있는 변경(기능 동작·화면 변화·데이터 처리 변화)을 보고할 때',
  sections: EXPLAINED_DIFF_SECTIONS,
  groupingRule: '관련된 파일과 변경은 기능 단위로 묶어 설명하고 전체 Diff 원문을 반복하지 않습니다.',
  readableCodeRule,
  noEvidenceRules: {
    why: '변경 이유의 근거가 없으면 추측하지 않고 "변경 이유는 Agent 결과에서 확인되지 않았습니다."로 표시합니다.',
    customization: '문구·색상·여백·이동 경로처럼 직접 다듬을 수 있는 위치의 코드 근거가 없으면 "내가 직접 다듬고 싶다면?" 섹션을 만들지 않습니다.',
    riskyArea: '인증·권한·결제·데이터베이스처럼 위험한 영역은 간단한 화면 다듬기 대상으로 제시하지 않고 주의가 필요하다고 표시합니다.',
  },
} as const;

const handoffRule = {
  when: '사용자가 다음 AI에게 작업을 넘기거나, 세션을 마무리하며 이어서 할 일을 남겨달라고 할 때',
  title: '다음 AI에게 전달하기',
  sections: ['지금 하던 일', '방금 끝난 것', '확인된 것', '아직 확인하지 못한 것', '다음에 해줬으면 하는 것', '먼저 보면 좋은 파일'],
  optionalSections: ['건드리면 안 되는 것', '사용자 결정이 필요한 것'],
  evidenceRule: '현재 작업/세션에서 이미 아는 근거만 사용한다. 저장소를 다시 읽거나 테스트를 다시 돌리거나 자동으로 다른 Agent에 보내지 않는다.',
  format: 'Markdown 복사 가능한 텍스트만 사용한다. HTML·클라우드·자동 오케스트레이션을 만들지 않는다.',
  templateHint: 'Request Builder의 NEXT_AGENT_HANDOFF 템플릿 또는 세션 SESSION_SUMMARY 내용을 재사용해도 된다.',
} as const;

const voiceRules: Record<VoicePreset, { preset: VoicePreset; style: string; guidance: string }> = {
  default: {
    preset: 'default',
    style: '일반적이고 명확한 비개발자용 설명',
    guidance: '친절하고 분명한 쉬운 한국어로 설명한다. 사실·예상·미확인·위험·사용자 행동을 구분한다.',
  },
  plain: {
    preset: 'plain',
    style: '짧고 직접적인 평이한 문장',
    guidance: '문장을 짧게 유지하고 군더더기 없이 핵심만 말한다. 근거·위험·검증 진실을 줄이지 않는다.',
  },
  learning: {
    preset: 'learning',
    style: '필요한 용어를 조금 더 풀어 설명',
    guidance: '필수 용어가 나오면 짧은 쉬운 설명을 덧붙인다. 용어 설명을 늘려도 근거와 확인 상태는 그대로 둔다.',
  },
  jutell: {
    preset: 'jutell',
    style: '친절하고 자연스럽고 간결한 JuTell Style',
    guidance: '딱딱한 문장을 현실적인 말로 풀고 핵심부터 말한다. 사실·검증·위험을 줄이거나 과장하지 않는다.',
  },
};

export function voiceRule(config: BridgeConfig) {
  return voiceRules[config.voice.preset] ?? voiceRules.default;
}

export function beginnerReportRules(config: BridgeConfig) {
  const active = Object.entries(config.features).filter(([, enabled]) => enabled).map(([id]) => FEATURE_CATALOG[id as FeatureId].label);
  return {
    language: '비개발자가 이해할 수 있는 쉬운 한국어',
    activeReportSections: active,
    limits: config.limits,
    voiceRule: voiceRule(config),
    evidenceRule: '실제로 확인한 사실, 코드만 보고 예상한 내용, 확인하지 못한 내용을 구분합니다.',
    statusRule: '검증 결과와 보고서 상태를 일치시킵니다.',
    diffRule: '코드 또는 Diff를 사용자에게 보여줄 경우, 바로 뒤에 무엇을 수정했고 사용자에게 어떤 영향이 있는지 기능 단위로 설명합니다.',
    ...(config.features.explainedDiff ? { explainedDiffRule } : {}),
    ...(config.features.requestBuilder ? { handoffRule } : {}),
    safetyRequirements: SAFETY_REQUIREMENTS,
    notCollected: ['프로젝트 코드', 'Git diff', 'Prompt', 'AI 답변 원문', '파일 경로', '비밀정보'],
  };
}

export function safeReportRequirements() {
  return { alwaysReport: SAFETY_REQUIREMENTS, note: '활성 Feature가 꺼져 있어도 위 정보는 숨기지 않습니다.' };
}
