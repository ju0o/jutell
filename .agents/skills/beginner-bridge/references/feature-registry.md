# JuTell Feature Registry

로컬 설정을 해석할 때 빠르게 확인하는 짧은 reference다. 기본값은 `balanced` 기준으로 모두 켬이다.

| ID | 기본값 | 꺼졌을 때 생략하는 정보 | 꺼져도 보고할 예외 | 관련 limits |
|---|---|---|---|---|
| `changeSummary` | 켬 | 일반 변경 요약 | 작업 실패·범위 밖 변경 | 없음 |
| `userVisibleChanges` | 켬 | 일반 화면·사용 방법 변화 | 중요한 안전 영향 | 없음 |
| `internalChanges` | 켬 | 일반 내부 동작 설명 | 데이터 손실·보안·범위 밖 영향 | 없음 |
| `mainFiles` | 켬 | 주요 파일 역할 설명 | 사용자가 요청한 파일 설명 | `maxMainFiles` |
| `glossary` | 켬 | 선택적 용어 괄호 설명 | 안전 판단에 필요한 의미 | `maxGlossaryTerms` |
| `validationResults` | 켬 | 통과한 검증의 일반 설명 | 핵심 검증 실패·작업 보류 | 없음 |
| `riskAssessment` | 켬 | 일반 위험도 설명 | 높은 위험·판정 불가·비밀정보 위험 | 없음 |
| `userActions` | 켬 | 일반 확인·추가 테스트 안내 | 안전·데이터 손실 관련 행동 | 없음 |
| `nextActionSuggestions` | 켬 | 일반 다음 행동 제안 | 안전·데이터 손실 관련 행동 | 없음 |
| `requestClarificationGuide` | 켬 | 모호한 요청에 대한 일반 확인 | 데이터 손실·보안 관련 확인 | 없음 |
| `manualEditGuidance` | 켬 | 일반 직접 수정 안내 | 데이터 손실·보안 관련 수정 안내 | 없음 |
| `requestBuilder` | 켬 | 템플릿 제공 안내 | 없음 | 없음 |

## 적용 순서

1. 안전상 강제되는 정보 확인
2. 사용자 요청 형식 확인
3. 명시적 Feature와 limits 적용
4. 선택한 Profile 기본값 적용
5. 나머지는 `balanced` 기본값 적용

설정 오류는 추측으로 보정하지 않고 `balanced`로 진행한다. 설정 파일 전체를 최종 보고서에 출력하지 않는다.
