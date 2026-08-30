# JuTell 브랜드 전환 안내

## 이름 대응표

| 이전 | 새 표기 | 처리 |
|---|---|---|
| Codex Beginner Bridge | JuTell by Ju0 | 대표 화면·문서에서 교체 |
| `beginner-bridge` CLI | `jutell` | 새 기본 명령 추가, 이전 명령은 호환 별칭 |
| `codex-beginner` 패키지 | `jutell` | `0.2.0`으로 패키지 준비. 2026-08-03 `npm view jutell`에서 기존 공개 패키지가 없음을 확인했으며, 이후 V1.5에서 `jutell@0.3.0`으로 npm에 공개됨 (`npm install -g jutell`) |
| `.beginner-bridge.json` | `.jutell.json` | 새 파일 우선, 기존 파일 fallback |
| `.beginner-bridge-local/` | `.jutell-local/` | 새 폴더 우선, 기존 기록 보존 |
| Skill ID·경로 | `beginner-bridge` 유지 | 설치와 Codex 연결 호환성 때문 |
| MCP 도구 ID | 기존 5개 ID 유지 | 표시 이름만 JuTell로 변경 |

## 기존 설치를 보존하는 순서

1. `jutell status`로 현재 설치와 기존 설정을 확인합니다.
2. `.jutell.json`이 있으면 사용하고, 없으면 `.beginner-bridge.json`을 읽습니다.
3. `jutell setup`을 사용자가 승인하면 새 설정을 만들고 기존 파일은 삭제하지 않습니다.
4. 기존 로컬 기록이 있으면 새 기록 폴더로 자동 삭제·덮어쓰기하지 않고 읽을 수 있는 기록을 보존합니다.
5. 새 Codex 세션에서 Skill과 설정을 직접 읽었는지 확인합니다.

## 자동 이전과 사용자 확인

자동으로 새 설정을 우선 읽고, 설치 명령이 명시적으로 승인된 경우에만 `.jutell.json`을 만들 수 있습니다. 기존 설정, Beta Journal, Codex의 다른 MCP 설정은 삭제하지 않습니다.

사용자는 새 설정과 기존 설정이 둘 다 있을 때 `.jutell.json`이 우선된다는 점, Skill ID는 호환성을 위해 이전 이름을 유지한다는 점을 확인해야 합니다.

## 롤백

문제가 생기면 새 `.jutell.json`을 별도 보관하고 기존 `.beginner-bridge.json`을 유지한 상태로 이전 CLI 별칭을 사용할 수 있습니다. Codex 설정은 변경 전 `.previous` 백업을 사용합니다. 자동 삭제나 Git 이력 재작성은 하지 않습니다.

## 문자열 분류

- 새 JuTell로 변경: README, 공식 문서 제목, CLI 출력, 관리자 화면, MCP 표시 설명
- 호환성으로 유지: Skill 경로·ID, MCP 도구 ID, 이전 CLI 명령
- 마이그레이션 설명에만 유지: 이전 제품명, 이전 설정·로컬 폴더 이름
- 내부·역사 기록으로 유지: 기존 테스트 결과와 과거 리뷰 기록의 사실 보존
- 추후 제거 후보: `beginner-bridge` 별칭과 legacy 설정 경로. 제거 시점은 정하지 않음

`jutell@0.3.0`은 npm에 공개되었습니다 (`npm install -g jutell`). GitHub 저장소 이름 변경, 호환 별칭 제거 시점은 별도 운영자 결정입니다.
