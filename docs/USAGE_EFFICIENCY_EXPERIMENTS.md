# 로컬 사용량 효율 실험 (Usage Efficiency Experiments)

## 목적

JuTell의 비개발자 보고서가 실제 사용에서 얼마나 효율적인지, 요청 만들기 템플릿이 어떤 작업에 쓰이는지를 이 컴퓨터 안에서만 측정하고 개선 근거로 사용합니다. 측정 결과는 중앙 서버나 외부로 보내지 않습니다.

## 핵심 원칙

- 사용량 기록은 **기본 OFF**입니다. `.jutell.json`에 `usageMeasurement.localCountersEnabled: true`로 명시적으로 켠 경우에만 기록합니다.
- 기록 OFF 상태에서는 어떤 파일도 만들지 않습니다.
- **저장 금지**: Prompt, AI 답변 원문, 코드, Diff, 파일 경로, 프로젝트 이름, 저장소 URL, API Key, Token, Cookie, 환경변수, 개인정보, MCP Tool arguments.
- 사용자·기기·세션 식별자를 만들지 않습니다.
- 외부 전송은 없습니다. 기록 주체는 로컬 프로세스(파일 쓰기)뿐입니다.
- 기존 Beta Journal(`beta-feedback.json`)과 Style Lab(`settings-history.json`) 저장 구조와 충돌하지 않도록 별도 파일을 사용합니다.
- Dashboard가 꺼져 있어도 MCP 카운터 기록은 동작합니다. MCP는 local-admin 없이 독립 실행되며, 카운터도 MCP 서버가 직접 로컬에 기록합니다.

## 파일 구조

`.jutell-local/` 아래 4개 파일이 역할을 나눠 가집니다.

| 파일 | 기록 주체 | 의미 |
| --- | --- | --- |
| `usage-counters.json` | MCP 서버 직접 기록, Dashboard API(템플릿 복사) | "AI가 얼마나 일했는가?" |
| `usage-experiments.json` | Dashboard API(운영자 명시 행위) | "이번 실험 결과는 어땠는가?" |
| `beta-feedback.json` | Dashboard API | "사용자가 무엇을 불편해했는가?" (기존) |
| `settings-history.json` | Dashboard API | "언제 설정이 바뀌었는가?" (기존) |

## usage-counters.json

MCP 서버가 각 도구 호출을 처리한 뒤 직접 기록하는 최소 런타임 카운터입니다.

```json
{
  "schemaVersion": 1,
  "enabled": true,
  "updatedAt": "2026-08-04T12:00:00.000Z",
  "totalToolCalls": 3,
  "tools": {
    "get_bridge_status": {
      "calls": 2,
      "responseCharacters": 890,
      "lastCalledAt": "2026-08-04T12:00:00.000Z"
    }
  },
  "templateCopies": {
    "FEATURE_REQUEST.md": {
      "count": 1,
      "byTaskType": { "feature": 1 },
      "byProfile": { "balanced": 1 },
      "lastCopiedAt": "2026-08-04T12:00:00.000Z"
    }
  }
}
```

저장 가능 항목은 도구 이름, 호출 수, 응답 문자 수 합계, 마지막 호출 시각, 템플릿 복사 횟수뿐입니다.

### 기록 흐름 (MCP)

1. 도구 호출 처리
2. 정상 응답 생성
3. 응답 문자 수 계산 (text 항목 길이 합계)
4. 카운터 파일 업데이트
5. 원래 MCP 응답 반환

카운터 기록 실패는 도구 호출 자체를 실패시키지 않습니다. 실패는 stderr의 안전한 요약(`JuTell usage counters: ...`)으로만 처리하며 stdout JSON-RPC를 오염시키지 않습니다.

### 동시성

- 프로세스 내부 저장 직렬화(단일 큐) 적용
- 임시 파일 + 원자적 rename
- 기존 파일 보존, 잘못된 JSON이면 자동 덮어쓰기 금지(기록만 중단)
- 저장 실패 시 1회 재시도 후 포기
- 초기화는 읽기마다 결정(설정 변경이 다음 호출부터 반영)

**프로세스 간 위험**: 여러 MCP 프로세스가 동시에 같은 프로젝트의 같은 파일을 쓸 수 있습니다. V1에서는 충돌 가능성을 문서로 명시하고, 재시도와 원자적 rename, 마지막 정상 파일 보존으로 위험을 줄입니다. 완전한 프로세스 간 file lock은 V1 범위가 아닙니다.

### 경로 결정

MCP 서버는 현재 프로젝트의 JuTell 설정 위치를 기준으로 `.jutell-local/usage-counters.json`(기존 `.beginner-bridge-local` 존재 시 그쪽)을 사용합니다. 임의 경로를 입력받지 않으며, 프로젝트 경로를 찾지 못하면 기록하지 않고 MCP 기능은 계속 동작합니다.

## usage-experiments.json

운영자가 명시적으로 시작한 비교 실험의 결과 저장소입니다. 런타임 로그가 아니라 운영자가 수행한 실험 결과만 축적합니다. 이 파일의 목적은 "AI가 무엇을 말했는지 저장하는 것이 아니라, JuTell 개선을 위한 실험 결과만 축적하는 것"입니다.

