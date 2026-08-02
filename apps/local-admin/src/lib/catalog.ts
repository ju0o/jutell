import type { Config, FeatureId, Profile } from '../types/config';

export const FEATURE_CATALOG: Array<{ id: FeatureId; label: string; description: string; omitted: string; forced: string }> = [
  { id: 'changeSummary', label: '변경 요약', description: '무엇이 바뀌었는지 짧게 설명합니다.', omitted: '일반 변경 요약', forced: '작업 실패와 범위 밖 변경' },
  { id: 'userVisibleChanges', label: '사용자에게 보이는 변화', description: '화면이나 사용 방법의 변화를 설명합니다.', omitted: '일반 화면 변화', forced: '중요한 안전 영향' },
  { id: 'internalChanges', label: '프로그램 내부 변화', description: '코드 안의 기능 변화를 설명합니다.', omitted: '일반 내부 동작 설명', forced: '데이터 손실·보안 영향' },
  { id: 'mainFiles', label: '주요 파일', description: '중요한 파일의 역할을 설명합니다.', omitted: '일반 주요 파일 설명', forced: '사용자가 요청한 파일 설명' },
  { id: 'glossary', label: '용어 설명', description: '필요한 개발 용어를 쉬운 말로 풀이합니다.', omitted: '선택적 용어 설명', forced: '안전 판단에 필요한 의미' },
  { id: 'validationResults', label: '검증 결과', description: '실행한 테스트와 검사 결과를 설명합니다.', omitted: '통과한 검증의 일반 설명', forced: '핵심 검증 실패와 보류 사유' },
  { id: 'riskAssessment', label: '위험도', description: '변경이 미칠 수 있는 영향의 크기를 설명합니다.', omitted: '일반 위험도 설명', forced: '높은 위험·판정 불가' },
  { id: 'userActions', label: '사용자 확인', description: '사용자가 직접 확인하거나 결정할 일을 안내합니다.', omitted: '일반 확인 안내', forced: '안전·데이터 손실 관련 행동' },
];

export const PROFILE_CATALOG: Record<Profile, { label: string; description: string; features: Record<FeatureId, boolean>; limits: Config['limits'] }> = {
  minimal: {
    label: 'minimal', description: '가장 짧은 보고서에 적합합니다.',
    features: { changeSummary: true, userVisibleChanges: true, internalChanges: false, mainFiles: false, glossary: false, validationResults: true, riskAssessment: false, userActions: true },
    limits: { maxMainFiles: 3, maxGlossaryTerms: 1, compactReportMaxSentences: 8 },
  },
  balanced: {
    label: 'balanced', description: '변경·검증·위험을 균형 있게 설명하는 기본값입니다.',
    features: { changeSummary: true, userVisibleChanges: true, internalChanges: true, mainFiles: true, glossary: true, validationResults: true, riskAssessment: true, userActions: true },
    limits: { maxMainFiles: 5, maxGlossaryTerms: 3, compactReportMaxSentences: 12 },
  },
  learning: {
    label: 'learning', description: '필요한 개발 용어를 조금 더 설명합니다.',
    features: { changeSummary: true, userVisibleChanges: true, internalChanges: true, mainFiles: true, glossary: true, validationResults: true, riskAssessment: true, userActions: true },
    limits: { maxMainFiles: 5, maxGlossaryTerms: 6, compactReportMaxSentences: 12 },
  },
  detailed: {
    label: 'detailed', description: '복잡하거나 위험한 작업을 더 자세히 설명합니다.',
    features: { changeSummary: true, userVisibleChanges: true, internalChanges: true, mainFiles: true, glossary: true, validationResults: true, riskAssessment: true, userActions: true },
    limits: { maxMainFiles: 5, maxGlossaryTerms: 6, compactReportMaxSentences: 18 },
  },
};

export const LIMIT_RANGES = {
  maxMainFiles: { min: 1, max: 10, label: '주요 파일 최대 개수' },
  maxGlossaryTerms: { min: 0, max: 10, label: '용어 설명 최대 개수' },
  compactReportMaxSentences: { min: 4, max: 30, label: '짧은 보고서 최대 문장 수' },
} as const;

export const FEATURE_IDS = FEATURE_CATALOG.map((item) => item.id);
