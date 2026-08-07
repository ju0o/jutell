# JuTell

## AI Project Guide for Non-Developers

### by Ju0

> JuTell은 AI Agent를 대신 실행하거나 중계하는 Gateway가 아닙니다. 사용자가 이미 사용하는 Agent에 Skill, MCP, 지침, Workflow와 시각적 설정을 연결하여 작업을 이해하고 검증하고 운영하도록 돕는 비개발자용 AI Agent Harness입니다.

JuTell은 비개발자가 AI 코딩 에이전트의 작업을 이해하고, 검증하고, 다음 작업을 요청하며, 프로젝트를 직접 운영할 수 있도록 돕습니다.

> AI는 코드를 만들고, JuTell은 사람이 그 코드를 이해하고 운영하게 합니다.

## JuTell이 하지 않는 일

- AI 모델을 제공하지 않습니다.
- Agent 구독을 중계하거나 API Gateway가 되지 않습니다.
- Agent GUI를 복제하거나 인증을 대행하지 않습니다.
- Codex, Claude Code, OpenCode를 대체하지 않습니다.
- Ju0Symphony의 오케스트레이션 기능을 대체하지 않습니다.

## Harness 구조와 경계

- **Core** — 보고 규칙과 설정. 오프라인에서 항상 동작하며 Cloud 없이 100% 사용할 수 있습니다.
- **Connector** — Agent별 연결(Skill, MCP, 지침, Workflow). Agent를 대신 실행하지 않습니다.
- **Dashboard** — 선택형 시각 설정 도구. 없어도 기본 Profile로 동작합니다.
- **Cloud** — 선택형 미래 기능. 현재 구현되어 있지 않습니다.
- **Ju0Symphony** — 여러 Agent를 오케스트레이션하는 영역이며 JuTell은 여기에 포함되지 않습니다.

상세 기준은 [Foundation 문서](docs/foundation/VISION.md)를 참고합니다.

## JuTell이 해결하는 문제

AI가 빠르게 코드를 바꾸어도 무엇이 바뀌었는지, 실제로 확인된 결과인지, 위험한 부분은 무엇인지 알기 어려울 수 있습니다. JuTell은 원래 용어와 근거를 보존하면서 쉬운 설명, 검증 결과, 위험과 다음 확인 항목을 하나의 보고서로 정리합니다.

## 현재 가능한 기능

- 변경·화면 변화·내부 변화·주요 파일을 쉬운 말로 설명
- 실제 확인, 예상, 미확인 상태를 분리
- 테스트·타입 검사·빌드 결과와 위험도 보고
- Profile, Feature, limits를 로컬 설정으로 조절
- `beginner-bridge` 호환 ID를 유지하는 JuTell Skill
- 선택형 로컬 읽기 전용 MCP와 Skill fallback
- 로컬 관리자, Beta Journal, CLI 설치·상태·진단·제거
- 현재 지원 Provider: Codex, OpenCode(베타). Claude Code·Cline은 준비 중

## 아직 구현되지 않은 방향

고급 코드 해석, 시각적 Diff, 다음 AI 요청 자동 생성, 프로젝트 기획·운영 Workflow, 중앙 서버, 익명 Telemetry, 팀 기능은 제품 방향이며 현재 완성된 기능으로 주장하지 않습니다.

## 빠른 설치 (5분)

현재는 npm에 공개하지 않았습니다. 저장소에서 CLI 패키지를 만들고 격리된 환경으로 확인할 수 있습니다.

```bash
cd packages/cli
npm install
npm pack
npm install -g ./jutell-0.2.1.tgz
```

설치가 끝나면 프로젝트 폴더에서 `jutell` 한 번만 실행합니다. 사용 중인 AI Agent와 보고 방식을 묻는 안내를 따라 고르면 Skill·AGENTS.md·MCP 연결과 관리자 화면이 한 번에 준비됩니다. 공개 후의 목표 흐름은 다음과 같습니다.

```powershell
npm install -g jutell
cd <프로젝트 폴더>
jutell
```

기억할 명령은 7개입니다.

| 명령 | 역할 |
|---|---|
| `jutell` | 처음 시작·연결·관리자 화면을 준비합니다. |
| `jutell on` / `jutell off` | 연결을 켜고 끕니다. |
| `jutell status` | 현재 연결 상태를 확인합니다. |
| `jutell doctor` | 문제가 있는지 점검합니다. |
| `jutell use codex` | Codex에 연결합니다 (권장). |
| `jutell use opencode` | OpenCode에 연결합니다 (베타). |

