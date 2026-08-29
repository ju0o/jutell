# OpenCode Provider 연결 기준

이 문서는 JuTell을 OpenCode(두 번째 실제 AI Agent Provider)에 연결할 때 사용하는 공식 기준입니다.
모든 내용은 OpenCode 공식 문서와 공식 저장소 소스 코드만 근거로 합니다. 추측으로 구현한 설정은 없습니다.

## 1. OpenCode, DeepSeek, JuTell의 구분

| 이름 | 역할 | JuTell이 다루는 범위 |
|---|---|---|
| OpenCode | AI Agent Provider (CLI/TUI/데스크톱 실행 환경) | Provider 감지, 설정 파일, MCP 등록 대상 |
| DeepSeek | OpenCode에서 사용하는 모델 (provider ID `deepseek`의 모델) | 모델 API 키나 비밀 값은 읽거나 저장하지 않음 |
| JuTell | Agent 작업을 설명·검증·운영하는 레이어 | Skill, AGENTS.md, 설정 파일, MCP 관리 |

OpenCode의 Provider(실행 환경)와 DeepSeek(모델)은 별개입니다. JuTell은 Provider 설정을 관리하지만,
모델 인증 정보(`provider.*.options.apiKey`, 환경변수 등)는 읽거나 저장하지 않습니다.

## 2. 공식 근거

- 설정: https://opencode.ai/docs/config/
- MCP 서버: https://opencode.ai/docs/mcp-servers/
- 규칙 파일: https://opencode.ai/docs/rules/
- Windows: https://opencode.ai/docs/windows-wsl/
- 설정 스키마: https://opencode.ai/config.json
- 소스 코드: `packages/opencode/src/config/config.ts` (공식 저장소 `anomalyco/opencode`)

조사 일자: 2026-08-03

## 3. Windows 설정 파일 위치

OpenCode 공식 문서에 따르면 설정 파일은 JSON 또는 JSONC(주석 허용) 형식입니다.

| 구분 | 경로 | 비고 |
|---|---|---|
| 전역 설정 | `~/.config/opencode/opencode.json` | 문서의 정식 경로. `~`는 사용자 홈(`C:\Users\<사용자>`) |
| 전역 설정(JSONC) | `~/.config/opencode/opencode.jsonc` | 소스 코드에서 `opencode.jsonc`도 로드 |
| 프로젝트 설정 | `<프로젝트 루트>/opencode.json` | 프로젝트 설정 파일 |
| 프로젝트 설정(JSONC) | `<프로젝트 루트>/opencode.jsonc` | 소스 코드에서 `opencode.jsonc`도 로드 |

소스 코드(`globalConfigFile`)는 `~/.config/opencode/`에서 `opencode.jsonc`, `opencode.json`, `config.json` 순서로 후보를 만들고
기존 파일을 우선해 읽습니다. 프로젝트는 저장소 루트까지 `opencode.jsonc`, `opencode.json`을 위로 탐색합니다.

Windows 공식 문서는 WSL 사용을 권장하며, WSL 환경에서는 설정과 세션 데이터가 `~/.local/share/opencode/`에 저장됩니다.
실제 검증은 현재 Windows 환경(데스크톱 앱)에서 수행합니다.

이 저장소(2026-08-03 기준)의 전역 설정은 `<사용자 홈>\.config\opencode\opencode.jsonc`에 있습니다.

## 4. 프로젝트 설정과 전역 설정

공식 문서의 핵심 규칙은 **설정 파일은 병합(merge)된다**입니다. "Configuration files are merged together, not replaced."

우선순위(나중이 먼저를 덮음, 공식 문서 그대로):

1. Remote config (`.well-known/opencode`)
2. 전역 설정 (`~/.config/opencode/opencode.json`)
3. 사용자 지정 (`OPENCODE_CONFIG` 환경변수)
4. 프로젝트 설정 (프로젝트 루트 `opencode.json`)
5. `.opencode` 디렉터리
6. 인라인 설정 (`OPENCODE_CONFIG_CONTENT`)
7. 관리 설정 (엔터프라이즈)

즉, 프로젝트 설정이 충돌하는 키만 전역 설정을 덮고, 나머지 키는 모두 보존됩니다.
JuTell은 전역 설정을 건드리지 않고, 프로젝트 `opencode.json`의 JuTell 관리 부분만 변경해 이 병합 규칙을 그대로 이용합니다.

