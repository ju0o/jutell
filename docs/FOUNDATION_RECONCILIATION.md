# Foundation 정합성 검토 (FOUNDATION_RECONCILIATION)

`docs/foundation/` 문서를 최상위 의사결정 기준으로 삼아 현재 구현을 검토한 기록이다.
기준 문서: VISION, PRODUCT_PHILOSOPHY, NON_GOALS, ARCHITECTURE, DESIGN_PRINCIPLES, CLOUD_PHILOSOPHY, PRODUCT_BOUNDARY, BUSINESS_MODEL.

## 일치한 부분

| Foundation 원칙 | 현재 구현 |
|---|---|
| Agent를 대체·실행하지 않는 Harness | CLI·Dashboard·MCP 어디에도 Agent를 실행하는 코드 없음. MCP는 설정·보고 규칙 조회만 제공 |
| MCP는 읽기 전용·외부 네트워크 차단 | `apps/mcp-server` 서버 지침에 코드·Diff·Prompt·비밀·외부 네트워크 접근 금지 명시 |
| API Key·Agent 인증 미취급 | 코드에 인증·키 저장 로직 없음 |
| Dashboard는 필수가 아닌 설정 도구 | Dashboard는 `jutell dashboard`로만 실행되는 선택형. Core·Skill 방식은 독립 동작 |
| Core는 오프라인·Cloud 불필요 | 중앙 서버·계정·결제·원격 Telemetry 미구현. 모든 기능 로컬 |
| Telemetry 기본 OFF·명시적 동의 | TELEMETRY_POLICY 문서만 존재, 수집·전송 코드 없음 |
| Cloud는 선택형 미래 기능 | 코드에 Cloud 기능 없음. 문서에서만 미래 방향으로 표시 |
| Provider는 연결 대상이지 소유 대상이 아님 | `use`·`connect`·`disconnect`·`switch`가 설정 파일의 관리 블록만 변경, Provider 프로세스·구독을 건드리지 않음 |

## 충돌한 부분과 수정

| 충돌 | 수정 여부 | 조치 |
|---|---|---|
| `docs/PRODUCT_BOUNDARY.md`가 빈 파일 | 수정 | Core·Connector·Dashboard·Cloud·Ju0Symphony 경계와 Harness 정의 작성 |
| `docs/ARCHITECTURE.md` 역할 미기재 | 수정 | 각 구성 요소 역할 완성 |
| `docs/BUSINESS_MODEL.md` 초안 지시문 포함 | 수정 | 공개 원칙 5개만 남기는 공개본으로 재작성 |
| README에 JuTell 공식 정의(한 문장)·"Agent를 대체하지 않음"이 빠져 있음 | 수정 | README 진입 구조에 공식 정의 반영 |
| Dashboard 개요의 "현재 사용 Provider"가 정적(Codex 고정) | 수정 | 활성 Provider를 실제 상태에서 계산 |
| `docs/PROVIDER_OPENCODE.md`에 운영자 절대 경로 포함 | 수정 | 사용자 홈 placeholder로 교체 |
| CLI 도움말에 `use`의 의미가 명시되지 않음 | 수정 | "연결만 준비하고 Agent를 대신 실행하지 않음" 안내 추가 |
| `planner/Phase 8`에 "유료 가격 기능" 언급, `docs/PRODUCT_SCOPE.md`에 "유료 팀 기능" 1건 | 분류 완료 | `planner/Phase 8`은 내부 사업·출시 전략으로 판단해 공개 저장소에서 제거, `PRIVATE_DOCUMENTS_MAP.md`에 `jutell-private/strategy/` 이동 대상으로 기록. `PRODUCT_SCOPE.md`의 "유료 팀 기능"은 공개 수준인 "팀 기능"으로 축약 |

## 수정하지 않은 이유

- `use` 명령 이름 변경: 직전 작업에서 승인·테스트된 명령. 호환을 유지하고 문구로 의미를 명확히 함.

## 이후 작업

- `planner/Phase 8` 내용을 운영자가 `jutell-private/strategy/`로 이동 (공개 저장소에서는 제거됨)
- 공개 베타 전 README 한 문장 정의를 실제 사용자 반응으로 재검증
- Workflow·Task·Phase 지침 기능은 구현 전 이 문서 기준으로 설계
