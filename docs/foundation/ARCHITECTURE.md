# Architecture

User

↓

AI Agent

↓

JuTell Connector

↓

JuTell Core

↓

Project

---

JuTell은

- Core

- Connector

- Dashboard

- Cloud(Optional)

으로 구성된다.

```
JuTell
├── Core
├── Connector
├── Dashboard
└── Cloud (Optional)
```

## 역할

### Core

보고 규칙, Profile·Feature 설정, 로컬 데이터를 관리한다.

항상 오프라인에서 동작하며 Cloud 없이 100% 사용할 수 있다.

### Connector

Agent별 연결 방식을 담당한다.

- Skill
- MCP
- 지침(AGENTS.md, instructions)
- Workflow·Task·Phase 지침

Connector는 Agent를 대신 실행하거나 중계하지 않는다.

Agent가 지원하는 방식으로 설정과 지침만 연결한다.

### Dashboard

설정을 시각적으로 편집하는 도구이다.

필수 프로그램이 아니며, 없어도 Core와 기본 Profile은 동작한다.

### Cloud (Optional)

선택형 미래 기능이다.

- 설정 동기화
- Team
- Premium
- Marketplace
- Beta
- 익명 사용 통계(동의 시)

Cloud를 연결하지 않아도 Core 기능은 모두 사용할 수 있다.