## 5. 로컬 stdio MCP 서버 등록 형식

공식 MCP 문서의 로컬(stdin/stdout stdio) 서버 형식입니다.

```jsonc
{
  "mcp": {
    "이름": {
      "type": "local",
      "command": ["npx", "-y", "서버-실행-명령"],
      "enabled": true,
      "cwd": ".",
      "environment": { "환경변수": "값" }
    }
  }
}
```

공식 스키마(`McpLocalConfig`)의 필드:

| 필드 | 필수 | 설명 |
|---|---|---|
| `type` | 예 | `"local"`이어야 함 |
| `command` | 예 | 명령과 인자를 담은 문자열 배열 (stdio 서버 시작) |
| `cwd` | 아니오 | 서버 프로세스 작업 디렉터리. 상대 경로는 작업 디렉터리(cwd) 기준 |
| `environment` | 아니오 | 서버 실행 시 설정할 환경변수 객체 |
| `enabled` | 아니오 | 시작 시 활성화 여부 |
| `timeout` | 아니오 | MCP 요청 타임아웃(ms), 기본 5000 |

`command` 배열이 로컬 stdio 서버의 실행 방법입니다. JuTell의 MCP 서버(`node <MCP 서버 index.js>`)도
이 형식의 `command: ["node", "<절대 경로>"]`로 등록합니다.

스키마 루트에 `"allowComments": true`, `"allowTrailingCommas": true`가 있어 JSONC 주석이 공식 지원됩니다.

## 6. 프로젝트 지침 파일 또는 규칙 파일

공식 Rules 문서에 따르면 OpenCode는 프로젝트 루트의 `AGENTS.md`를 자동으로 읽습니다.

- 프로젝트 규칙: 프로젝트 루트 `AGENTS.md` (Cursor의 rules와 유사)
- 전역 규칙: `~/.config/opencode/AGENTS.md`
- Claude Code 호환 대체: `CLAUDE.md` (AGENTS.md가 없을 때만 사용)
- 추가 지침: `opencode.json`의 `instructions` 배열로 추가 파일/패턴 지정 가능

JuTell이 이미 관리하는 `AGENTS.md`는 OpenCode에서도 동일하게 읽히므로, Provider 전용 규칙 파일이 따로 필요하지 않습니다.
JuTell Skill(`.agents/skills/beginner-bridge/SKILL.md`)은 OpenCode의 Skill 경로 규칙과 독립적으로,
AGENTS.md 지침이 에이전트로 하여금 읽도록 안내하는 방식입니다.

## 7. 기존 설정을 보존하는 방법

- 공식 문서: 설정 파일은 병합되며, 프로젝트 설정은 충돌 키만 덮습니다. 비충돌 키는 모두 보존됩니다.
- JuTell 적용 규칙: 전역 설정 파일을 수정하지 않습니다. 프로젝트 `opencode.json`(또는 기존 `.jsonc`)의
  `mcp.beginner_bridge` 키만 추가·갱신·제거합니다.
- 같은 이름(`beginner_bridge`)의 관리되지 않는 MCP 항목이 이미 있으면 자동 변경하지 않습니다.
- 변경 전에는 기존 파일을 `.previous`로 백업합니다.
- 파일 형식을 읽지 못하면 자동 변경하지 않습니다.

## 8. MCP 활성화·비활성화 방식

공식 MCP 문서에 따르면 두 가지 방법이 있습니다.

1. MCP 항목의 `enabled` 값을 `true`/`false`로 전환
   ```jsonc
   { "mcp": { "beginner_bridge": { "type": "local", "command": ["node", "..."], "enabled": false } } }
   ```
2. `tools` 키로 전역 끄기 (서버 이름 `*` glob)
   ```jsonc
   { "tools": { "beginner_bridge_*": false } }
   ```

JuTell은 항목 자체는 유지하고 `enabled` 값만 전환하는 방식(1)을 사용해, 껐다 켜도 설정이 남도록 합니다.
이는 Codex의 `enabled = true/false` 방식과 같은 개념입니다.

## 9. JuTell 구현 요약

