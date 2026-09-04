# JuTell 시작하기

## 이 문서는 무엇을 설명하나요?

처음 보는 사람이 JuTell의 역할과 현재 범위를 빠르게 이해하도록 돕는 안내서입니다. 모든 문서를 처음부터 읽을 필요는 없습니다.

## JuTell의 역할

JuTell은 AI Agent를 대신 실행하거나 중계하는 Gateway가 아닙니다. 사용자가 이미 사용하는 Agent에 Skill, MCP, 지침, Workflow와 시각적 설정을 연결하여 작업을 이해하고 검증하고 운영하도록 돕는 비개발자용 AI Agent Harness입니다. 최상위 의사결정 기준은 [Foundation 문서](foundation/VISION.md)이며, 현재 구현과의 대조는 [FOUNDATION_RECONCILIATION.md](FOUNDATION_RECONCILIATION.md)에 있습니다.

JuTell은 AI Agent 작업 뒤에 다음을 구분해 보고하도록 돕습니다. 현재 연결 Provider는 Codex이며, OpenCode를 베타로 지원하고 다른 Provider로 확장할 수 있는 구조를 사용합니다.

- 실제로 확인한 사실
- 코드만 보고 예상한 변화
- 아직 확인하지 못한 내용
- 사용자가 직접 확인하거나 결정할 내용

JuTell 자체가 코드를 실행하거나 화면을 대신 승인하는 제품은 아닙니다. Agent는 사용자가 선택한 도구로 그대로 실행되며, JuTell은 연결과 보고·설정만 담당합니다.

## Dashboard는 선택 사항

로컬 관리자 화면(Dashboard)은 설정을 시각적으로 편집하는 도구입니다. 실행하지 않아도 Skill 방식과 기본 Profile로 JuTell은 그대로 동작합니다. Dashboard 없이 시작하고 싶다면 3단계로 시작합니다: 1) 작업 전 상태 확인, 2) 작은 작업부터 balanced로 실행, 3) 보고서에서 실제 확인과 예상을 구분해 읽기.

## Skill과 설정 파일

`.agents/skills/beginner-bridge/SKILL.md`는 보고서를 만드는 실행 규칙입니다. 프로젝트 루트의 `.jutell.json`은 보고서의 선택 기능과 길이 제한을 정하며, CLI 또는 Dashboard가 생성하는 사용자별 로컬 설정입니다 (공개 저장소에는 예시만 포함: `examples/config/jutell.example.json`). 설정 파일이 없거나 잘못되면 `balanced` 기본값으로 진행합니다.

Profile은 다음과 같이 사용합니다.

| Profile | 쉬운 설명 |
|---|---|
| `minimal` | 짧은 보고서. 선택적인 내부 설명과 용어 설명을 줄입니다. |
| `balanced` | 기본값. 변경, 검증, 위험, 사용자 확인을 균형 있게 설명합니다. |
| `learning` | 필요한 개발 용어를 조금 더 설명합니다. |
| `detailed` | 복잡하거나 위험한 작업을 더 자세히 설명합니다. |

안전 문제, 핵심 실패, 중요한 미확인 사항, 비밀정보 위험은 Profile로 숨길 수 없습니다.

## V0.1 검증 상태

예제 프로젝트는 [`examples/v0.1-test-app/`](../examples/v0.1-test-app/)에 있습니다. 시나리오 A와 B의 기술 실행 기록은 [`tests/results/`](../tests/results/)에 보존되어 있습니다. 현재 기록은 코드와 자동 검증 중심이며, 실제 비개발자 평가가 완료된 것은 아닙니다.

## 실제 프로젝트에서 처음 사용하는 순서

1. 작업 전 Git 상태와 기존 변경을 확인합니다.
2. 작은 작업부터 `balanced` Profile로 사용합니다.
3. 작업 뒤 안전한 테스트·검사·빌드를 실행합니다.
4. Skill 보고서에서 실제 확인과 예상을 구분해 읽습니다.
5. 사용자가 직접 화면에서 확인할 항목을 확인합니다.
6. 길이, 어려운 표현, 빠진 정보가 있으면 오늘 Session 폴더(운영자 협업 기록)의 해당 Page에 기록합니다. 운영자 기록 방법은 [Session 가이드](operator/COLLABORATION_BETA_SESSION_GUIDE.md)를 봅니다.

Prompt, 코드, 파일 경로, 비밀정보를 피드백에 그대로 적지 않습니다. 오류를 기록해야 한다면 민감한 내용을 제거한 짧은 요약만 사용합니다.

## Distribution CLI

일반 사용자가 Skill을 직접 복사하지 않도록 `jutell@1.0.1`을 npm에 공개했습니다. 일반 설치는 npm registry에서 진행합니다.

```powershell
npm install -g jutell
cd <프로젝트 폴더>
jutell use codex
```

`jutell use codex`는 권장 경로이며, OpenCode 또는 Claude Code를 사용한다면 `jutell use opencode` 또는 `jutell use claude`를 사용합니다 (베타). `jutell`만 실행해도 같은 안내를 시작할 수 있습니다.

