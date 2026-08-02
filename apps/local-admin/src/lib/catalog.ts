import type { Config, FeatureId, Profile } from '../types/config';

export const FEATURE_CATALOG: Array<{ id: FeatureId; label: string; description: string; example: string; omitted: string; forced: string; recommendedFor: string; impact: string; badge: string; recommended: boolean }> = [
  { id: 'changeSummary', label: '변경 요약', description: '무엇이 바뀌었는지 짧게 알려줍니다.', example: '검색 화면의 버튼 문구를 바꿨습니다.', omitted: '일반 변경 요약', forced: '작업 실패와 범위 밖 변경', recommendedFor: '모든 사용자', impact: '거의 없음', badge: '기본 권장', recommended: true },
  { id: 'userVisibleChanges', label: '사용자에게 보이는 변화', description: '화면이나 사용 방법이 어떻게 달라지는지 설명합니다.', example: '화면에서 버튼 색상이 파란색으로 보일 것으로 예상됩니다.', omitted: '일반 화면 변화', forced: '중요한 안전 영향', recommendedFor: '화면 변경을 확인하려는 사용자', impact: '조금 줄어듦', badge: '기본 권장', recommended: true },
  { id: 'internalChanges', label: '프로그램 내부 변화', description: '화면 뒤에서 어떤 동작이 바뀌었는지 쉽게 설명합니다.', example: '검색 실행 전에 검색어가 입력됐는지 확인하는 기능을 추가했습니다.', omitted: '일반 내부 동작 설명', forced: '데이터 손실·보안 영향', recommendedFor: '코드 동작도 이해하고 싶은 사용자', impact: '조금 줄어듦', badge: '학습용', recommended: true },
  { id: 'mainFiles', label: '주요 파일 설명', description: '변경에 중요한 파일을 몇 개만 골라 역할을 설명합니다.', example: '`검색 화면 파일`이 입력과 결과 표시를 담당합니다.', omitted: '일반 주요 파일 설명', forced: '사용자가 요청한 파일 설명', recommendedFor: '어디가 바뀌었는지 파일로 확인하려는 사용자', impact: '조금 줄어듦', badge: '선택 기능', recommended: true },
  { id: 'glossary', label: '개발 용어 설명', description: '필요한 개발 용어를 처음 나올 때 쉬운 말로 풀이합니다.', example: '입력 검증(입력한 값이 조건에 맞는지 먼저 확인하는 기능)', omitted: '선택적 용어 설명', forced: '안전 판단에 필요한 의미', recommendedFor: '개발 용어가 익숙하지 않은 사용자', impact: '많이 줄어들 수 있음', badge: '학습용', recommended: true },
  { id: 'validationResults', label: '검증 결과', description: '실행한 테스트와 검사 결과를 알려줍니다.', example: '자동 테스트 6개가 통과했습니다.', omitted: '통과한 검증의 일반 설명', forced: '핵심 검증 실패와 보류 사유', recommendedFor: '결과를 확인하고 싶은 모든 사용자', impact: '거의 없음', badge: '안전 관련', recommended: true },
  { id: 'riskAssessment', label: '위험도 안내', description: '변경이 기존 기능에 미칠 수 있는 영향의 크기를 설명합니다.', example: '위험도: 중간 — 검색 실행 조건이 달라졌습니다.', omitted: '일반 위험도 설명', forced: '높은 위험·판정 불가', recommendedFor: '중요한 기능 변경을 검토하는 사용자', impact: '조금 줄어듦', badge: '안전 관련', recommended: true },
  { id: 'userActions', label: '사용자 확인 안내', description: '사용자가 직접 확인하거나 결정할 일을 알려줍니다.', example: '실제 화면에서 검색 버튼을 눌러 확인하세요.', omitted: '일반 확인 안내', forced: '안전·데이터 손실 관련 행동', recommendedFor: '작업 후 다음 행동이 필요한 사용자', impact: '거의 없음', badge: '기본 권장', recommended: true },
];

export const PROFILE_CATALOG: Record<Profile, { label: string; description: string; recommendedFor: string; features: Record<FeatureId, boolean>; limits: Config['limits'] }> = {
  minimal: {
    label: '최소 보고', description: '꼭 필요한 결과와 확인 사항만 짧게 보고받습니다.', recommendedFor: '토큰과 보고 길이를 최대한 줄이고 싶은 사용자',
    features: { changeSummary: true, userVisibleChanges: true, internalChanges: false, mainFiles: false, glossary: false, validationResults: true, riskAssessment: false, userActions: true },
    limits: { maxMainFiles: 3, maxGlossaryTerms: 1, compactReportMaxSentences: 8 },
  },
  balanced: {
    label: '균형 보고', description: '변경 내용, 검증, 위험과 주요 파일을 균형 있게 설명합니다.', recommendedFor: '처음 사용하는 사용자에게 권장',
    features: { changeSummary: true, userVisibleChanges: true, internalChanges: true, mainFiles: true, glossary: true, validationResults: true, riskAssessment: true, userActions: true },
    limits: { maxMainFiles: 5, maxGlossaryTerms: 3, compactReportMaxSentences: 12 },
  },
  learning: {
    label: '학습 보고', description: '개발 용어와 내부 변화를 조금 더 자세히 설명합니다.', recommendedFor: '바이브 코딩을 하며 개발 개념도 함께 배우고 싶은 사용자',
    features: { changeSummary: true, userVisibleChanges: true, internalChanges: true, mainFiles: true, glossary: true, validationResults: true, riskAssessment: true, userActions: true },
    limits: { maxMainFiles: 5, maxGlossaryTerms: 6, compactReportMaxSentences: 12 },
  },
  detailed: {
    label: '상세 보고', description: '복잡하거나 위험한 작업을 더 자세하게 확인합니다.', recommendedFor: '로그인, 데이터, 배포처럼 중요한 작업을 검토할 때',
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
