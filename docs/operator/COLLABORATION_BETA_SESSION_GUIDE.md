# JuTell 협업 베타 세션 가이드 (Collaboration Beta Session Guide)

이 문서는 운영자가 **ChatGPT · 운영자 · OpenCode · JuTell** 네 주체가 하루 동안 주고받은 전체 흐름을 기록하는 방법입니다. 한 작업을 독립적으로 평가하는 [피드백 폼](OPERATOR_FEEDBACK_FORM.md)과 다르게, 이 기록은 하루 단위로 여러 작업을 이어서 남깁니다.

모든 기록은 이 컴퓨터의 로컬 전용 경로에 남고, 외부로 전송되지 않습니다.

---

## 1. 빠른 사용 방법

```
1. 작업 시작 전에 새 세션 기록 생성 (npm run session:new)
2. ChatGPT 프롬프트 붙여 넣기
3. OpenCode에 전달
4. OpenCode 답변 또는 요약 붙여 넣기
5. 운영자 피드백 작성
6. 다음 프롬프트 전달
7. 하루 동안 같은 파일에 작업 기록 추가
8. 하루 종료 요약 작성
9. Review Bundle 생성
10. 선택한 피드백 요약과 Bundle을 외부 검토자에게 전달
```

## 2. 세션 기록 생성

```powershell
npm run session:new
```

- `.jutell-local/collaboration-sessions/` 폴더에 날짜·세션 ID가 입력된 파일이 생성됩니다.
- 예: `2026-08-04-session-001.md`
- 이미 같은 이름의 파일이 있으면 덮어쓰지 않고 안내만 합니다.
- 에디터나 외부 프로그램을 자동으로 열지 않습니다.

파일명 예시와 작성법은 [세션 폼](COLLABORATION_BETA_SESSION_FORM.md)을 복사해서 씁니다.

## 3. 하루 동안 기록하는 방법

- 하루 동안 여러 작업을 **같은 파일**에 `작업 기록 01`, `작업 기록 02`처럼 번호를 늘려 추가합니다.
- 한 작업이 끝날 때마다 `작업 기록` 섹션을 복사해 다음 번호로 이어 붙입니다.
- Prompt·답변 원문은 **운영자가 직접 붙여 넣은 경우에만** 기록합니다. 자동 수집하지 않습니다.

## 4. 하루 종료 요약

같은 파일 맨 아래 `# 하루 종료 요약`을 작성합니다.

- 오늘 완료한 작업과 반복 문제를 짧게 적습니다.
- Style 규칙 후보, Feature 개선 후보를 구분해 적습니다.
- Beta Journal / Style Lab / Experiment Backlog / Internal Decisions 중 어디에 옮길지 표시합니다.
- 다음 날 가장 먼저 할 작업을 정합니다.

## 5. Review Bundle과 세션 피드백

실제 로컬 세션 원본은 Review Bundle에 포함하지 않습니다. 아래 흐름으로 안전한 요약본만 별도로 만듭니다.

```
실제 로컬 세션 기록
→ 운영자가 하루 종료 요약 확인
→ 민감정보 제거
→ 선택적 검토 요약 생성
→ Review Bundle과 함께 전달
```

- 세션 원본은 `.jutell-local/`에 남겨 둡니다. Git에도, Bundle에도 들어가지 않습니다.
- 외부 검토자에게 보낼 때는 운영자가 검토한 요약본만 `artifacts/session-feedback/` 폴더에 별도 파일로 만듭니다.
- 요약본에 Prompt·답변 원문·코드·경로·개인정보가 들어갔는지 확인한 뒤에만 전달합니다.
- Review Bundle 생성 방법은 [검토 번들 만들기](PROJECT_REVIEW_EXPORT_GUIDE.md)를 봅니다.

## 6. 로컬 세션 파일 안전 규칙

실제 세션 파일에는 다음 내용을 넣지 않습니다.

- 코드 원문, Diff 전체
- API Key, Token, Cookie
- 실제 사용자 정보(이름, 이메일, 계정)
- 로컬 절대 경로가 포함된 원문 로그
- Private 전략이나 내부 판단 원문

필요하면 민감한 부분을 제거한 짧은 요약만 사용합니다.

## 7. Dashbboard 확장 (V2 후보)

이번 V1은 Markdown 기반입니다. 다음 기능은 V2 후보이며, V1 사용으로 필요가 확인된 뒤에만 설계합니다.

- 협업 세션 폼
- 작업 항목 추가
- ChatGPT Prompt 입력
- OpenCode 답변 입력
- 운영자 피드백
- 하루 종료 요약
- 선택적 안전한 Export
- 사용량 측정 연결

## 8. 피드백 폼과의 차이

| 항목 | [피드백 폼](OPERATOR_FEEDBACK_FORM.md) | 협업 세션 폼 |
|---|---|---|
| 평가 대상 | 하나의 작업을 독립적으로 평가 | ChatGPT·운영자·OpenCode가 하루 동안 주고받은 전체 흐름 |
| 단위 | 작업 1건 | 하루 단위 세션 1개 |
| 기록 위치 | Dashboard 베타 기록 또는 자유 선택 | `.jutell-local/collaboration-sessions/` |
| 포함 내용 | 불편·개선 요청 중심 | Prompt·답변·피드백·설명법·좋았던 점·개선·JuTell 관찰·다음 결정 |
