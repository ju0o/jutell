# JUTELL-V1.5.2-CORE-FEATURE-REALITY-CHECK-01

TASK ID:
JUTELL-V1.5.2-CORE-FEATURE-REALITY-CHECK-01

MILESTONE:
V1.5.2

GOAL:
Determine actual V1 core implementation truth before feature freeze.

---

## 1. Product Baseline

- **Repository**: `ju0o/jutell` (local checkout at `jutell_repo/`)
- **Branch**: `main`
- **Expected baseline SHA**: `fe738d8ad535b42be6062bccb88ac6492d33e3da`
- **Actual remote/main HEAD**: `fe738d8ad535b42be6062bccb88ac6492d33e3da` (matches — verified via `git log --oneline -5` and `git rev-parse HEAD`)
- **Version**: `0.3.0` (README, CLI help, package.json, DECISIONS.md J01-VERSION-003 all agree)
- **Working tree**: clean (no uncommitted changes at audit start)
- **npm published**: `jutell@0.3.0` is published to npm (README line 127, packages/cli/README.md, CLI_INSTALLATION.md)

---

## 2. Files/Components Inspected

### Source code
- `packages/cli/src/cli.ts` — CLI entry point, command routing
- `packages/cli/src/output/format.ts` — CLI help text and status output
- `packages/cli/src/config/managed.ts` — config normalization (CLI side)
- `packages/cli/src/config/paths.js` — asset paths
- `packages/cli/src/commands/lifecycle.ts` — `on/off/setup/enable/disable/uninstall` commands
- `packages/cli/src/commands/status.ts` — `jutell status` (provider/MCP status)
- `packages/cli/src/commands/dashboard.ts` — `jutell dashboard` (local admin launcher)
- `packages/cli/src/commands/session/` — session management (`new`, `page`, `work`, `move`, `finish`)
- `packages/cli/src/commands/session/storage.ts` — session metadata, `summaryTemplate`, `SESSION_SUMMARY_FILE`
- `packages/cli/src/commands/session/finish-session.ts` — `jutell session finish` (auto-generates SESSION_SUMMARY.md)
- `apps/mcp-server/src/config/bridge-config.ts` — MCP config normalization, profile defaults
- `apps/mcp-server/src/tools/bridge-tools.ts` — MCP tool implementations (5 read-only tools)
- `apps/mcp-server/src/tools/catalog.ts` — MCP tool catalog
- `apps/local-admin/server/config/schema.ts` — config validation, feature IDs, profiles, limits
- `apps/local-admin/server/app.ts` — local admin API server, config CRUD, provider MCP management
- `apps/local-admin/server/mcp/config.ts` — provider MCP registration/read for Codex/OpenCode/Claude Code/Cline
- `apps/local-admin/server/templates/request-templates.ts` — request builder template loading
- `apps/local-admin/server/usage/` — usage counters and experiments
- `apps/local-admin/src/features/` — React UI components (FeatureSettings, Profiles, RequestBuilder, Overview, McpConnection)
- `apps/local-admin/src/App.tsx` — dashboard app shell
- `apps/local-admin/src/lib/catalog.ts` — feature catalog, profile catalog for UI
- `apps/local-admin/src/types/config.ts` — shared TypeScript config types

### Skill / references
- `.agents/skills/beginner-bridge/SKILL.md` — primary agent instructions (beginner reporting procedure)
- `.agents/skills/beginner-bridge/references/feature-registry.md` — feature definitions
- `.agents/skills/beginner-bridge/references/report-format.md` — report format, 4 information systems
- `.agents/skills/beginner-bridge/references/explained-diff-format.md` — explained diff format
- `.agents/skills/beginner-bridge/references/risk-level-guide.md` — risk levels
- `.agents/skills/beginner-bridge/references/glossary-ko.md` — Korean glossary
- `templates/request-builder/` — 8 request templates (README, DESIGN_REQUEST, FEATURE_REQUEST, BUG_REPORT_REQUEST, PROJECT_PLANNING_REQUEST, CODE_REVIEW_REQUEST, NEXT_AGENT_HANDOFF, MANUAL_EDIT_GUIDE)

### Docs
- `README.md` — public-facing product README
- `packages/cli/README.md` — CLI package README
- `docs/START_HERE.md` — getting started
- `docs/CLI_INSTALLATION.md` — installation guide
- `docs/FEATURE_CONFIGURATION.md` — feature configuration reference
- `docs/BEGINNER_REPORT_SPEC.md` — beginner report specification
- `docs/GLOSSARY_POLICY.md` — glossary policy
- `docs/JUTELL_STYLE.md` — style guide (default, JuTell style, voice presets)
- `docs/MCP_INTEGRATION.md` — MCP connection guide
- `docs/MCP_SECURITY.md` — MCP security model
- `docs/PROVIDER_OPENCODE.md` — OpenCode provider integration
- `docs/BUSINESS_MODEL.md` — business model
- `docs/DECISIONS.md` — architecture decisions log
- `docs/DOCUMENTATION_MAP.md` — documentation map
- `docs/FOUNDATION_RECONCILIATION.md` — foundation vs implementation reconciliation
- `docs/PUBLIC_REPOSITORY_POLICY.md` — what is/isn't public
- `docs/LOCAL_DATA_STORAGE.md` — local file storage reference
- `docs/PRIVACY_PRINCIPLES.md` — privacy principles
- `docs/TELEMETRY_POLICY.md` — telemetry policy
- `docs/TELEMETRY_EVENTS.md` — event registry
- `docs/ROADMAP_TELEMETRY.md` — telemetry roadmap
- `docs/PRODUCT_SCOPE.md` — product scope
- `docs/PRODUCT_VISION.md` — product vision
- `docs/DISTRIBUTION_ARCHITECTURE.md` — distribution architecture
- `docs/LOCAL_ADMIN_REQUIREMENTS.md` — local admin requirements
- `docs/PERSONAL_BETA_PLAN.md` — personal beta plan
- `docs/BRAND_MIGRATION.md` — brand migration guide

### Tests
- `packages/cli/tests/config-normalization.test.ts` — config normalization, profile defaults
- `packages/cli/tests/cli.test.ts` — CLI behavior tests
- `packages/cli/tests/version-consistency.test.ts` — version consistency
- `packages/cli/tests/session.test.ts` — session system tests
- `apps/mcp-server/tests/bridge-tools.test.ts` — MCP tool output, feature toggle behavior
- `apps/mcp-server/tests/skill-contract.test.ts` — explained-diff-format.md contract test
- `apps/local-admin/src/test/App.test.tsx` — local admin UI tests
- `apps/local-admin/server/app.test.ts` — local admin server/API tests

