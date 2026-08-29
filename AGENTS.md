# JuTell by Ju0 검증 저장소

- 이 저장소는 JuTell Skill을 검증하는 프로젝트입니다.
- 코드 또는 문서를 변경한 후 JuTell Skill을 사용합니다.
- 보고서 상태 체계는 `docs/BEGINNER_REPORT_SPEC.md`를 기준으로 합니다.
- 테스트 기준은 `docs/TEST_SCENARIOS.md`를 기준으로 합니다.
- 용어 설명은 `docs/GLOSSARY_POLICY.md`를 기준으로 합니다.
- 기존 사용자 변경을 임의로 되돌리지 않습니다.
- 확인하지 않은 결과를 사실처럼 보고하지 않습니다.
- 실제 테스트 전에는 V0.1 통과를 선언하지 않습니다.
- 비밀정보를 출력하는 명령을 실행하지 않습니다.
- 실제 시나리오 실행은 사용자가 별도로 요청할 때만 진행합니다.
- 현재 단계는 중앙 서버가 없는 개인 로컬 베타 준비이며, `apps/local-admin/`은 로컬 설정·피드백 관리만 제공합니다.
- 개인 베타 피드백 없이 Feature를 늘리거나 제품 범위를 넓히지 않습니다.
- 새 Feature는 실제 사용에서 확인된 문제와 연결해 제안합니다.
- 로컬 관리자 기능은 설정과 사용자가 직접 작성한 기록에 한정합니다.
- 프로젝트 코드와 Prompt를 수집하거나 외부로 전송하지 않습니다.

<!-- BEGIN JUTELL MANAGED BLOCK -->
## JuTell

- 코드 또는 문서 변경 후 `.agents/skills/beginner-bridge/SKILL.md`와 `.jutell.json`을 먼저 읽습니다. 소유자 대상 구현/보고 전에는 JuTell 보고 규칙을 먼저 적용해 최종 답변을 작성합니다.
- JuTell MCP가 보이면 canonical `jutell` 서버를 사용합니다. `jutell`과 legacy `beginner_bridge`가 모두 보이면 `jutell`을 우선하고 `beginner_bridge`는 호환용으로만 사용합니다.
- 확인하지 않은 결과를 사실처럼 표현하지 않습니다.
- 비밀정보를 명령 출력이나 보고서에 포함하지 않습니다.
- 외부 전송 없이 현재 프로젝트의 로컬 설정을 기준으로 작업합니다.
<!-- END JUTELL MANAGED BLOCK -->
