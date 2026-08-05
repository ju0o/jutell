# 외부 검토 번들 만들기 (Project Review Export Guide)

코드나 문서를 외부 검토(다른 사람, 다른 Agent)에 보낼 때, 안전한 파일만 묶어 ZIP으로 만드는 방법입니다. **공개 저장소에서 안전하다고 확인된 파일만 포함**되며, 로컬 데이터와 비밀정보는 절대 들어가지 않습니다.

## 1. 사용법

저장소 루트에서 실행합니다.

```
npm run bundle:review
```

실행 결과:

1. 공개 안전 검사(`npm run check:public`)를 먼저 실행합니다. 위반이 있으면 번들을 만들지 않고 중단합니다.
2. git 추적 파일 중 안전한 파일만 골라 번들에 넣습니다.
3. 번들 안에 `REVIEW_BUNDLE_MANIFEST.md`를 자동으로 만들어 넣습니다.
4. 결과: `artifacts/jutell-review-bundle-YYYYMMDD-HHMM.zip`

ZIP 생성을 지원하지 않는 환경에서는 같은 이름의 폴더 번들이 만들어지며, manifest에 대체 이유가 기록됩니다.

## 2. 포함되는 것

- git에 추적된 공개 파일 전부 (아래 제외 목록에 해당하지 않는 것)
- `.agents/skills/beginner-bridge/**` — JuTell이 배포하는 공개 제품 Skill (실제 사용자 설정이 아님)
- 예시 설정 파일 — `examples/config/jutell.example.json`, `examples/config/beginner-bridge.example.json`, `examples/instructions/AGENTS.example.md`
- `REVIEW_BUNDLE_MANIFEST.md` (자동 생성)

미추적(untracked) 파일과 로컬 데이터는 포함되지 않습니다. 포함 여부는 Git 추적 여부와 제품 배포 목록을 기준으로 결정합니다.

## 3. 제외되는 것

| 구분 | 내용 |
|---|---|
| 실제 사용자 설정 | 루트 `.jutell.json`, `.beginner-bridge.json`, `opencode.json` — 설정은 CLI 또는 Dashboard가 생성하며, 저장소에는 예시만 존재 (`examples/config/*.example.json`) |
| 로컬 데이터 | `.jutell-local/`, `.beginner-bridge-local/` 및 비공개 표시 폴더(`private/`, `docs/private/`, `*.private.md`, `*.internal.md`) |
| 로컬 Agent 설정 | `.codex/`, 허용 경로(`.agents/skills/beginner-bridge/**`) 밖의 `.agents/**` (설치·사용자별 복사본) |
| 비밀정보 | `.env*`, `.pem`, `.key`, `.token`, `*.local.json`, `*.backup.json` |
| 빌드·의존성 | `node_modules/`, `dist/`, `build/`, `coverage/`, `assets/` |
| 산출물 | `artifacts/`, `*.tgz`, `*.log` |
| 로컬 테스트 프로젝트 | `jutell-*-test/` |
| 기타 | `.git/` |

## 4. 번들 안의 manifest 읽는 법

받은 쪽은 ZIP 안의 `REVIEW_BUNDLE_MANIFEST.md`를 먼저 읽습니다.

- 생성 시각과 HEAD 커밋 (어느 시점의 저장소인지)
- 작업 트리 상태 (커밋되지 않은 변경이 있었는지)
- 공개 안전 검사 결과
- **이 번들에 포함된 설정은 예시이며 실제 사용자 설정이 아닙니다** — manifest 첫 부분에 명시됨
- 포함 규칙과 제외 원칙 (`.agents/skills/`는 공개 배포 자산, 실제 설정과 로컬 설치 산출물은 제외)
- 포함 목록 전체와 제외된 추적 파일 수
- 비밀정보 검사 결과

## 5. 보내기 전 확인

- [ ] `artifacts/` 폴더는 커밋하지 않는다 (gitignore 처리됨)
- [ ] ZIP 파일 안에 로컬 데이터 폴더가 없는지 확인 (스크립트가 자동 확인)
- [ ] 받는 사람이 알아야 할 맥락은 manifest에 없는 경우 별도 메모로 전달
- [ ] 구현 범위 요약은 `docs/PRODUCT_VISION.md`와 `docs/foundation/ARCHITECTURE.md`를 함께 읽도록 안내

## 6. 검토 후

- 받은 검토 의견은 오늘 Session의 해당 Page `### 내 피드백`에 기록합니다. (이전 피드백 폼은 [보관 폴더](../deprecated/)에 있습니다.)
- 문제 유형이 JuTell 문제인지 Agent 문제인지 구분해 남깁니다 ([Dogfooding 가이드](JUTELL_DOGFOODING_GUIDE.md)).
- 검토 의견 반영 후에는 저장소 상태를 다시 확인하고, 필요하면 번들을 새로 만듭니다.

## 7. 협업 세션 피드백 포함 (V1)

실제 로컬 세션 원본(`.jutell-local/collaboration-sessions/`)은 Review Bundle에 **자동으로 포함하지 않습니다**. V1에서는 다음 흐름으로 운영자가 직접 고른 안전한 요약본만 전달합니다.

```
실제 로컬 세션 기록
→ 운영자가 오늘 총평 확인
→ 민감정보 제거
→ 선택적 검토 요약 생성
→ Review Bundle과 함께 별도 파일로 전달
```

1. 세션 원본에서 외부 검토에 필요한 내용만 골라 `artifacts/session-feedback/COLLABORATION_SESSION_SUMMARY.md`로 복사합니다.
2. 요약본에서 다음이 없는지 확인합니다: Prompt·답변 원문, 코드·Diff 원문, 파일 경로, API Key·Token·Cookie, 실제 사용자 정보, Private 전략.
3. Review Bundle ZIP과 요약 파일을 함께 업로드합니다.

자동으로 로컬 기록을 Bundle에 복사하지 않습니다. 번들 생성 방법은 [Session 가이드](COLLABORATION_BETA_SESSION_GUIDE.md) 10번도 함께 읽습니다.
