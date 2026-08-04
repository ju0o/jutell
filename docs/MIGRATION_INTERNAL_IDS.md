# 내부 ID 마이그레이션 계획 (MIGRATION_INTERNAL_IDS)

상태: 계획만 기록한 문서입니다. 실제 내부 ID 이름 변경은 아직 적용하지 않습니다.
사용자 표시명은 이미 JuTell로 통일되어 있으며, 남은 `beginner-bridge` 사용처는 아래 분류와 같습니다.

## 배경

JuTell이 Provider 설정에 등록하는 MCP 항목의 내부 ID는 `beginner_bridge`입니다.
이 ID는 `beginner-bridge` 시절 명령 이름에서 시작됐으며, 현재는 표시 이름이 JuTell로 바뀌었습니다.
사용자에게 보이는 화면과 명령은 JuTell 이름을 사용하지만, 설정 파일 안의 내부 ID는 그대로입니다.

## 사용처 분류

### A. 사용자 표시명 — 이미 JuTell (변경 완료 상태)

- CLI 도움말 제목: `JuTell CLI` — 유지
- CLI 안내 문구: `JuTell 연결을 켭니다` 등 — 유지
- Dashboard 문구 — JuTell 표기
- MCP 서버 표시 이름: `JuTell` (`apps/mcp-server/src/index.ts`)
- Skill 제목: `JuTell by Ju0` (`SKILL.md` 본문)
- README·일반 문서 — JuTell 표기
- 보고서 제목 — JuTell

남은 `beginner-bridge` 표기는 모두 "이전 별칭/호환" 안내이며, 이번 작업에서 더 바꾸지 않습니다.

### B. 공개 파일·폴더 이름 — 마이그레이션 검토 필요

- `.agents/skills/beginner-bridge/` Skill 경로·ID — 기존 설치와 연결 호환성 때문에 유지 중
- `docs/BEGINNER_REPORT_SPEC.md` — 파일명·제목에 `Beginner` 유지
- `.agents/skills/beginner-bridge/references/*.md` — 문서 링크가 참조하는 경로
- `packages/cli/tests/cli.test.ts` fixture 접두어 `beginner-bridge-cli-`
- `apps/local-admin/server/app.test.ts` fixture 접두어 `beginner-bridge-admin-`
- `tests/results/scenario-*/run-001.md` — 과거 실행 기록 (기록 보존)
- `planner/` 문서 — 과거 계획 기록 (기록 보존)

새 설치와 기존 설치가 동시에 깨지지 않는 전환 순서가 확정되면 별도 커밋으로 변경합니다.

### C. 내부 호환 식별자 — 이번 작업에서 변경·삭제 금지

- MCP 관리 키 `beginner_bridge`
  - `packages/cli/src/installer/opencode.ts` — `OPENCODE_MCP_KEY = 'beginner_bridge'` (opencode.json)
  - `packages/cli/src/config/managed.ts` — Codex TOML 관리 블록 `[mcp_servers.beginner_bridge]`
  - `apps/local-admin/server/mcp/config.ts` — Dashboard의 Codex/OpenCode 등록 로직
  - `opencode.json` 실제 예: `"beginner_bridge": { ... }`
- `.beginner-bridge.json` fallback — `packages/cli/src/config/paths.ts` `legacyConfigFile`
- `.beginner-bridge-local/` fallback — `paths.ts` `legacyDataRoot`
- Skill ID `beginner-bridge` — `SKILL.md` frontmatter `name:`
- CLI 별칭 `beginner-bridge` — `packages/cli/package.json` `bin` + `src/compat.ts`
- 임시 파일 접두어 `beginner-bridge-tmp-` — `config/managed.ts`
- `docs/TELEMETRY_EVENTS.md` — `beginner_bridge_version` 필드명
- MCP 도구 이름 접두어 `beginner_bridge_*` — MCP 클라이언트와 설정 키에 연결

## 새 설치 동작

새 설치에서 생성되는 것도 현재는 기존 ID를 그대로 사용합니다.

