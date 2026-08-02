## Phase 3. Git Diff 수집기

여기서부터 작은 프로그램이 들어간다.

하지만 AI API를 사용하는 프로그램은 아니다.

로컬에서 다음 명령만 실행하는 Node.js 스크립트다.

```

git status
git diff
git diff --stat
git diff --name-status

```

# 스크립트가 생성할 데이터

```

{
  "changedFiles": [
    {
      "path": "src/features/auth/LoginForm.tsx",
      "changeType": "modified",
      "addedLines": 18,
      "deletedLines": 4
    }
  ],
  "summary": {
    "filesChanged": 1,
    "linesAdded": 18,
    "linesDeleted": 4
  }
}

```

# 중요한 원칙

이 단계에서는 AI가 다음을 추측하지 않게 해야 한다.

어떤 파일이 바뀌었는가
몇 줄이 추가됐는가
파일이 생성·수정·삭제됐는가
현재 커밋되지 않은 변경이 무엇인가

이 정보는 스크립트가 제공하고, Codex는 그 의미만 설명한다.

이 구조가 토큰도 줄이고 정확도도 높여준다.



