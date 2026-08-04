# 운영자 시작 가이드 (Operator Start Here)

이 문서는 JuTell을 직접 사용하고 기록하는 운영자(비개발자 사용자)가 **오늘 해야 할 일을 고르는** 첫 문서입니다. 코드를 몰라도 됩니다. 모든 기록은 로컬에만 남고 외부로 전송되지 않습니다.

---

## 1. 오늘 할 일 고르기

아래에서 1~3개만 골라 진행합니다. 한 번에 많은 일을 벌이지 않습니다.

| 순위 | 할 일 | 방법 |
|---|---|---|
| 1 | 작은 작업 하나를 JuTell로 실행 | [일일 체크리스트](OPERATOR_DAILY_CHECKLIST.md) 시작 |
| 2 | 실행 결과를 기록 | Dashboard의 베타 기록 (아래 3번 참고) |
| 3 | 기억나는 불편을 한 건 기록 | [피드백 폼](OPERATOR_FEEDBACK_FORM.md) 복사해서 작성 |
| 4 | 이번 주 진행 상황을 로드맵과 대조 | [베타 로드맵](OPERATOR_BETA_ROADMAP.md) |
| 5 | 문서 한 개를 검토 | [문서 검토 폼](OPERATOR_DOCUMENT_REVIEW_FORM.md) |

## 2. 공개와 Private의 차이

| 구분 | 저장 위치 | 다른 사람이 보나요? | 내용 |
|---|---|---|---|
| 공개 문서 | 이 저장소 `docs/` | 공개될 수 있음 | 철학, 구조, 사용법, 운영자 가이드 |
| 로컬 기록 | 이 프로젝트 `.jutell-local/` | 아니요 (전송·공유 안 함) | 베타 기록, 설정 기록, 사용량 카운터 |
| Private 메모 | 다른 저장소 `jutell-private/` | 아니요 (비공개 저장소) | 실험 백로그, 내부 결정 |

**주의**: private 저장소의 실제 내용을 공개 문서에 옮겨 적지 않습니다. 공개 문서에는 일반 원칙만 남깁니다.

## 3. 로컬 기록 위치

- 설정: 이 프로젝트 루트의 `.jutell.json`
- 로컬 데이터: 이 프로젝트 루트의 `.jutell-local/`
  - 베타 기록 (사용자가 직접 작성)
  - 설정 기록 (변경 내역)
  - 사용량 카운터 (선택형, 기본 꺼짐)
  - Style Lab 설정 (선택형)

## 4. 베타 시작 순서

1. 일일 체크리스트로 오늘 상태를 확인합니다.
2. 작은 작업부터 `balanced` Profile로 실행합니다.
3. 결과를 베타 기록에 남깁니다.
4. 피드백 폼으로 한 건 이상 기록합니다.
5. 로드맵의 현재 단계를 확인하고 진행합니다.

## 5. 작업 후 기록 위치

| 무엇을 기록하나 | 어디에 |
|---|---|
| 제품 기능 문제 (동작이 이상함, 설명이 어려움) | Dashboard 베타 기록 |
| 말투·표현 느낌 | Style Lab |
| 새 기능 아이디어 | `jutell-private/product/EXPERIMENT_BACKLOG.md` (일반 원칙만) |
| 내부 결정 (왜 이렇게 하는가) | `jutell-private/operations/INTERNAL_DECISIONS.md` (일반 원칙만) |
| 공개 철학·정책 | `docs/foundation/` |

## 6. AI Agent 결과 검토 순서

Agent(OpenCode·Codex)가 만든 결과는 그대로 받아들이지 않고 다음 순서로 확인합니다.

1. **실제 확인과 예상을 구분**합니다. "~했을 것"은 예상, "~라고 확인했다"는 확인.
2. 보고서의 위험 안내를 봅니다. 핵심 실패·미확인 사항·비밀정보 위험은 숨길 수 없습니다.
3. Diff 해석으로 어떤 파일이 바뀌었는지 봅니다.
4. 이상하면 피드백 폼에 기록합니다. Agent 문제인지 JuTell 문제인지 구분해 적습니다 ([Dogfooding 가이드](JUTELL_DOGFOODING_GUIDE.md)).

## 7. 기록 구분 흐름

```
문제를 발견했다
  ├─ 동작·설명 문제 → Dashboard 베타 기록
  ├─ 말투·표현 문제 → Style Lab
  ├─ 새 기능 아이디어 → EXPERIMENT_BACKLOG (private, 원칙만)
  ├─ 왜 이렇게 하지? 결정 질문 → INTERNAL_DECISIONS (private, 원칙만)
  └─ 정책·철학이 바뀐다 → docs/foundation/ (공개)
```

## 8. 다음 문서

- [운영자 파일 가이드](OPERATOR_FILE_GUIDE.md) — 무엇을 어디서 고치는가
- [일일 체크리스트](OPERATOR_DAILY_CHECKLIST.md) — 오늘 해야 할 일
- [베타 로드맵](OPERATOR_BETA_ROADMAP.md) — 지금 어느 단계인가
- [피드백 폼](OPERATOR_FEEDBACK_FORM.md) — 기록용 복사 폼
- [문서 검토 폼](OPERATOR_DOCUMENT_REVIEW_FORM.md) — 문서 상태 확인용
- [검토 번들 만들기](PROJECT_REVIEW_EXPORT_GUIDE.md) — 외부 검토용 ZIP 만들기
