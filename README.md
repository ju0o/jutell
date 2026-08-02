# Codex Beginner Bridge

Codex Beginner Bridge는 Codex가 작업한 내용을 비개발자도 이해할 수 있게 정리하는 Codex Skill입니다. 실제로 확인한 사실, 코드만 보고 예상한 내용, 사용자가 직접 확인할 내용을 나누어 짧은 보고서로 제공합니다.

## 누구를 위한 도구인가요?

Codex로 웹사이트나 프로그램을 만들지만 코드 변경의 의미를 직접 읽기 어려운 사람, 작은 프로젝트의 결과를 확인하고 싶은 사람을 위한 도구입니다.

## 지금 할 수 있는 일

- 코드나 프로젝트 파일을 바꾼 뒤 변경 내용과 검증 결과를 쉬운 말로 보고합니다.
- 프로젝트 루트의 [`.beginner-bridge.json`](.beginner-bridge.json)에서 보고서 Profile과 선택 Feature를 조절합니다.
- `apps/local-admin/`에서 Profile, Feature, limits와 개인 베타 피드백을 로컬로 관리합니다.
- `apps/local-admin/`에서 선택형 로컬 MCP 연결 상태를 확인하고 읽기 전용 MCP 서버를 시작·중지할 수 있습니다.
- V0.1 검증용 예제 프로젝트에서 화면 변경과 입력 검증 시나리오를 확인할 수 있습니다.
- Telemetry의 정책과 미래 확장 구조를 문서로 정의했지만, 현재 이벤트를 저장하거나 전송하지는 않습니다.

## 아직 하지 않는 일

현재는 개인 베타 준비 단계입니다. 원격 Telemetry, 중앙 서버, 계정, 결제와 npm 공개 배포는 구현하지 않았습니다. MCP는 로컬 선택 기능이며 Skill 방식을 대체하지 않습니다.

## 가장 빠른 사용 순서

Distribution CLI V0.1은 아직 npm에 공개되지 않았습니다. 로컬 패키지를 검증할 때는 먼저 `packages/cli/`에서 패키지를 만들고 설치합니다.

```bash
cd packages/cli
npm install
npm pack
npm install -g ./codex-beginner-0.1.0.tgz
beginner-bridge setup
beginner-bridge
```

공개 후의 목표 사용 흐름은 다음과 같습니다.

```bash
npm install -g codex-beginner
beginner-bridge setup
beginner-bridge
```

자세한 범위와 격리된 설치 검증은 [CLI 설치 안내](docs/CLI_INSTALLATION.md)와 [배포 구조](docs/DISTRIBUTION_ARCHITECTURE.md)를 참고합니다.

1. [문서 시작점](docs/START_HERE.md)에서 현재 범위와 첫 사용 순서를 확인합니다.
2. 필요하면 [Feature 설정](docs/FEATURE_CONFIGURATION.md)을 읽고 `.beginner-bridge.json`의 Profile을 선택합니다.
3. Codex 작업이 끝난 뒤 Beginner Bridge Skill을 사용해 결과를 보고합니다.
4. 필요하면 [로컬 관리자 실행](docs/START_HERE.md#로컬-관리자-실행)으로 설정과 피드백을 관리합니다.
5. 실제 사용 중 불편한 점은 [개인 베타 피드백 양식](docs/BETA_FEEDBACK_TEMPLATE.md)에 짧게 기록합니다.

## 문서 안내

- [START_HERE.md](docs/START_HERE.md): 처음 읽을 문서
- [DOCUMENTATION_MAP.md](docs/DOCUMENTATION_MAP.md): 문서별 역할과 필요한 읽기 순서
- [PERSONAL_BETA_PLAN.md](docs/PERSONAL_BETA_PLAN.md): 개인 베타 사용과 판단 기준
- [LOCAL_ADMIN_REQUIREMENTS.md](docs/LOCAL_ADMIN_REQUIREMENTS.md): 로컬 관리자 V0.1 요구사항과 현재 구현 범위
- [MCP_INTEGRATION.md](docs/MCP_INTEGRATION.md): 로컬 MCP 연결과 Codex 확인 절차
- [MCP_SECURITY.md](docs/MCP_SECURITY.md): MCP가 읽고 읽지 않는 데이터와 설정 보호 기준
- [개인정보 원칙](docs/PRIVACY_PRINCIPLES.md)과 [Telemetry 정책](docs/TELEMETRY_POLICY.md): 기록·전송에 대한 현재 원칙

## 개인정보와 Telemetry

Beginner Bridge는 코드, Prompt, AI 답변 원문, 파일 경로와 비밀정보를 Telemetry 대상으로 삼지 않습니다. Telemetry 기본값은 OFF이며 현재는 실제 저장과 외부 전송을 구현하지 않았습니다.

## 현재 단계

현재 단계는 개인 베타 준비입니다. 로컬 관리자 V0.1과 V0.1 시나리오 A·B의 기술 검증 기록은 있지만, 비개발자 평가와 공개 베타 판단은 아직 남아 있습니다.
