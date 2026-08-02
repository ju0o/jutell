# Codex Beginner Bridge — Decisions

## 2026-08-02 — 개인 베타 준비와 문서 진입 구조

### 결정 내용

* README, START_HERE, DOCUMENTATION_MAP을 첫 방문자용 진입 구조로 둔다.
* 개인 베타는 최소 3개 실제 프로젝트, 네 Profile, 현재 Feature 8개, 권장 20개 이상 보고서 검토를 기준으로 반복되는 불편을 찾는다.
* 향후 로컬 관리자 화면은 설정·Profile·Feature·제한값·사용자 작성 베타 기록과 삭제를 다루는 요구사항으로만 정의한다.
* 현재 작업에서는 로컬 관리자 UI, 이벤트 저장, 서버, API, 외부 전송을 구현하지 않는다.
* 개인 베타 기록에는 프로젝트를 식별하지 않는 별칭만 사용하고 Prompt·코드·경로·비밀정보를 넣지 않는다.

### 변경 이유

처음 보는 사람이 문서 전체를 읽지 않고도 제품의 현재 범위와 첫 사용 순서를 이해하게 하고, 공개 베타 전에 실제 사용 근거를 모으기 위해서다.

### 영향받은 파일

* `README.md`
* `AGENTS.md`
* `docs/START_HERE.md`
* `docs/DOCUMENTATION_MAP.md`
* `docs/PERSONAL_BETA_PLAN.md`
* `docs/LOCAL_ADMIN_REQUIREMENTS.md`
* `docs/BETA_FEEDBACK_TEMPLATE.md`
* `docs/DECISIONS.md`

### V0.1 범위 변경 여부

없음. 문서 진입 구조와 개인 베타 준비 기준만 추가하며, 기존 보고서·Feature·Telemetry 정책과 V0.1 기능 범위는 유지한다.

## 2026-08-02 — Telemetry Foundation V0.1 문서 설계

### 결정 내용

* Telemetry의 목적을 사용자 추적이 아닌 제품 개선으로 한정한다.
* 기본값은 OFF이며, 명시적 동의 전에는 이벤트 생성·저장·외부 전송을 하지 않는다.
* V0.1에서는 정책, Event Registry, 개인정보 원칙과 단계별 Roadmap만 작성하고 실제 데이터 처리는 구현하지 않는다.
* 프로젝트 코드·diff·Prompt·AI 답변·파일 경로·프로젝트 식별 정보·비밀정보·개인정보는 수집 대상에서 제외한다.
* 공식 Event Registry에 없는 필드는 수집 가능한 정보로 간주하지 않는다.
* 로컬 기록, 익명 통계, 중앙 Dashboard, Team Analytics는 단계별 개인정보 검토와 명시적 동의 이후에만 확장한다.

### 변경 이유

향후 로컬 기록이나 익명 통계로 확장할 수 있는 공통 언어를 마련하되, V0.1에서 추적·전송 기능이 이미 존재하는 것처럼 오해하지 않도록 하기 위해서다.

### 영향받은 파일

* `docs/TELEMETRY_POLICY.md`
* `docs/TELEMETRY_EVENTS.md`
* `docs/PRIVACY_PRINCIPLES.md`
* `docs/ROADMAP_TELEMETRY.md`
* `docs/DECISIONS.md`

### V0.1 범위 변경 여부

없음. 문서 기반 설계만 추가하며 이벤트 저장·전송, 서버, API, UI와 관리자 기능은 구현하지 않는다.

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
