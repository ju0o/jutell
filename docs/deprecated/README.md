# 보관 폴더 (Deprecated)

이 폴더는 더는 사용하지 않는 **이전 운영자 폼**을 향후 참고용으로만 보관하는 곳입니다.

## 현재 베타의 기록 방법

현재 베타에서는 여러 폼을 사용하지 않습니다. 하루에 **Session 폴더 하나**(`.jutell-local/collaboration-sessions/YYYY-MM-DD/`)만 사용하고, 그 안에 **Agent·역할별 Page 파일**(`page-NN-*.md`)을 만들어 기록합니다.

```text
하루 시작          → jutell session new
Agent별 Page 만들기 → jutell session page
현재 Page에 작업 추가 → jutell session work
작업할 Page 이동    → jutell session move
하루 마감          → jutell session finish
```

npm 호환 별칭(`npm run session:new` 등)도 그대로 동작합니다.

- 사용 방법: [운영자 Session 가이드](../operator/COLLABORATION_BETA_SESSION_GUIDE.md)
- 예전 단일 파일 기록(`YYYY-MM-DD-session-NN.md`)은 변환·이동·삭제하지 않고 그대로 둡니다.
- 폼 직접 복사는 명령 실행이 불가능한 경우의 대체 방법입니다.

## 보관된 문서

| 문서 | 이전 용도 | 현재 대체 |
|---|---|---|
| [COLLABORATION_BETA_SESSION_FORM.md](COLLABORATION_BETA_SESSION_FORM.md) | 협업 베타 세션 기록 폼 (작업 기록 01~10) | `jutell session new` + `session page` |
| [OPERATOR_FEEDBACK_FORM.md](OPERATOR_FEEDBACK_FORM.md) | 작업 1건의 독립 피드백 폼 | `jutell session work` (`### 내 피드백`) |
| [OPERATOR_DOCUMENT_REVIEW_FORM.md](OPERATOR_DOCUMENT_REVIEW_FORM.md) | 문서 1건 검토 폼 | `jutell session work` (`### 내 피드백`) |
| [BETA_FEEDBACK_TEMPLATE.md](BETA_FEEDBACK_TEMPLATE.md) | 개인 베타 불편 기록 양식 | `jutell session work`, `jutell session finish` |

## 주의

- 보관된 문서는 **향후 참고용**입니다. 새 기록은 이 폼들을 복사해 작성하지 않습니다.
- 내용이 필요할 때만 열어보고, 수정하지 않습니다.
