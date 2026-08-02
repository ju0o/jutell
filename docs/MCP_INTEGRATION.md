# JuTell MCP 연결 안내

## 1. 역할

JuTell은 두 가지 적용 방식을 함께 지원합니다.

| 방식 | 역할 | MCP가 꺼져도 사용 가능한가 |
|---|---|---|
| Skill 방식 | `AGENTS.md`, Skill, `.jutell.json`을 Codex가 읽습니다. | 예 |
| MCP 방식 | 현재 설정과 읽기 전용 보고 규칙을 Codex에 제공합니다. | 선택 기능 |

MCP는 Skill의 대체재가 아닙니다. MCP 서버가 중지되거나 연결되지 않아도 Skill 방식은 계속 사용합니다.

현재 연결 방식은 Codex가 지원하는 로컬 `stdio` 서버와 프로젝트 범위 `.codex/config.toml`입니다. Codex CLI, Codex 앱, Codex IDE 확장은 같은 Codex 호스트 설정을 사용할 수 있지만 새 세션이나 재시작이 필요할 수 있습니다. ChatGPT 웹의 원격 연결은 이 문서의 지원 범위가 아닙니다.

Distribution CLI를 사용하면 Skill과 MCP 자산을 수동 복사하지 않고 설치할 수 있습니다. 현재는 npm에 publish하지 않았으므로 [CLI 설치 안내](CLI_INSTALLATION.md)의 로컬 패키징 절차를 사용합니다.

공식 기준은 [Codex Model Context Protocol 안내](https://learn.chatgpt.com/docs/extend/mcp.md)와 [MCP 서버 설정 안내](https://developers.openai.com/plugins/concepts/mcp-server.md)를 참고합니다.

## 2. 제공 도구

MCP V0.1은 읽기 도구만 제공합니다.

- `get_bridge_status`: 설정·Skill·AGENTS.md 준비 상태, Profile, 활성 Feature 수, 버전, 외부 전송 없음, Telemetry OFF
- `get_active_features`: Feature 한글 이름, ID, 활성 상태, OFF 시 생략되는 정보, 안전상 계속 보고되는 예외
- `get_report_preferences`: Profile, 주요 파일·용어·보고서 길이 단계와 실제 limits 숫자
- `get_beginner_report_rules`: 현재 활성 Feature와 limits에 필요한 짧은 보고 규칙
- `get_safe_report_requirements`: 설정으로 숨길 수 없는 실패·위험·미확인·범위 밖 변경 정보

긴 문서 전체, 프로젝트 코드, Git diff, Prompt, AI 답변 원문은 반환하지 않습니다.

## 3. 처음 연결하기

1. MCP 서버를 빌드합니다.

   ```text
   cd apps/mcp-server
   npm install
   npm run build
   ```

2. 로컬 관리자를 실행합니다.

   ```text
   cd apps/local-admin
   npm install
   npm run dev
   ```

3. 관리자 화면의 `MCP 연결`에서 `MCP 사용`을 켭니다.
4. `연결 설정 미리 보기`로 프로젝트 설정을 확인합니다.
5. `Codex 연결 설정 생성`을 누릅니다.
6. `MCP 서버 시작`을 누릅니다.
7. Codex 새 세션 또는 재시작 후 다음 확인 문구를 전달합니다.

   ```text
   JuTell MCP 연결 상태를 확인해주세요.
   사용 가능한 MCP 도구 목록에서 JuTell 도구를 찾고,
   get_bridge_status와 get_active_features를 호출해주세요.
   실제 호출 결과를 기준으로 연결 성공 또는 실패를 보고해주세요.
   ```

관리자 화면은 서버 실행과 설정 등록을 확인할 수 있지만, 실제 Codex 도구 호출까지 자동으로 확인하지는 않습니다.

## 4. 생성되는 프로젝트 설정

관리자는 기존 `.codex/config.toml`을 먼저 읽고, 다른 설정을 보존한 뒤 JuTell 관리 블록만 추가합니다.

```toml
# BEGINNER_BRIDGE_MCP_BEGIN
[mcp_servers.beginner_bridge]
command = "node"
args = ["apps/mcp-server/dist/index.js"]
cwd = "."
enabled = false
required = false
default_tools_approval_mode = "prompt"
# BEGINNER_BRIDGE_MCP_END
```

관리 블록은 현재 설정의 MCP 사용 여부에 맞춰 `enabled`를 작성합니다. 설정 파일 전체를 덮어쓰지 않으며, 같은 이름의 관리되지 않는 항목이 있으면 자동 변경하지 않습니다.

## 5. 끄기와 제거

- `MCP 서버 중지`: 서버만 중지합니다.
- `MCP 사용 끄기`: MCP 사용 설정을 끄고 Skill 방식은 유지합니다.
- `설정 제거`: 확인 후 JuTell 관리 블록만 제거합니다.

서버를 중지해도 Codex 설정은 유지할 수 있습니다. 설정을 제거하면 새 Codex 세션이나 재시작이 필요할 수 있습니다. 운영체제 시작 시 자동 실행은 V0.1에서 구현하지 않으며 기본값은 항상 OFF입니다.

## 6. 상태 읽는 법

| 상태 | 의미 |
|---|---|
| 서버 실행 상태 | 로컬 MCP 프로세스가 시작됐는지 확인한 상태 |
| Codex 설정 등록 | `.codex/config.toml`에 JuTell 관리 블록이 있는지 확인한 상태 |
| 실제 연결 상태 | Codex 세션에서 도구 목록과 도구 호출을 직접 확인해야 하는 상태 |

서버가 실행 중이라는 이유만으로 실제 연결 완료라고 표시하지 않습니다. 실제 호출이 확인되지 않으면 `Codex 세션에서 직접 확인 필요`로 표시합니다.