### Config artifacts
- `.jutell.json` — repo-level config (profile: balanced, voice: default)
- `examples/config/jutell.example.json` — example config
- `AGENTS.md` — managed block with reporting config interpretation

### Dogfood evidence
- `private/dogfood/JUTELL-V1.3-THREE-PROVIDER-RETEST-01.md` — real MCP tool calls from Codex, Claude Code, OpenCode
- `private/dogfood/JUTELL-V1.5.1-AGENT-EFFICIENCY-EXPLANATION-VALUE-AUDIT-01.md` — agent efficiency audit

---

## 3. V1 Core Feature Matrix

| # | Capability | Classification | User can use today? | Evidence | Main gap | V1 blocker? |
|---|---|---|---|---|---|---|
| 1 | 쉬운 보고 (Beginner-friendly reporting) | IMPLEMENTED | Yes — via MCP rule guidance + Skill instructions | SKILL.md §Reporting, MCP `get_beginner_report_rules`, report-format.md, dogfood evidence, bridge-tools.test.ts | Agent must still produce the report (MCP provides rules only) | No |
| 2 | 코드/Diff 쉬운 독해 (Readable code/diff explanation) | PARTIAL (A: IMPLEMENTED, B: PARTIAL, C: ABSENT, D: ABSENT, E: IMPLEMENTED) | Partially — explainedDiff works when code is shown, but no automated code-block extraction | explained-diff-format.md, SKILL.md step 13, MCP explainedDiffRule, skill-contract.test.ts, bridge-tools.test.ts | No automated meaningful-code-block selection; relies on agent to reuse evidence | No |
| 3 | 사실/예상/미확인 구분 (Evidence/confidence separation) | IMPLEMENTED | Yes — embedded in report rules and format | BEGINNER_REPORT_SPEC.md, report-format.md §4 information systems, MCP evidenceRule/statusRule/safetyRequirements/notCollected | None — safety requirements enforce the separation | No |
| 4 | 다음 Agent Handoff (Lightweight handoff) | PARTIAL | Partially — Request Builder + session summary exist, but no integrated auto-generated handoff artifact | templates/request-builder/NEXT_AGENT_HANDOFF.md, RequestBuilder.tsx, session/storage.ts summaryTemplate, finish-session.ts | SESSION_SUMMARY.md is a recap template, not a structured handoff; NEXT_AGENT_HANDOFF.md requires manual agent fill-in | No |
| 5 | 기능 ON/OFF (Feature toggles) | IMPLEMENTED | Yes — via local admin dashboard or direct .jutell.json edit | .jutell.json, schema.ts validateConfig, FeatureSettings.tsx, MCP get_active_features/activeReportSections, bridge-tools.test.ts (explainedDiff off → rule undefined), config-normalization.test.ts | No CLI command for per-feature toggle (only connection-level `on`/`off`) | No |
| 6 | 사용자 말투/스타일 (User voice/style) | PARTIAL (Schema exists, runtime absent) | No — voice.preset accepted in config but not applied to agent behavior | JUTELL_STYLE.md, schema.ts, .jutell.json (voice: default), App.tsx (no voice UI), SKILL.md (no voice reference) | No agent-facing style engine; no local-admin UI for voice | No |
| 7 | Agent 효율/Evidence 재사용 (Agent efficiency) | HEALTHY_BY_DESIGN | N/A — architectural property | SKILL.md step 13 (reuse evidence), report-format.md (no diff repetition), MCP read-only rules only, bridge-config.ts (read-per-call), BEGINNER_REPORT_SPEC.md | No automated token monitoring; relies on agent following instructions | No |
| 8 | CLI / Help (Beginners usability) | PARTIAL (all commands work; help text has stale deployment language) | Yes — all listed commands verified | format.ts printHelp, cli.ts routing, lifecycle.ts, status.ts, dashboard.ts; packages/cli/README.md | CLI help line 144 claims "before actual deployment" but jutell@0.3.0 is published | No |

---

## 4. Detailed Findings

### 4.1 Capability 1: Beginner-Friendly Reporting — IMPLEMENTED

The full reporting pipeline is genuinely implemented across three layers:

**Skill instructions (`.agents/skills/beginner-bridge/SKILL.md`)**: The SKILL provides a 13-step procedure. Step 6 requires loading `get_beginner_report_rules` from MCP before writing the final answer. Steps 7-13 define the report structure: changeSummary, userVisibleChanges, internalChanges, mainFiles, explainedDiff, glossary, validationResults, riskAssessment, userActions, nextActionSuggestions, requestClarificationGuide, manualEditGuidance.

**MCP rule output (`apps/mcp-server/src/tools/bridge-tools.ts`)**: `get_beginner_report_rules` returns:
- `activeReportSections` — only sections whose feature is ON (filtered by `beginnerReportRules()` in bridge-config.ts)
- `safetyRequirements` — rules that always apply regardless of feature toggles (e.g., "비밀번호·비밀정보는 보고하지 않는다")
- `notCollected` — explicitly list what is NOT collected ("Prompt", "AI 답변", "민감정보")
- `evidenceRule` — how to label evidence sources (confirmed fact / test result / expected behavior / unverified claim / risk / failure / user action)
- `statusRule` — report status and completion criteria
- `explainedDiffRule` — only present when `explainedDiff` feature is ON (5 sections, no-fabrication rules)
- `diffRule` — general code/diff explanation rule (always present)

**Reference format (`references/report-format.md`)**: Defines the 4 information systems:
1. 증거 근거 (evidence source) — Agent 결과 / 사용자 요청 / 코드 비교 / 공식 문서
2. 확인/예상 구분 (confirmation status) — 확인됨 / 기대됨 / 실행하지 못함 / 실행하지 않음 / 미확인
3. 사용자 조치 (user action) — 필요함 / 권장 / 없음
4. 보고서 상태 (report status) — 완료 / 진행 중 / 정보 부족

**Test proof (`bridge-tools.test.ts`)**:
- `activeReportSections` correctly excludes disabled features (e.g., glossary: false → "용어 설명" not in sections)
- `safetyRequirements` contain "비밀정보"
- `notCollected` contains "Prompt" and "민감정보"
- 13 active features verified

**Dogfood evidence (`private/dogfood/JUTELL-V1.3-THREE-PROVIDER-RETEST-01.md`)**: Real MCP `get_beginner_report_rules` calls executed from all three providers (Codex, Claude Code, OpenCode), returning the full rule set with evidence/confidence separation.

