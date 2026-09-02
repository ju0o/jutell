# JuTell — by Ju0

**AI는 코드를 만들고, JuTell은 사람이 그 작업을 이해하고 확인하고 다음 작업으로 이어가도록 돕습니다.**

코딩 에이전트는 일을 잘 해내지만, 그 설명은 비개발자가 이해하기 어렵습니다.
JuTell은 이미 쓰고 있는 에이전트 옆에서 — 무슨 일이 바뀌었는지, 어디를 확인해야 하는지, 다음 AI에게 무엇을 전달하면 되는지를 사람이 읽을 수 있는 언어로 정리해 줍니다.

JuTell은 코딩 에이전트도, AI 모델도, IDE도 아닙니다. 지금 쓰는 에이전트와 함께 동작하는 설명·검증·이어가기 레이어입니다.

---

### 30초 요약

| 궁금한 것 | 답 |
|---|---|
| **무엇인가요?** | AI가 바꾼 코드를 쉬운 보고서로 풀어주는 로컬 도구 |
| **왜 쓰나요?** | "뭘 바꾼 건지", "진짜 확인된 건지", "어디가 중요한지"를 바로 알기 위해 |
| **뭘 해주나요?** | 쉬운 작업 보고 · 중요한 코드 1~2개 독해 · 확인/예상/미확인 구분 · 다음 AI에게 전달하기 |
| **어떤 에이전트와 쓰나요?** | Codex (지원) · OpenCode (베타) · Claude Code (베타) |
| **어떻게 설치하나요?** | `npm install -g jutell` → `jutell use codex` |

```powershell
npm install -g jutell
cd <프로젝트 폴더>
jutell use codex
# OpenCode 또는 Claude Code라면 jutell use opencode / jutell use claude
```

> `jutell@0.3.0` — npm에 공개되어 있습니다. `npm install -g jutell` 로 설치합니다.

---

## 왜 JuTell이 필요한가요?

AI에게 코드를 맡기면 이런 순간이 옵니다.

- "AI가 코드를 수정했는데 정확히 뭘 한 건지 모르겠다."
- "테스트를 했다고 하는데 진짜 확인된 것과 예상한 것이 섞여 있다."
- "다른 AI에게 이어서 맡기고 싶은데 대화 전체를 다시 설명해야 한다."
- "Diff를 봐도 어디가 중요한지 모르겠다."

JuTell은 이 혼란을 하나의 보고서로 정리합니다. 원래 용어는 유지하되, 옆에 쉬운 설명을 덧붙이고 근거·위험·다음 확인 항목을 분리합니다.

---

## JuTell을 쓰면 무엇이 달라지나요?

### 1. 쉬운 작업 보고
무슨 기능이 어떻게 바뀌었는지, 비개발자도 읽을 수 있는 문장으로 정리합니다.
"무슨 파일이 바뀌었나"가 아니라 "사용자에게 무엇이 달라지나"를 중심으로 설명합니다.

### 2. 중요한 코드 독해 — 최대 1~2개
전체 Diff를 쏟아내지 않습니다. 이미 확인한 변경 중 가장 중요한 코드 **최대 1~2개만** 골라

- **중요한 코드** (짧은 스니펫)
- **쉬운 설명**
- **영향** (이 코드를 바꾸면 무엇이 달라지는지)

를 함께 보여줍니다. 시각적 Diff 뷰어가 아니라, 읽어주는 설명입니다.

### 3. 확인된 것과 아직 모르는 것 구분
섞여 있으면 위험합니다. JuTell은 명확히 나눕니다.

- **확인됨** — 파일을 읽거나 명령을 실행해 직접 확인
- **예상** — 코드는 그렇게 보이지만 실행으로 확인하지 않음
- **미확인** — 검증 수단이 없거나 실행하지 못함
- **위험도** — 낮음 / 중간 / 높음 / 판정 불가 (검증 상태와 별도로 판단)

"통과했다고 해서 화면까지 확인된 것은 아닙니다"처럼 범위를 정확히 적습니다.

