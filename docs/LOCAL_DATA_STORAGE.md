# JuTell이 로컬에 저장하는 데이터 (LOCAL_DATA_STORAGE)

이 문서는 일반 사용자를 위해 JuTell이 컴퓨터의 어느 위치에 어떤 파일을 만드는지 안내합니다.
어려운 용어는 최소화하고, 직접 확인·변경·삭제하는 방법을 알려줍니다.

## 한 줄 요약

JuTell은 사용자의 컴퓨터 안(로컬)에만 파일을 만듭니다.
인터넷의 어느 서버로도 자동으로 보내지 않으며, Git(버전 관리)에도 자동으로 포함되지 않습니다.

## 1. JuTell이 만드는 로컬 파일

현재 프로젝트 폴더(또는 사용자 홈 폴더) 아래에 다음이 생깁니다.

| 파일·폴더 | 역할 | 자동 전송 | Git 자동 포함 |
|---|---|---|---|
| `.jutell.json` | JuTell 설정 파일. CLI나 관리자 화면(Dashboard)에서 저장할 때 만들어짐 | 안 함 | 안 됨 |
| `.jutell-local/` | 로컬 데이터 폴더. 아래 Session 기록, 설정 기록, 사용량 카운터, Style Lab 설정이 들어감 | 안 함 | 안 됨 |
| `.jutell-operator.local.json` | (운영자 전용) Session 저장 위치를 직접 지정할 때만 만들어짐. 일반 사용자는 필요 없음 | 안 함 | 안 됨 |
| `artifacts/` | 외부 검토용 Review Bundle을 만들 때만 생성됨 (자동 생성 아님) | 안 함 | 안 됨 |

> `.beginner-bridge.json`, `.beginner-bridge-local/`은 예전 이름을 쓰시던 분을 위한 호환 경로입니다. 역할은 위와 같습니다.

## 2. Session 저장 기본 위치

하루 작업 기록(Session)을 `jutell session new`로 시작하면, 기본 위치는 다음과 같습니다.

```text
<현재 프로젝트 폴더>/.jutell-local/collaboration-sessions/YYYY-MM-DD/
```

- 하루 단위로 폴더가 하나 생깁니다.
- 그 안에 Agent·역할별 Page 파일이 만들어집니다.
- 운영자가 `jutell session storage set <절대 경로>`로 다른 로컬 폴더를 지정하지 않는 한 기본 위치를 사용합니다.

## 3. Review Bundle 저장 기본 위치

외부 검토용 번들은 사용자가 직접 명령을 실행할 때만 만들어집니다.

```text
npm run bundle:review
```

실행하면 프로젝트 폴더 아래에 생성됩니다.

```text
<현재 프로젝트 폴더>/artifacts/jutell-review-bundle-YYYYMMDD-HHMM.zip
```

- 번들은 자동으로 만들어지지 않습니다.
- 실제 사용자 설정과 로컬 데이터는 번들에 들어가지 않습니다.
- 번들에는 공개 문서와 예시 설정만 포함됩니다.

## 4. Git(버전 관리)에 자동으로 포함되지 않습니다

JuTell이 만드는 로컬 파일과 폴더는 프로젝트의 `.gitignore`에 모두 등록되어 있습니다.

- `.jutell.json`, `.beginner-bridge.json`
- `.jutell-local/`, `.beginner-bridge-local/`
- `.jutell-operator.local.json`
- `artifacts/`

따라서 `git` 저장소에 커밋하더라도 이 파일들은 자동으로 올라가지 않습니다.

## 5. 외부 서버로 자동 전송하지 않습니다

- Telemetry(사용 통계)는 기본적으로 꺼져 있고, 켜더라도 로컬 카운터만 저장합니다.
- 중앙 서버, 계정, 결제, 원격 수집 기능은 현재 버전에 없습니다.
- 네트워크 통신은 Provider 연결(`/use`로 안내하는 Codex·OpenCode 같은 도구)을 시작할 때만 발생하며, JuTell 자체가 사용자 데이터를 외부로 보내지 않습니다.

공개 안전 검사(`npm run check:public`)는 로컬 절대 경로·비밀정보 패턴이 공개 파일에 섞이지 않았는지 확인하는 탐지 전용 도구입니다. 자동 삭제나 자동 수정은 하지 않습니다.

## 6. 저장 위치를 확인하는 방법

```text
jutell status
jutell session
jutell session storage
```

- `jutell status`: 현재 연결 상태, 설정 위치, 프로젝트/사용자 전역 범위를 함께 보여줍니다.
- `jutell session`: 오늘 Session 상태를 봅니다.
- `jutell session storage`: Session 저장 위치가 기본인지 운영자 지정인지 확인합니다.

## 7. 저장 위치를 바꾸는 방법

### 설정 파일 범위 바꾸기

CLI 명령에 `--project`(현재 프로젝트) 또는 `--global`(사용자 전역)을 붙여 설정이 저장되는 범위를 고릅니다.

### Session 저장 위치 바꾸기 (운영자 전용)

```text
jutell session storage set <절대 경로>
jutell session storage reset
```

- `set`: 지정한 절대 경로(같은 컴퓨터 안의 로컬 폴더)에 Session이 저장됩니다.
- `reset`: 운영자 지정을 제거하고 기본 위치로 돌아갑니다.
- 일반 사용자는 이 명령 없이도 기본 위치로 충분히 사용할 수 있습니다.

### Review Bundle 위치

Review Bundle은 항상 현재 프로젝트의 `artifacts/`에 만들어집니다. 위치를 따로 바꾸는 옵션은 제공하지 않습니다.

## 8. 로컬 데이터를 삭제하는 방법

### 직접 삭제

다음 파일과 폴더를 지우면 JuTell이 만든 로컬 데이터가 모두 제거됩니다.

```text
.jutell-local/
.beginner-bridge-local/
.jutell.json
.beginner-bridge.json
.jutell-operator.local.json
artifacts/
```

삭제해도 공개 저장소의 JuTell 제품 코드나 문서에는 영향을 주지 않습니다.

### 명령으로 제거

```text
jutell uninstall --remove-data
```

- 설치를 제거하면서 로컬 데이터 폴더까지 함께 지웁니다.
- 데이터를 유지하고 설치만 제거하려면 `--remove-data` 없이 실행합니다.

> Session 기록을 삭제하기 전에 필요한 내용을 따로 복사해 두었는지 확인하세요. 삭제는 되돌릴 수 없습니다.

## 9. 운영자 내부 저장소와의 관계

이 문서가 설명하는 파일은 모두 **일반 사용자 컴퓨터의 로컬**에 생기는 것입니다.

- JuTell의 공개 제품은 일반 사용자의 로컬 데이터만 다룹니다.
- 운영자가 별도로 보관하는 비공개 자료(전략·로드맵·내부 연구 등)는 공개 JuTell 제품과 완전히 분리되어 있으며, JuTell을 설치하거나 사용할 때 공개 제품이 그 자료에 접근하지 않습니다.
- 일반 사용자는 운영자의 비공개 자료 존재나 위치를 알 필요가 없으며, 알 수도 없습니다.

## 10. 더 보기

- 공개 저장소 정책: `docs/PUBLIC_REPOSITORY_POLICY.md`
- 공개 제품과 운영자 비공개 자료 경계: `docs/OPERATOR_PRIVATE_DATA_BOUNDARY.md`
- 개인정보·오프라인 원칙: `docs/PRIVACY_PRINCIPLES.md`
- 공개 안전 검사: `npm run check:public`