- 감지: `opencode --version` 실행 성공 여부 (best-effort). 명령을 찾지 못하면 화면에는 `직접 확인 필요`로 표시합니다.
- 설정 백업: 변경 전 `opencode.json` → `opencode.json.previous`
- 관리 블록: `mcp.beginner_bridge` 항목을 마커 주석으로 감싸 식별
- 반복 설치: 마커가 있으면 교체만 수행해 중복을 만들지 않음
- 제거: JuTell 관리 블록만 제거하고 다른 키는 보존
- 활성화/비활성화: `enabled` 값만 전환
- 모델 정보: OpenCode 설정에서 안전하게 확인 가능할 때만 표시. DeepSeek API Key 등 비밀 값은 읽지 않음

## 10. 명령

```powershell
jutell use opencode        # 백업·등록·활성화·Skill·AGENTS.md를 한 번에 준비
jutell use codex           # Codex 연결 활성화 (기존 OpenCode 연결 유지)
jutell provider            # Agent 연결 상태 요약
jutell connect opencode    # 다른 연결을 유지한 채 추가 연결
jutell disconnect opencode # 선택한 Agent 연결만 비활성화
jutell switch opencode     # 선택한 Agent만 활성화, 다른 연결 비활성화
```

고급 명령(그대로 유지):

```powershell
jutell provider list
jutell provider status
jutell provider setup opencode
jutell provider enable opencode
jutell provider disable opencode
```

Claude Code는 `jutell use claude`로 연결합니다 (베타, `claude mcp add`를 통한 local/user 범위 등록). Cline은 `준비 중`으로 안내만 출력하며 설정을 만들지 않습니다. 기존 `jutell setup`과 Codex 연결은 그대로 유지됩니다.

## 11. 실제 호출 확인

JuTell MCP 서버가 stdio 표준으로 도구를 제공하는지는 로컬 핸드셰이크로 직접 검증했습니다 (2026-08-03).

- `initialize` 응답: `JuTell 0.2.1`
- `tools/list`: `get_active_features`, `get_beginner_report_rules`, `get_bridge_status`, `get_report_preferences`, `get_safe_report_requirements` 5개
- `tools/call get_bridge_status`: 설정 조회 성공 (profile, activeFeatures, 외부 전송 없음 확인)

### 상태 읽는 법 (Provider별)

CLI·관리자 화면은 OpenCode MCP 연결을 다음 상태로 구분해 표시합니다. "현재 Agent 세션 적용"은 해당 Agent 세션에서 직접 확인해야 하므로 항상 `직접 확인 필요`로 남깁니다.

| 상태 | 의미 |
|---|---|
| OpenCode MCP: 미등록 | 프로젝트 `opencode.json`에 `mcp.beginner_bridge` JuTell 관리 항목이 없습니다. |
| OpenCode MCP: 등록됨 | 관리 항목은 있지만 `enabled`가 꺼져 있습니다. |
| OpenCode MCP: 활성화됨 | 관리 항목과 활성 상태가 확인됐습니다 (새 세션 자동 시작 켜짐). |
| OpenCode MCP: 충돌 | 같은 이름의 관리되지 않는 항목이 있어 자동 변경하지 않았습니다. |
| 실제 도구 호출 (MCP 서버 응답) | 서버가 도구를 제공하는지 로컬 핸드셰이크로 확인한 별도 상태입니다. |

현재 검증 환경에는 OpenCode CLI가 PATH에 없어, OpenCode 앱 세션에서 실제로 JuTell 도구를 호출하는 단계는 운영자가 직접 확인해야 합니다. 확인 방법:

1. `jutell use opencode` 실행. 프로젝트 루트 `opencode.json`에 `mcp.beginner_bridge` 항목과 `// BEGIN JUTELL MANAGED BLOCK` 마커가 있는지 확인.
2. OpenCode 앱에서 새 세션을 시작하고 다음 문구를 전달합니다.

```text
JuTell MCP 연결 상태를 확인해주세요.
사용 가능한 MCP 도구 목록에서 JuTell 도구를 찾고,
get_bridge_status와 get_active_features를 호출해주세요.
실제 호출 결과를 기준으로 연결 성공 또는 실패를 보고해주세요.
```

3. 결과를 `tests/results/`에 운영자 기록으로 남깁니다. 결과를 확인하기 전에는 V0.1 OpenCode 연결 통과를 선언하지 않습니다.