### 4. 다음 AI에게 전달하기
현재까지 확인된 근거만으로, 복사해서 다음 AI에게 바로 붙여넣을 수 있는 짧은 전달 메모를 만듭니다. 대화 전체를 다시 설명할 필요가 없습니다.

> 이 4가지가 핵심입니다. 그 외 기능은 필요할 때 켜고 끌 수 있습니다.

**선택 기능**
- Feature ON/OFF — `changeSummary`, `userVisibleChanges`, `internalChanges`, `mainFiles`, `explainedDiff`, `glossary`, `validationResults`, `riskAssessment`, `userActions` 등 13개를 각각 켜고 끌 수 있습니다. 안전·데이터 손실과 관련된 내용은 꺼져 있어도 짧게 남깁니다.
- Reporting profiles — `minimal` / `balanced`(기본) / `learning` / `detailed` 중 하나로 보고서 길이를 조절합니다.
- Voice presets — `default` / `plain` / `learning` / `jutell` 중 말투만 바꿉니다. 사실·검증·위험을 줄이거나 과장하지 않습니다.

---

## 실제 출력은 이렇게 생겼습니다

검색어 없이 검색 버튼을 눌렀을 때를 예로 든, 짧은 합성 예시입니다.

```text
[무엇이 바뀌었나요?]
검색어가 비어 있으면 검색 요청을 보내지 않도록 바뀌었습니다.
이전에는 빈 검색어가 그대로 전송되었습니다.

[중요한 코드] — 1개
  if (!query.trim()) return;
  - 쉬운 설명: 검색어 앞뒤 공백을 제거해 비어 있으면 함수를 끝냅니다.
  - 영향: 빈 검색으로 인한 불필요한 요청과 오류 화면을 막습니다.

[확인된 것과 아직 모르는 것]
- 확인됨 (근거: 파일, Git diff) — 위 코드가 추가된 것은 확인했습니다.
- 예상 (근거: 코드 예상) — 버튼을 눌러도 요청이 가지 않을 것으로 예상됩니다.
- 확인하지 못함 — 실제 브라우저에서 빈 검색 동작은 확인하지 못했습니다.
- 위험도: 낮음 — 검색 버튼 동작에만 영향을 줍니다.

[다음 AI에게 전달하기 — 복사해서 붙여넣기]
> 검색 폼 빈 값 검증 추가됨 (src/components/SearchForm.tsx).
> 확인됨: 빈 값이면 return으로 요청 차단. 미확인: 브라우저 실제 동작.
> 다음 작업 시 빈 값·공백·정상 검색어 3가지를 브라우저에서 확인 필요.

[사용자 확인 필요]
- 브라우저에서 검색어를 비우고 검색 버튼을 눌러 요청이 가지 않는지 확인해 주세요.
- 보고서 상태: 추가 확인 필요
```

> 실제 보고서는 작업 규모에 따라 길이가 달라지며, 단순 작업은 12문장·25줄 이내로 간결하게 유지됩니다.

---

## 어떻게 동작하나요?

- **이미 쓰는 에이전트 옆에서 동작합니다.** 에이전트를 대신 실행하거나 중계하지 않습니다. 에이전트가 남긴 파일·Git diff·명령 결과를 재사용해 설명합니다.
- **로컬 우선.** 보고서 규칙과 설정은 내 컴퓨터에서 동작하며, 클라우드 없이 100% 사용할 수 있습니다.
- **자동 업로드 없음.** 프로젝트 코드, 프롬프트, AI 답변 원문, diff, 비밀정보를 자동으로 수집하거나 외부로 보내지 않습니다. Telemetry는 기본 OFF이며 이번 단계에서 저장·전송을 구현하지 않았습니다.
- **Skill이 기본, MCP는 선택.** Skill(보고 규칙)이 기본 경로입니다. MCP는 로컬 읽기 전용 연결로, 꺼지거나 실패해도 Skill 방식으로 보고서가 동작합니다.

