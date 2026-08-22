import type { FeatureId } from '../config/bridge-config.js';

export const FEATURE_CATALOG: Record<FeatureId, { label: string; omitted: string; forced: string; description: string }> = {
  changeSummary: { label: '변경 요약', description: '무엇이 바뀌었는지 짧게 알려줍니다.', omitted: '일반 변경 요약', forced: '작업 실패와 범위 밖 변경' },
  userVisibleChanges: { label: '사용자에게 보이는 변화', description: '화면이나 사용 방법이 어떻게 달라지는지 설명합니다.', omitted: '일반 화면 변화', forced: '중요한 안전 영향' },
  internalChanges: { label: '프로그램 내부 변화', description: '화면 뒤에서 어떤 동작이 바뀌었는지 쉽게 설명합니다.', omitted: '일반 내부 동작 설명', forced: '데이터 손실·보안 영향' },
  mainFiles: { label: '주요 파일 설명', description: '변경에 중요한 파일을 몇 개만 골라 역할을 설명합니다.', omitted: '일반 주요 파일 설명', forced: '사용자가 요청한 파일 설명' },
  explainedDiff: { label: '설명형 변경 요약', description: '의미 있는 변경을 무엇을·왜·어디를·중요한 변경 순으로 묶어 설명합니다. 근거 없는 이유와 다듬기 위치는 만들지 않습니다.', omitted: '일반 변경 의미 설명', forced: '데이터 손실·보안 관련 중요 변경' },
  glossary: { label: '개발 용어 설명', description: '필요한 개발 용어를 처음 나올 때 쉬운 말로 풀이합니다.', omitted: '선택적 용어 설명', forced: '안전 판단에 필요한 의미' },
  validationResults: { label: '검증 결과', description: '실행한 테스트와 검사 결과를 알려줍니다.', omitted: '통과한 검증의 일반 설명', forced: '핵심 검증 실패와 보류 사유' },
  riskAssessment: { label: '위험도 안내', description: '변경이 기존 기능에 미칠 수 있는 영향의 크기를 설명합니다.', omitted: '일반 위험도 설명', forced: '높은 위험·판정 불가' },
  userActions: { label: '사용자 확인 안내', description: '사용자가 직접 확인하거나 결정할 일을 알려줍니다.', omitted: '일반 확인 안내', forced: '안전·데이터 손실 관련 행동' },
  nextActionSuggestions: { label: '다음 행동 제안', description: '보고서 끝에 다음 행동 제안을 최대 3개 추가합니다.', omitted: '일반 다음 행동 제안', forced: '안전·데이터 손실 관련 행동' },
  requestClarificationGuide: { label: '요청 명확화 질문', description: '요청이 모호할 때 결과가 크게 달라지는 항목을 작업 전에 확인합니다.', omitted: '모호한 요청에 대한 일반 확인', forced: '데이터 손실·보안 관련 확인' },
  manualEditGuidance: { label: '직접 수정 안내', description: '사용자가 직접 파일을 고칠 때 위치와 주의점을 안내합니다.', omitted: '일반 직접 수정 안내', forced: '데이터 손실·보안 관련 수정 안내' },
  requestBuilder: { label: '요청 만들기', description: '요청 템플릿 제공 안내를 포함합니다.', omitted: '템플릿 제공 안내', forced: '없음' },
};

export const SAFETY_REQUIREMENTS = [
  '작업 실패',
  '핵심 검증 실패',
  '중요한 미확인 사항',
  '높은 위험 또는 위험도 판정 불가',
  '비밀정보 노출 위험',
  '데이터 손실 가능성',
  '요청 범위 밖 변경',
  '작업 보류 사유',
] as const;
