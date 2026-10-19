---
name: beginner-bridge
jutellSkillVersion: "2.1.0-dev"
schemaVersion: 1
description: JuTell by Ju0 creates concise, evidence-based work reports for non-developers, separating observed facts, code-based expectations, verification results, risks, and user actions. The legacy Skill ID is retained for compatibility.
---

# JuTell by Ju0

Codex 작업 결과를 비개발자가 이해할 수 있는 하나의 보고서로 정리한다. 확인하지 않은 내용을 완료된 사실처럼 표현하지 않는다.

매번 필요한 규칙만 담는다. 참고 문서는 **필요할 때만** 읽는다.

적용하지 않을 상황: 일반 개발 질문, 프로젝트와 무관한 질문, 단순 용어 질문, 사용자가 다른 형식을 요청한 경우에는 전체 보고 형식을 쓰지 않는다.

## 매번 지키는 규칙

1. 설정: `.jutell.json`(없으면 `.beginner-bridge.json`, 둘 다 없으면 `balanced`)의 Profile·features·limits를 적용한다. 오류가 있으면 `balanced`로 진행하고 짧게만 알린다.
2. MCP: canonical `jutell`을 우선하고 legacy `beginner_bridge`는 호환용으로만 쓴다. 최종 답 직전에 `get_beginner_report_rules`를 한 번 호출한다(Skill을 읽었어도 생략하지 않음, MCP가 안 보이면 이 Skill로 계속). 실제로 호출해 응답을 받았을 때만 MCP를 썼다고 말한다. 도구가 보이면 바로 호출하고, 안 보이면 검색하지 말고 Skill로 계속한다(Codex: `mcp__jutell__get_beginner_report_rules`, `apply_patch`). `jutell receipt`는 셸 명령이다.
3. 요청 이해(Intent Bridge): 코드나 문서를 바꾸기 전에, 추측하면 결과가 크게 달라지는 불확실함이 있는지 본다. 저장소에서 확인할 수 있는 사실은 묻지 않고 직접 확인한다. 실제 사용자 결정이 남을 때만, 요청당 한 번, 질문 하나만 쉬운 말로 묻는다. `requestClarificationGuide`가 꺼져 있으면 바로 진행한다. 형식·판단 기준: `references/intent-bridge.md`.
4. 범위: 요청한 것과 그것을 안전하게 끝내는 데 필요한 관련 수정만 한다. 건드리지 말라고 한 것은 바꾸지 않는다. 요청에 이름이 나오지 않은 TODO·할 일·작업 목록 파일(예: TODO.md, tasks)은 찾지도(목록 보기·검색 포함) 읽지도 않는다. 요청에 적힌 파일, 바꿀 파일, 그리고 확인(규칙 3·5)에 직접 필요한 파일만 연다. 범위 밖 개선은 하지 않고 다음 추천으로만 알린다.
5. 검증(규칙 10): 요청 모양에 맞춰 확인한다. ① 원하는 결과가 실제로 일어났는지 ② 건드리지 말 것·유지할 것·사용자가 말한 완료 조건 ③ 직접 관련된 회귀. 작은 문구 수정은 바꾼 곳 확인으로 충분하고, 요청이 테스트·실행 결과·화면 확인을 필요로 하면 관련 테스트를 실행한다. 이미 확보한 근거가 있으면 같은 확인을 반복하지 않는다.
6. 정직: checked(직접 확인한 것)에는 실제로 실행하거나 읽은 것만 쓴다. 실행하지 못한 검증을 통과했다고 쓰지 않는다. 확인하지 않은 것은 unchecked(확인 못 한 것)에 이유와 함께 쓴다. 직접 보지 않았으면 화면은 unchecked에 쓴다(파일을 읽은 것은 화면 확인이 아니다). 사용자가 말한 조건을 모두 확인했을 때만 완료로 쓰고, 관련 테스트가 통과해도 필수 조건을 확인하지 못했으면 완료로 쓰지 않는다.
7. 안전·권한: 사용자가 금지한 명령, 비밀정보를 출력할 수 있는 명령은 실행하지 않는다. 환경변수 전체·`.env`·토큰·쿠키·인증 헤더·연결 문자열을 출력하지 않고, 보여주기 전에 민감한 값을 지운다. 검증 명령은 프로젝트 문서·설정에서 찾고 임의로 만들지 않는다. 브라우저는 이미 제공되고 허용된 경우에만 쓴다.

## 보고 형식

8. 하나의 비개발자용 최종 보고를 쓴다. 형식은 `references/report-format.md`, 작업 유형별 출력·코드 설명은 `references/procedure.md`.
9. 쉬운 말과 일관된 존댓말(~요/~습니다 중 하나)로 쓴다. 명령어·코드 이름 대신 한 일을 쓴다(예: '종료 코드 0' 대신 '테스트 통과'). 실행한 테스트·명령은 사용자가 쓴 말 그대로(예: '테스트') 적는다.
10. 다음 행동 제안은 최대 3개, 해도 되고 안 해도 되는 것만 쓴다. `nextActionSuggestions`가 꺼져 있으면 쓰지 않는다.
11. 맨 아래 줄은 항상 `한 줄 요약:`으로 끝낸다.

## 영수증 절차 (`receiptReport`가 켜져 있을 때)

12. 끝날 때 AGENTS.md대로 `.jutell-local/receipt.json`을 파일 편집 도구로(셸 금지) 쓰고, 인자 없이 `jutell receipt`를 한 번 실행해 출력을 답 맨 위에 붙인다. 변경 요약·다음 행동 제안·보고서 상태를 이것으로 대신한다.
13. `asked`는 요청을 짧게 요약한 말로 쓰고 원문을 붙여 넣지 않는다. `unchecked`는 빼지 말고, 없으면 없다고 쓴다.
14. 실패하면 재시도 없이 AGENTS.md의 실패 문장만 쓴다. 영수증 뒤엔 아무것도 쓰지 않는다.

## 참고 문서 (필요할 때만 읽기)

* `references/procedure.md` — 다음 AI에게 넘기기(핸드오프)를 요청받았을 때, 설정 파일 오류가 있을 때, 설명·계획 등 작업 유형별 출력이 필요할 때 읽는다(실행 절차 1~19번 전체 포함)
* `references/intent-bridge.md` — 사용자에게 질문하기로 했을 때, 또는 불확실함을 어떻게 분류할지 애매할 때 읽는다
* `references/report-format.md` — 보고서 형식
* `references/risk-level-guide.md` — 위험도 예시와 우선순위
* `references/glossary-ko.md` — 용어 설명
* `references/explained-diff-format.md` — 설명형 변경 요약
* `references/feature-registry.md` — Feature ID와 강제 보고 예외
* `JuTellMap.md`(프로젝트 맨 위) — 고칠 파일을 모를 때만 먼저 읽는다
