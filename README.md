# JuTell

## AI Project Guide for Non-Developers

### by Ju0

AI와 만든 프로젝트를 이해하고 운영하게 해주는 오픈소스입니다.

JuTell은 비개발자가 AI 코딩 에이전트의 작업을 이해하고, 검증하고, 다음 작업을 요청하며, 프로젝트를 직접 운영할 수 있도록 돕습니다.

> AI는 코드를 만들고, JuTell은 사람이 그 코드를 이해하고 운영하게 합니다.

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

## 아직 구현되지 않은 방향

고급 코드 해석, 시각적 Diff, 다음 AI 요청 자동 생성, 프로젝트 기획·운영 Workflow, 중앙 서버, 익명 Telemetry, 팀 기능은 제품 방향이며 현재 완성된 기능으로 주장하지 않습니다.

## 빠른 설치

현재는 npm에 공개하지 않았습니다. 저장소에서 CLI 패키지를 만들고 격리된 환경으로 확인할 수 있습니다.

```bash
cd packages/cli
npm install
npm pack
npm install -g ./jutell-0.2.0.tgz
```

설치한 뒤 사용할 프로젝트 폴더에서 `jutell`만 실행하면 설치 확인, 기본 연결, 로컬 관리자 실행과 브라우저 열기를 순서대로 처리합니다. 공개 후의 목표 흐름은 다음과 같습니다.

```powershell
npm install -g jutell
cd <프로젝트 폴더>
jutell
```

자주 쓰는 명령은 `jutell`, `jutell on`, `jutell off`, `jutell status`, `jutell doctor`입니다. 기존 사용자를 위해 `beginner-bridge`도 같은 기능의 호환 별칭으로 유지합니다. `setup`, `enable`, `disable`, `uninstall`은 고급 명령으로 계속 사용할 수 있습니다.

## Skill, MCP, 관리자

Skill은 기본 보고 경로입니다. `.agents/skills/beginner-bridge/SKILL.md`는 호환성을 위해 ID와 경로를 유지하고 표시 이름은 JuTell로 바꿉니다. 프로젝트 설정은 `.jutell.json`을 우선 읽고, 없으면 기존 `.beginner-bridge.json`을 읽습니다. Skill은 연결된 AI Agent Provider가 보고 규칙을 읽을 수 있게 하는 공통 경로입니다.

MCP는 선택형 로컬 읽기 연결입니다. MCP가 꺼지거나 실패해도 Skill 방식은 계속 사용할 수 있습니다. MCP 서버 실행, Provider 설정 등록, 실제 도구 호출은 서로 다른 상태입니다. 현재 실제 MCP 연결은 Codex를 지원하며, Claude Code와 Cline은 확장 대상입니다.

로컬 관리자는 Profile, Feature, limits, Beta Journal, AI Agent Provider 연결 준비 상태를 현재 컴퓨터에서만 관리합니다.

## 개인정보와 Telemetry

JuTell은 프로젝트 코드, Prompt, AI 답변 원문, 파일 내용, 파일 경로, 비밀정보와 사용자를 식별할 정보를 수집하지 않는 것을 원칙으로 합니다. Telemetry는 기본 OFF이며 이번 단계에서 실제 저장이나 외부 전송을 구현하지 않았습니다.

## 개인 베타 상태

현재는 개인 베타 단계입니다. 기술 검증 기록은 있지만 비개발자 평가와 공개 베타 판단은 아직 남아 있습니다.

## 문서

- [시작하기](docs/START_HERE.md)
- [제품 범위](docs/PRODUCT_SCOPE.md)
- [제품 비전](docs/PRODUCT_VISION.md)
- [브랜드 정책](docs/BRAND_IDENTITY.md)
- [브랜드 전환](docs/BRAND_MIGRATION.md)
- [JuTell Style](docs/JUTELL_STYLE.md)
- [Feature 설정](docs/FEATURE_CONFIGURATION.md)
- [로컬 관리자 요구사항](docs/LOCAL_ADMIN_REQUIREMENTS.md)
- [AI Agent 연결](docs/MCP_INTEGRATION.md)
- [개인정보 원칙](docs/PRIVACY_PRINCIPLES.md)
- [Telemetry 정책](docs/TELEMETRY_POLICY.md)

## Ju0와의 관계

Ju0는 상위 브랜드이고, JuTell은 그 아래의 제품입니다. 공식 표기는 `JuTell by Ju0`입니다. GitHub 저장소 이름 변경과 npm 공개 시점은 별도 운영자 결정으로 남겨둡니다.

마이그레이션 이전의 이름과 파일 경로는 [브랜드 전환 안내](docs/BRAND_MIGRATION.md)에서만 설명합니다.
