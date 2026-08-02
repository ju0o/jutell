# Distribution CLI V0.1 설치 안내

## 현재 상태

`codex-beginner` 패키지와 `beginner-bridge` 명령을 준비했지만 아직 npm에 publish하지 않았습니다. 이번 버전은 로컬 `npm pack`과 격리된 설치 검증 단계입니다.

공개 후 목표 흐름은 다음과 같습니다.

```bash
npm install -g codex-beginner
beginner-bridge setup
beginner-bridge
```

현재 저장소에서 검증할 때는 다음을 사용합니다.

```bash
cd packages/cli
npm install
npm pack
npm install -g ./codex-beginner-0.1.0.tgz
```

## 명령

| 명령 | 역할 |
|---|---|
| `beginner-bridge` | 로컬 관리자 화면을 실행하고 가능한 경우 브라우저를 엽니다. |
| `beginner-bridge setup` | Skill, 기본 설정, MCP 연결 설정을 안전하게 준비합니다. |
| `beginner-bridge dashboard` | 127.0.0.1의 임시 포트에서 관리자 화면을 실행합니다. |
| `beginner-bridge status` | 설치·Profile·Feature·MCP·Telemetry 상태를 보여줍니다. |
| `beginner-bridge enable` | Skill과 MCP를 다시 활성화합니다. |
| `beginner-bridge disable` | 기본적으로 MCP 연결만 끄고 Skill과 데이터를 보존합니다. |
| `beginner-bridge doctor` | 설치 파일, 설정, 권한과 외부 전송 여부를 점검합니다. |
| `beginner-bridge uninstall` | Skill과 Beginner Bridge MCP 관리 블록을 제거합니다. 기본적으로 데이터는 보존합니다. |

`--project`는 현재 프로젝트, `--global`은 격리된 사용자 전역 범위를 뜻합니다. `setup` 기본 범위는 현재 프로젝트입니다.

## 설치 안전성

- 기존 Codex 설정 파일을 변경하기 전에 `.previous` 백업을 만듭니다.
- 다른 MCP 서버 설정은 보존합니다.
- Beginner Bridge 관리 블록만 추가·갱신·제거합니다.
- 같은 이름의 관리되지 않는 MCP 설정이 있으면 자동 변경하지 않습니다.
- 이미 같은 Skill 파일이 있으면 중복으로 만들지 않습니다.
- 다른 내용의 기존 Skill 파일은 덮어쓰지 않고 주의로 알립니다.
- 설치 중 오류가 발생하면 이번 설치에서 바꾼 설정을 이전 상태로 복원합니다.
- `uninstall`은 기본적으로 설정과 Beta Journal을 보존합니다. `--remove-data`를 함께 사용할 때만 해당 로컬 데이터를 제거합니다.
- `dashboard`는 운영체제 시작 프로그램이나 영구 서비스로 등록하지 않습니다.

중요한 변경 전에는 미리보기를 보여주며, 자동 실행 환경에서는 `--yes`를 사용할 수 있습니다.

## 상태와 개인정보

`status`의 기본 출력은 비개발자가 읽기 쉬운 요약이며 전체 절대 경로와 비밀 값을 표시하지 않습니다. `--json`은 자동 점검용 구조화 결과입니다.

Telemetry는 비활성화되어 있고, CLI는 프로젝트 코드·Prompt·AI 답변·Git diff·API Key·환경변수·사용자 식별 정보를 수집하거나 외부로 보내지 않습니다. MCP는 선택 기능이며 Skill fallback은 유지됩니다.

## 지원 범위와 제한

Windows 11, macOS, Linux를 기준으로 경로와 실행 파일을 처리합니다. 실제 검증은 현재 Windows 환경에서 수행합니다. CLI는 현재 Codex 설치 여부를 자동으로 확인할 수 있지만, 실제 Codex 세션에서 MCP 도구를 호출했는지는 대신 판정하지 않습니다.

업데이트 기능은 V0.1에 포함하지 않습니다. 공개 후 패키지 업데이트에는 다음 명령을 사용할 수 있습니다.

```bash
npm update -g codex-beginner
```
