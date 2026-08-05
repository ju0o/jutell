# 운영자 Session 가이드 (Collaboration Session Guide)

운영자는 하루에 **Session 폴더 하나**를 사용합니다. 그 안에 **Agent·역할별 Page 파일**을 만들고, 각 Page 파일에 **작업(Work)**을 계속 추가합니다. 같은 날 여러 AI Agent(OpenCode, Codex, Claude Code 등)를 동시에 써도 각 Agent의 기록이 Page 파일로 나뉘어 섞이지 않습니다.

모든 기록은 이 컴퓨터의 로컬에 남고, 외부로 전송되지 않습니다. 기본 저장 위치는 로컬 전용 경로(`.jutell-local/`)이며, 운영자는 [12절](#12-운영자-session-저장-위치-지정-선택)처럼 별도 설정으로 다른 로컬 폴더에 저장할 수 있습니다.

---

## 1. 기록 구조 (정의)

```text
Session = 하루                 (date 폴더 하나)
Page    = 별도 Agent·역할 작업 파일 (page-NN-*.md)
Work    = Page 파일 안의 개별 작업   (## 작업 N 블록)
```

파일 위치:

```text
.jutell-local/collaboration-sessions/
└─ 2026-08-05/
   ├─ session.json
   ├─ page-01-opencode-rule.md
   ├─ page-02-codex-diff-review.md
   └─ SESSION_SUMMARY.md
```

예시: 하루에 OpenCode·Codex·Claude Code를 함께 쓴다면 Page 파일 3개가 생깁니다.

```text
2026-08-05/
├─ page-01-opencode-rule.md          → Page 01 — OpenCode / 말투
├─ page-02-codex-diff-review.md      → Page 02 — Codex / Diff 검토
└─ page-03-claude-code-style.md      → Page 03 — Claude Code / 말투
```

- `session.json`: 오늘 하루의 상태(진행 중/마감됨), 현재 Page, Page 목록을 자동 기록하는 파일입니다. 직접 수정하지 않습니다.
- `SESSION_SUMMARY.md`: 하루를 마감하면 명령이 만드는 오늘 총평 파일입니다.

## 2. 사용 흐름

```text
하루 시작          → jutell session new
Agent별 Page 만들기 → jutell session page
현재 Page에 작업 추가 → jutell session work
작업할 Page 이동    → jutell session move
하루 마감          → jutell session finish
상태 확인          → jutell session
```

| 명령 | 하는 일 |
|---|---|
| `jutell session` | 오늘 Session 상태(진행 중/마감됨, 현재 Page) 확인 |
| `jutell session new` | 오늘 날짜 폴더와 `session.json` 생성 (중복 생성 방지) |
| `jutell session page` | Agent·역할·제목을 물어 Page 파일 생성, 작업 01 자동 생성 |
| `jutell session work` | 현재 Page에 다음 번호 작업 추가 (Page마다 번호 독립) |
| `jutell session move` | 작업할 Page 이동 (방향키·번호 선택 또는 `--page <번호>`) |
| `jutell session finish` | `SESSION_SUMMARY.md` 한 번만 생성, 상태를 마감됨으로 변경 |
| `jutell session storage` | Session 저장 위치 상태 확인 (기본/운영자 지정, 사용 가능 여부) |
| `jutell session storage set <절대 경로>` | 저장 위치를 운영자 지정으로 변경 (확인 후 저장) |
| `jutell session storage reset` | 운영자 지정 설정만 제거, Session 기록은 유지 |

npm 호환 별칭도 그대로 동작합니다: `npm run session:new`, `npm run session:page`, `npm run session:work`(`session:add`), `npm run session:move`, `npm run session:finish`, `npm run session:status`.

비대화형(자동화·스크립트)에서는 `--agent`, `--role`, `--title`, `--page <번호>` 플래그를 함께 사용할 수 있습니다.

## 3. Session 만들기 — `jutell session new`

오늘 날짜 폴더(`2026-08-05`)와 `session.json`을 만듭니다.

1. 오늘 Session이 **없으면** 새로 만듭니다.
2. **이미 있으면** 기존 Session을 그대로 이어서 사용합니다. 덮어쓰지 않고 중복으로 만들지 않습니다.
3. 이미 마감된 Session이면 그 상태를 보여주고 다시 열지 않습니다.

> **레거시 안내:** 예전에 한 파일로 쓰던 `YYYY-MM-DD-session-NN.md` 기록은 발견해도 자동으로 변환하거나 이동하지 않고 그대로 둡니다. 새 기록은 폴더 방식으로만 만듭니다.

## 4. Page 추가 — `jutell session page`

Agent·역할·제목을 입력하면 해당 Page 파일을 만들고 `session.json`의 현재 Page를 갱신합니다.

```text
사용 Agent 선택:   OpenCode / Codex / Claude Code / Cline (방향키·번호)
집중할 역할:       (예: 규칙 정리, 쉬운 설명, Diff 검토)
Page 제목:         (예: Jutell Rule 검토)
```

- 준비 중인 Provider도 **기록용 Agent 이름**으로 선택할 수 있습니다. 선택했다고 해서 "실제 연결 완료"를 뜻하지 않으며, 기록에도 그렇게 표시하지 않습니다.
- Page 파일명은 `page-NN-agent-title.md` 형태로 자동 생성됩니다. 같은 파일은 절대 덮어쓰지 않습니다.
- 새 Page에는 `## 작업 01`이 자동으로 만들어집니다.

```markdown
# Page 01 — OpenCode / Jutell Rule 검토

- Date: 2026-08-05
- Agent: OpenCode
- 역할: 규칙 정리
- 상태: 진행 중

---

## 작업 01

### ChatGPT

-

### Agent 답변

-

### 내 피드백

좋았던 점

-

불편했던 점

-

나라면 이렇게 말할 것 같다

-

JuTell 개선 아이디어

-

오늘의 발견

-
```

## 5. 작업 추가 — `jutell session work`

`session.json`의 **현재 Page 파일**에 다음 번호 작업을 추가합니다.

- **작업 번호는 Page마다 독립적**입니다. Page 01의 작업 03과 Page 02의 작업 01이 동시에 존재할 수 있습니다.
- 기존 내용은 절대 덮어쓰지 않습니다. 작업 번호가 중복되지 않습니다.
- 다른 Page에 추가하려면 먼저 `jutell session move`로 이동합니다 (`--page <번호>` 가능).
- Page가 없으면 `jutell session page`를 먼저 실행하라고 안내합니다.
- Session이 없으면 `jutell session new`를 먼저 실행하라고 안내합니다.
- 파일 경로를 직접 입력받지 않습니다.

## 6. Page 이동 — `jutell session move`

현재 Page를 원하는 Page로 바꿉니다.

- 목록을 보여주고 **방향키(↑/↓) + Enter** 또는 **번호 입력**으로 선택합니다.
- 자동화에서는 `jutell session move --page 2`처럼 번호를 직접 지정할 수 있습니다.

## 7. 하루 마감 — `jutell session finish`

`SESSION_SUMMARY.md`를 한 번만 만들고 `session.json`의 상태를 `finished`로 바꿉니다.

```markdown
# Session Summary

Date: 2026-08-05

## 오늘 Page

- Page 01 — OpenCode / Jutell Rule 검토
- Page 02 — Codex / Diff Review

## 오늘 가장 좋았던 점

-

## 오늘 가장 불편했던 점

-

## 오늘의 핵심 발견

-

## Agent별 차이

-

## JuTell에 반영할 후보

-

## 다음 Session에서 가장 먼저 할 일

-
```

이미 마감했으면 중복으로 만들지 않고 안내만 합니다. `finish`는 Page 파일을 바꾸지 않습니다.

## 8. 명령을 실행할 수 없을 때 (대체 방법)

명령 실행이 불가능한 환경(예: CLI 빌드가 없는 컴퓨터)에서는 예전처럼 **폴더 구조를 직접 만드는 방법**을 대체 수단으로만 사용합니다.

- Session: `.jutell-local/collaboration-sessions/YYYY-MM-DD/` 폴더 생성
- Page: 위 4절 형식을 복사해 `page-NN-agent-title.md`로 저장
- 작업: 위 4·5절 형식을 복사하고 작업 번호를 그 Page의 마지막 번호 다음으로 수정
- 총평: 위 7절 형식을 `SESSION_SUMMARY.md`로 저장 (중복 금지)

가능하면 항상 명령을 사용하고, 이 방법은 예외적인 경우에만 사용합니다.

## 9. 안전 규칙

Session 기록(Page 파일·총평)에는 다음 내용을 넣지 않습니다.

- 코드 원문, Diff 전체
- API Key, Token, Cookie
- 실제 사용자 정보(이름, 이메일, 계정)
- 로컬 절대 경로가 포함된 원문 로그
- Private 전략이나 내부 판단 원문

필요하면 민감한 부분을 제거한 짧은 요약만 사용합니다.

- 프롬프트·답변 원문은 **운영자가 직접 붙여 넣은 경우에만** 기록합니다. 자동 수집하지 않습니다.
- Agent 문제인지 JuTell 문제인지 구분이 되면 함께 적습니다 ([Dogfooding 가이드](JUTELL_DOGFOODING_GUIDE.md)).

## 10. Review Bundle과 세션 원본

실제 로컬 세션 원본은 Review Bundle에 포함하지 않습니다. 아래 흐름으로 안전한 요약본만 별도로 만듭니다.

```text
실제 로컬 세션 기록
→ 운영자가 오늘 총평 확인
→ 민감정보 제거
→ 선택적 검토 요약 생성
→ Review Bundle과 함께 전달
```

- 세션 원본은 `.jutell-local/`에 남겨 둡니다. Git에도, Bundle에도 들어가지 않습니다.
- 외부 검토자에게 보낼 때는 운영자가 검토한 요약본만 `artifacts/session-feedback/` 폴더에 별도 파일로 만듭니다.
- Review Bundle 생성 방법은 [검토 번들 만들기](PROJECT_REVIEW_EXPORT_GUIDE.md)를 봅니다.

## 11. 이전 방식은 보관 폴더에

- 예전 단일 파일 기록(`YYYY-MM-DD-session-NN.md`)은 폴더 방식으로 전환하면서 **변환·이동·삭제하지 않고** 그대로 둡니다. 참고용으로만 남겨 둡니다.
- 이전에 쓰던 여러 폼(협업 세션 폼, 피드백 폼, 문서 검토 폼, 베타 피드백 양식)은 삭제하지 않고 `docs/deprecated/`로 옮겨 참고용으로만 보관합니다.
- 이전 폼이 필요할 때는 [보관 폴더](../deprecated/README.md)를 봅니다.

## 12. 운영자 Session 저장 위치 지정 (선택)

기본적으로 Session 기록은 다음 위치에 저장됩니다.

```text
<현재 프로젝트>/.jutell-local/collaboration-sessions/
```

운영자가 이 기록(GPT Prompt, Agent 답변, 운영 피드백이 담긴 Session)을 공개 저장소 작업 폴더 밖의 **별도 비공개 작업 공간**에 보관하고 싶다면, 로컬 설정 파일로 저장 위치를 바꿀 수 있습니다.

### 설정 파일 (직접 작성 방식)

공개 Git에 포함되지 않는 로컬 설정 파일 `.jutell-operator.local.json`을 프로젝트 루트에 둡니다.

```json
{
  "sessionStoragePath": "<운영자가 선택한 로컬 절대 경로>"
}
```

- 위 예시는 형태만 보여줍니다. **실제 운영자 경로를 문서·출력에 적지 않습니다.**
- JSON이 손상되었거나, 경로가 아니라면 기본 저장 위치로 조용히 바꾸지 않고 다음처럼 알려줍니다.

```text
운영자 Session 저장 위치를 사용할 수 없습니다.
설정을 확인하거나 제거하면 기본 로컬 저장 위치를 사용할 수 있습니다.
```

### CLI 명령 방식

```powershell
jutell session storage                 # 저장 위치 상태 확인 (경로는 출력하지 않음)
jutell session storage set <절대 경로>  # 운영자 지정으로 변경 (확인 후 저장)
jutell session storage reset           # 운영자 지정 설정만 제거
```

- `set`은 폴더가 없으면 만들고, 접근할 수 없으면 오류를 안내합니다. `--yes`로 확인을 건너뜁니다.
- 절대 경로 전체를 출력하지 않습니다. 오류 안내에도 경로를 넣지 않습니다.

### 저장 위치 우선순위

1. `.jutell-operator.local.json`의 `sessionStoragePath`가 사용 가능하면 그 경로
2. 설정이 없으면 `<현재 프로젝트>/.jutell-local/collaboration-sessions/`

설정 파일은 있지만 경로가 잘못된 경우에는 기본 위치로 대체하지 않고 중단합니다.

### 안전 규칙

- 이 설정 파일은 **Session 저장 위치 용도 외에는 사용하지 않습니다.**
- `.gitignore`에 포함되며 공개 저장소에 올리지 않습니다. 추적되면 `check:public`이 위반으로 알립니다.
- Review Bundle에서 제외됩니다.
- Session 기록을 외부로 전송하지 않으며, 비공개 Git 자동 commit·push를 하지 않습니다.
- 기록 파일은 항상 운영자가 직접 관리합니다.