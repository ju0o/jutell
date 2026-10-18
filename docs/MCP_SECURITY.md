# JuTell MCP 보안 기준

## 기본 원칙

MCP V0.1은 개인 베타용 로컬 읽기 기능입니다. 외부 네트워크나 중앙 서버에 연결하지 않으며, Skill 방식과 분리된 선택 기능입니다.

## 허용되는 읽기

MCP 서버는 프로젝트 루트에서 다음 고정 위치만 읽습니다.

- `.jutell.json`
- `AGENTS.md` 존재 여부
- `.agents/skills/beginner-bridge/SKILL.md` 존재 여부와 필요한 안전 규칙

MCP 입력으로 임의 경로를 받지 않습니다. 서버는 프로젝트 코드, Git diff, Prompt, AI 답변, 파일 경로 목록, 비밀정보를 읽지 않습니다.

## 도구 안전성

- 모든 V0.1 도구는 읽기 전용입니다. 코드·파일을 수정하는 도구는 제공하지 않습니다.
- Codex에 등록할 때는 JuTell 자신의 읽기 전용 도구 5개(get_bridge_status, get_active_features, get_report_preferences, get_beginner_report_rules, get_safe_report_requirements)에만 도구별로 approval_mode = "approve"(묻지 않고 실행)를 적용합니다. 서버 기본값 default_tools_approval_mode = "prompt"와 다른 MCP 서버 설정은 바꾸지 않습니다. 나중에 새 도구가 추가되어도 이 목록에 자동으로 들어가지 않습니다.
- 관리 블록(`# JUTELL_CLI_MCP_BEGIN`~`END`) 안을 직접 고치면 `jutell use` 때 되돌아요. 바꾸려면 블록 밖에 쓰세요. 블록 밖에 직접 둔 도구별 `approval_mode`(예: `"prompt"`)는 JuTell이 바꾸지 않습니다.
- 관리 블록 **안**에 `approval_mode = "prompt"`를 써 두면 `jutell use`/설치 때 `"approve"`로 되돌아갑니다. 계속 묻게 하려면 블록 밖에 쓰세요.
- `jutell uninstall --global`과 `jutell migrate --clean`은 부모 표가 없어진 뒤 남는 하위 표(예: `[mcp_servers.jutell.env]`, `[mcp_servers.beginner_bridge.tools.*]`)를 지우지 않고 `# jutell 제거로 주석 처리됨` 머리줄과 함께 주석으로 바꿉니다. 바꾸기 전 파일은 백업하고, 안내에 실제 백업 경로를 보여 줍니다. 다시 설치해도 자동으로 되살리지 않으니, 다시 쓰려면 그 줄들 맨 앞의 `# `을 지우세요.
- 예외는 로컬 사용량 카운터 기록뿐입니다. `usageMeasurement.localCountersEnabled`가 켜진 경우에만 `.jutell-local/usage-counters.json`에 도구 이름, 호출 수, 응답 문자 수 합계, 시각을 기록하며, 기록 실패는 도구 응답에 영향을 주지 않습니다. 자세한 구조는 `docs/USAGE_EFFICIENCY_EXPERIMENTS.md`를 참조하세요.
- 자동 Commit, Profile 변경, Feedback 전송을 하지 않습니다.
- API Key, 환경변수, Cookie, Token을 요구하거나 출력하지 않습니다.
- 오류에는 절대 경로와 전체 스택을 포함하지 않습니다.
- 도구 입력은 현재 버전에서 빈 입력만 허용합니다.

## Provider 설정 보호

관리자 화면이 연결 설정을 만들 때 다음 순서를 따릅니다.

1. 프로젝트의 `.codex/config.toml`을 읽습니다.
2. 기존 파일이 있으면 `.codex/config.toml.previous`로 백업합니다(쓸 때마다 바로 전 버전으로 바뀝니다). JuTell이 처음 바꿀 때만 `.codex/config.toml.jutell-original`도 만들고, 이 파일은 다시 덮어쓰지 않습니다.
3. JuTell 관리 블록만 추가하거나 갱신합니다.
4. 다른 MCP 서버 설정은 유지합니다.
5. 같은 이름의 관리되지 않는 항목이 있으면 자동 변경하지 않습니다.
6. 제거할 때도 JuTell 관리 블록만 제거합니다.

설정 변경 전 미리보기를 제공하고, 제거는 사용자 확인 후 실행합니다. 실패하면 기존 설정을 유지하는 것을 우선합니다.

## 상태 오해 방지

서버 실행, Provider 설정 등록, 실제 AI Agent 도구 호출은 각각 별도 상태입니다. MCP 서버가 실행 중이어도 AI Agent가 실제 도구를 호출했다고 보고하지 않습니다. 현재 연결 구현은 Codex Provider에 한정되며, OpenCode는 설정 등록 베타 단계입니다.

## 데이터와 Telemetry

MCP는 Prompt, 코드, AI 답변 원문, 프로젝트 식별 정보와 개인정보를 저장하거나 전송하지 않습니다. 원격 Telemetry와 외부 HTTP 요청은 구현하지 않습니다. MCP가 꺼져도 Skill 방식은 계속 사용할 수 있습니다.

로컬 사용량 카운터가 켜진 경우에만 도구 이름·호출 수·응답 문자 수 합계·시각을 `.jutell-local/usage-counters.json`에 기록합니다. Tool arguments, 응답 원문, 파일 경로, 프로젝트 이름, 저장소 URL, API Key, 식별자는 저장하지 않으며, 잘못된 형식의 기존 파일은 덮어쓰지 않고 보존합니다. 기록 실패는 stderr 요약으로만 처리하고 stdout JSON-RPC는 오염시키지 않습니다.
