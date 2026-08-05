# JuTell by Ju0 — Decisions

## 2026-08-06 — Session 구조를 날짜 폴더로 전환 (Page = 별도 파일, Work = 작업 블록)

### 결정 내용

* 협업 기록을 하루 하나의 파일(`YYYY-MM-DD-session-NN.md`)에서 **하루 하나의 폴더**(`.jutell-local/collaboration-sessions/YYYY-MM-DD/`)로 전환한다.
* 정의: `Session = 하루(폴더)`, `Page = Agent·역할별 별도 Markdown 파일(page-NN-*.md)`, `Work = Page 파일 안의 개별 작업(## 작업 N 블록)`.
* 폴더 안에는 `session.json`(날짜·상태·현재 Page·Page 목록), Page 파일들, `SESSION_SUMMARY.md`를 둔다. Page 파일 하나에 다른 Agent의 기록이 섞이지 않는다.
* 명령을 `jutell session` 하위 명령으로 제공한다: `session`(상태), `new`, `page`, `work`, `move`, `finish`. npm 호환 별칭(`npm run session:new` 등)은 유지한다.
* 기존 단일 파일 기록(`YYYY-MM-DD-session-NN.md`)은 자동 변환·이동·삭제하지 않고 그대로 둔다. 새 기록은 폴더 방식으로만 만든다.
* Page 번호·작업 번호는 자동 계산하며 기존 내용을 덮어쓰지 않는다. `session.json`은 임시 파일 교체 방식으로 원자적으로 저장한다.

### 변경 이유

여러 Agent를 동시에 쓰는 다중 세션 환경에서 한 파일에 Page를 쌓는 방식은 파일이 길어지고 Agent별 Diff·비교 기록이 섞이는 문제가 생기기 때문이다. Page를 별도 파일로 분리하면 Agent·역할별 기록을 독립적으로 열고 비교할 수 있다.

### 영향받은 파일

* `packages/cli/src/commands/session/` (신규: new-session, create-page, add-work, move-page, finish-session, storage, prompt)
* `packages/cli/src/cli.ts`, `packages/cli/src/output/format.ts`, `packages/cli/src/types.ts` (session 명령 배선, `--page`/`--agent`/`--role`/`--title` 옵션)
* `packages/cli/tests/session.test.ts` (신규)
* `package.json` (session:* 스크립트를 CLI 진입점으로 교체)
* `scripts/session/` (이전 구현 삭제)
* `docs/operator/COLLABORATION_BETA_SESSION_GUIDE.md`, `OPERATOR_START_HERE.md`, `OPERATOR_DAILY_CHECKLIST.md`, `OPERATOR_FILE_GUIDE.md`, `JUTELL_DOGFOODING_GUIDE.md`, `PROJECT_REVIEW_EXPORT_GUIDE.md`
* `docs/DOCUMENTATION_MAP.md`, `docs/deprecated/README.md`, `docs/DECISIONS.md`

### V0.1 범위 변경 여부

없음. 기록 구조와 CLI 제공 방식만 변경하며, 중앙 서버·원격 Telemetry·새 Feature는 추가하지 않는다.

## 2026-08-05 — Collaboration Session 구조 단순화 (하루 하나의 파일)

### 결정 내용

* 협업 기록을 여러 폼(피드백 폼, 협업 세션 폼, 문서 검토 폼, 베타 피드백 양식)을 오가는 구조에서, 하루에 **Session 파일 하나**(`.jutell-local/collaboration-sessions/YYYY-MM-DD-session-NN.md`)만 열어서 계속 이어 쓰는 구조로 단순화한다.
* Session 파일은 `Date`, `Project`, `AI`, `Profile` Header만 필수로 가지며, 작업마다 `## 작업 N` 블록(ChatGPT → OpenCode → 내 피드백)을 복사해 이어 붙이고 파일 끝에 `# 오늘 총평`을 남긴다.
* `npm run session:new`는 오늘 날짜·세션 번호·기본 Header만 담긴 빈 파일을 하나 생성한다. 작업 블록은 자동으로 만들지 않는다.
* 기존 폼 문서는 삭제하지 않고 `docs/deprecated/`로 옮겨 향후 참고용으로만 보관한다.
* 개인 베타 단계에서는 Session 파일 하나만 사용한다. 로컬 관리자 화면의 설정·기록 관리 기능은 그대로 유지한다.

### 변경 이유

협업 기록 구조가 문서·폼이 많아 비개발자인 운영자가 매일 어디에 무엇을 적을지 판단하기 어려웠기 때문이다. "하루에 md 파일 하나만 열어놓고 계속 이어 쓰는 것"으로 기록 부담을 줄인다.

