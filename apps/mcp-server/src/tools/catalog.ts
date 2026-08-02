import type { FeatureId } from '../config/bridge-config.js';

export const FEATURE_CATALOG: Record<FeatureId, { label: string; omitted: string; forced: string; description: string }> = {
  changeSummary: { label: '변경 요약', description: '무엇이 바뀌었는지 짧게 알려줍니다.', omitted: '일반 변경 요약', forced: '작업 실패와 범위 밖 변경' },
  userVisibleChanges: { label: '사용자에게 보이는 변화', description: '화면이나 사용 방법이 어떻게 달라지는지 설명합니다.', omitted: '일반 화면 변화', forced: '중요한 안전 영향' },
  internalChanges: { label: '프로그램 내부 변화', description: '화면 뒤에서 어떤 동작이 바뀌었는지 쉽게 설명합니다.', omitted: '일반 내부 동작 설명', forced: '데이터 손실·보안 영향' },
  mainFiles: { label: '주요 파일 설명', description: '변경에 중요한 파일을 몇 개만 골라 역할을 설명합니다.', omitted: '일반 주요 파일 설명', forced: '사용자가 요청한 파일 설명' },
  glossary: { label: '개발 용어 설명', description: '필요한 개발 용어를 처음 나올 때 쉬운 말로 풀이합니다.', omitted: '선택적 용어 설명', forced: '안전 판단에 필요한 의미' },
  validationResults: { label: '검증 결과', description: '실행한 테스트와 검사 결과를 알려줍니다.', omitted: '통과한 검증의 일반 설명', forced: '핵심 검증 실패와 보류 사유' },
  riskAssessment: { label: '위험도 안내', description: '변경이 기존 기능에 미칠 수 있는 영향의 크기를 설명합니다.', omitted: '일반 위험도 설명', forced: '높은 위험·판정 불가' },
  userActions: { label: '사용자 확인 안내', description: '사용자가 직접 확인하거나 결정할 일을 알려줍니다.', omitted: '일반 확인 안내', forced: '안전·데이터 손실 관련 행동' },
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
