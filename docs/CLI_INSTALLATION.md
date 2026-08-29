# JuTell CLI V0.2 설치 안내

## 현재 상태

`jutell` 패키지와 `jutell` 명령을 준비했지만 아직 npm에 publish하지 않았습니다. 이번 버전은 로컬 `npm pack`과 격리된 설치 검증 단계입니다.

공개 후 일반 사용자 흐름은 다음과 같습니다.

```bash
npm install -g jutell
jutell
```

현재 저장소에서 검증할 때는 다음을 사용합니다.

```bash
cd packages/cli
npm install
npm pack
npm install -g ./jutell-0.3.0.tgz
```

## 명령

| 명령 | 역할 |
|---|---|
| `jutell` | 프로젝트 연결을 확인·준비하고 관리자 화면을 엽니다. 최초에는 balanced, Skill, MCP를 기본으로 준비합니다. |
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

Windows 11, macOS, Linux를 기준으로 경로와 실행 파일을 처리합니다. 실제 검증은 현재 Windows 환경에서 수행합니다. CLI는 Codex·OpenCode·Claude Code 설치 여부를 자동으로 확인할 수 있지만, 실제 AI Agent 세션에서 MCP 도구를 호출했는지는 대신 판정하지 않습니다.

업데이트 기능은 V0.1에 포함하지 않습니다. 공개 후 패키지 업데이트에는 다음 명령을 사용할 수 있습니다.

```bash
npm update -g jutell
```
