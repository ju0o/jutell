# Codex Beginner Bridge 시작하기

## 이 문서는 무엇을 설명하나요?

처음 보는 사람이 Beginner Bridge의 역할과 현재 범위를 빠르게 이해하도록 돕는 안내서입니다. 모든 문서를 처음부터 읽을 필요는 없습니다.

## Beginner Bridge의 역할

Beginner Bridge는 Codex 작업 뒤에 다음을 구분해 보고하도록 돕는 Codex Skill입니다.

- 실제로 확인한 사실
- 코드만 보고 예상한 변화
- 아직 확인하지 못한 내용
- 사용자가 직접 확인하거나 결정할 내용

Beginner Bridge 자체가 코드를 실행하거나 화면을 대신 승인하는 제품은 아닙니다.

## Skill과 설정 파일

`.agents/skills/beginner-bridge/SKILL.md`는 보고서를 만드는 실행 규칙입니다. 프로젝트 루트의 [`.beginner-bridge.json`](../.beginner-bridge.json)은 보고서의 선택 기능과 길이 제한을 정합니다. 설정 파일이 없거나 잘못되면 `balanced` 기본값으로 진행합니다.

Profile은 다음과 같이 사용합니다.

| Profile | 쉬운 설명 |
|---|---|
| `minimal` | 짧은 보고서. 선택적인 내부 설명과 용어 설명을 줄입니다. |
| `balanced` | 기본값. 변경, 검증, 위험, 사용자 확인을 균형 있게 설명합니다. |
| `learning` | 필요한 개발 용어를 조금 더 설명합니다. |
| `detailed` | 복잡하거나 위험한 작업을 더 자세히 설명합니다. |

안전 문제, 핵심 실패, 중요한 미확인 사항, 비밀정보 위험은 Profile로 숨길 수 없습니다.

## V0.1 검증 상태

예제 프로젝트는 [`examples/v0.1-test-app/`](../examples/v0.1-test-app/)에 있습니다. 시나리오 A와 B의 기술 실행 기록은 [`tests/results/`](../tests/results/)에 보존되어 있습니다. 현재 기록은 코드와 자동 검증 중심이며, 실제 비개발자 평가가 완료된 것은 아닙니다.

## 실제 프로젝트에서 처음 사용하는 순서

1. 작업 전 Git 상태와 기존 변경을 확인합니다.
2. 작은 작업부터 `balanced` Profile로 사용합니다.
3. 작업 뒤 안전한 테스트·검사·빌드를 실행합니다.
4. Skill 보고서에서 실제 확인과 예상을 구분해 읽습니다.
5. 사용자가 직접 화면에서 확인할 항목을 확인합니다.
6. 길이, 어려운 표현, 빠진 정보가 있으면 [베타 피드백 양식](BETA_FEEDBACK_TEMPLATE.md)에 기록합니다.

Prompt, 코드, 파일 경로, 비밀정보를 피드백에 그대로 적지 않습니다. 오류를 기록해야 한다면 민감한 내용을 제거한 짧은 요약만 사용합니다.

## 문제가 생기면 어디를 보나요?

- 보고서 형식이나 상태가 궁금하면 [BEGINNER_REPORT_SPEC.md](BEGINNER_REPORT_SPEC.md)를 봅니다.
- Profile과 Feature가 궁금하면 [FEATURE_CONFIGURATION.md](FEATURE_CONFIGURATION.md)를 봅니다.
- 용어가 이상하면 [GLOSSARY_POLICY.md](GLOSSARY_POLICY.md)와 [glossary reference](../.agents/skills/beginner-bridge/references/glossary-ko.md)를 봅니다.
- 시나리오나 평가 기준이 궁금하면 [TEST_SCENARIOS.md](TEST_SCENARIOS.md)를 봅니다.
- 기록·개인정보·Telemetry가 궁금하면 [DOCUMENTATION_MAP.md](DOCUMENTATION_MAP.md)에서 해당 문서만 선택합니다.

## 현재 단계

## 로컬 관리자 실행

로컬 관리자 화면은 개인 베타 준비용으로 구현되어 있습니다.

```bash
cd apps/local-admin
npm install
npm run dev
```

브라우저에서 `http://127.0.0.1:5174`를 엽니다. API도 `127.0.0.1:8787`에 함께 실행되며 외부 네트워크 주소에 공개하지 않습니다. 포트가 사용 중이면 `BB_LOCAL_ADMIN_PORT`와 `BB_LOCAL_ADMIN_VITE_PORT` 환경변수로 바꿀 수 있습니다.

현재 단계는 개인 베타 준비입니다. 다음 단계는 이 화면을 중앙 서비스로 확장하는 것이 아니라, 실제 사용에서 반복되는 문제와 필요한 설정을 기록하는 것입니다.
