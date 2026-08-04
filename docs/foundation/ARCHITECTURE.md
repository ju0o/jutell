# Architecture

## 구성 개요

JuTell은 기존 AI Agent를 대체하지 않는다. 사용자와 프로젝트 사이에 놓여 기존 Agent가 더 쉽고 안전하게 작업하도록 돕는 Harness이다.

```
사용자
  ↓
기존 AI Agent (Codex · OpenCode · Claude Code · Cline)
  ↓
JuTell Connector (Agent 공식 설정 연결)
  ↓
JuTell Core (Agent 비종속 지식·지침)
  ↓
프로젝트
```

JuTell은 다음으로 구성된다.

```
JuTell
├── Core           (Agent와 무관한 핵심 동작)
├── Connector      (기존 Agent와의 연결)
├── Dashboard      (선택형 설정·기록 편집 도구)
└── Cloud (Optional) (선택형 미래 계층, 아직 없음)
```

Dashboard는 없어도 JuTell이 동작한다. Skill만으로 보고와 지침을 제공하고, MCP와 Dashboard는 선택형 경로이다.

---

## 1. 기존 AI Agent

JuTell이 동작하는 기반이다. JuTell은 모델을 만들지 않고 기존 Agent를 대체하지 않는다. Agent의 공식 설정 경로와 호환되는 방식으로만 연결한다.

## 2. JuTell Connector

- 기존 Agent의 공식 설정 파일과 연결한다.
- Skill, AGENTS.md, 지침을 프로젝트에 설치한다.
- MCP 등록을 돕는다.
- 연결을 켜고 끌 수 있으며, 설정과 기록은 보존한다.
- 기존 사용자의 Agent 설정을 임의로 덮어쓰거나 삭제하지 않는다.
- Agent를 직접 실행하지 않는다. Agent는 사용자가 평소대로 실행한다.

현재 Provider 지원 상태:

- Codex: 지원
- OpenCode: 베타 (설정 등록 지원)
- Claude Code, Cline: 준비 중

## 3. JuTell Core

Agent와 무관하게 항상 적용되는 핵심 지식과 지침이다.

- 쉬운 설명: 작업을 비개발자 관점에서 설명한다.
- 코드와 Diff 해석: 변경 내용을 보기 쉽게 해석한다.
- 코드 리뷰: 프로젝트 운영 관점에서 검토 지침을 제공한다.
- 프로젝트 운영: Workflow·Task·Phase 지침을 제공한다.
- Report: 작업 보고서 형식을 제공한다.
- 용어 설명: 용어 정책을 제공한다.
- 요청 만들기 (Request Builder): 사용자 → AI Agent 방향의 요청 템플릿을 제공한다.
- Profile·Feature·limits: 사용자에게 맞는 보고 방식과 제한값을 제공한다.

## 4. MCP (선택형)

- Dashboard(local-admin)와 독립적으로 동작하는 stdio 서버이다.
- Dashboard가 꺼져 있거나 없어도 MCP는 기능한다.
- 인증이나 API Key를 다루지 않는다.
- Prompt, 코드, Diff 원문을 저장하지 않는다.
- 외부로 전송하지 않는다.
- 선택형 로컬 사용량 카운터가 켜진 경우에만 도구 이름·호출 수·응답 문자 수 합계·시각을 로컬 파일에 기록한다.

## 5. Dashboard (선택형)

로컬 전용 설정·기록 편집 도구이다. 중앙 서버가 없다.

- 설정과 베타 기록 관리 (로컬 전용, 중앙 서버 없음)
- 요청 만들기 (Request Builder) — 사용자 → AI Agent 방향 요청 템플릿 (V1)
- 선택형 로컬 사용량 측정 (기본 OFF)

Dashboard는 사용자가 직접 작성한 기록만 다루며 외부로 전송하지 않는다. Dashboard를 실행하지 않아도 Skill 방식과 기본 Profile로 JuTell은 그대로 동작한다.

## 6. Local Storage

설정과 기록은 프로젝트 로컬에 저장된다.

- 설정: 프로젝트 루트의 `.jutell.json`
- 로컬 데이터: 프로젝트 루트의 `.jutell-local/` (Beta Journal, 설정 기록, 사용량 카운터, Style Lab 등)

`.jutell-local/` 아래는 파일별 역할을 나누어 저장하며, 현재 다음 파일이 사용된다.

- Beta Journal (사용자가 직접 작성한 기록)
- 설정 기록 (변경 내역)
- 사용량 카운터 (`usage-counters.json`, 선택형)
- Style Lab 설정 (선택형)

저장하지 않는 것:

- Prompt와 코드 원문
- 파일 경로, 프로젝트 이름, 저장소 URL
- API Key와 식별자
- 오류 원문과 개인 정보

## 7. Request Builder

- V1: 현재 제공 중인 사용자 → AI Agent 방향 요청 템플릿이다.
- V2: 예정된 확장이다. 현재 구현된 기능처럼 서술하지 않는다.

## 8. Local Usage Measurement

- 선택형이며 기본적으로 꺼져 있다.
- MCP 서버가 자신의 도구 호출을 직접 기록한다.
- Dashboard에서 켜고 끄며 조회하고 삭제할 수 있다.
- Provider(Codex 등)의 토큰 사용량을 추측하거나 계산하지 않는다.

## 9. Cloud (Optional)

- 선택형 미래 계층으로, 현재 구현되지 않는다.
- 수익화 전략, 가격, Private Roadmap은 공개 문서에 기재하지 않는다.

---

## 시스템 경계

하는 일:

- 쉬운 설명, Diff 해석, 코드 리뷰, 프로젝트 운영, Workflow, Report, 용어 설명
- 요청 만들기 (사용자 → AI Agent 방향 요청 템플릿)
- 로컬 사용량 측정 (선택형, 기본 꺼짐)
- 로컬 설정·기록 관리 (중앙 서버 없음)

하지 않는 일:

- 모델을 만들지 않는다.
- IDE를 만들지 않는다.
- 기존 AI Agent를 대체하지 않는다.
- AI가 할 일을 대신하지 않는다.
- 데이터를 외부로 전송하지 않는다.
- 사용자의 기존 설정을 임의로 덮어쓰지 않는다.
