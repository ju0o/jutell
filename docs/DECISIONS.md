# Codex Beginner Bridge — Decisions

## 2026-08-02 — 로컬 Feature 설정 시스템 추가

### 결정 내용

* Beginner Bridge 보고서의 선택 기능을 프로젝트 루트 `.beginner-bridge.json`에서 독립적으로 켜고 끌 수 있게 한다.
* `minimal`, `balanced`, `learning`, `detailed` Profile을 제공하고 명시적 Feature·limits를 Profile보다 우선한다.
* 설정이 없거나 잘못되면 설정 전체를 추측하지 않고 `balanced` 기본값으로 진행한다.
* 실패, 핵심 검증 실패, 중요한 미확인 사항, 높은 위험·판정 불가, 비밀정보·데이터 손실 위험, 범위 밖 변경과 작업 보류 사유는 설정으로 숨길 수 없다.
* 설정은 로컬 파일과 Skill 문서 해석에 한정하며 중앙 서버, 외부 API, Gateway, MCP, Plugin, UI와 동기화는 추가하지 않는다.

### 변경 이유

사용자가 보고서의 상세 수준과 용어 설명 정도를 작업 목적에 맞게 조절하면서도 안전 정보와 사실성 기준을 유지할 수 있게 하기 위해서다.

### 영향받은 파일

* `.beginner-bridge.json`
* `docs/FEATURE_CONFIGURATION.md`
* `docs/TEST_SCENARIOS.md`
* `.agents/skills/beginner-bridge/SKILL.md`
* `.agents/skills/beginner-bridge/references/feature-registry.md`
* `.agents/skills/beginner-bridge/references/report-format.md`
* `docs/DECISIONS.md`

### V0.1 범위 변경 여부

없음. 로컬 설정 문서와 Skill 실행 규칙만 추가하며 중앙 서비스나 실행 프로그램은 만들지 않는다.

## 2026-08-02 — V0.1 문서 기반과 Skill 초안 정리

### 결정 내용

* `docs/BEGINNER_REPORT_SPEC.md`를 보고서의 공식 정보 체계와 보고서 상태 연결 기준으로 유지한다.
* `docs/GLOSSARY_POLICY.md`에는 용어 설명 정책만 남기고, 핵심 용어와 상세 예시는 `.agents/skills/beginner-bridge/references/glossary-ko.md`에서 관리한다.
* 보고서 형식과 위험도 상세 기준은 각각 `references/report-format.md`와 `references/risk-level-guide.md`에서 필요한 경우 읽는다.
* `.agents/skills/beginner-bridge/SKILL.md`는 전체 문서를 복사하지 않고 짧은 실행 흐름과 reference 탐색 규칙만 제공한다.
* 기본 사전에 없는 용어는 코드와 프로젝트 문맥, 프로젝트 문서, 공통 reference 순서로 확인하며 정확히 확인하지 못하면 추측하지 않는다.
* V0.1 제품 범위는 변경하지 않는다. 실제 예제 프로젝트 실행과 비개발자 평가는 별도 다음 단계로 남긴다.

### 변경 이유

용어 설명과 보고서·위험도 세부 내용을 분리해 Skill의 기본 지침을 짧게 유지하고, 비개발자 보고서의 사실성·문맥성을 높이기 위해서다.

### 영향받은 파일

* `docs/GLOSSARY_POLICY.md`
* `docs/TEST_SCENARIOS.md`
* `.agents/skills/beginner-bridge/SKILL.md`
* `.agents/skills/beginner-bridge/references/glossary-ko.md`
* `.agents/skills/beginner-bridge/references/report-format.md`
* `.agents/skills/beginner-bridge/references/risk-level-guide.md`

### V0.1 범위 변경 여부

없음. 이번 변경은 문서 정리, 실행 지침 초안, reference 분리에 한정한다.
