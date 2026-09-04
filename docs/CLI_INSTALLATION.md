# JuTell CLI 설치 안내

## 현재 상태

`jutell@1.1.0`은 npm에 공개되었습니다. 일반 설치는 npm registry에서 진행합니다.

```powershell
npm install -g jutell
jutell
```

`jutell`을 실행하면 설치된 Coding Agent(Codex, OpenCode, Claude Code)를 찾아 연결을 물어보고, 승인하면 곧바로 평소 쓰던 화면으로 돌아갑니다. 특정 Agent 하나만 수동으로 연결하거나 다시 연결하고 싶을 때는 `jutell use codex` / `jutell use opencode` (베타) / `jutell use claude` (베타)를 사용합니다 — 이 명령들은 자동 연결이 실패했을 때 쓰는 수동/복구 경로입니다.

### 개발자·기여자용 로컬 설치 (tarball 검증)

저장소에서 직접 패키지를 검증할 때만 사용합니다. 일반 사용자는 위의 `npm install -g jutell`을 사용하세요.

```bash
cd packages/cli
npm install
npm pack
npm install -g ./jutell-1.1.0.tgz
```

## 명령

| 명령 | 역할 |
|---|---|
| `jutell` | 설치된 Coding Agent를 찾아 연결하고 평소 쓰던 화면으로 돌아갑니다 (관리자 화면은 열지 않습니다). 최초에는 balanced, Skill, MCP를 기본으로 준비합니다. |
| `jutell on` | Skill, MCP, AGENTS.md JuTell 블록을 다시 활성화합니다. |
| `jutell off` | Skill과 MCP를 끄고 설정과 Beta Journal을 보존합니다. |
| `jutell setup` | Skill, 기본 설정, MCP 연결 설정을 안전하게 준비합니다. |
| `jutell dashboard` | 127.0.0.1의 임시 포트에서 관리자 화면을 실행합니다. |
| `jutell status` | 설치·Profile·Feature·MCP·Telemetry 상태를 보여줍니다. |
| `jutell enable` | Skill과 MCP를 다시 활성화합니다. |
| `jutell disable` | 기본적으로 MCP 연결만 끄고 Skill과 데이터를 보존합니다. |
| `jutell doctor` | 설치 파일, 설정, 권한과 외부 전송 여부를 점검합니다. |
| `jutell uninstall` | Skill과 JuTell MCP 관리 블록을 제거합니다. 기본적으로 데이터는 보존합니다. |

`--project`는 현재 프로젝트, `--global`은 격리된 사용자 전역 범위를 뜻합니다. `setup` 기본 범위는 현재 프로젝트입니다.

`jutell --no-open`은 기본 흐름에서 브라우저를 열지 않고, `jutell --status-only`는 연결 상태만 출력합니다. 이미 관리자가 실행 중이면 새 서버를 만들지 않고 기존 주소를 보여줍니다.

최초 실행 시 기존 프로젝트 내용을 보존하면서 다음을 준비합니다.

- `.jutell.json` 설정 (터미널 안내에서 고른 보고 방식. 자동 환경에서는 `balanced` 기본값)
- `.agents/skills/beginner-bridge/SKILL.md` Skill
- `AGENTS.md`의 JuTell 관리 블록
- 선택한 AI Agent Provider 설정의 JuTell MCP 관리 블록과 활성 상태

AGENTS.md의 기존 내용과 다른 Provider MCP 설정은 보존합니다. 현재 실제 연결 Provider는 Codex이며 OpenCode와 Claude Code는 베타로 지원을 확인합니다. `on`과 `off`는 설정 및 Beta Journal을 삭제하지 않습니다. 빠른 연결은 `jutell use codex` / `jutell use opencode` / `jutell use claude`를 사용합니다.

이전 설치에서 사용하던 `beginner-bridge` 명령도 같은 기능의 호환 별칭으로 동작하며, 실행 시 `jutell` 사용을 안내합니다.

## 설치 안전성

- 기존 Provider 설정 파일을 변경하기 전에 `.previous` 백업을 만듭니다.
- 다른 MCP 서버 설정은 보존합니다.
- JuTell 관리 블록만 추가·갱신·제거합니다.
- 같은 이름의 관리되지 않는 MCP 설정이 있으면 자동 변경하지 않습니다.
- 이미 같은 Skill 파일이 있으면 중복으로 만들지 않습니다.
- 다른 내용의 기존 Skill 파일은 덮어쓰지 않고 주의로 알립니다.
- 설치 중 오류가 발생하면 이번 설치에서 바꾼 설정을 이전 상태로 복원합니다.
- `uninstall`은 기본적으로 설정과 Beta Journal을 보존합니다. `--remove-data`를 함께 사용할 때만 해당 로컬 데이터를 제거합니다.
- `dashboard`는 운영체제 시작 프로그램이나 영구 서비스로 등록하지 않습니다.

중요한 변경 전에는 미리보기를 보여주며, 자동 실행 환경에서는 `--yes`를 사용할 수 있습니다.

## 상태와 개인정보

`status`의 기본 출력은 비개발자가 읽기 쉬운 요약이며 전체 절대 경로와 비밀 값을 표시하지 않습니다. AI Agent 연결 준비 상태는 `설정 미등록`, `등록됨`, `활성화됨`, `오류/충돌`로 구분하고, 실제 도구 호출은 `확인하지 않음`, `마지막 확인 성공`, `마지막 확인 실패`로 따로 표시합니다. 현재 지원 Provider는 Codex(지원)와 OpenCode·Claude Code(베타)이며, 실제 호출을 확인하지 않았다는 이유만으로 설치 경고를 표시하지 않습니다. `--json`은 자동 점검용 구조화 결과입니다.

Telemetry는 비활성화되어 있고, CLI는 프로젝트 코드·Prompt·AI 답변·Git diff·API Key·환경변수·사용자 식별 정보를 수집하거나 외부로 보내지 않습니다. MCP는 선택 기능이며 Skill fallback은 유지됩니다.

## 지원 범위와 제한

- Windows: VERIFIED — Windows 11에서 `npm install -g jutell` (registry) 설치, `jutell use codex` 연결, `jutell status`/`doctor`, MCP 서버 5개 도구 응답, 로컬 관리자 빌드 실행을 검증했습니다. 로컬 tarball 설치(`npm install -g ./jutell-*.tgz`)도 동일하게 검증했습니다. 전체 lifecycle 기준 공개 베타 검증 대상은 Windows입니다.
- Linux (Ubuntu Native): 공개 패키지 최소 스모크 VERIFIED — `npm install -g jutell`로 설치한 공개 패키지 기준 최소 CLI/Provider 연결 스모크를 Ubuntu Native에서 검증했습니다. 다른 배포판, 모든 Provider, Windows와 동일한 전체 lifecycle 명령까지 검증한 것은 아닙니다.
- macOS: AVAILABLE / UNVERIFIED — 경로·실행 파일 처리는 Node 기준으로 구현되어 있으나 실제 macOS 환경에서 설치·연결·MCP 호출을 검증하지 않았습니다. Node 이식성만으로 검증된 것으로 간주하지 않습니다.

CLI는 Codex·OpenCode·Claude Code 설치 여부를 자동으로 확인할 수 있지만, 실제 AI Agent 세션에서 MCP 도구를 호출했는지는 대신 판정하지 않습니다.

패키지 업데이트는 npm registry에서 진행합니다.

```powershell
npm install -g jutell@latest
# 또는
npm update -g jutell
```
