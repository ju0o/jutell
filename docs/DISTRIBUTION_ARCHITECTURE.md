# JuTell Distribution CLI V0.2 배포 구조

## 패키지 구성

`packages/cli/`는 실행 코드와 설치 후 사용할 자산을 하나의 npm 패키지로 묶습니다.

```text
jutell/
├─ dist/                 # CLI 실행 코드
├─ assets/
│  ├─ skill/             # JuTell Skill과 reference
│  ├─ mcp-server/        # MCP 빌드 결과
│  ├─ local-admin/       # 로컬 관리자 정적 화면
│  ├─ local-admin-server.js
│  ├─ default-config.json
│  └─ version.json
└─ package.json
```

패키지 실행 시 소스 저장소의 경로를 참조하지 않습니다. 설치된 패키지 내부 자산과 사용자가 선택한 현재 프로젝트 또는 전역 위치만 사용합니다.

## 설치 범위

### 현재 프로젝트

- Skill: `<프로젝트>/.agents/skills/beginner-bridge/`
- 설정: `<프로젝트>/.jutell.json`
- 현재 Provider MCP 설정: `<프로젝트>/.codex/config.toml`
- Beta Journal과 관리자 상태: `<프로젝트>/.jutell-local/`

### 사용자 전역

- Skill: 사용자 홈의 `.agents/skills/beginner-bridge/`
- 설정: 사용자 홈의 `.jutell.json`
- 현재 Provider MCP 설정: 사용자 Codex 설정의 `config.toml`
- OpenCode MCP 설정: 프로젝트 `opencode.json` (베타)
- 전역 관리자 상태: 사용자 홈의 `.jutell-local/`

전역 설치에서 실제 프로젝트의 보고서 설정은 해당 프로젝트의 설정을 우선합니다. 전역 설치는 Skill과 현재 지원 Provider인 Codex 연결을 사용자 범위에 준비하는 방식입니다. OpenCode는 베타로 프로젝트 `opencode.json`에 JuTell 관리 블록을 등록합니다. 그 외 다른 Provider 연결은 아직 지원하지 않습니다.

기존 `.beginner-bridge.json`과 `.beginner-bridge-local/`은 새 경로가 없을 때 fallback으로 읽고, 사용자 승인 없이 삭제하지 않습니다.

## 실행 흐름

1. `setup`이 운영체제·Node·현재 지원 Provider 상태를 확인합니다.
2. 기존 설정을 읽고 미리보기를 보여줍니다.
3. Skill reference를 중복 없이 설치합니다.
4. 기본 설정을 만들거나 기존 설정의 필요한 부분만 보완합니다.
5. 현재 Provider 설정을 백업하고 JuTell MCP 관리 블록만 추가합니다.
6. `status`와 `doctor`가 설치 상태를 다시 확인합니다.
7. `dashboard`는 packaged local-admin 서버와 정적 화면을 127.0.0.1의 임시 포트로 실행합니다.

패키지로 실행한 관리자 화면의 MCP 시작·중지와 설정 등록은 프로젝트의 `apps/mcp-server` 경로가 아니라 설치된 패키지 내부 MCP 자산을 사용합니다.

## Skill과 MCP의 관계

Skill은 기본 보고 경로입니다. MCP는 현재 Profile, Feature, limits와 안전한 보고 규칙을 읽기 위한 선택형 보조 경로입니다. MCP가 비활성화되거나 실패해도 Skill은 계속 사용할 수 있습니다.

서버 실행, Provider 설정 등록, 실제 AI Agent 도구 호출은 서로 다른 상태입니다. CLI는 앞의 두 상태를 확인할 수 있지만, 실제 도구 호출은 새 Agent 세션에서 사용자가 직접 확인해야 합니다. 현재 실제 연결 확인 대상은 Codex이며, OpenCode는 베타 단계입니다.

## 범위 밖

V0.1에는 npm publish, 자동 업데이트, 중앙 서버, 원격 Telemetry, 계정, 결제, OS 서비스 등록, Electron과 Plugin Directory 게시가 없습니다.