JuTell이 하지 않는 것: AI 모델 제공 / API 게이트웨이 / Agent GUI 복제 / 인증 대행 / Codex·Claude Code·OpenCode 대체 / 오케스트레이션

---

## 설치 — 5분

**요구 사항:** Node.js 18 이상, Windows·macOS·Linux에서 `npm` 사용 가능

```powershell
# 1. 설치 (npm registry)
npm install -g jutell

# 2. 프로젝트 폴더로 이동
cd <프로젝트 폴더>

# 3. 쓰는 에이전트에 연결 (하나만 고르기)
jutell use codex      # 권장
jutell use opencode   # 베타
jutell use claude     # 베타 — claude-code 별칭도 동일

# 4. 안내에 따라 보고 방식 고르기
#    → .jutell.json, Skill, AGENTS.md, MCP 연결이 한 번에 준비됩니다.

# 그냥 jutell 만 쳐도 같은 안내가 시작됩니다.
jutell
```

설치가 끝나면 지금 쓰는 에이전트에서 평소처럼 작업하고, 작업이 끝나면 JuTell 규칙으로 보고서가 정리됩니다.

<details>
<summary>개발자·기여자용 로컬 설치 (tarball 검증)</summary>

저장소에서 직접 패키지를 검증할 때만 사용합니다. 일반 사용자는 위의 `npm install -g jutell`을 사용하세요.

```bash
cd packages/cli
npm install
npm pack
npm install -g ./jutell-1.0.0.tgz
```
</details>

---

## 어떤 에이전트와 쓸 수 있나요?

| Provider | 상태 | 연결 명령 |
|---|---|---|
| **Codex** | 지원 | `jutell use codex` |
| **OpenCode** | 베타 | `jutell use opencode` |
| **Claude Code** | 베타 — `claude` 별칭 지원 | `jutell use claude` |

> 베타는 설정 등록을 지원하며, 로컬 환경에 따라 동작이 다를 수 있습니다. 문제는 `jutell doctor`로 점검할 수 있습니다.

작동 방식: JuTell은 `.agents/skills/beginner-bridge/SKILL.md` (호환 ID 유지, 표시 이름은 JuTell)와 `AGENTS.md`의 JuTell 블록으로 보고 규칙을 전달합니다. MCP는 선택형 로컬 연결입니다. 현재 실제 MCP 호출 검증은 Codex에서 지원하며 OpenCode·Claude Code는 설정 등록을 베타로 지원합니다.

---

## 내 입맛대로 조절하기

설정 파일은 프로젝트 루트의 `.jutell.json` (없으면 기존 `.beginner-bridge.json` 호환) 하나입니다. 공개 저장소에 커밋하지 않는 로컬 설정이며, CLI나 로컬 관리자에서 생성합니다.

```json
{
  "version": 1,
  "profile": "balanced",
  "voice": { "preset": "default" }
}
```

**Profile** — 보고서 분량 프리셋

| profile | 특징 |
|---|---|
| `minimal` | 토큰 절약 — 내부 변화·주요 파일·용어 등 줄임, 핵심 검증/사용자 행동은 유지 |
| `balanced` | 기본 — 모든 항목 균형 있게 |
| `learning` | 용어 설명을 더 많이 (최대 6개) |
| `detailed` | 복잡·위험 작업에서 더 자세히 |

**Voice** — 말투만 바꾸고 내용은 그대로

| preset | 느낌 |
|---|---|
| `default` | 공식·명확한 기본 문체 |
| `plain` | 더 담백하고 짧게 |
| `learning` | 처음 보는 용어를 더 친절하게 |
| `jutell` | JuTell 스타일 — 다정하지만 사실·검증·위험은 그대로 |

**Feature 끄기 예시** — 필요한 것만 켜기

```json
{
  "profile": "balanced",
  "features": { "internalChanges": false, "glossary": false },
  "limits": { "maxMainFiles": 3 }
}
```
`jutell on` / `jutell off` 로 전체 연결을 켜고 끌 수 있고, `jutell status`로 현재 Profile·활성 Feature 수·연결 상태를 확인합니다.

