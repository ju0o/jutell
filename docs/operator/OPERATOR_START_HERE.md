# 운영자 시작 가이드 (Operator Start Here)

이 문서는 JuTell을 직접 사용하고 기록하는 운영자(비개발자 사용자)가 **오늘 해야 할 일을 고르는** 첫 문서입니다. 코드를 몰라도 됩니다. 모든 기록은 로컬에만 남고 외부로 전송되지 않습니다.

---

## 1. 오늘 할 일 고르기

아래에서 1~3개만 골라 진행합니다. 한 번에 많은 일을 벌이지 않습니다. 모든 기록은 **오늘 Session 폴더** 안에 **Agent·역할별 Page 파일**로 나누어 남깁니다.

| 순위 | 할 일 | 방법 |
|---|---|---|
| 1 | 오늘 Session 만들기 | `jutell session new` — 오늘 폴더 생성 |
| 2 | Agent·역할별 Page 만들기 | `jutell session page` — Page 파일에 작업 01 자동 생성 |
| 3 | 작은 작업 하나를 JuTell로 실행 | [일일 체크리스트](OPERATOR_DAILY_CHECKLIST.md) 시작 |
| 4 | 현재 Page에 작업 기록 | `jutell session work` — Page마다 번호 독립 |
| 5 | 작업할 Page 바꾸기 | `jutell session move` |
| 6 | 기억나는 불편을 한 건 기록 | 해당 Page의 `### 내 피드백`에 적기 |
| 7 | 하루 마감 | `jutell session finish` — `SESSION_SUMMARY.md` 작성 |
| 8 | 이번 주 진행 상황을 로드맵과 대조 | [베타 로드맵](OPERATOR_BETA_ROADMAP.md) |

사용 흐름:

```text
Session = 하루          Page = 별도 Agent·역할 작업 파일    Work = Page 파일 안의 개별 작업
```

```text
하루 시작          → jutell session new
Agent별 Page 만들기 → jutell session page
현재 Page에 작업 추가 → jutell session work
작업할 Page 이동    → jutell session move
하루 마감          → jutell session finish
상태 확인          → jutell session
```

npm 호환 별칭(`npm run session:new` 등)도 그대로 동작합니다. 자세한 사용법은 [Session 가이드](COLLABORATION_BETA_SESSION_GUIDE.md)를 봅니다.

## 2. 공개와 Private의 차이

| 구분 | 저장 위치 | 다른 사람이 보나요? | 내용 |
|---|---|---|---|
| 공개 문서 | 이 저장소 `docs/` | 공개될 수 있음 | 철학, 구조, 사용법, 운영자 가이드 |
| 로컬 기록 | 이 프로젝트 `.jutell-local/` | 아니요 (전송·공유 안 함) | 베타 기록, 설정 기록, 사용량 카운터 |
| Private 메모 | 운영자 전용 비공개 작업 공간 | 아니요 (비공개) | 실험 백로그, 내부 결정 |

**주의**: private 저장소의 실제 내용을 공개 문서에 옮겨 적지 않습니다. 공개 문서에는 일반 원칙만 남깁니다.

## 3. 로컬 기록 위치

- 설정: 이 프로젝트 루트의 `.jutell.json`
- 로컬 데이터: 이 프로젝트 루트의 `.jutell-local/`
  - 협업 Session 폴더 (`collaboration-sessions/YYYY-MM-DD/`) — 하루 하나, Page 파일로 나누어 작성
  - 베타 기록 (사용자가 직접 작성)
  - 설정 기록 (변경 내역)
  - 사용량 카운터 (선택형, 기본 꺼짐)
  - Style Lab 설정 (선택형)

## 4. 베타 시작 순서

1. 일일 체크리스트로 오늘 상태를 확인합니다.
2. `jutell session new`로 오늘 Session 폴더를 만듭니다.
3. `jutell session page`로 Agent·역할별 Page 파일을 만들고 작업 01을 시작합니다.
4. 작은 작업부터 `balanced` Profile로 실행합니다.
5. 결과와 피드백을 해당 Page에 `jutell session work`로 이어서 기록합니다.
6. 여러 Agent를 쓰면 `jutell session move`로 Page를 바꿔가며 기록합니다.
7. 하루가 끝나면 `jutell session finish`로 `SESSION_SUMMARY.md`를 남깁니다.
8. 로드맵의 현재 단계를 확인하고 진행합니다.

## 5. 작업 후 기록 위치

| 무엇을 기록하나 | 어디에 |
|---|---|
| 작업 하나의 프롬프트·답변·내 피드백 | 해당 Page 파일 (`## 작업 N` 블록, `jutell session work`) |
| Agent·역할별 구분 | Session 폴더 안의 Page 파일 (`jutell session page`) |
| 하루 정리 (좋았던 점, 불편, 발견, Agent별 차이) | `SESSION_SUMMARY.md` (`jutell session finish`) |
| 새 기능 아이디어 | Page `⭐ JuTell 개선 아이디어`에 모은 뒤 판단 |
| 내부 결정 (왜 이렇게 하는가) | 운영자 전용 비공개 작업 공간 (일반 원칙만) |
| 공개 철학·정책 | `docs/foundation/` |

## 6. AI Agent 결과 검토 순서

Agent(OpenCode·Codex 등)가 만든 결과는 그대로 받아들이지 않고 다음 순서로 확인합니다.

1. **실제 확인과 예상을 구분**합니다. "~했을 것"은 예상, "~라고 확인했다"는 확인.
2. 보고서의 위험 안내를 봅니다. 핵심 실패·미확인 사항·비밀정보 위험은 숨길 수 없습니다.
3. Diff 해석으로 어떤 파일이 바뀌었는지 봅니다.
4. 이상하면 해당 Page의 `### 내 피드백`에 기록합니다. Agent 문제인지 JuTell 문제인지 구분해 적습니다 ([Dogfooding 가이드](JUTELL_DOGFOODING_GUIDE.md)).

## 7. 기록 구분 흐름

```
문제를 발견했다
  └─ 해당 Page의 `내 피드백`에 기록
      ├─ 반복 확인 후 말투·표현 문제 → Style 개선 후보로 모음
      ├─ 새 기능 아이디어 → 비공개 작업 공간 기록 (원칙만)
      ├─ 왜 이렇게 하지? 결정 질문 → 비공개 작업 공간 기록 (원칙만)
      └─ 정책·철학이 바뀐다 → docs/foundation/ (공개)
```

## 8. 다음 문서

- [Session 가이드](COLLABORATION_BETA_SESSION_GUIDE.md) — Session·Page·Work 구조와 명령 사용법
- [운영자 파일 가이드](OPERATOR_FILE_GUIDE.md) — 무엇을 어디서 고치는가
- [일일 체크리스트](OPERATOR_DAILY_CHECKLIST.md) — 오늘 해야 할 일
- [베타 로드맵](OPERATOR_BETA_ROADMAP.md) — 지금 어느 단계인가
- [검토 번들 만들기](PROJECT_REVIEW_EXPORT_GUIDE.md) — 외부 검토용 ZIP 만들기
- [비공개 작업 공간 경계](../OPERATOR_PRIVATE_WORKSPACE_BOUNDARY.md) — 공개와 비공개 작업 공간의 경계
- 이전 폼(피드백·협업·문서 검토·베타 피드백)은 [보관 폴더](../deprecated/README.md)에 있습니다 — 참고용