# Beginner Bridge Telemetry Event Registry

## 1. 문서 범위

이 문서는 향후 확장을 위한 공식 Event Registry다. 현재 V0.1에서는 이벤트를 생성·저장·전송하지 않는다.

Registry의 이벤트 `id`는 이벤트 종류를 나타내는 고정된 문서 식별자다. 사용자나 기기를 식별하는 고유 이벤트 ID를 만들지 않는다.

## 2. 공통 규칙

각 이벤트에서 허용하는 공통 필드는 다음으로 제한한다.

* `beginner_bridge_version`: Beginner Bridge 버전
* `skill_version`: Skill 버전
* `profile`: `minimal`, `balanced`, `learning`, `detailed` 중 하나
* `active_features`: 공식 Feature ID 목록
* `inactive_features`: 공식 Feature ID 목록
* `os_type`: `windows`, `macos`, `linux`, `other` 중 하나

검증 이벤트에서만 `validation_kind`, `result`, 제한된 `failure_category`를 사용할 수 있다. 자유 텍스트 값은 허용하지 않는다.

다음은 공통으로 기록하지 않는다.

* 고유 사용자·기기·세션 ID
* 이메일, 사용자 이름, 계정 정보
* timestamp, 위치, 호스트 이름, IP 주소
* 프로젝트 이름, Repository URL, 파일 경로
* Prompt, AI 답변, 코드, Git diff
* 명령 원문, 오류 로그, 스택 트레이스
* API Key, 환경 변수, 비밀번호, Token, Cookie

## 3. 공식 Event Registry

### `feature_enabled`

* 설명: 특정 Beginner Bridge Feature가 활성화된 설정 변경
* 기록 가능한 필드: `feature_id`, `profile`, `beginner_bridge_version`, `skill_version`, `os_type`
* 절대 기록하면 안 되는 정보: 사용자가 설정한 원문, 프로젝트 정보, 설정 파일 전체, 사용자·기기 식별값

### `feature_disabled`

* 설명: 특정 Beginner Bridge Feature가 비활성화된 설정 변경
* 기록 가능한 필드: `feature_id`, `profile`, `beginner_bridge_version`, `skill_version`, `os_type`
* 절대 기록하면 안 되는 정보: 비활성화 이유의 자유 입력, 설정 파일 전체, 프로젝트 정보, 사용자·기기 식별값

### `profile_changed`

* 설명: Beginner Bridge Profile이 변경된 설정 변경
* 기록 가능한 필드: `from_profile`, `to_profile`, `beginner_bridge_version`, `skill_version`, `os_type`
* 절대 기록하면 안 되는 정보: 설정 파일의 원문, 사용자 선택 이유, 프로젝트 정보, 사용자·기기 식별값

### `report_generated`

* 설명: Beginner Bridge 최종 보고서 생성 시도 또는 생성 완료를 나타내는 이벤트
* 기록 가능한 필드: `profile`, `active_features`, `inactive_features`, `beginner_bridge_version`, `skill_version`, `os_type`
* 절대 기록하면 안 되는 정보: 보고서 원문, 변경 파일 목록, Prompt, 코드, 사용자 행동의 원문

### `validation_completed`

* 설명: 제한된 검증 종류가 성공한 이벤트
* 기록 가능한 필드: `validation_kind` (`test`, `typecheck`, `build`, `browser` 중 하나), `result` (`success`), `profile`, `beginner_bridge_version`, `skill_version`, `os_type`
* 절대 기록하면 안 되는 정보: 명령 원문, 테스트 이름·출력, 오류 로그, 파일·프로젝트 정보

### `validation_failed`

* 설명: 제한된 검증 종류가 실패한 이벤트
* 기록 가능한 필드: `validation_kind`, `result` (`failure`), `failure_category` (`test`, `typecheck`, `build`, `browser`, `permission`, `environment` 중 하나), `profile`, `beginner_bridge_version`, `skill_version`, `os_type`
* 절대 기록하면 안 되는 정보: 실패 메시지 원문, 스택 트레이스, 명령 원문, 파일·프로젝트 정보

### `configuration_error`

* 설명: 로컬 Beginner Bridge 설정을 해석할 수 없어 안전한 기본값을 사용한 이벤트
* 기록 가능한 필드: `error_category` (`json_syntax`, `unknown_profile`, `unknown_feature`, `invalid_boolean`, `invalid_limit`, `unsupported_version` 중 하나), `fallback_profile` (`balanced`), `os_type`, `beginner_bridge_version`, `skill_version`
* 절대 기록하면 안 되는 정보: 잘못된 설정값 원문, 설정 파일 전체, 경로, 환경 변수, 사용자 입력

### `glossary_used`

* 설명: 보고서에 용어 설명 Feature가 사용된 이벤트
* 기록 가능한 필드: `profile`, `term_count` (0~10의 정수), `beginner_bridge_version`, `skill_version`, `os_type`
* 절대 기록하면 안 되는 정보: 설명한 용어 이름, 코드·파일 문맥, 보고서 원문, 프로젝트 정보

## 4. 확장 규칙

새 이벤트나 필드를 추가하려면 먼저 `TELEMETRY_POLICY.md`의 허용 범위와 개인정보 원칙을 검토한다. Registry에 없는 필드는 수집 가능한 정보로 간주하지 않는다.

동의 상태 자체를 사용자 행동 통계로 기록하지 않는다. 동의는 Telemetry를 켜고 끄는 로컬 제어 상태로 취급한다.