### 영향받은 파일

* `scripts/create-collaboration-session.mjs`
* `docs/operator/COLLABORATION_BETA_SESSION_GUIDE.md`
* `docs/operator/OPERATOR_START_HERE.md`, `OPERATOR_DAILY_CHECKLIST.md`, `OPERATOR_FILE_GUIDE.md`, `JUTELL_DOGFOODING_GUIDE.md`, `PROJECT_REVIEW_EXPORT_GUIDE.md`, `OPERATOR_BETA_ROADMAP.md`
* `docs/DOCUMENTATION_MAP.md`, `docs/PERSONAL_BETA_PLAN.md`, `docs/START_HERE.md`, `docs/DECISIONS.md`
* `docs/deprecated/` (이전 폼 보관: `COLLABORATION_BETA_SESSION_FORM.md`, `OPERATOR_FEEDBACK_FORM.md`, `OPERATOR_DOCUMENT_REVIEW_FORM.md`, `BETA_FEEDBACK_TEMPLATE.md`)

### V0.1 범위 변경 여부

없음. 기록 구조와 문서 정리만 변경하며, 중앙 서버·원격 Telemetry·새 Feature는 추가하지 않는다.

## 2026-08-03 — AI Agent Provider 공통 표시

* 사용자 화면과 일반 안내 문서는 특정 Agent 이름보다 `AI Agent Provider`를 기본 개념으로 사용한다.
* 현재 실제 MCP 연결은 Codex만 지원한다. Claude Code, Cline 등은 지원된다고 표시하지 않고 확장 준비 상태로만 보여준다.
* 기존 Codex 설정 파일, 내부 상태 필드와 호환 경로는 변경하지 않는다. Provider별 연결 구현은 나중에 별도 Adapter로 추가할 수 있도록 화면의 Provider 목록과 현재 지원 상태를 분리한다.

변경 이유: 사용자가 JuTell을 한 Agent 전용 도구로 오해하지 않도록 하면서도, 아직 구현하지 않은 연결을 지원한다고 과장하지 않기 위해서다.

영향받은 파일: 로컬 관리자 Provider 연결 화면, CLI 상태 출력, README, 시작·MCP·설정·배포 안내 문서.

V0.1 범위 변경 여부: 사용자 표시와 문서 구조만 일반화했다. 실제 연결 Provider 추가, 외부 API, 중앙 서버는 포함하지 않았다.

## 2026-08-03 — Codex Beginner Bridge에서 JuTell로 리브랜딩

* 제품 표시는 `JuTell by Ju0`로 통일하고, 대표 CLI는 `jutell`로 준비한다.
* 기존 `beginner-bridge` CLI, Skill ID·경로, MCP 도구 ID는 호환성을 위해 유지한다.
* `.jutell.json`과 `.jutell-local/`을 우선 사용하되 기존 `.beginner-bridge.json`과 `.beginner-bridge-local/`은 삭제하지 않고 fallback·마이그레이션 대상으로 보존한다.
* `voice.preset`은 기본 `default`인 선택 구조만 준비하며 JuTell Style 엔진은 구현하지 않는다.
* 패키지 버전은 문서·CLI·설정·UI를 함께 전환하고 호환성을 추가하므로 `0.2.0`으로 올린다. npm publish와 GitHub 저장소 이름 변경은 하지 않는다.

변경 이유: 제품이 단순 보고 Skill을 넘어 비개발자의 이해·검증·계속 작업·운영을 돕는 제품으로 확장되는 방향을 명확히 하고, 기존 설치를 깨뜨리지 않기 위해서다.

영향받은 파일: README, AGENTS.md, Skill 표시 설명, CLI, 로컬 관리자, MCP 표시 설명, 설정 경로와 브랜드 문서.

V0.1 범위 변경 여부: 제품 이름과 표시·호환성만 정리했다. 중앙 서버, 원격 Telemetry, 계정, 미래 Plan 기능은 추가하지 않았다.

## 2026-08-03 — Distribution CLI V0.1

### 결정 내용

* (이전 결정) `packages/cli/`에 `codex-beginner` 패키지와 `beginner-bridge` 실행 명령을 둔다. 2026-08-03 JuTell 리브랜딩 결정으로 새 설치 경로는 `jutell`을 사용한다.
* 패키지는 Skill reference, MCP 빌드 결과, 로컬 관리자 정적 화면과 서버 번들을 내부 자산으로 포함한다.
* `setup`의 기본 범위는 현재 프로젝트이며, `--global`은 격리된 사용자 전역 범위를 지원한다.
* Codex 설정은 기존 파일을 백업한 뒤 JuTell 관리 블록만 추가·갱신한다. 다른 MCP 서버 설정은 보존한다.
* `dashboard`는 127.0.0.1의 임시 포트에서 foreground로 실행하고 운영체제 서비스로 등록하지 않는다.
* 실제 npm publish와 공개 배포는 이번 범위에 포함하지 않는다.