`setup`, `enable`, `disable`, `uninstall`, `provider`는 고급 명령으로 계속 사용할 수 있습니다. 기존 사용자를 위해 `beginner-bridge`도 같은 기능의 호환 별칭으로 유지합니다.

## Skill, MCP, 관리자

Skill은 기본 보고 경로입니다. `.agents/skills/beginner-bridge/SKILL.md`는 호환성을 위해 ID와 경로를 유지하고 표시 이름은 JuTell로 바꿉니다. 프로젝트 설정은 `.jutell.json`을 우선 읽고, 없으면 기존 `.beginner-bridge.json`을 읽습니다. Skill은 연결된 AI Agent Provider가 보고 규칙을 읽을 수 있게 하는 공통 경로입니다.

`.jutell.json`은 사용자별 로컬 설정이며 공개 저장소에 커밋하지 않습니다. 실제 설정은 CLI 또는 Dashboard가 생성합니다. 저장소에는 안전한 예시(`examples/config/jutell.example.json`)만 포함하며, `.beginner-bridge.json`은 하위 호환용으로 `examples/config/beginner-bridge.example.json`에 예시만 남깁니다.

MCP는 선택형 로컬 읽기 연결입니다. MCP가 꺼지거나 실패해도 Skill 방식은 계속 사용할 수 있습니다. MCP 서버 실행, Provider 설정 등록, 실제 도구 호출은 서로 다른 상태입니다. 현재 실제 MCP 연결은 Codex를 지원하며, OpenCode는 설정 등록을 베타로 지원합니다. Claude Code와 Cline은 확장 대상입니다.

로컬 관리자는 Profile, Feature, limits, Beta Journal, AI Agent Provider 연결 준비 상태를 현재 컴퓨터에서만 관리합니다.

## 개인정보와 Telemetry

JuTell은 프로젝트 코드, Prompt, AI 답변 원문, 파일 내용, 파일 경로, 비밀정보와 사용자를 식별할 정보를 수집하지 않는 것을 원칙으로 합니다. Telemetry는 기본 OFF이며 이번 단계에서 실제 저장이나 외부 전송을 구현하지 않았습니다.

## 개인 베타 상태

현재는 개인 베타 단계입니다. 기술 검증 기록은 있지만 비개발자 평가와 공개 베타 판단은 아직 남아 있습니다.

## 문서

- [시작하기](docs/START_HERE.md)
- [Foundation (최상위 기준)](docs/foundation/VISION.md)
- [Foundation 정합성 검토](docs/FOUNDATION_RECONCILIATION.md)
- [제품 범위](docs/PRODUCT_SCOPE.md)
- [제품 비전](docs/PRODUCT_VISION.md)
- [브랜드 정책](docs/BRAND_IDENTITY.md)
- [브랜드 전환](docs/BRAND_MIGRATION.md)
- [JuTell Style](docs/JUTELL_STYLE.md)
- [Feature 설정](docs/FEATURE_CONFIGURATION.md)
- [로컬 관리자 요구사항](docs/LOCAL_ADMIN_REQUIREMENTS.md)
- [AI Agent 연결](docs/MCP_INTEGRATION.md)
- [OpenCode 연결 (베타)](docs/PROVIDER_OPENCODE.md)
- [개인정보 원칙](docs/PRIVACY_PRINCIPLES.md)
- [Telemetry 정책](docs/TELEMETRY_POLICY.md)
- [공개 저장소 정책](docs/PUBLIC_REPOSITORY_POLICY.md)
- [비공개 문서 지도](docs/PRIVATE_DOCUMENTS_MAP.md)
- [운영자 문서](docs/operator/OPERATOR_START_HERE.md) — 운영자용 가이드 모음 (문서·피드백·협업 세션·로드맵·검토 번들)

## Ju0와의 관계

Ju0는 상위 브랜드이고, JuTell은 그 아래의 제품입니다. 공식 표기는 `JuTell by Ju0`입니다. GitHub 저장소 이름 변경과 npm 공개 시점은 별도 운영자 결정으로 남겨둡니다.

마이그레이션 이전의 이름과 파일 경로는 [브랜드 전환 안내](docs/BRAND_MIGRATION.md)에서만 설명합니다.
