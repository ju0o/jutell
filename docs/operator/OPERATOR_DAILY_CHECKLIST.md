# 운영자 일일 체크리스트 (Operator Daily Checklist)

하루에 한 번, 이 순서대로 확인합니다. 10분 안에 끝납니다.

## 시작 전

- [ ] 오늘 Session 확인: `jutell session` — 오늘 폴더와 상태 확인
- [ ] 오늘 Session 만들기: `jutell session new` — 이미 있으면 이어서 사용
- [ ] 저장소 상태 확인: `git status` — 내가 만든 변경 외에 이상한 파일이 없는지
- [ ] 오늘 할 일 고르기 (1~3개): [시작 가이드](OPERATOR_START_HERE.md) 1번 표에서
- [ ] 지금 로드맵의 어느 단계인지 확인: [베타 로드맵](OPERATOR_BETA_ROADMAP.md)

## 작업 중

- [ ] 작업 시작 전에 "지금 무엇을 할 것인가"를 한 문장으로 정함
- [ ] Agent·역할별로 Page 파일 만들기: `jutell session page` (작업 01 자동 생성)
- [ ] 작업할 Page 바꾸기: `jutell session move`
- [ ] 같은 Page에 작업 이어서 기록: `jutell session work` (Page마다 번호 독립)
- [ ] Agent가 만든 결과는 실제 확인과 예상을 구분해 읽음
- [ ] 결과 보고서를 그대로 믿지 않고, 위험 안내와 Diff 해석을 봄
- [ ] 문제를 만나면 그 자리에서 해당 Page의 `### 내 피드백`에 1건 이상 기록함 (기록 규칙: 비밀정보·경로 금지)
- [ ] 변경 범위를 확인: 이번 작업이 제품 범위를 넓히는 일인지 확인

## 종료 전

- [ ] 오늘 마감: `jutell session finish` — `SESSION_SUMMARY.md`를 한 번만 생성
- [ ] 공개 저장소 안전 검사 실행: `npm run check:public` — 위반 0건인지
- [ ] README/CLI 안내 문구를 바꿨거나 `jutell` 기본 동작(연결·관리자 화면·Provider 상태)을 바꿨다면 Release README Gate 실행: `npm test -- readme-behavior-parity` (packages/cli) — README.md·README.ko.md가 실제 동작·Provider 상태와 어긋나지 않는지 확인
- [ ] 코드를 바꿨다면 테스트 실행:
  - `npm test` (packages/cli, apps/local-admin, apps/mcp-server 각각)
  - 빌드 확인: 각 패키지 `npm run build`
- [ ] 커밋 전 검토: `git status`, `git diff` — 커밋에 들어가면 안 되는 파일(.jutell-local, .env, artifacts 등)이 없는지
- [ ] 문서를 바꿨다면 링크가 깨지지 않았는지 확인
- [ ] 외부 검토용 번들이 필요하면 만들기: `npm run bundle:review`
- [ ] 오늘 한 일과 내일 할 일을 `SESSION_SUMMARY.md`에 한 문장씩 남김

## 기록 규칙 요약

- 실제 확인한 것과 예상을 구분해서 적습니다.
- Prompt, 코드, 파일 경로, 오류 원문, 프로젝트 식별 정보, 비밀정보를 기록에 넣지 않습니다.
- 기존 사용자 변경을 임의로 되돌리지 않습니다.
- 확인하지 않은 결과를 사실처럼 보고하지 않습니다.