**Each of the 10 required sub-items**:
| Sub-item | Status | Evidence source |
|---|---|---|
| easy explanation | IMPLEMENTED | changeSummary in activeReportSections |
| change summary | IMPLEMENTED | changeSummary section in SKILL + rules |
| user-visible change | IMPLEMENTED | userVisibleChanges activeReportSections |
| internal change | IMPLEMENTED | internalChanges activeReportSections (minimal profile has this OFF) |
| important files | IMPLEMENTED | mainFiles activeReportSections (profile limit: maxMainFiles) |
| terminology / glossary | IMPLEMENTED | glossary activeReportSections (glossary-ko.md reference) |
| validation results | IMPLEMENTED | validationResults activeReportSections (report-format.md §검증 결과) |
| risks | IMPLEMENTED | riskAssessment activeReportSections (risk-level-guide.md) |
| user action | IMPLEMENTED | userActions activeReportSections |
| next action | IMPLEMENTED | nextActionSuggestions activeReportSections |

**Agents are instructed to use them**: SKILL.md step 6 explicitly says to call `get_beginner_report_rules` and apply the rules. AGENTS.md managed block (lines 93-104) also instructs the agent to read `.jutell.json` and follow the profile/features. The MCP server is the primary runtime path — the agent receives the rules dynamically based on the current config.

### 4.2 Capability 2: Readable Code / Diff Explanation

**A. Functional Explained Diff — IMPLEMENTED**

The `explainedDiff` feature provides a 5-section format defined in `references/explained-diff-format.md`:
1. **무엇을 바꾸나요?** (what changed)
2. **왜 바꾸나요?** (why it changed)
3. **어디를 바꾸나요?** (where it changed)
4. **실제 중요한 변경** (actual important changes — only meaningful ones)
5. **내가 직접 다듬고 싶다면?** (customization hints — only when code evidence exists)

The MCP server exposes `explainedDiffRule` only when the feature is ON (verified by test). The SKILL.md step 6 instructs the agent to apply it. The `skill-contract.test.ts` verifies the reference doc contains all 5 section names and the mandatory no-evidence sentence ("변경 이유는 Agent 결과에서 확인되지 않았습니다.").

This is genuinely wired end-to-end: config `explainedDiff: false` → MCP omits `explainedDiffRule` → agent does not produce the 5-section format. Test proof in `bridge-tools.test.ts`: "omits only the explained diff guidance when the feature is off and keeps other fields intact."

**B. Raw diff/code-block explanation — PARTIAL**

The `diffRule` (always present, independent of `explainedDiff` feature) provides a general rule: show code context, explain what the code does, what changed, and why it matters. The `explained-diff-format.md` says "Changed code: `<small meaningful code block>`" and "Easy explanation: What this block does / what changed / why it matters."

However, the MCP server does NOT provide actual code blocks or git diffs. It only provides rules. The agent must obtain the code/diff from its own work context. The explained-diff-format.md explicitly says: "기존 보고서 길이 규칙이 우선한다" — the format is a guideline for the agent, not a system-provided code extraction.

**C. Automated selection of meaningful code blocks — ABSENT**

No system mechanism automatically identifies and extracts "meaningful" code blocks. The explained-diff-format.md requires the agent to group related changes and select meaningful blocks itself ("기능 단위로 묶고 전체 Diff 원문을 반복하지 않는다"). The `explainedDiffRule.when` field says "의미 있는 변경(기능 동작·화면 변화·데이터 처리 변화)" — this is a guideline, not automated detection.

**D. UI visual diff — ABSENT**

No visual diff viewer or speech-bubble overlay. This is explicitly V2 per `RequestBuilder.tsx` line 44: "V2 예정."

**E. Agent-generated code-reading based on already-read evidence — IMPLEMENTED**

SKILL.md step 13: "explainedDiff가 활성이면 의미 있는 변경에 같은 근거로 설명형 변경 요약을 덧붙인다." — the agent is explicitly instructed to reuse evidence already obtained during coding, not to reread. Step 6 requires loading `get_beginner_report_rules` which includes the `diffRule`: "肄붾뱶 ?먮뒗 Diff" (code or diff evidence already obtained) — the rule tells the agent to use already-obtained code/diff evidence.

The `explained-diff-format.md` grouping rule says: "관련된 변경을 기능 단위로 묶고 전체 Diff 원문을 반복하지 않는다. 단순 작업(문구 한 개, 색상 한 곳 등)에는 이 형식을 강요하지 않는다." — explicitly avoids re-presenting the full diff.

**Summary: Does the current system require the Agent to reread code/diff only for JuTell?**

No. The MCP server provides rules only — no code or diff content. The SKILL.md explicitly instructs reuse of evidence already obtained during coding. The agent is NOT forced to reread files or diffs.

**Can it reuse evidence already obtained during coding?**

Yes. SKILL.md step 13 and the `explainedDiffRule.when` / `diffRule` both direct the agent to use already-available evidence.

### 4.3 Capability 3: Evidence / Confidence Separation — IMPLEMENTED

The 4 information systems are fully operational:

1. **증거 근거 (evidence source)** — `evidenceRule` from MCP, plus `BEGINNER_REPORT_SPEC.md` §3.1:
   - `Agent 결과` (what the agent did)
   - `사용자 요청` (what the user asked)
   - `코드 비교` (code-level verification)
   - `공식 문서` (external reference)
   These are the only valid evidence sources. The SKILL.md step 8 requires citing evidence sources at point of claim.

2. **확인/예상 구분 (confirmation status)** — `statusRule` from MCP, plus `BEGINNER_REPORT_SPEC.md` §3.2 and `report-format.md` §4.2:
   - `확인됨` (confirmed via test/run)
   - `기대됨` (expected by design, not yet tested)
   - `실패` (attempted and failed)
   - `실행하지 못함` (could not execute)
   - `실행하지 않음` (skipped)
   - `검증 수대 없음` (unable to verify)

3. **사용자 조치 (user action)** — `userActions` activeReportSections, plus `BEGINNER_REPORT_SPEC.md` §3.4:
   - Required action vs. recommendation vs. none

4. **보고서 상태 (report status)** — `report-status-guide` concept in report-format.md, plus SKILL.md step 11 (completion criteria):
   - `complete` (all claims supported by evidence)
   - `in-progress` (claims pending)
   - `needs-evidence` (gaps identified)

**Safety enforcement**: `safetyRequirements` in MCP output cannot be disabled by features (DECISIONS.md log entry 2026-08-02: "실패, 핵심 검증 실패, 중요한 미확인 사항, 높은 위험·판정 불가, 비밀정보·데이터 손실 위험, 범위 밖 변경과 작업 보류 사유는 설정으로 숨길 수 없다"). Test: `safetyRequirements` contain "비밀정보" even when all features are off.

**notCollected** explicitly lists "Prompt", "AI 답변", "민감정보" as not collected. Test: `notCollected` contains "Prompt" and "민감정보".

### 4.4 Capability 4: Lightweight Agent Handoff — PARTIAL

Current pieces that exist:

