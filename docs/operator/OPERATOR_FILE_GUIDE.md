# 운영자 파일 가이드 (Operator File Guide)

운영자가 자주 만지는 항목을 한눈에 보는 표입니다. **목적**을 먼저 정하고 이 표에서 해당 위치를 찾습니다.

기호 설명: 🔒 공개 금지 · 📝 문서 · ⚙️ 코드 (코드 검토 필요)

| # | 목적 | 수정 파일 또는 화면 | 공개 여부 | 작성 예시 | 주의사항 |
|---|---|---|---|---|---|
| 1 | 보고 방식 조절 (Profile·Feature·limits) | Dashboard 설정 화면 | 로컬 | `balanced` 사용, `detailed` 비교 | 화면에서 저장해야 `.jutell.json`이 검증을 거침. `.jutell.json` 직접 수정은 최후 수단 |
| 2 | 하루 협업·베타 기록 작성 | 오늘 Session 폴더: `.jutell-local/collaboration-sessions/YYYY-MM-DD/` | 로컬 | `jutell session new` → `session page`(Page 파일) → `session work` → `session move` → `session finish` | 하루 Session은 하나. Page·작업은 명령으로 추가. 프롬프트·답변 원문은 직접 붙여 넣을 때만. 비밀정보·경로·오류 원문 금지 |
| 3 | 사용량 실험 기록·조회 | Dashboard 사용량 화면 | 로컬 | 실험 목록, 평균 길이, 가장 OFF된 Feature | 실험은 로컬 카운터가 켜졌을 때만 쌓임 (기본 OFF) |
| 4 | 말투·표현 기록 | Dashboard Style Lab 화면 | 로컬 | "요약이 너무 건조하다" | 스타일은 아직 선택형 적용 준비 단계. 원문 저장 안 함 |
| 5 | 요청 템플릿 만들기 | Dashboard 요청 만들기 (Request Builder) | 로컬 | "이 파일의 변경 요약을 부탁해" | 템플릿은 사용자 → AI Agent 방향. V1만 현재 지원 |
| 6 | 공개 철학·정책 정리 | `docs/foundation/` 📝 | 공개 | [ARCHITECTURE.md](../foundation/ARCHITECTURE.md) 참고 | 완성된 문장으로만 작성. 작업 메모 금지. 수익화 상세 금지 |
| 7 | 운영자 안내 문서 | `docs/operator/` 📝 | 공개 (운영자 구역) | 이 문서가 예시 | 일반 사용자 문서와 구역을 분리해서 배치 |
| 8 | 일반 사용자 문서 | `docs/` (root) 📝 | 공개 | [START_HERE.md](../START_HERE.md) | 설치·사용법만. 운영자 절차는 `docs/operator/`로 |
| 9 | 공개 저장소 안전 검사 | `scripts/check-public-repository.mjs` ⚙️ | 공개 | 실행: `npm run check:public` | 위반 탐지·자동 삭제 없음. 예외 추가는 이유를 함께 적음 |
| 10 | 외부 검토 번들 만들기 | `scripts/create-review-bundle.mjs` ⚙️ | 공개 | 실행: `npm run bundle:review` | 생성 전 공개 검사를 먼저 실행함 |
| 11 | 프로젝트 규칙 | `AGENTS.md` 📝 | 공개 | 이 저장소 AGENTS.md | 함부로 확장하지 않음. 실제 사용에서 확인된 문제와만 연결 |
| 12 | Skill (보고 지침) | `.agents/skills/` ⚙️ | 공개 | `beginner-bridge` Skill | Skill은 JuTell 핵심 경로. 변경은 신중히, 테스트 후 반영 |
| 13 | 로컬 관리자 화면 | `apps/local-admin/` ⚙️ | 공개 | 설정·기록 관리 화면 | 코드 변경은 코드 검토 필요. 로컬 전용 기능만 추가 |
| 14 | CLI | `packages/cli/` ⚙️ | 공개 | `jutell status`, `jutell on/off` | 설치·상태·진단·제거 명령. 공개 범위 확인 필요 |
| 15 | MCP 서버 | `apps/mcp-server/` ⚙️ | 공개 | 읽기 전용 MCP 도구 | 인증·API Key·외부 전송·원문 저장 금지 |
| 16 | 테스트 기준 | `docs/TEST_SCENARIOS.md` 📝 | 공개 | 시나리오 C1~ | 실제 실행 결과만 사실로 보고 |
| 17 | 새 기능 아이디어 | `jutell-private/product/EXPERIMENT_BACKLOG.md` 🔒 | 비공개 | "텍스트 음성 읽기가 있으면?" | 공개 문서에 아이디어 원문 복사 금지 |
| 18 | 내부 결정 기록 | `jutell-private/operations/INTERNAL_DECISIONS.md` 🔒 | 비공개 | "요청 만들기는 V1만 제공" | 공개 문서에는 일반 원칙만 |
| 19 | 사용량 원본 | `.jutell-local/usage-counters.json` 🔒 | 로컬 | — | Dashboard에서 조회·삭제. 직접 편집 금지 |

## 직접 수정하면 안 되는 것

- `.jutell-local/`, `.beginner-bridge-local/` 안의 데이터 파일
- `.env` 류 비밀값 파일
- `node_modules/`, `dist/`, `build/`, `coverage/`
- `artifacts/` (생성물 폴더, 커밋하지 않음)
- git 추적된 코드 중 검토받지 않은 파일 (위 표의 ⚙️ 항목)

## 항목을 바꾸기 전에

1. 목적이 이 표에 있는지 확인합니다. 없으면 새 항목이 아니라 기존 항목의 확장인지 봅니다.
2. 공개 여부를 확인합니다. 비공개 내용이면 공개 위치에 옮기지 않습니다.
3. 코드(⚙️)면 운영자 문서만으로 결정하지 않고 검토가 필요하다고 표시합니다.
4. 작업 후에는 일일 체크리스트의 종료 전 단계를 실행합니다.