### 변경 이유

일반 사용자가 Git clone, 수동 Skill 복사와 MCP 설정 편집 없이 JuTell를 설치할 수 있는 첫 배포 경로를 준비하기 위해서다. 설치 과정에서 기존 Codex 설정과 사용자 데이터를 보존해야 한다.

### 영향받은 파일

* `packages/cli/`
* `docs/PRODUCT_SCOPE.md`
* `README.md`
* `docs/START_HERE.md`
* `docs/DOCUMENTATION_MAP.md`
* `docs/MCP_INTEGRATION.md`
* `docs/CLI_INSTALLATION.md`
* `docs/DISTRIBUTION_ARCHITECTURE.md`
* `docs/DECISIONS.md`

### V0.1 범위 변경 여부

로컬 설치·상태·대시보드 실행 CLI를 개인 베타 범위에 추가했다. npm publish, 중앙 서버, 원격 Telemetry, OS 서비스 등록, 계정과 V1 공개 선언은 여전히 범위 밖이다.

## 2026-08-02 — 개인 베타용 선택형 로컬 MCP 연결

### 결정 내용

* Skill 방식은 기본 적용 경로로 유지하고 MCP는 선택형 보조 연결로 둔다.
* MCP는 공식 Codex 로컬 `stdio` 방식과 프로젝트 `.codex/config.toml` 관리 블록을 사용한다.
* MCP V0.1은 설정·Feature·보고 규칙을 읽는 도구만 제공하며 코드, Prompt, Git diff, AI 답변과 비밀정보는 읽지 않는다.
* 로컬 서버 실행, Codex 설정 등록, 실제 Codex 도구 호출을 별도 상태로 표시한다.
* 자동 시작은 기본 OFF이며, 설정 생성·제거는 미리보기와 사용자 확인을 거친다.

### 변경 이유

개인 베타 운영자가 로컬 MCP 연결을 시험할 수 있게 하면서도 기존 Skill 경로와 개인정보 보호 원칙을 유지해야 하기 때문이다.

### 영향받은 파일

* `apps/mcp-server/`
* `apps/local-admin/`
* `docs/MCP_INTEGRATION.md`
* `docs/MCP_SECURITY.md`
* `README.md`
* `docs/START_HERE.md`
* `docs/DOCUMENTATION_MAP.md`
* `docs/LOCAL_ADMIN_REQUIREMENTS.md`
* `docs/PERSONAL_BETA_PLAN.md`
* `docs/DECISIONS.md`

### V0.1 범위 변경 여부

로컬 선택형 MCP 읽기 연결을 개인 베타 범위에 추가했다. 중앙 서버, 외부 API, 원격 Telemetry, 쓰기 도구, 계정과 배포는 여전히 범위 밖이다.

## 2026-08-02 — 비개발자용 로컬 관리자 UI/UX 보완

### 결정 내용

* 로컬 관리자 화면의 Feature, Profile, limits 설명은 한국어를 먼저 보여주고 내부 ID는 보조 정보로 둔다.
* limits는 숫자보다 쉬운 단계 선택을 기본으로 제공하고, 숫자 입력은 고급 설정으로 접는다.
* 관리자 화면은 프로젝트 설정 파일과 Skill·AGENTS 준비 상태만 확인하며, 현재 Codex 세션에 설정을 자동 적용했다고 표현하지 않는다.
* 첫 사용 안내, 설정 미리보기, 복사 가능한 Codex 요청문, 개인 베타 피드백 기록을 제공한다.
* 개인 베타에서 발견한 여섯 가지 UI/UX 문제를 `local-admin-v0.1` 별칭과 `개선 중` 상태로 로컬 기록한다. 기록에는 Prompt, 코드, 경로와 식별 정보를 넣지 않는다.

### 변경 이유

비개발자가 영어 ID나 숫자를 해석하지 않고도 설정을 고르고, 설정을 Codex 작업에 전달하는 방법을 이해할 수 있어야 하기 때문이다. 실제 사용 중 반복된 불편을 다음 개선의 근거로 남기기 위해서다.

### 영향받은 파일

* `apps/local-admin/`
* `README.md`
* `docs/START_HERE.md`
* `docs/LOCAL_ADMIN_REQUIREMENTS.md`
* `docs/DECISIONS.md`

### V0.1 범위 변경 여부