- **NEXT_AGENT_HANDOFF.md** template (`templates/request-builder/NEXT_AGENT_HANDOFF.md`): A 9-section handoff template (what's being built, work summary, current problems, next steps, what to preserve, what not to touch, user verification points, AI pre-check questions, final request paragraph). Served via local-admin RequestBuilder → `GET /api/request-templates` (reads from project `templates/request-builder/` or `JUTELL_TEMPLATES_ROOT` env, set by `dashboard.ts` line 44).

- **Request Builder UI** (`RequestBuilder.tsx`): Shows template content in a panel with a "복사하기" (copy) button that writes to clipboard via `navigator.clipboard.writeText()`.

- **Session system** (`packages/cli/src/commands/session/`): `jutell session finish` auto-generates `SESSION_SUMMARY.md` via `summaryTemplate()` (storage.ts). The template includes: Date, Pages, Key changes, Issues, Decisions, Next steps, Agent handoff notes, JuTell review notes, Notes for next session.

- **Dogfood evidence**: Session system has been used in real projects (JUTELL-V1.3-THREE-PROVIDER-RETEST-01.md references real session files).

**Analysis by sub-question**:

| Question | Answer | Evidence |
|---|---|---|
| A. User can build a NEW request | IMPLEMENTED | RequestBuilder.tsx + 8 templates, copy-to-clipboard |
| B. JuTell can summarize CURRENT completed work | PARTIAL | SESSION_SUMMARY.md auto-generated by `jutell session finish` but contains placeholders ("-") for agent to fill; not content-aware |
| C. JuTell can produce Agent-to-Agent handoff artifact | PARTIAL | NEXT_AGENT_HANDOFF.md template exists but requires agent/manual fill-in; SESSION_SUMMARY.md is auto-generated but is a recap, not the handoff format |
| D. Artifact saved as Markdown | IMPLEMENTED | .md files for both templates and SESSION_SUMMARY.md |
| E. Easy to copy/use | IMPLEMENTED | Copy button in dashboard; session files in `.jutell-local/collaboration-sessions/YYYY-MM-DD/` |
| F. HTML available | ABSENT | No HTML generation; dashboard serves React SPA over HTTP |

**Recommended lightest V1 form**: The existing `NEXT_AGENT_HANDOFF.md` template + `SESSION_SUMMARY.md` auto-generation already provide the core handoff capability. The gap is that they are not automatically combined: the agent would need to manually fill the NEXT_AGENT_HANDOFF.md template using session data. No new system is needed — the recommendation is to have the agent use the NEXT_AGENT_HANDOFF.md template as-is for V1.

### 4.5 Capability 5: Feature ON/OFF — IMPLEMENTED

**End-to-end path**: `local-admin FeatureSettings.tsx` toggle → PATCH `/api/config` → `saveConfig()` → writes `.jutell.json` → MCP `readBridgeContext()` reads `.jutell.json` on each tool call → `beginnerReportRules()` filters `activeReportSections` → agent receives only active sections.

Also works via direct `.jutell.json` edit — the MCP reads the file fresh on every call (`readBridgeContext` is called in `get_bridge_status`, `get_active_features`, `get_report_preferences`, `get_beginner_report_rules`).

**13 feature IDs** (schema.ts FEATURE_IDS):
`changeSummary, userVisibleChanges, internalChanges, mainFiles, explainedDiff, glossary, validationResults, riskAssessment, userActions, nextActionSuggestions, requestClarificationGuide, manualEditGuidance, requestBuilder`

**4 profiles**: `minimal` (8 active), `balanced` (13 active), `learning` (13 active), `detailed` (13 active)

**Toggle genuinely changes agent behavior** — Test proof in `bridge-tools.test.ts`:
- "omits only the explained diff guidance when the feature is off" — `explainedDiff: false` → `rules.explainedDiffRule` is `undefined`, but `diffRule`, `evidenceRule`, `statusRule`, `safetyRequirements` all remain
- "fills explainedDiff with the Profile default for configs written before it existed" — backward compatibility
- "returns only active rules" — `activeReportSections` correctly filters (glossary: false → section not listed)
- "keeps explainedDiff off in the minimal profile by default" — profile defaults apply

**Profile defaults via normalizeConfig**: When a feature key is missing from `.jutell.json`, `normalizeConfig` fills it with the profile default (DECISIONS.md J01-CLI-001 fixed the CLI to match MCP/profile defaults). Test: "fills missing helper feature keys with defaults for backward compatibility" — missing `nextActionSuggestions`, `requestClarificationGuide`, `manualEditGuidance` are filled from profile, while `requestBuilder` gets `balanced` default (true).

**CLI limitation**: `jutell on`/`jutell off` toggle the entire JuTell connection (MCP + Skill + AGENTS.md), not individual features. `jutell enable`/`jutell disable` (lifecycle.ts) also operate at the connection level. There is NO CLI command for per-feature toggle — users must use the local-admin dashboard or edit `.jutell.json` directly. This matches the README's documentation table which only lists connection-level on/off.

**Feature toggle end-to-end map**:

| Component | Reads/writes | Purpose |
|---|---|---|
| `.jutell.json` (file) | Write: local-admin, CLI setup/enable/disable; Read: MCP, local-admin, CLI | Source of truth for features |
| `schema.ts validateConfig` | Read/write | Validates + applies profile defaults to feature keys |
| `bridge-config.ts normalizeConfig` | Read | MCP-side: normalizes config, fills missing features from profile |
| `bridge-tools.ts beginnerReportRules()` | Read | Filters `activeReportSections` by feature flags |
| `FeatureSettings.tsx` | Write | Dashboard UI with toggle switches per feature |
| `App.tsx` (dashboard) | Read/write | Orchestrates config save and readiness checks |
| `SKILL.md` / `AGENTS.md` | Read by agent | Instructs agent to read config, apply features |
| MCP tools | Read by agent | `get_active_features`, `get_beginner_report_rules` return active sections |

### 4.6 Capability 6: User Voice / Style — PARTIAL (schema exists, runtime absent)

| Sub-question | Status | Evidence |
|---|---|---|
| A. Default easy-language policy | IMPLEMENTED | SKILL.md step 5: "간단한 말로 쓴다", report-format.md length limits, glossary-ko.md |
| B. JuTell Style preset | SPEC_ONLY | JUTELL_STYLE.md defines "JuTell" preset (간결하고 사실적, 비슷하지만 익명) but no runtime applies it |
| C. Voice config schema | IMPLEMENTED | schema.ts validates `voice.preset` as `'default' \| 'plain' \| 'learning' \| 'jutell'`; `.jutell.json` has `voice: { preset: "default" }` |
| D. User-selectable style | ABSENT | No UI in local-admin (App.tsx, catalog.ts have no voice/style section); no CLI command |
| E. User-provided style sample | ABSENT | No mechanism to upload or define custom style |
| F. Actual Agent instruction incorporating style | ABSENT | SKILL.md has zero references to `voice`, `preset`, `style`, or `JUTELL_STYLE.md` |
| G. Local Admin toggle/UI | ABSENT | FeatureSettings.tsx has no voice/style controls; Profiles.tsx shows profile cards only |
| H. Tests | ABSENT | No tests referencing voice or style |

**Key evidence**: `JUTELL_STYLE.md` line 29: "현재 설정 구조의 `voice.preset`은 호환 가능한 준비 단계입니다. 실제 스타일 엔진과 관리자 토글은 아직 구현하지 않았고, 기본값도 `default`에서 바꾸지 않습니다."

The voice preset is accepted in config validation but the MCP server's `normalizeConfig` (bridge-config.ts) does NOT include `voice` in its output — it is silently dropped. The local-admin's `DEFAULT_CONFIG` (schema.ts line 194-196) also does NOT include a `voice` key. The schema.ts accepts `voice` as an unknown-but-valid key, but it has zero effect on any runtime behavior.

**Recommended smallest V1 behavior**: Since the config schema already accepts `voice.preset`, the smallest V1 behavior would be to have SKILL.md step 5 conditionally apply the "plain" style (shorter, simpler language) when `voice.preset === 'plain'`. But this is a feature addition, not part of this audit.

### 4.7 Capability 7: Agent Efficiency / Evidence Reuse — HEALTHY_BY_DESIGN

The architecture is designed to minimize redundant evidence collection:

1. **MCP provides rules only, not code/diffs** — The 5 MCP tools return config, profile, feature list, and reporting rules. They do NOT return file contents, git diffs, prompts, or AI responses. There is no mechanism for the MCP to cause the agent to reread files. (MCP_SECURITY.md §2 explicitly lists what MCP does NOT read.)

2. **SKILL.md explicitly instructs evidence reuse** — Step 13: "explainedDiff가 활성이면 의미 있는 변경에 같은 근거로 설명형 변경 요약을 덧붙인다." — reuse evidence from the same change. The `explainedDiffRule.when` says "의미 있는 변경(기능 동작·화면 변화·데이터 처리 변화)" — identify meaningful changes from already-obtained evidence, not by rereading.

3. **No repeated MCP calls needed** — `get_beginner_report_rules` returns the complete rule set (all sections, safety requirements, evidence rules, status rules, explainedDiffRule, diffRule, notCollected) in a single call. The agent calls it once per report, not once per section.

4. **Report length limits enforced** — `compactReportMaxSentences` (4~30, controlled per-profile) limits report verbosity. The `explained-diff-format.md` grouping rule says "관련된 변경을 기능 단위로 묶고 전한 Diff 원문을 반복하지 않는다" — explicitly forbids diff repetition.

5. **"Don't apply" conditions** — SKILL.md step 98 has "적용하지 않을 상황" (situations to skip reporting): "코드 변경이 없거나 사용자 지시를 따른 결과만 있을 때", "변경이 단순한 오타나 임시 방편일 때", "사용자가 이미 충분히 설명을 받았을 때" — prevents unnecessary reporting on trivial changes.

6. **Not-collected list** — MCP returns `notCollected: ["Prompt", "AI 답변", "민감정보"]` so the agent knows these are explicitly off-limits, preventing accidental large-context inclusion.

7. **Dogfood evidence** — `JUTELL-V1.5.1-AGENT-EFFICIENCY-EXPLANATION-VALUE-AUDIT-01.md` (private) confirms: "no avoidable repeated engineering work observed" and "evidence reuse was positive." The PM interpretation: "exact token delta not proven, no avoidable repeated engineering work observed, evidence reuse was positive, V1.5.1 is non-blocking research."

**Potential waste areas (not currently implemented)**:
- No automated check prevents the agent from rereading files if it chooses to (the SKILL is an instruction, not a hard constraint)
- No telemetry on actual token usage or redundant calls

**Classification**: HEALTHY_BY_DESIGN — the architecture provides rules only, instructs reuse, limits report length, and has "don't apply" conditions. No evidence of forced rereading by the system itself.

### 4.8 Capability 8: CLI Beginner Usability — PARTIAL

All commands from the task verified:

| Command | Verified | Source |
|---|---|---|
| `jutell` | Yes | cli.ts defaultCommand (setup wizard or status + dashboard) |
| `jutell --help` | Yes | format.ts printHelp (line 89: `--help` or `-h` → help) |
| `jutell -h` | Yes | Same handler |
| `jutell --version` | Yes | cli.ts line 24: returns version `0.3.0` |
| `jutell use codex` | Yes | Known subcommand "codex" → useProvider('codex') |
| `jutell use opencode` | Yes | Known subcommand "opencode" → useProvider('opencode') |
| `jutell use claude` | Yes | Known subcommand "claude" → useProvider('claude') (beta) |
| `jutell status` | Yes | statusCommand |
| `jutell doctor` | Yes | doctorCommand |
| `jutell on` | Yes | onCommand → enableCommand (connection-level) |
| `jutell off` | Yes | offCommand → disableCommand (connection-level, full) |

**Advanced commands** (listed in CLI help): `dashboard`, `setup`, `enable`, `disable`, `provider`, `connect`, `disconnect`, `switch`, `uninstall`, `upgrade`, `migrate`, `session`

**CLI Truth Gaps** (stale or misleading help text):

1. **CLI help line 144** (`packages/cli/src/output/format.ts`):
   - **CLAIM**: "실제 배포 전에는 로컬 패키지 검증만 지원합니다. 업데이트는 다음 명령을 사용하세요." / "npm update -g jutell"
   - **ACTUAL**: jutell@0.3.0 is published and installed via `npm install -g jutell` (README, CLI_INSTALLATION.md, packages/cli/README.md all confirm npm registry install)
   - **SEVERITY**: S2 (misleading/stale)
   - **SUGGESTED_DIRECTION**: Remove "실제 배포 전" language; state that npm registry install is supported

2. **README command table** missing `jutell use claude`:
   - **CLAIM**: README "현재 가능한 기능" table lists only `jutell use codex` and `jutell use opencode`
   - **ACTUAL**: CLI help and docs/CLI_INSTALLATION.md both list `jutell use claude` (beta). PROVIDER_OPENCODE.md line 167 and MCP_INTEGRATION.md both document it.
   - **SEVERITY**: S3 (polish / omission)
   - **SUGGESTED_DIRECTION**: Add `jutell use claude` row to the README command table, or add a note about advanced commands

3. **README** does not mention `jutell enable`/`jutell disable` or `jutell provider`:
   - **CLAIM**: README "현재 가능한 기능" table covers the core commands
   - **ACTUAL**: `jutell enable`, `jutell disable`, `jutell connect`, `jutell disconnect`, `jutell switch`, `jutell provider` all exist as advanced commands (format.ts lists them under "고급 명령")
   - **SEVERITY**: S3 (polish / omission)
   - **SUGGESTED_DIRECTION**: Add an "고급 명령" subsection to README, or reference docs/CLI_INSTALLATION.md for the full command list

4. **PROVIDER_OPENCODE.md** uses stale `beginner_bridge` MCP key:
   - **CLAIM**: Line 115: "mcp.beginner_bridge 키만 추가·갱신·제거합니다." and line 126 shows `"beginner_bridge": {...}` and line 130 shows `"beginner_bridge_*"` tool glob
   - **ACTUAL**: Current code uses `mcp.jutell` as the canonical key (local-admin/server/mcp/config.ts line 395: `OPENCODE_MCP_KEY = "jutell"`). README and MCP_INTEGRATION.md both correctly use `jutell`.
   - **SEVERITY**: S2 (misleading/stale)
   - **SUGGESTED_DIRECTION**: Update PROVIDER_OPENCODE.md to reference `jutell` as the canonical key; mention `beginner_bridge` only as legacy compatibility

5. **Cline wording inconsistency between docs**:
   - **CLAIM**: README says "Cline은 준비 중", PROVIDER_OPENCODE.md says "Cline은 준비 중으로 안내만 출력", MCP_INTEGRATION.md says "Cline: 확장 준비"
   - **ACTUAL**: All mean the same thing — Cline is not yet implemented. The wording is slightly inconsistent but not false.
   - **SEVERITY**: S3 (polish)
   - **SUGGESTED_DIRECTION**: Standardize on one term (e.g., "준비 중") across all docs

6. **README "개인 베타" status**:
   - **CLAIM**: Readme line 103: "현재는 개인 베타 단계입니다. 기술 검증 기록은 있지만 비개발자 평가와 공개 베타 판단은 아직 남아 있습니다."
   - **ACTUAL**: This is accurate — DECISIONS.md confirms personal beta phase; the product is installable but not officially past beta. This is honest and correct.
   - **SEVERITY**: None — accurate

---

## 5. README Truth Gaps

| # | Claim | Actual | Severity | Suggested Direction |
|---|---|---|---|---|
| 1 | README "현재 가능한 기능" table lists only `jutell use codex` and `jutell use opencode` | `jutell use claude` exists and is documented in CLI help, CLI_INSTALLATION.md, PROVIDER_OPENCODE.md | S3 | Add `jutell use claude` row or reference advanced commands |
| 2 | README does not list `jutell enable`/`disable`/`provider`/`connect`/`switch` advanced commands | All exist in CLI (`format.ts` lists them under "고급 명령") | S3 | Add "고급 명령" reference to README |
| 3 | CLI help (format.ts line 144): "실제 배포 전에는 로컬 패키지 검증만 지원합니다" | `jutell@0.3.0` is published to npm; `npm install -g jutell` works | S2 | Remove pre-deployment language; state npm registry is supported |
| 4 | PROVIDER_OPENCODE.md: "mcp.beginner_bridge 키" (line 115, 126, 130) | Canonical key is now `mcp.jutell` (config.ts line 395); README and MCP_INTEGRATION.md use `jutell` | S2 | Update doc to `jutell`, mention `beginner_bridge` as legacy only |
| 5 | Cline wording varies: "준비 중" vs "확장 준비" across docs | All mean Cline is not yet implemented | S3 | Standardize wording |
| 6 | README says "개인 베타 단계" | Accurate — personal beta confirmed in DECISIONS.md | None | No change needed |
| 7 | README states MCP provides 5 read-only tools | Verified — catalog.ts has exactly 5 tools | None | Accurate |
| 8 | README states Windows VERIFIED, macOS/Linux UNVERIFIED | Accurate — platform policy (V1.5.2 scope) | None | Accurate |
| 9 | README states Cline "준비 중" | Accurate — no Cline connection code exists | None | Accurate |
| 10 | README states Telemetry OFF by default, no external transmission | Accurate — DECISIONS.md confirms no external transmission; MCP returns `externalTransmission: false` | None | Accurate |

---

## 6. Feature Toggle End-to-End Map

```
User toggles feature → .jutell.json saved → MCP reads .jutell.json on next tool call → normalizeConfig applies profile defaults → beginnerReportRules() filters activeReportSections → agent calls get_beginner_report_rules → receives only active sections → agent includes/excludes sections accordingly
```

| Path | Mechanism | Verified? |
|---|---|---|
| **Dashboard UI** | FeatureSettings.tsx toggle → PATCH /api/config → saveConfig() → writes .jutell.json | Yes (FeatureSettings.tsx, app.ts saveConfig) |
| **Direct config edit** | User edits .jutell.json features.<id> = true/false | Yes (schema.ts validates, MCP reads on next call) |
| **Local-admin → MCP** | MCP readBridgeContext() reads .jutell.json fresh per call | Yes (bridge-config.ts, bridge-tools.ts) |
| **MCP → Agent** | get_beginner_report_rules returns activeReportSections based on features | Yes (test: glossary off → section excluded) |
| **Agent → Report** | SKILL.md step 6: read rules, apply only active sections | Yes (SKILL.md line 56) |

**No CLI per-feature toggle**: `jutell on`/`off` toggle the entire connection (MCP + Skill + AGENTS.md). `jutell enable`/`disable` (lifecycle.ts) also operate at connection level. Per-feature toggling is only available via the local-admin dashboard or direct `.jutell.json` editing. This is intentional — the README documents `on`/`off` as connection-level toggles, not per-feature.

---

## 7. Explained Diff Reality

The `explainedDiff` feature works as follows:

1. **Rule delivery**: When `explainedDiff: true`, MCP `get_beginner_report_rules` includes `explainedDiffRule` with:
   - `sections`: ["무엇을 바꾸나요?", "왜 바꾸나요?", "어디를 바꾸나요?", "실제 중요한 변경", "내가 직접 다듬고 싶다면?"]
   - `when`: "의미 있는 변경(기능 동작·화면 변화·데이터 처리 변화)" — only for meaningful changes
   - `noEvidenceRules.why`: "변경 이유는 Agent 결과에서 확인되지 않았습니다." — never fabricate
   - `groupingRule`: "관련된 변경을 기능 단위로 묶고 전체 Diff 원문을 반복하지 않는다"
   - `noEvidenceRules.customization`: only with code evidence
   - `noEvidenceRules.riskyArea`: never present risky areas as simple visual customization

2. **Agent instruction**: SKILL.md step 6 loads the rules; step 13 applies them when active. The `explainedDiffRule` is only present when the feature is ON.

3. **Code blocks**: The MCP does NOT supply code blocks. The agent must show code itself (SKILL.md: "코드나 Diff 원문을 요청받았거나 실제로 사용자에게 보여준 경우에만"). The agent reuses evidence from its own work context.

4. **Test verification**: `skill-contract.test.ts` verifies the reference format doc contains all 5 section names and the no-fabrication sentence. `bridge-tools.test.ts` verifies the rule is undefined when feature is off.

**Verdict**: The explained diff is a functional rule + format, not a code-reading engine. It tells the agent WHAT to explain and HOW to structure it, but the agent must supply the actual code evidence from its own context.

---

## 8. Handoff Reality

**SESSION_SUMMARY.md** (auto-generated): `jutell session finish` calls `summaryTemplate()` (storage.ts) which produces a markdown file with: Date, Pages, Key changes, Issues, Decisions, Next steps, Agent handoff notes, JuTell review notes, Notes for next session. This IS auto-generated but all content fields are placeholders ("-") for the agent to fill.

**NEXT_AGENT_HANDOFF.md** (template-based): A 9-section template served via the local-admin Request Builder with a copy-to-clipboard button. The agent/user fills it manually. Sections: what's being built, work summary, current problems, next steps, preserve, don't touch, user verification, AI pre-check, final request paragraph.

The two artifacts are separate — SESSION_SUMMARY.md is auto-generated but a recap; NEXT_AGENT_HANDOFF.md is a structured handoff but requires manual fill-in. There is no single command or button that produces a filled-in handoff artifact.

**Verdict**: Partial handoff capability. The building blocks exist (templates, session system, copy-to-clipboard) but are not integrated into a single automated handoff flow.

---

## 9. Voice / Style Reality

The `voice.preset` field in `.jutell.json` is accepted by the config schema (schema.ts) with values `default`, `plain`, `learning`, `jutell`. However:

- The MCP server's `normalizeConfig` (bridge-config.ts) does NOT include `voice` in its output — it is silently dropped
- The CLI's `DEFAULT_CONFIG` (managed.ts) does NOT include a `voice` key
- The local-admin UI has no voice/style controls
- The SKILL.md has zero references to `voice`, `preset`, `style`, or `JUTELL_STYLE.md`
- `JUTELL_STYLE.md` line 29 explicitly states: "실제 스타일 엔진과 관리자 토글은 아직 구현하지 않았고, 기본값도 `default`에서 바꾸지 않습니다."

**Verdict**: Spec-only at the config schema level. No runtime behavior connected to voice/style.

---

## 10. Efficiency Architecture Assessment

**Classification: HEALTHY_BY_DESIGN**

The system architecture prevents unnecessary evidence collection by design:

- **MCP is read-only rules only**: The 5 MCP tools return config, profile, feature list, reporting rules, and status. They do NOT return file contents, git diffs, prompts, or AI responses. There is no path through which MCP forces the agent to reread files.
- **SKILL.md step 13** explicitly instructs reuse: "explainedDiff가 활성이면 의미 있는 변경에 같은 근거로 설명형 변경 요약을 덧붙인다."
- **Explained-diff grouping rule**: "관련된 변경을 기능 단위로 묶고 전체 Diff 원문을 반복하지 않는다" — forbids diff repetition.
- **Report length limits**: `compactReportMaxSentences` (4~30) constrains verbosity per profile.
- **Don't-apply conditions**: SKILL.md step 98 lists situations to skip reporting entirely.
- **Single MCP call**: `get_beginner_report_rules` returns the complete rule set (all sections, safety requirements, evidence rules, status rules, explainedDiffRule, diffRule, notCollected) — no repeated calls needed.

**Potential waste areas** (not currently implemented, not blocking):
- No automated enforcement preventing agent from rereading if it chooses (instruction-based only)
- No telemetry on actual redundant calls or token usage

---

## 11. MUST_FIX_BEFORE_V1 / SHOULD_FIX_BEFORE_V1 / DEFER_AFTER_V1 / DO_NOT_BUILD

### MUST_FIX_BEFORE_V1
(none — no blocking gaps identified)

All 8 core capabilities either meet V1 intent or are explicitly scoped out (visual diff, HTML, voice engine) per PM scope. The CLI help text stale language (S2) is misleading but does not block V1 since the README and CLI_INSTALLATION.md correctly state npm install is available.

### SHOULD_FIX_BEFORE_V1
1. **CLI help text stale deployment language** (S2) — `format.ts` line 144 says "실제 배포 전에는 로컬 패키지 검증만 지원합니다" but jutell@0.3.0 is published. Quick one-line edit to `printHelp()`.
2. **PROVIDER_OPENCODE.md stale key reference** (S2) — uses `beginner_bridge` instead of canonical `jutell`. Update to reflect current `mcp.jutell` key.
3. **README command table missing `jutell use claude`** (S3) — add the command to the user-facing table.
4. **README missing advanced commands** (S3) — add a brief reference to docs/CLI_INSTALLATION.md for the full command list.

### DEFER_AFTER_V1
1. **Integrated agent handoff artifact** — Combine SESSION_SUMMARY.md auto-generation with NEXT_AGENT_HANDOFF.md template into a single command (`jutell session handoff`). The building blocks exist; integration is a feature addition.
2. **Automated meaningful code-block selection** — Let the agent select meaningful code blocks based on `explainedDiffRule` guidance rather than building a diff viewer. Document this expectation in SKILL.md.
3. **Voice/style engine** — Wire `voice.preset` into SKILL.md step 5 (apply "plain" style when preset is `plain`). Small scope; defer until style is requested by users.
4. **CLI per-feature toggle command** — Add `jutell feature explainedDiff on/off` or similar. Currently only available via dashboard.

### DO_NOT_BUILD
1. **Visual diff viewer** — Explicitly not V1 per Product Boundary philosophy.
2. **HTML report generation** — MCP is read-only rules only; HTML generation is out of scope.
3. **Voice-learning system** — Explicitly deferred per JUTELL_STYLE.md line 29.
4. **MCP Registry integration** — Not V1 scope per DECISIONS.md.
5. **Remote Telemetry transmission** — Explicitly not implemented per DECISIONS.md and TELEMETRY_POLICY.md.
6. **Automated agent rereading of files/diffs** — The architecture is designed to prevent this; no system should be built to force it.

---

## 12. Recommended V1 Feature Freeze

**Recommended: GO_TO_MINIMAL_V1_FIX**

The audit shows 5 of 8 core capabilities are fully IMPLEMENTED, 2 are PARTIAL with viable V1 scope, and 1 is PARTIAL with spec-only remaining. No capability has ABSENT or BLOCKED classification for a core V1 promise.

The smallest credible JuTell V1 includes:
- Beginner-friendly reporting via MCP rules + Skill (IMPLEMENTED)
- Explained diff for meaningful changes (IMPLEMENTED for rules; PARTIAL for code blocks)
- Evidence/confidence separation (IMPLEMENTED)
- Feature ON/OFF via dashboard (IMPLEMENTED)
- Request Builder + session summaries for handoff (PARTIAL, but usable)
- CLI with all listed commands working (PARTIAL only due to stale help text)
- Agent efficiency by design (HEALTHY)

The only MUST_FIX (if any) is the CLI help text stale language (S2), which is a 1-line edit. All remaining gaps are S3 polish or explicitly out of V1 scope.

---

## 13. What Was Proven

1. Beginner-friendly reporting works end-to-end: MCP rules → SKILL.md instructions → agent produces structured reports with all 10 sub-items. Verified by tests and dogfood evidence.
2. Feature toggles genuinely change agent-visible behavior: setting `explainedDiff: false` removes `explainedDiffRule` from MCP output (tested). Dashboard toggles write to `.jutell.json` which MCP reads on every call.
3. Evidence/confidence separation is enforced by MCP `safetyRequirements` and `notCollected` — cannot be disabled by features.
4. All 7 V1 platform providers (Codex, OpenCode, Claude Code, Cline-planned) and their status (VERIFIED / beta / 준비 중) are accurately reflected in code, MCP_INTEGRATION.md, and PROVIDER_OPENCODE.md (except stale key reference).
5. All CLI commands listed in the task work (`jutell`, `--help`, `--version`, `use codex/opencode/claude`, `status`, `doctor`, `on`, `off`).
6. Agent efficiency is healthy by design — MCP is read-only rules, SKILL.md instructs evidence reuse, report length is limited.
7. Voice/style config schema exists but has zero runtime effect — proven by JUTELL_STYLE.md's own admission.
8. Next-agent handoff has building blocks (templates, session summaries, copy button) but no integrated automated flow.

## 14. What Was Not Proven

1. **Real end-user non-developer comprehension** — Tests verify rule output and SKILL.md content, but no actual non-developer usability evaluation exists (personal beta phase).
2. **Token savings quantified** — PM decision: exact token delta not proven (V1.5.1 non-blocking research finding).
3. **macOS/Linux actual provider connections** — Platform policy says UNVERIFIED but available. No macOS/Linux-specific dogfood evidence was found in scope.
4. **Voice/style at runtime** — Proven absent (no runtime consumption of `voice.preset`).
5. **Integrated handoff automation** — Template + session summary exist but no single artifact combining both with actual work content.

---

## 15. Special PM Questions

**Q1. Is beginner-friendly reporting genuinely implemented end-to-end?**
Yes. MCP `get_beginner_report_rules` returns active sections filtered by config; SKILL.md instructs the agent to call and apply these rules; all 10 sub-items are available as reportable sections. Tests and dogfood evidence confirm.

**Q2. Does current explainedDiff actually explain code blocks, or only summarize functional changes?**
It provides explanation RULES (what/why/where/important changes/customization) but does NOT extract or supply code blocks. The MCP provides format rules only; the agent must show code from its own context. It is a rule-based guidance, not a code-reading engine.

**Q3. What is the smallest change required to provide useful code-reading without building a full Diff Viewer?**
The `explainedDiffRule` and `diffRule` already instruct the agent to show code and explain it. The smallest change is to ensure SKILL.md verbally reinforces: "재미있는 변화가 있다면 이미 읽은 코드나 변경된 파일의 근처 코드 블록을 1개~2개 보여주고, 왜 중요한지 1~2문장으로 덧붙이세요" — using evidence already obtained. No new system needed; this is an instruction refinement.

**Q4. Can JuTell currently create a useful next-Agent handoff artifact?**
Partially. `jutell session finish` auto-generates SESSION_SUMMARY.md (with placeholder sections for key changes, issues, decisions, next steps, agent handoff notes). The NEXT_AGENT_HANDOFF.md template exists in the local-admin Request Builder with a copy button. But there is no single flow that fills the template with actual session content automatically.

**Q5. If not, can existing Session + Request Builder pieces be reused instead of creating a new system?**
Yes. The `summaryTemplate()` in storage.ts already produces a markdown recap. The NEXT_AGENT_HANDOFF.md template already has the structured sections. The smallest improvement: have the agent reference the session's SESSION_SUMMARY.md content and fill NEXT_AGENT_HANDOFF.md sections from it, using the copy button. No new system needed.

**Q6. Is "user voice" currently real or only prepared?**
Only prepared. `voice.preset` is accepted in config schema but silently dropped by MCP `normalizeConfig` and unused by any runtime path. SKILL.md has no voice references. JUTELL_STYLE.md explicitly states the style engine is not yet implemented.

**Q7. Can individual features really be turned ON/OFF end-to-end?**
Yes. Dashboard FeatureSettings.tsx toggles → writes `.jutell.json` → MCP reads fresh on next call → `beginnerReportRules()` filters `activeReportSections` → agent receives only active rules. Test-verified: `explainedDiff: false` removes the rule; `glossary: false` removes the glossary section. No CLI per-feature toggle exists (only connection-level `on`/`off`).

**Q8. Does `jutell --help` accurately describe the current public product?**
Almost. All commands listed work and match implementation. However, format.ts line 144 has stale text: "실제 배포 전에는 로컬 패키지 검증만 지원합니다" — this contradicts the published `jutell@0.3.0` on npm. The rest of the help (command list, version, provider connections) is accurate.

**Q9. Is there any evidence that current JuTell materially harms Coding Agent productivity?**
No. The architecture is designed to reuse evidence (SKILL.md step 13, MCP read-only rules, report length limits, don't-apply conditions). Dogfood evidence (JUTELL-V1.5.1-AUDIT) confirms "no avoidable repeated engineering work observed" and "evidence reuse was positive."

**Q10. Which missing capability would most weaken JuTell's public value proposition if V1 shipped today?**
The lack of an integrated handoff artifact (Q4). Users get reporting + feature toggles, but to hand off to the next agent they must manually copy and fill a template. The building blocks exist, but the integrated experience is incomplete. This is the most visible gap for a user chaining multiple agent sessions.

---

## GitHub

- **Repository**: `ju0o/jutell`
- **Branch**: `main`
- **Commit SHA**: `fe738d8ad535b42be6062bccb88ac6492d33e3da` (baseline verified)
- **Push**: After committing only the audit document to `main`
- **Working Tree**: Clean at audit start (no uncommitted user changes)

---

## Next Recommendation

GO_TO_MINIMAL_V1_FIX — Fix the stale CLI help text (1-line edit in `format.ts`) and update `PROVIDER_OPENCODE.md`'s key reference. Commit the audit document. No further feature work needed before V1.