<details>
<summary>개발자·기여자용 로컬 검증 (tarball)</summary>

저장소에서 직접 패키지를 검증할 때만 사용합니다. 일반 사용자는 위의 `npm install -g jutell`을 사용하세요.

```bash
cd packages/cli
npm install
npm pack
npm install -g ./jutell-1.0.1.tgz
```

</details>

첫 실행은 `jutell` 하나로 시작합니다. 설치된 AI Agent(Codex, OpenCode, Claude Code)를 찾아 연결을 물어보고, 승인하면 Skill, AGENTS.md, MCP 연결을 준비한 뒤 곧바로 평소 쓰던 화면으로 돌아갑니다 — 관리자 화면은 자동으로 열리지 않으며 필요할 때 `jutell dashboard`로 직접 엽니다. 자동화 환경에서는 안내 없이 `balanced` Profile로 연결됩니다. 이미 연결된 프로젝트에서는 필요한 상태만 확인하고, 안전하게 복구할 수 있는 항목만 묻습니다. Agent 하나만 수동으로 연결·재연결하고 싶을 때는 `jutell use <provider>`를 사용합니다. `jutell on`과 `jutell off`로 연결을 켜고 끌 수 있으며 설정과 Beta Journal은 보존됩니다. 명령별 안전 규칙은 [CLI 설치 안내](CLI_INSTALLATION.md)를 읽습니다.

## 문제가 생기면 어디를 보나요?

- 보고서 형식이나 상태가 궁금하면 [BEGINNER_REPORT_SPEC.md](BEGINNER_REPORT_SPEC.md)를 봅니다.
- Profile과 Feature가 궁금하면 [FEATURE_CONFIGURATION.md](FEATURE_CONFIGURATION.md)를 봅니다.
- 용어가 이상하면 [GLOSSARY_POLICY.md](GLOSSARY_POLICY.md)와 [glossary reference](../.agents/skills/beginner-bridge/references/glossary-ko.md)를 봅니다.
- 시나리오나 평가 기준이 궁금하면 [TEST_SCENARIOS.md](TEST_SCENARIOS.md)를 봅니다.
- 기록·개인정보·Telemetry가 궁금하면 [DOCUMENTATION_MAP.md](DOCUMENTATION_MAP.md)에서 해당 문서만 선택합니다.

운영자가 하루 협업 흐름을 기록하는 방법은 [운영자 문서](operator/OPERATOR_START_HERE.md)에 있습니다.

## 로컬 관리자 실행

로컬 관리자 화면은 개인 베타 준비용으로 구현되어 있습니다.

```bash
cd apps/local-admin
npm install
npm run dev
```

브라우저에서 `http://127.0.0.1:5174`를 엽니다. API도 `127.0.0.1:8787`에 함께 실행되며 외부 네트워크 주소에 공개하지 않습니다. 포트가 사용 중이면 `BB_LOCAL_ADMIN_PORT`와 `BB_LOCAL_ADMIN_VITE_PORT` 환경변수로 바꿀 수 있습니다.

현재 단계는 개인 베타 준비입니다. 다음 단계는 이 화면을 중앙 서비스로 확장하는 것이 아니라, 실제 사용에서 반복되는 문제와 필요한 설정을 기록하는 것입니다.

관리자 화면은 AI Agent 세션에 설정을 자동으로 주입하지 않습니다. 화면은 프로젝트 루트의 `.jutell.json`을 저장합니다. 연결 후 새 대화를 열면 JuTell에 자동 적용되며, 아래 문구는 필수가 아닌 선택 안내입니다. 원한다면 첫 작업을 JuTell 보고 형식으로 시작하기 쉽게 쓸 수 있습니다.

```text
이 프로젝트의 AGENTS.md,
.agents/skills/beginner-bridge/SKILL.md,
.jutell.json을 먼저 읽고 작업해주세요.

작업 완료 후 현재 활성화된 JuTell 기능만 사용해 보고해주세요.
설정으로 꺼진 항목은 생략하되,
실패, 중요한 미확인 사항, 범위 밖 변경과 안전 문제는 숨기지 마세요.
```

## 선택형 AI Agent 연결

MCP는 Skill 방식에 추가로 사용할 수 있는 로컬 읽기 연결입니다. 연결은 `jutell use opencode`(또는 `jutell use codex`) 한 번으로 백업·등록·활성화를 끝냅니다. 관리자 화면의 `AI Agent 연결`에서 Provider 카드의 `연결하기`, `연결 끊기`, `기본 Agent로 사용` 버튼으로 같은 작업을 할 수 있습니다. 서버 실행 상태와 실제 AI Agent 도구 호출 성공은 다르므로 새 세션에서 도구 호출을 직접 확인해야 합니다.

자세한 실행 순서는 [MCP_INTEGRATION.md](MCP_INTEGRATION.md), 보안 범위는 [MCP_SECURITY.md](MCP_SECURITY.md)를 읽습니다. MCP가 꺼져도 AGENTS.md·Skill·설정 파일 방식은 그대로 사용할 수 있습니다.