없음. 기존 로컬 관리자 범위 안의 설명·안내·피드백 기록 UX를 보완하며, Codex 세션 자동 주입이나 중앙 서비스는 추가하지 않는다.

## 2026-08-02 — 개인 베타 로컬 관리자 V0.1 구현

### 결정 내용

* `apps/local-admin/`에 Vite·React 화면과 Node.js 기본 HTTP 로컬 API를 둔다.
* 서버는 `127.0.0.1`에만 바인딩하고, 설정과 개인 베타 피드백을 프로젝트 루트의 허용된 로컬 파일에만 저장한다.
* 설정 저장은 `version`, 공식 Profile·Feature, limits 범위와 알 수 없는 필드를 검증하며, 임시 파일·재검증·기존 파일 보존·직렬화 처리를 사용한다.
* limits의 V0.1 입력 범위는 `maxMainFiles` 1~10, `maxGlossaryTerms` 0~10, `compactReportMaxSentences` 4~30으로 통일한다.
* Prompt, AI 답변, 코드, Git diff, 경로, 프로젝트 식별 정보, 비밀정보, 원문 오류 로그는 로컬 기록에도 저장하지 않는다.
* 원격 Telemetry, 중앙 서버, 계정·로그인, 외부 API와 자동 수집은 구현하지 않는다.

### 변경 이유

개인 운영자가 브라우저에서 설정과 피드백을 직접 관리할 수 있어야 개인 베타를 반복 실행할 수 있기 때문이다. 기존 Feature와 Telemetry의 개인정보 원칙은 유지한다.

### 영향받은 파일

* `apps/local-admin/`
* `.gitignore`
* `README.md`
* `AGENTS.md`
* `docs/START_HERE.md`
* `docs/DOCUMENTATION_MAP.md`
* `docs/LOCAL_ADMIN_REQUIREMENTS.md`
* `docs/PERSONAL_BETA_PLAN.md`
* `docs/FEATURE_CONFIGURATION.md`
* `docs/DECISIONS.md`

### V0.1 범위 변경 여부

개인용 로컬 관리자 화면과 로컬 피드백 기록으로 범위를 확장했다. 중앙 서버·원격 Telemetry·외부 전송·사용자 계정은 여전히 범위 밖이다.

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

* JuTell 보고서의 선택 기능을 프로젝트 루트 `.beginner-bridge.json`에서 독립적으로 켜고 끌 수 있게 한다.
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

## 2026-08-03 — `jutell` 기본 실행 흐름 단순화

### 결정 내용

* 프로젝트 폴더에서 `jutell`만 실행하면 현재 프로젝트 연결 확인, 최초 기본 설정, Skill·AGENTS.md·MCP 준비와 로컬 관리자 실행을 순서대로 처리한다.
* 최초 연결의 기본값은 현재 프로젝트, `balanced`, Skill 활성화, MCP 활성화, 자동 OS 시작 OFF, Telemetry OFF로 한다.
* 이미 연결된 프로젝트는 설치를 반복하지 않고 필요한 항목만 확인하며, 안전한 복구 전 사용자에게 묻는다.
* `jutell on`과 `jutell off`를 제공하되 설정·Beta Journal·다른 Codex 설정은 보존한다.
* Codex 연결 준비 상태와 실제 도구 호출 확인 상태를 별도 항목으로 표시한다. 실제 호출을 확인하지 않았다는 이유만으로 경고하지 않는다.
* AGENTS.md에는 JuTell 관리 블록만 추가·갱신·제거하며 기존 내용은 보존한다.

### 변경 이유

일반 사용자가 여러 개의 고급 명령과 연결 상태 확인 절차를 반복하지 않고도 안전하게 JuTell을 시작할 수 있게 하기 위해서다.

### 영향받은 파일

* `packages/cli/src/cli.ts`
* `packages/cli/src/commands/default.ts`
* `packages/cli/src/commands/lifecycle.ts`
* `packages/cli/src/commands/status.ts`
* `packages/cli/src/installer/agents.ts`
* `apps/local-admin/server/app.ts`
* `apps/local-admin/src/features/overview/Overview.tsx`
* `apps/local-admin/src/features/mcp-connection/McpConnection.tsx`
* `README.md`
* `docs/START_HERE.md`
* `docs/CLI_INSTALLATION.md`
* `docs/MCP_INTEGRATION.md`

### V0.1 범위 변경 여부

없음. 기존 로컬 CLI·관리자·Skill·선택형 MCP 연결을 한 명령으로 묶으며 중앙 서버, 원격 Telemetry, OS 자동 시작과 npm publish는 추가하지 않는다.