- CLI·Dashboard가 생성하는 opencode.json MCP 키: `beginner_bridge`
- Codex TOML 관리 블록: `[mcp_servers.beginner_bridge]`
- Skill 경로·ID: `.agents/skills/beginner-bridge/`, `name: beginner-bridge`
- CLI bin: `jutell` (기본) + `beginner-bridge` (호환 별칭)

새 ID(`jutell`)를 새 설치 기본으로 바꾸는 것은 별도 계획으로 남겨둡니다.

## 결정: 즉시 이름 변경하지 않음

이미 `beginner_bridge` ID로 등록된 설정이 있는 사용자(로컬 베타 참가자 포함)에게는,
이름을 바꾸면:

- 기존 등록 항목이 "관리되지 않는 항목"으로 보여 충돌 처리될 수 있음
- Provider 설정에서 중복 MCP 항목이 생길 수 있음
- 자동 삭제는 사용자 설정을 임의로 바꾸는 것이므로 하지 않음

따라서 **내부 ID 이름 변경은 다음 조건이 충족될 때만** 수행합니다.

## 적용 조건

1. 중앙 서버가 없어도 사용자를 식별할 수 있는 공식 전환 명령(예: `jutell migrate --mcp-id`)을 먼저 설계하고 검증 테스트를 통과한 경우
2. 전환 명령이 기존 `beginner_bridge` 항목을 백업 후 읽고, 새 ID 항목으로 교체하며, 충돌 시 아무것도 바꾸지 않는 경우
3. Dashboard와 CLI가 새 ID를 기본으로 사용하고 기존 ID를 호환 별칭으로 인식하는 경우
4. 전체 회귀 테스트가 통과하고 운영자 재시험이 끝난 경우

## 전환 명령 설계안 (미구현)

- 새 ID: `jutell` (표시 이름과 동일)
- `jutell migrate --mcp-id` 실행 시:
  - Codex TOML: 관리 블록 안 `[mcp_servers.beginner_bridge]` → `[mcp_servers.jutell]` 교체
  - opencode.json: 관리 블록 안 `"beginner_bridge"` 키 → `"jutell"` 키 교체
  - `.previous` 백업 파일을 먼저 생성
  - 관리되지 않는 항목이 있으면 중단하고 아무것도 바꾸지 않음
- Dashboard의 읽기 로직: 새 ID와 기존 ID를 모두 인식해 상태를 표시
- 자동 삭제 없음: 전환 후에도 기존 ID가 남아 있으면 충돌로 표시만 함

## 제약

- 사용자가 직접 작성한 설정 변경을 되돌리지 않습니다.
- 이름 변경은 실제 사용에서 확인된 문제(예: 다른 도구와의 ID 충돌, 혼동 보고)가 있어야 시작합니다.
- 현재 단계에서는 개인 로컬 베타 준비이므로, 전환 명령 없이는 ID를 바꾸지 않습니다.

## 제거 가능 버전

- `beginner-bridge` CLI 별칭: 기존 설치가 전환 명령으로 새 bin을 사용한 뒤, 별칭 사용 보고가 사라진 다음 버전부터 제거 후보.
- `.beginner-bridge.json`·`.beginner-bridge-local/` fallback: 전환 도구가 기존 데이터를 새 경로로 옮긴 뒤, 일정 기간 fallback 사용 기록이 없는 버전부터 제거 후보.
- `beginner_bridge` MCP 키: 전환 명령이 새 ID로 교체한 설치에서만 새 기본 사용. 구식 키만 남은 설치가 없는 시점까지 유지.
- `docs/BEGINNER_REPORT_SPEC.md` 파일명: 문서 제목과 링크를 함께 바꾸는 별도 커밋에서만 변경.

각 제거에는 별도 버전과 실제 설치 검증이 필요합니다.

## 롤백 기준

- 전환 명령 실행 전에 `.previous` 백업이 있고, 전환 기록이 남아 있어야 합니다.
- 전환 후 `jutell status`·`jutell doctor`가 기존 ID와 새 ID를 모두 인식해 상태를 표시해야 합니다.
- 새 ID 전용 설치에서 오류가 나면 백업으로 즉시 복원하고, 기존 ID로 다시 등록한 뒤 새 계획을 세웁니다.
- 자동 삭제는 하지 않습니다. 복원은 백업 파일을 다시 적용하는 방식만 사용합니다.
