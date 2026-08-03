# Request Builder — 요청 만들기

## 1. 목적

막연한 요구를 AI Agent가 이해할 수 있는 요청문으로 바꾸는 도구입니다. 실제 파일이나 화면을 직접 조작하는 기능은 V2에서 제공하고, V1은 Markdown 템플릿과 안내만 제공합니다.

- 사용자 표시명: **요청 만들기**
- Feature ID: `requestBuilder` (기존 Feature ID 체계인 camelCase를 따름 — `request-builder`는 표시 규칙에서 사용)
- 템플릿 위치: `templates/request-builder/` (프로젝트 루트) — 배포 시 CLI 자산 `assets/templates/request-builder/`에도 포함

## 2. V1 범위

- 선택형 Markdown 템플릿 7종 + README 1개 (총 8개 파일)
- 프로젝트 경로 원칙: 확인하지 못한 경로를 확정해 적지 않음
- 로컬 관리자에 "요청 만들기" 탭 (템플릿 보기·복사 안내, V2 예정 안내, 기본 OFF 상태 표시)
- 자동 전송, Prompt 수집, 중앙 서버 전송 없음

## 3. 템플릿 목록

| 파일 | 용도 |
|---|---|
| `DESIGN_REQUEST.md` | 화면 모양이나 분위기 변경 |
| `FEATURE_REQUEST.md` | 새 기능·화면 추가 |
| `BUG_REPORT_REQUEST.md` | 문제(버그) 신고 |
| `PROJECT_PLANNING_REQUEST.md` | 프로젝트 계획 |
| `CODE_REVIEW_REQUEST.md` | 작업 검토 |
| `NEXT_AGENT_HANDOFF.md` | 다음 Agent에게 작업 전달 |
| `MANUAL_EDIT_GUIDE.md` | 사용자 직접 수정 안내 |
| `README.md` | 사용법과 공통 선택지 설명 |

## 4. 공통 흐름 (8단계)

모든 템플릿은 다음 8단계를 공통으로 포함합니다.

1. 지금 만들고 있는 것
2. 무엇이 불편한가 (문제)
3. 원하는 결과
4. 반드시 유지할 부분
5. 바꾸면 안 되는 부분
6. 사용자가 직접 확인할 부분
7. AI가 먼저 확인할 질문
8. 최종 요청문 (복사용)

## 5. 공통 선택지

모든 템플릿에서 다음 선택지를 사용할 수 있습니다. AI는 선택지를 이해하고 보고서나 요청문에서 각 항목의 뜻을 알려줄 수 있어야 합니다.

- **잘 모르겠음** — 해당 항목을 모르며 AI의 도움을 원함
- **정확히 무엇이 문제인지 모르겠음** — 문제는 느끼지만 원인을 특정하지 못함
- **현재 상태 유지** — 이 부분은 지금 그대로 둠
- **요청하지 않음** — 이 항목은 다루지 않음
- **AI가 먼저 확인 후 제안** — 추측하지 말고 확인 후 선택지를 제안

## 6. 프로젝트 경로 안내 원칙

템플릿은 프로젝트의 실제 경로, 파일명, 실행 명령을 **사용자가 직접 확인하거나 AI가 확인하기 전에는 확정해 적지 않습니다.** "확인 필요"로 남겨 두고, AI가 프로젝트를 먼저 확인한 뒤 안내하도록 유도합니다. 이 원칙은 `MANUAL_EDIT_GUIDE.md`와 `CODE_REVIEW_REQUEST.md`에서 특히 중요합니다.

## 7. Feature 기본값 근거

4개 도우미 Feature(`nextActionSuggestions`, `requestClarificationGuide`, `manualEditGuidance`, `requestBuilder`)는 보고서의 정보 체계(근거 출처·확인 상태·사용자 행동·보고서 상태)를 바꾸지 않는 통신 도우미입니다.

| Feature | minimal | balanced/learning/detailed | 근거 |
|---|---|---|---|
| `nextActionSuggestions` | 끔 | 켬 | 보고서 끝에 최대 3줄이 추가됩니다. minimal은 보고 길이 최소화가 목표라 끕니다. |
| `requestClarificationGuide` | 끔 | 켬 | 작업 전 확인 질문이 추가될 수 있습니다. 최소 보고에서는 생략합니다. |
| `manualEditGuidance` | 끔 | 켬 | 수동 편집 안내 문단이 추가됩니다. 최소 보고에서는 생략합니다. |
| `requestBuilder` | 켬 | 켬 | 보고서와 무관한 템플릿 제공 기능이라 모든 Profile에서 켭니다. |

기존 체계(FEATURE_CONFIGURATION.md §3: 기본값 모두 켬, §4: minimal만 선택 OFF)를 유지했습니다. 안전 강제 보고 예외는 이 도우미 Feature에 추가하지 않습니다(실패·보안·데이터 손실은 기존 `changeSummary`·`userVisibleChanges`·`internalChanges`·`riskAssessment`·`userActions`의 강제 예외와 별도 규칙으로 항상 보고됩니다).

## 8. 하위 호환

이전 버전 설정 파일에는 새 Feature ID가 없습니다. 누락된 ID는 오류로 처리하지 않고 선택한 Profile의 기본값으로 채웁니다. 로컬 관리자 서버 `validateConfig`와 MCP 서버 `normalizeConfig` 모두 이 규칙을 적용합니다. `minimal` Profile 기존 사용자는 도우미 Feature 3개가 기본으로 꺼져 있어 보고 길이에 변화가 없습니다.

## 9. V2 예정 (현재 범위 밖)

- 로컬 관리자 화면에서 템플릿을 선택하고 작성하는 화면
- 민감정보 경고와 저장 방식 안내
- 자동 전송은 설계 대상이 아닙니다 (별도 검토 후 결정)

상세 설계는 `docs/REQUEST_BUILDER_V2.md`를 참조합니다.

## 10. 관련 문서

- `docs/REQUEST_BUILDER_V2.md` — V2 화면 설계
- `docs/USAGE_EFFICIENCY_EXPERIMENTS.md` — 요청 작성 방식 비교 실험
- `docs/FEATURE_CONFIGURATION.md` — Feature 설정 전체 정책
