# Product Boundary

## 문서 목적

JuTell과 다른 제품 영역의 경계를 명확히 하는 공개 Foundation 문서이다. 새 기능을 어디에 둘지, 어떤 기능은 JuTell의 범위가 아닌지 판단하는 기준을 제공한다.

JuTell과 Ju0Symphony는 다음과 같이 나뉜다.

| JuTell    | Ju0Symphony   |
| --------- | ------------- |
| 설명       | 실행          |
| Report    | Orchestration |
| Review    | Multi-Agent   |
| Workflow  | Execution     |
| Dashboard | Agent OS      |

## JuTell의 책임

- 기존 AI Agent에 연결되는 Harness
- 쉬운 설명
- 코드·Diff 해석
- Request Builder
- Workflow·Task·Phase 지침
- Profile·Feature 설정
- 로컬 Dashboard
- MCP·Skill·Connector

## JuTell이 하지 않는 일

- Agent 직접 실행
- 모델 라우팅
- 병렬 Agent 실행
- 작업 자동 분배
- Agent 세션 통합 관리
- API Gateway
- Agent 인증·구독 중계

## Connector와 Agent의 경계

JuTell Connector는 기존 Agent의 공식 설정 경로와 연결한다. Skill, AGENTS.md, MCP 등록, 지침 설치를 돕지만, Agent를 직접 실행하지 않는다. Agent는 사용자가 평소대로 실행하며, JuTell은 그 작업을 이해·검증·운영하도록 돕는다.

## Dashboard와 Agent 실행기의 차이

Dashboard는 선택형 로컬 설정·기록 편집 도구이다. Profile·Feature·limits 설정과 사용자가 직접 작성한 베타 기록을 관리하며, Agent를 실행하거나 세션을 관리하지 않는다. Dashboard가 없어도 Skill 방식과 기본 Profile로 JuTell은 그대로 동작한다.

## JuTell과 Multi-Agent Orchestration의 경계

여러 AI Agent를 직접 실행하고 분배하고 오케스트레이션하는 기능은 JuTell Core의 범위가 아니다.

Ju0Symphony의 구체적인 기능 계획, 일정, 수익화, 내부 전략은 이 문서에 작성하지 않는다.

## 기능 판단 기준

새 기능이 JuTell에 속하는지는 다음 기준으로 판단한다.

- 기존 Agent 하나에 연결되어 작업을 이해·검증·운영하는가 → JuTell
- 여러 Agent를 실행하거나 분배하거나 통합 관리하는가 → JuTell 아님
- Agent 자체를 대체하거나 중계하는가 → JuTell 아님

## 예시

- 쉬운 Diff 설명 → JuTell
- Provider 설정 연결 → JuTell
- 여러 Agent에게 작업 병렬 분배 → JuTell 아님
- Agent 사용량에 따라 모델 자동 교체 → JuTell 아님
- 대규모 작업을 Phase 템플릿으로 나누는 지침 → JuTell
