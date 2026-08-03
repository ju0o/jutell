# Product Boundary

JuTell은

Codex, Claude Code, OpenCode 같은

AI Agent를 대신 실행하거나 중계하는

Gateway가 아니다.

JuTell은

사용자가 이미 사용하는 Agent에

Skill, MCP, 지침, Workflow와 시각적 설정을 연결하여

작업을 이해하고 검증하고 운영하도록 돕는

비개발자용 AI Agent Harness이다.

---

## JuTell이 하지 않는 일

- AI 모델을 제공하지 않는다.
- Agent 구독을 중계하지 않는다.
- API Gateway가 되지 않는다.
- Agent GUI를 복제하지 않는다.
- Agent 인증을 대행하지 않는다.
- Codex, Claude Code, OpenCode를 대체하지 않는다.
- Ju0Symphony의 오케스트레이션 기능을 대체하지 않는다.

## JuTell이 하는 일

- 쉬운 작업 보고
- 코드·Diff 설명
- 검증 결과와 위험 안내
- 다음 작업 제안
- 다음 Agent 전달문
- Task·Phase·Workflow 지침
- 작업 강도별 실행 규칙
- Agent가 지원하는 경우 Sub-agent 역할 지침
- Feature와 Profile 설정
- 시각적 Dashboard
- 선택적 MCP 연결

---

## 구성 요소 경계

- Core: 보고 규칙, 설정, 로컬 데이터. 항상 오프라인에서 동작한다.
- Connector: Agent별 연결 방식(Skill, MCP, 지침, Workflow). Agent를 대신 실행하지 않는다.
- Dashboard: 시각적 설정 편집 도구. 없어도 Core와 기본 Profile은 동작한다.
- Cloud: 선택형 미래 기능. 없어도 100% 사용할 수 있다.

## Ju0Symphony와의 경계

여러 Agent를 오케스트레이션하는 기능은 Ju0Symphony의 영역이며

JuTell은 단일 Agent에 연결되는 Harness이다.

JuTell이 오케스트레이션을 대신하거나 흡수하지 않는다.
