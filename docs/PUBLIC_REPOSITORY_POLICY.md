# 공개 저장소 정책 (PUBLIC_REPOSITORY_POLICY)

JuTell은 공개 GitHub 저장소(ju0o/jutell)와 별도 비공개 저장소를 함께 사용한다.
이 문서는 공개 저장소에 무엇을 올리고 올리지 않는지의 기준이다.

## 공개 저장소에 올릴 수 있는 것

- 제품 철학과 공개 아키텍처
- 사용자 기능 설명과 설치 방법
- 개인정보 보호 원칙
- 오프라인 Core 원칙
- 선택형 Cloud의 존재와 기본 원칙 (구체 계획 제외)
- 공개 로드맵
- 기여 방법
- 현재 지원 Provider
- 라이선스와 릴리스 정보
- 테스트와 검증 기록

## 공개 저장소에 올리면 안 되는 것

- 구체적인 수익 목표, 가격 전략, 전환율 목표
- 유료 전환·경쟁사 대응 전략
- 아직 공개하지 않을 Premium 기능
- 중앙 서버 도입 시점의 내부 판단
- 사용자 행동 데이터 분석 전략, 내부 KPI
- 실제 사용자 식별 정보
- 개인적인 장기 사업 방향, 미공개 마케팅 계획
- 운영자 개인 메모
- API Key, Token, Cookie, 인증 정보, 환경변수 값
- 로컬 절대 경로(예: `C:\Users\<사용자>\...`)
- 실제 사용자 데이터
- Beta Journal·Style Lab 원본
- 테스트 프로젝트와 빌드 산출물
- `.jutell-local/`, `.beginner-bridge-local/` 데이터
- 실제 사용자 설정 파일 — 루트 `.jutell.json`, `.beginner-bridge.json`, `.jutell-operator.local.json` (설정은 CLI 또는 Dashboard가 생성하며, 공개 저장소에는 예시만 포함)
- 실제 Agent 설정과 사용자별 Skill 복사본 — `.codex/`, 허용 경로(`.agents/skills/beginner-bridge/**`) 밖의 `.agents/**`
- 로컬 설치 산출물 — 설치 과정에서 생성되는 AGENTS.md, MCP 등록 파일

## 예시 설정과 실제 설정의 구분

| 항목 | 저장소에 포함되는 것 | 포함되지 않는 것 |
|---|---|---|
| JuTell 설정 | `examples/config/jutell.example.json` (예시) | 루트 `.jutell.json` (실제 사용자 설정) |
| 하위 호환 설정 | `examples/config/beginner-bridge.example.json` (예시) | 루트 `.beginner-bridge.json` |
| Agent 지침 | 루트 `AGENTS.md` (공개 제품 지침, Git 추적 기준) | 설치 과정에서 생성된 사용자별 AGENTS.md |
| Skill | `.agents/skills/beginner-bridge/**` (공개 배포 자산) | 사용자별 Skill 복사본, 전역 Skill |

판단 기준은 폴더 이름이 아니라 파일의 출처와 역할이다. 공개 저장소에서 Git 추적 중이며 제품 배포 목록에 포함되면 포함할 수 있고, 설치 과정에서 생성된 사용자별 파일이면 포함하지 않는다.

## 커밋 전 확인 절차

1. `git status`로 추가·변경 파일을 확인한다.
2. 새 문서는 이 정책의 "올리면 안 되는 것"에 해당하지 않는지 확인한다.
3. `npm run check:public`을 실행해 탐지 결과(비밀정보·절대 경로·비공개 저장소 이름·부모 폴더 접근 포함)가 없는지 확인한다.
4. 판단이 필요한 파일은 커밋하지 않고 보고만 남긴다.
5. 공개와 비공개가 섞인 문서는 공개 요약본과 비공개 상세본으로 나눈다.

## Review Bundle 검사 규칙

`check:public`은 `artifacts/`의 ZIP 번들도 검사한다.

- **FAIL**: 번들 안에 실제 사용자 설정(`.jutell.json`, `.beginner-bridge.json`), `.jutell-local/`, `.codex/`, 허용 경로 밖의 `.agents/**`, 비공개 문서가 있으면 위반
- **PASS**: 예시 설정(`examples/config/jutell.example.json` 등)과 `.agents/skills/beginner-bridge/**`는 통과
- 번들은 `npm run bundle:review`로 생성하며, 생성 전에 공개 안전 검사를 먼저 실행한다.

## 공개 안전 검사 예외(allowlist)

`check:public`의 탐지 결과 중 위험이 아님을 직접 확인한 경우에만 예외를 기록한다.
예외는 `scripts/check-public-repository.mjs`의 `ALLOWED_EXCEPTIONS`에 다음 네 가지를 함께 적는다.

- 파일 경로
- 탐지 유형 (예: `winPath`)
- 예외 이유
- 허용 범위 (해당 파일의 해당 탐지로 한정)

예외 기록은 해당 파일의 다른 탐지를 끄지 않으며, 전체 경로·URL 검사는 그대로 유지한다.
동일한 고정 경고가 반복되지 않도록, 이미 예외 처리된 항목은 요약에서 제외 횟수로만 표시한다.

## 경고

- 이미 추적된 파일은 `.gitignore`만으로 숨겨지지 않는다. 제외하려면 운영자 승인 후 별도 절차가 필요하다.
- 비밀정보가 한 번 커밋되면 Git 기록에 남을 수 있다. 로컬 기록 삭제·force push는 운영자 승인 없이 수행하지 않는다.
- 삭제·기록 정리는 운영자 승인 없이 수행하지 않는다.

## 비공개 저장소 사용

비공개 전략 문서는 공개 저장소가 아닌 운영자 전용 비공개 저장소에 보관한다.
공개 저장소에서 비공개 파일을 참조하지 않는다. 경계와 검사 규칙은 [공개 제품과 운영자 비공개 자료 경계 정책](OPERATOR_PRIVATE_DATA_BOUNDARY.md), 보관 대상 종류는 `PRIVATE_DOCUMENTS_MAP.md`를 참고한다.
