# Workspace 모드 (선택, 운영자·고급 사용자용)

JuTell은 기본적으로 `Project Mode`로 동작합니다. Administrator나 고급 사용자가 공개 저장소와 비공개 작업 공간을 분리해 관리할 때만 선택형 `Workspace Mode`를 사용할 수 있습니다.

- **일반 사용자**: 동작이 변하지 않습니다. Workspace 설정이 없으면 지금까지와 같은 Project 방식 그대로 사용합니다.
- **운영자·고급 사용자**: `jutell workspace init`으로 시작하면 공개·비공개·자료 폴더 구조를 한 곳에서 관리할 수 있습니다.

## 시작과 점검

```text
jutell workspace init              새 Workspace를 만듭니다.
jutell workspace status            Workspace 상태를 확인합니다.
jutell workspace doctor            설정과 폴더 구조를 점검합니다.
jutell workspace doctor --fix      없는 폴더만 안전하게 만들어줍니다.
jutell workspace <명령> --workspace <경로>
                                   지정한 위치의 Workspace를 대상으로 합니다.
```

`JUTELL_WORKSPACE` 환경 변수를 지정하면 해당 위치를 Workspace로 사용할 수도 있습니다. `--workspace`와 동시에 있으면 `--workspace`가 우선합니다.

## Workspace 설정 파일

`jutell.workspace.json`이 Workspace 모드를 결정합니다. 필수 항목 8개가 모두 있어야 유효합니다.

| 폴더 키 | 의미 |
|---|---|
| `public` | 공개용 프로젝트 (독립 Git 가능) |
| `private` | 비공개 작업 공간 (독립 Git 가능) |
| `session` | 하루 Session 기록 |
| `review` | 검토 · 피드백 기록 |
| `archive` | 보관 |
| `export` | 내보내기 |
| `backup` | 백업 |
| `operator` | 운영자 문서 |

모든 폴더 값은 `public`처럼 Workspace 안의 **상대 폴더 이름**만 허용합니다. 절대 경로나 `..` 탈출 경로는 거부됩니다.

## Git 구조

- Workspace Root(`jutell.workspace.json`이 있는 폴더)는 **Git 저장소로 관리하지 않는 것을 권장**합니다. Root에 Git이 있으면 doctor가 경고합니다.
- `public`과 `private`만 각각 독립적인 Git 저장소로 만들 수 있습니다.
- Session·Review·Backup 등 운영 영역은 공개·비공개 Git 경로 **밖**에 있어야 합니다.

## doctor가 자동으로 고치고 고치지 않을 일

`doctor`는 점검만 합니다. config 파일 본문을 자동으로 수정하거나 삭제하지 않습니다.

- `doctor`는 **없는 일반 폴더**를 만들어줄 수 있습니다.
- 누락된 필수 설정 항목은 자동 채우지 않습니다. `--fix`로도 채우지 않습니다.
- 쓰기 권한을 확인하기 위해 임시 검사 파일을 만들고 삭제합니다.
- 이전 버전 설정(V1)을 발견하면 자동 이동·삭제하지 않고 그대로 두는 것을 알려줍니다.

## 지켜야 할 것

- 설정 파일에 비밀 정보(토큰·비밀번호·인증 키 등)를 넣지 않습니다.
- `private` 폴더 이름은 설정 값입니다. 코드에 `jutell-private` 같은 특정 이름을 하드코딩하지 않습니다.
- 오타 등으로 유효하지 않은 설정은 오류로 처리되고, 예상되는 후보 하나만 안내하며 자동 교정하지 않습니다.