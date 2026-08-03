# 내부 MCP ID 마이그레이션 계획 (MIGRATION_INTERNAL_IDS)

상태: 계획만 기록한 문서입니다. 실제 이름 변경은 아직 적용하지 않습니다.

## 배경

JuTell이 Provider 설정에 등록하는 MCP 항목의 내부 ID는 `beginner_bridge`입니다.
이 ID는 `beginner-bridge` 시절 명령 이름에서 시작됐으며, 현재는 표시 이름이 JuTell로 바뀌었습니다.
사용자에게 보이는 화면과 명령은 JuTell 이름을 사용하지만, 설정 파일 안의 내부 ID는 그대로입니다.

## 현재 사용처 (조사 결과)

- `packages/cli/src/installer/opencode.ts` — `OPENCODE_MCP_KEY = 'beginner_bridge'` (opencode.json)
- `packages/cli/src/config/managed.ts` — Codex TOML 관리 블록 `[mcp_servers.beginner_bridge]`
- `apps/local-admin/server/mcp/config.ts` — Dashboard의 Codex/OpenCode 등록 로직
- `packages/cli/tests/cli.test.ts` — 회귀 테스트에서 ID 사용
- `docs/TELEMETRY_EVENTS.md` — `beginner_bridge_version` 필드명

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