---

## 개인정보와 로컬 우선

- JuTell은 프로젝트 코드, 프롬프트, AI 답변 원문, 파일 내용/경로, 비밀정보, 사용자 식별 정보를 수집하지 않는 것을 원칙으로 합니다.
- Telemetry는 기본 OFF이며 현재 단계에서 실제 저장이나 외부 전송을 구현하지 않았습니다.
- 로컬 관리자는 Profile·Feature·limits·Beta Journal·연결 준비 상태를 현재 컴퓨터에서만 관리합니다.

---

## 지원 환경

- **Windows: VERIFIED** — Windows 11에서 `npm install -g jutell`, `jutell use codex`, `jutell status`/`doctor`, MCP 서버 도구 응답, 로컬 관리자 실행을 검증했습니다.
- **macOS: UNVERIFIED** — Node 기준으로 구현되어 있으나 실제 macOS 환경에서 설치·연결·MCP 호출을 검증하지 않았습니다.
- **Linux: UNVERIFIED** — 코드상 이식 가능하나 실제 Linux 환경 검증은 수행하지 않았습니다.

> macOS/Linux를 지원하지 않는다고 단정하지 않습니다. 공식 검증 기준은 현재 Windows이며, 사용 중 발견한 문제와 Pull Request를 환영합니다.

---

## 자주 쓰는 명령 7개

| 명령 | 역할 |
|---|---|
| `jutell` | 처음 시작·연결·관리자 화면을 준비합니다 |
| `jutell on` / `jutell off` | 연결을 켜고 끕니다 |
| `jutell status` | 현재 연결·Profile·Feature 상태를 확인합니다 |
| `jutell doctor` | 설치·설정·권한·외부 전송 여부를 점검합니다 |
| `jutell use codex` | Codex에 연결합니다 (권장) |
| `jutell use opencode` | OpenCode에 연결합니다 (베타) |
| `jutell use claude` | Claude Code에 연결합니다 (베타) |

고급 명령: `setup`, `enable`, `disable`, `uninstall`, `provider`, `dashboard`, `upgrade`, `migrate`, `session` — 전체 목록은 `jutell --help` 또는 [CLI 설치 안내](docs/CLI_INSTALLATION.md)를 참고하세요. 기존 사용자를 위해 `beginner-bridge`도 같은 기능의 호환 별칭으로 유지됩니다.

`status` 표기: MCP 연결 준비는 `미등록` / `등록됨` / `활성화됨` / `오류·충돌`로, 실제 도구 호출은 `확인하지 않음` / `마지막 확인 성공` / `마지막 확인 실패`로 따로 표시합니다.

---

## 문서

- [시작하기](docs/START_HERE.md)
- [CLI 설치 안내](docs/CLI_INSTALLATION.md)
- [Foundation (최상위 기준)](docs/foundation/VISION.md)
- [제품 범위](docs/PRODUCT_SCOPE.md)
- [Feature 설정](docs/FEATURE_CONFIGURATION.md)
- [JuTell 말투 정책](docs/JUTELL_STYLE.md)
- [개인정보 원칙](docs/PRIVACY_PRINCIPLES.md)
- [Telemetry 정책](docs/TELEMETRY_POLICY.md)
- [MCP 연결](docs/MCP_INTEGRATION.md)
- [OpenCode 연결 (베타)](docs/PROVIDER_OPENCODE.md)

---

## JuTell by Ju0

Ju0는 상위 브랜드, JuTell은 그 아래 제품입니다. 공식 표기는 `JuTell by Ju0`입니다.
`jutell@0.3.0`은 npm에 공개되어 있습니다. GitHub 저장소 이름 변경은 별도 운영 결정으로 유지됩니다.

이전 이름과 경로는 [브랜드 전환 안내](docs/BRAND_MIGRATION.md)에서만 설명합니다.
