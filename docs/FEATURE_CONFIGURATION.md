# Beginner Bridge 로컬 Feature 설정

## 1. 목적과 범위

Beginner Bridge 보고서의 선택 기능을 프로젝트별 로컬 설정으로 조절한다.

이 설정은 Codex Skill이 보고서를 작성할 때 읽는 문서 기반 설정이다. 별도의 프로그램 파서, 설정 화면, 중앙 서버, 계정 동기화, 외부 Provider는 현재 범위가 아니다.

설정 파일에는 비밀정보, 비밀번호, API 키, 토큰 또는 개인정보를 저장하지 않는다.

## 2. 기본 설정 파일

프로젝트 루트의 `.beginner-bridge.json`을 사용한다. 파일이 없으면 `balanced` 기본값을 사용한다.

```json
{
  "version": 1,
  "profile": "balanced",
  "features": {
    "changeSummary": true,
    "userVisibleChanges": true,
    "internalChanges": true,
    "mainFiles": true,
    "glossary": true,
    "validationResults": true,
    "riskAssessment": true,
    "userActions": true
  },
  "limits": {
    "maxMainFiles": 5,
    "maxGlossaryTerms": 3,
    "compactReportMaxSentences": 12
  }
}
```

JSON에는 주석을 넣지 않는다.

## 3. Feature ID

모든 Feature는 서로 독립적으로 켜거나 끌 수 있다.

| ID | 역할 |
|---|---|
| `changeSummary` | 변경 내용을 기능 중심으로 요약 |
| `userVisibleChanges` | 사용자가 보는 화면이나 사용 방법의 변화 설명 |
| `internalChanges` | 프로그램 내부 동작의 변화 설명 |
| `mainFiles` | 주요 수정 파일과 역할 설명 |
| `glossary` | 필요한 개발 용어에 쉬운 설명 추가 |
| `validationResults` | 테스트·타입 검사·빌드·브라우저 확인 결과 설명 |
| `riskAssessment` | 위험도와 위험 근거 설명 |
| `userActions` | 사용자 확인·추가 테스트·설정·결정 안내 |

기본값은 모든 Feature가 `true`다. Feature 값은 반드시 boolean이어야 한다.

## 4. Profile

Profile은 여러 Feature와 길이 제한의 기본 묶음이다. 명시적으로 적은 `features`와 `limits`가 Profile보다 우선한다.

| Profile | 기본 Feature | 권장 limits |
|---|---|---|
| `minimal` | `internalChanges`, `mainFiles`, `glossary`, `riskAssessment` 끔; 나머지 켬 | 주요 파일 3개, 용어 1개, 8문장 |
| `balanced` | 모두 켬 | 주요 파일 5개, 용어 3개, 12문장 |
| `learning` | 모두 켬 | 주요 파일 5개, 용어 6개, 12문장 |
| `detailed` | 모두 켬 | 주요 파일 5개, 용어 6개, 18문장 |

`learning`은 용어 설명 한도를 늘릴 수 있다. `detailed`는 복잡하거나 위험한 작업에서 파일과 검증 설명을 더 자세히 작성할 수 있다. 단순 작업에서는 실제 작업 규모에 맞게 줄인다.

`maxMainFiles`는 1~10, `maxGlossaryTerms`는 0~10, `compactReportMaxSentences`는 4~30의 정수만 허용한다. 이 제한은 선택 정보에 적용하며 안전상 강제되는 정보에는 적용하지 않는다.

## 5. 설정 우선순위

여러 규칙이 동시에 적용되면 다음 순서로 판단한다.

1. 안전상 반드시 보고해야 하는 정보
2. 사용자가 현재 요청에서 명시한 보고 형식
3. `.beginner-bridge.json`의 명시적 `features`와 `limits`
4. 선택한 Profile의 기본 설정
5. Beginner Bridge의 `balanced` 기본값

사용자가 현재 요청에서 특정 정보를 요구하면 해당 정보를 보고한다. 사용자가 안전·실패 정보를 숨겨달라고 해도 숨기지 않는다.

## 6. 안전상 끌 수 없는 정보

다음 정보는 관련 Feature가 꺼져 있어도 짧게 보고한다.

* 작업 실패
* 핵심 검증 실패
* 중요한 미확인 사항
* 비밀정보 노출 위험
* 데이터 손실 가능성
* 요청 범위를 벗어난 변경
* 작업 보류 사유
* 높은 위험 또는 위험도 판정 불가
* 안전·데이터 손실과 관련된 사용자 행동

이 규칙은 꺼진 Feature 전체를 다시 켜는 것이 아니라, 안전에 필요한 사실만 추가하는 규칙이다.

## 7. 설정 오류 처리

설정 오류가 있어도 작업 자체를 불필요하게 중단하지 않는다. 오류가 있는 설정 전체를 추측해 보정하지 않고 `balanced` 기본값으로 진행한다.

| 상황 | 처리 |
|---|---|
| 설정 파일 없음 | `balanced` 사용. 오류로 보고하지 않음 |
| JSON 문법 오류 | `balanced` 사용 후 설정 문제를 짧게 보고 |
| 알 수 없는 Profile | `balanced` 사용 후 Profile 이름을 추측하지 않았음을 보고 |
| 알 수 없는 Feature ID | 해당 이름을 적용하지 않고 `balanced` 사용 후 이름만 보고 |
| boolean이 아닌 Feature 값 | `balanced` 사용 후 설정 문제를 보고 |
| 음수·범위를 벗어난 limits | `balanced` 사용 후 설정 문제를 보고 |
| 지원하지 않는 `version` | `balanced` 사용 후 지원 버전을 보고 |

설정 오류 보고에는 설정 파일 전체나 값이 포함될 수 있는 내용을 출력하지 않는다. 예를 들어 `glossarry`처럼 지원하지 않는 이름만 표시할 수 있다.

## 8. 예시

### 8.1 토큰 절약용 `minimal`

```json
{
  "version": 1,
  "profile": "minimal",
  "limits": {
    "maxMainFiles": 3,
    "maxGlossaryTerms": 1,
    "compactReportMaxSentences": 8
  }
}
```

이 설정에서는 변경 요약, 사용자 변화, 검증 결과, 필요한 사용자 행동을 유지하고 내부 변화·주요 파일·용어·일반 위험도 설명은 기본적으로 줄인다. 실패와 중요한 미확인 사항은 유지한다.

### 8.2 용어 학습용 `learning`

```json
{
  "version": 1,
  "profile": "learning",
  "limits": {
    "maxGlossaryTerms": 6
  }
}
```

이 설정은 필요한 개발 용어 설명을 더 제공할 수 있다. 작업과 무관한 용어를 모두 설명하지는 않는다.

## 9. 현재 범위

현재는 프로젝트 루트의 로컬 설정만 지원한다. 중앙 서버, 계정별 동기화, 외부 Provider, 설정 UI, 원격 분석과 사용량 수집은 현재 범위가 아니다.