```json
{
  "schemaVersion": 1,
  "createdAt": "2026-08-04T12:00:00.000Z",
  "updatedAt": "2026-08-04T12:00:00.000Z",
  "experiments": [
    {
      "id": "EXP-001",
      "title": "보고서 길이 비교",
      "status": "completed",
      "profile": "balanced",
      "features": ["changeSummary", "glossary", "riskAssessment"],
      "environment": { "provider": "codex", "mcpEnabled": true, "skillEnabled": true },
      "measurement": { "toolCalls": 6, "responseCharacters": 4210, "estimatedTokens": 1180, "durationMs": 3810 },
      "evaluation": { "understanding": 5, "readability": 4, "accuracy": 5, "overall": 5 },
      "issues": ["용어 설명이 조금 길다"],
      "decision": "balanced 유지",
      "notes": "다음 버전에서 용어 설명 길이를 줄여보기",
      "createdAt": "2026-08-04T12:00:00.000Z",
      "updatedAt": "2026-08-04T12:00:00.000Z"
    }
  ]
}
```

### 저장 가능한 정보

- Experiment ID(서버 생성, `EXP-001` 형식), 생성/수정 시각
- 실험 이름, 상태(진행 중/완료)
- Provider(Codex/OpenCode/기타), Profile, 활성 Feature ID
- MCP 사용 여부, Skill 사용 여부
- Tool 호출 수, 응답 문자 수, 추정 토큰 수, 실행 시간
- 이해도/가독성/정확도/종합(1~5)
- 발견한 문제 목록(각 200자 이하, 최대 20개), 최종 결정, 운영자 메모(각 500자 이하)

### 절대 저장하지 않는 정보

Prompt, AI 응답 원문, 코드, Diff, 파일 내용, 파일 경로, 프로젝트 이름, Git URL, API Key, Token, Cookie, 환경변수, 개인정보, 저장소 정보, MCP Tool arguments.

## API 구성 (local-admin Dashboard)

API 개수를 억지로 맞추지 않고 요구 기능에 따라 결정했습니다. 실험 5개 + 카운터/설정 3개입니다.

### 실험 기록

| 메서드/경로 | 기능 |
| --- | --- |
| `GET /api/usage-experiments` | 실험 목록과 집계 조회 |
| `POST /api/usage-experiments` | 새 실험 기록 생성(운영자 명시 행위) |
| `PATCH /api/usage-experiments/:id` | 평가·측정·결정 등 기존 기록 수정 |
| `POST /api/usage-experiments/template-copy` | 템플릿 복사 이벤트 카운트(템플릿 ID·익명 작업 유형·Profile만 허용) |
| `DELETE /api/usage-experiments` | 전체 삭제(명시적 확인 필수) |

`template-copy`는 `localCountersEnabled` OFF 상태에서는 409로 거부하고 아무 데이터도 만들지 않습니다. 복사한 Prompt 원문이나 템플릿 작성 내용은 저장하지 않습니다. V1에서는 개별 실험 삭제 API를 두지 않습니다(실제 UI 요구가 확인될 때 추가).

### 카운터/설정

| 메서드/경로 | 기능 |
| --- | --- |
| `GET /api/usage-counters` | usage-counters.json 조회(파일 없음/형식 손상 구분) |
| `DELETE /api/usage-counters` | 카운터 전체 삭제(명시적 확인 필수) |
| `PATCH /api/usage-settings` | `localCountersEnabled` ON/OFF 설정 변경 |

### 기록 경로 구분

- MCP 도구 호출 카운터 → **MCP 서버 직접 기록**(파일)
- 템플릿 복사 카운터 → **Dashboard API 기록**(같은 usage-counters.json의 `templateCopies`)
- 사용자 평가(실험) → **usage-experiments API 기록**

## Dashboard 표시

Dashboard는 카운터의 기록 주체가 아니라 조회·관리자 역할입니다.

- `localCountersEnabled` ON/OFF 설정
- `usage-counters.json` 조회(도구별 호출·응답 문자, 템플릿 복사), 카운터 초기화·전체 삭제
- 실험 기록과 런타임 카운터를 구분해 표시
- 실험 집계: 실험 목록, 평균 이해도/가독성/정확도, 평균 응답 길이, 평균 Tool 호출 수, 가장 많이 선택된 Profile, 가장 많이 OFF된 Feature, 가장 많이 보고된 문제, 완료/진행중 실험 수

원본 데이터나 AI 대화는 어디에도 저장하지 않습니다.

## 테스트 기준

- local-admin 미실행 상태에서 MCP 호출 카운터 기록(독립 실행)
- 기록 OFF 상태에서 파일 생성 또는 카운터 증가 없음(템플릿 복사 포함)
- 기록 ON 상태에서 도구별 증가와 응답 문자 수 합산
- 기록 실패해도 MCP 응답 성공, stdout JSON-RPC 오염 없음
- 동시 호출 시 JSON 손상 없음
- 기존 잘못된 파일 자동 덮어쓰기 금지
- Dashboard에서 조회·초기화·전체 삭제
- 외부 전송 없음, 금지 데이터 미저장
- 카운터/실험 삭제가 Beta Journal·Style Lab 파일에 영향 없음

## 관련 문서

- `docs/MCP_SECURITY.md` — MCP 보안 기준
- `docs/REQUEST_BUILDER.md`, `docs/REQUEST_BUILDER_V2.md` — 요청 만들기와 템플릿 사용 횟수 측정
- `docs/FEATURE_CONFIGURATION.md` — 설정 항목 설명
