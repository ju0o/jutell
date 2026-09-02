# JUTELL-V1.6-MCP-REGISTRY-DISTRIBUTION-AUDIT-01

**Task:** V1.6 Distribution / Discovery Expansion — MCP Registry audit (research only)  
**Baseline:** `6e735c41f5902b4224a3041f765a383403cf203c` (`main` at 2026-09-02)  
**Date:** 2026-09-02  
**Author:** Coding Agent audit  
**Status:** Research + audit only — no implementation, no registration, no publishing

---

## 1. Executive Summary

**Question:** Should JuTell register its local stdio MCP server in the *official MCP Registry* before V1 RC?

**Answer: B — USEFUL BUT NON-BLOCKING → DEFER_AFTER_V1 (recommended: `SKIP_REGISTRY_AND_GO_TO_RC`).**

- **MCP Registry is a public metadata catalog, not a package host.** It stores a `server.json` that *points to* an existing npm/PyPI/Docker/remote package; it does not install the package itself.
- **JuTell's distribution truth is already complete via npm:** `npm install -g jutell` + `jutell use <provider>` works today on Windows (VERIFIED) and installs both the CLI and the bundled stdio MCP server from a single public npm artifact (`jutell@0.3.0`, `MIT`, `node >=18`).
- **JuTell is technically eligible** as a local `stdio` / `npm` server. No architecture change is required.
- **But registry listing adds only *discovery* value today, not *install* value, for JuTell's three providers.** None of Codex / Claude Code / OpenCode natively consume `registry.modelcontextprotocol.io` to auto-install a local npm MCP server; the registry is consumed by downstream aggregators/marketplaces (VS Code, future clients), not by host apps directly.
- **Blocking V1 on an external preview registry would violate the PM principle:** an external listing/approval must not block V1 when a valid public npm install path already exists.
- **One hard gate remains:** `ju0o/jutell` is still **PRIVATE** on GitHub. Official publication under `io.github.ju0o/*` requires a successful GitHub OAuth/OIDC namespace check and, for transparency/security-review expectations, a public repository URL. Registry publication is effectively impossible while the repo stays private — but making it public is a separate V1 RC decision, not an MCP task.
- **Next gate (if pursued after V1 RC):** add `mcpName`, add `server.json`, `mcp-publisher login/publish`, align `server.version` with `0.3.0` (or next npm release), and make the GitHub repo public — ~2 hours of work, no code change.

---

## 2. Current JuTell Distribution Reality

Verified against `main@6e735c4` (local inspection, not memory):

| Area | Current state | Evidence |
|---|---|---|
| **npm distribution** | Public. `jutell@0.3.0` published to `https://registry.npmjs.org`. Install path is `npm install -g jutell` (global) or tarball `packages/cli`. | `packages/cli/package.json:2-3` (`name: jutell`, `version: 0.3.0`), `packages/cli/package.json:6-8` (`repository.url: https://github.com/ju0o/jutell.git`), `README.md:22-29` |
| **Single artifact contains CLI + MCP** | `packages/cli` ships `dist/` + `assets/mcp-server/` + `assets/skill/` + `assets/local-admin` + `README.md` + `LICENSE`. MCP server is bundled, not a separate package. | `packages/cli/package.json:34-39` (`files`), `packages/cli/assets/mcp-server/index.js`, `apps/mcp-server/src/index.ts` |
| **MCP server** | Local, `stdio` only, read-only helper (5 tools: `get_bridge_status`, `get_active_features`, `get_report_preferences`, `get_beginner_report_rules`, `get_safe_report_requirements`). No `Streamable HTTP` or `SSE` transport. No network access to project code/prompts. | `apps/mcp-server/src/index.ts:2` (`StdioServerTransport`), `apps/mcp-server/src/index.ts:51` |
| **MCP server package** | Not separately published. Internal name `jutell-local-mcp@0.1.0` (`private: true`). Public surface is `jutell@0.3.0`. | `apps/mcp-server/package.json:2-4` |
| **CLI integration** | `jutell use codex|opencode|claude` writes provider-specific config blocks: Codex `config.toml` (`# JUTELL_CLI_MCP_BEGIN`), OpenCode `opencode.json`, Claude `.claude.json`. `status`/`doctor` verify local registration; actual tool calls are not centrally validated. | `packages/cli/src/config/paths.ts`, `packages/cli/assets/mcp-server/index.js` |
| **Repository** | `ju0o/jutell` — **PRIVATE** (PM-confirmed current state). `package.json:repository` points to `https://github.com/ju0o/jutell.git` but repo is not publicly browsable. | PM task statement; `packages/cli/package.json:7` |
| **License** | `MIT` (publicly verifiable license field). `LICENSE` file shipped in package. | `packages/cli/package.json:5`, `LICENSE:1` |
| **Node / platform** | `engines.node >=18`, `type: module`, Windows VERIFIED, macOS/Linux UNVERIFIED (intentional wording). | `packages/cli/package.json:26-27`, `README.md:235-239` |
| **README public install flow** | `npm install -g jutell` → `cd <project>` → `jutell use codex` (plus `opencode`/`claude` beta). No mention of MCP Registry. | `README.md:130-151` |
| **Missing for registry** | No `mcpName` in `packages/cli/package.json`, no `server.json` at repo root or `packages/cli/`, no `$schema` reference. | Grepped `packages/cli/package.json`, `server.json` not found |

**In one sentence:** JuTell already has a complete, verifiable public *npm* distribution; the MCP Registry would be a *second* discovery layer pointing back to that same npm artifact.

---

## 3. What MCP Registry Actually Is

Plain-language summary, verified against current official docs (access 2026-09-02):

**Official name:** **MCP Registry** (also called **Official MCP Registry**, hosted at `registry.modelcontextprotocol.io`). Source at `github.com/modelcontextprotocol/registry`.

**Current status:** **Preview** (not GA). Announced 2025-09-08, API freeze `v0.1` declared 2025-10-24. Maintainers state: *"Breaking changes or data resets may occur before general availability"* and *"may remain stable with no breaking changes"* during the freeze. Use in production at own risk; expect evolution toward v1 GA.

**Who operates it:** The **MCP Registry Working Group** (WG lead: Radoslav Dimitrov, Stacklok) under the Model Context Protocol project, now governed by the **Agentic AI Foundation / Linux Foundation** (MCP donated by Anthropic Dec 2025). Backed by **Anthropic, GitHub, PulseMCP, Microsoft** among others. Open-source codebase (`Go`, `ko`, `PostgreSQL`, GitHub Container Registry `ghcr.io/modelcontextprotocol/registry`).

**What it indexes:** **Metadata about publicly accessible MCP servers** — not the servers themselves. Each entry is a `server.json` document describing one version of one server (name, description, version, where to get the package, how to run it, transports, repository link).

**Does it host packages?** **No.** Packages stay on their original registries: `npm` for npm, `pypi.org` for Python, `crates.io`, `nuget`, `docker.io/ghcr.io`, or `mcpb` via GitHub/GitLab Releases. The MCP Registry only validates that the package exists and that the submitter can prove ownership.

**Relationship to npm/PyPI/Docker/remote:** MCP Registry *points to* those registries. An entry for `io.github.ju0o/jutell@0.3.0` with `registryType: npm`, `identifier: jutell`, `version: 0.3.0`, `transport: {type: stdio}` tells a client: "fetch `jutell@0.3.0` from `registry.npmjs.org` and run it via `npx -y jutell` (or via your configured runtime)."

**Does an entry install the server?** No. The registry never runs `npm install` for users. A *client or aggregator* that consumes the registry API decides how to turn metadata into an install (e.g., write `npx -y jutell` into a config file, or run a helper CLI). The registry itself is install-agnostic.

**Who interacts directly?** **Aggregators / marketplaces**, not end-users and not host apps directly. From `modelcontextprotocol.io/registry/about`: *"The MCP Registry is not intended to be directly consumed by host applications. Instead, host applications should consume other MCP registries, such as downstream marketplaces, via a REST API conforming to the official MCP Registry's OpenAPI spec."* Users browse `registry.modelcontextprotocol.io` (web UI at `/`), aggregators poll `GET /v0.1/servers` (OpenAPI at `registry.modelcontextprotocol.io/docs`), marketplaces curate further (ratings, security scans delegated to underlying package registries).

> Analogy: **npm is the warehouse; MCP Registry is the card catalog that tells you which aisle and which box to fetch, and proves the librarian actually owns that aisle.**

---

## 4. Eligibility

**Question:** Can a local stdio npm MCP server that lives *inside* a larger CLI package like JuTell be listed?

**Answer: YES — CONDITIONAL ELIGIBLE.** No architecture conflict; one gap to close.

| Criterion | Registry position | JuTell fit |
|---|---|---|
| **Local `stdio` servers** | Explicitly supported. `transport.type: "stdio"` is the canonical local transport. Examples in official `quickstart`: `transport: {"type": "stdio"}` for npm. | `apps/mcp-server/src/index.ts` uses `StdioServerTransport` only — matches. |
| **npm-backed servers** | First-class. `registryType: "npm"` is the most common package type. Must be published to `https://registry.npmjs.org` (public) *before* registry publish. | `jutell@0.3.0` already on public npm — satisfies. |
| **Packages containing CLI + MCP server** | Allowed. Registry validates *package* ownership via `mcpName` in `package.json`; it does not require a 1:1 "one repo = one MCP server, nothing else." Many listed servers are also CLIs (e.g., `mcp-shodan` publishes both SDK and CLI). | JuTell's single `jutell` package containing CLI + bundled MCP server + skill/dashboard is permissible; the `server.json` would declare how to invoke the MCP part (typically `npx -y jutell` plus args, or a binary entry point). |
| **Servers started via `npx` / installed package** | Allowed. `runtimeHint: "npx"` + `runtimeArguments` (and/or `packageArguments`) describe how to launch the package via `npx -y <identifier>`. | JuTell currently documents `jutell use codex` for config-writing, not `npx` for running MCP. Server invocation path would need explicit declaration (see §7). The MCP server itself is launched by host apps as a `stdio` child process with a command; that command can be `npx -y jutell mcp` or `node <path>` depending on how JuTell exposes it. Current `packages/cli/assets/mcp-server/index.js` shows the runtime is `node` inside the installed package. Both are valid. |
| **Servers whose main product includes more than MCP** | Allowed. Registry description should *"focus on capabilities, not implementation details"* (schema `description` field) — JuTell being a "harness that explains code" is fine; it is not required to be *only* an MCP server. | JuTell's product positioning (explanation, handoff, voice) exceeds MCP but does not disqualify; it merely affects description quality. |
| **Public install method requirement** | Must be publicly installable *or* publicly accessible. Local stdio via public npm qualifies. | Satisfies via `registry.npmjs.org`. |

**Remaining condition:** Add `mcpName` proof in `package.json` and correct invocation metadata. No code refactor.

---

## 5. Current Registration Requirements

Source: `server.schema.json` draft `2025-12-11` (generated from `openapi.yaml` — `make generate-schema`), `modelcontextprotocol.io/registry/{quickstart,authentication,package-types}` (access 2026-09-02). Listed fields are exact JSON keys.

### 5.1 Top-level `server.json`

| Field | Name in schema | Type | MUST / SHOULD / OPTIONAL | Notes for JuTell |
|---|---|---|---|---|
| `$schema` | `$schema` | string (uri) | SHOULD | `https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json` (or current version at publish time). `mcp-publisher init` injects this. |
| `name` | `name` | string reverse-DNS | **MUST** | Must contain exactly one `/`. E.g., `io.github.ju0o/jutell`. Must match `mcpName` in npm `package.json`. For GitHub auth, must be `io.github.ju0o/*` or `io.github.<org>/*`. |
| `description` | `description` | string 1–100 chars | **MUST** | "Clear human-readable explanation of server functionality. Should focus on capabilities, not implementation details." E.g., `"Local read-only helper that explains AI-driven code changes for non-developers"` (needs crafting ≤100 chars). |
| `version` | `version` | string 1–255, NOT `latest`, no ranges | **MUST** | SHOULD be semver (e.g. `0.3.0`). SHOULD align with `packages[].version`. Each `name@version` must be unique; duplicates rejected. |
| `packages` | `packages` | array of `Package` | **MUST** (one entry covers JuTell) | At least one; JuTell needs one npm entry. `packages` and `remotes` are alternatives; stdio qualifies via `packages`. |
| `repository` | `repository` | object `{source, url, id?, subfolder?}` | SHOULD (OPTIONAL but strongly recommended) | `source: "github"`, `url: "https://github.com/ju0o/jutell"`, optional `subfolder` if MCP lives in subdir (JuTell's MCP is in `packages/cli/assets/mcp-server` — may need `subfolder: "packages/cli"` or root depending on what is considered source). Improves transparency/security review; some consumers expect it. |
| `title` | `title` | string 1–100 | OPTIONAL | Human-readable display name (e.g. `"JuTell"`). Used by aggregators for display. |
| `websiteUrl` | `websiteUrl` | string uri | OPTIONAL | Homepage/docs (e.g. `https://github.com/ju0o/jutell#readme`). Useful for custom install instructions. |
| `remotes` | `remotes` | array of `RemoteTransport` | OPTIONAL | Not needed for JuTell (stdio, not remote HTTP/SSE). |
| `icons` | `icons` | array of `Icon{src}` | OPTIONAL | HTTPS icon URLs; clients SHOULD support png/jpeg, SHOULD also support svg/webp. |
| `_meta` | `_meta` | object (extension) | OPTIONAL | Publisher-provided metadata, vendor namespaced. Not needed for JuTell. |

### 5.2 `Package` object (inside `packages[]`)

| Field | Name in schema | MUST / SHOULD / OPTIONAL | Notes |
|---|---|---|---|
| `registryType` | `registryType` | **MUST** | `"npm"` for JuTell. Other literals: `pypi`, `cargo`, `nuget`, `oci`, `mcpb`. |
| `identifier` | `identifier` | **MUST** | For npm: package name, e.g. `"jutell"` (unscoped) or `"@ju0o/jutell"` if scoped. Must match actual npm identifier. JuTell's npm identifier is `jutell`. |
| `version` | `version` | **MUST** | Specific version, e.g. `"0.3.0"`. Ranges (`^1.2.3`, `~`, `>=`, `1.x`) and `latest` are rejected. |
| `transport` | `transport` | **MUST** | For local/package context, one of `StdioTransport` / `StreamableHttpTransport` / `SseTransport`. For JuTell: `{"type":"stdio"}`. |
| `registryBaseUrl` | `registryBaseUrl` | SHOULD | Base URL of package registry. For npm, defaults to `https://registry.npmjs.org`; omit to use default. Only set to override. |
| `runtimeHint` | `runtimeHint` | SHOULD when `runtimeArguments` present | e.g. `"npx"` for npm, `"uvx"` for PyPI, `"docker"` for OCI, `"dnx"` for NuGet. If absent, client infers runtime from `registryType`. For JuTell, likely `"npx"`. |
| `runtimeArguments` | `runtimeArguments` | OPTIONAL | Additional args passed to runtime (before package). E.g. `[{"type":"positional","value":"-y"}]`. Some servers omit; default behavior is `npx -y <identifier>` for npm. |
| `packageArguments` | `packageArguments` | OPTIONAL | Args passed *after* the package binary. Array of `Argument` (`PositionalArgument` or `NamedArgument`). Useful if JuTell's MCP entry point needs flags (e.g. `["mcp", "--stdio"]`). Currently JuTell's MCP is invoked via `node packages/cli/assets/mcp-server/index.js` inside the installed package; this must be encoded correctly. |
| `environmentVariables` | `environmentVariables` | OPTIONAL | Array of `KeyValueInput` — declare required env vars (name, description, isRequired, isSecret, format). JuTell currently requires *no* env vars (local read-only). Can omit or provide empty array. |
| `fileSha256` | `fileSha256` | REQUIRED for `mcpb`, OPTIONAL otherwise | Integrity hash; validated by clients if present. Not needed for npm. |

### 5.3 Ownership verification (package-type specific)

| Package type | Verification method | Exact proof location | Value must equal |
|---|---|---|---|
| **npm** (JuTell) | `mcpName` field in `package.json` | `package.json: mcpName` (top-level) | `server.json: name` (exact string match) |
| PyPI | `mcp-name: <serverName>` in package README (PyPI description) | README | `server.json: name` |
| NuGet | `mcp-name: <serverName>` in package README | README | `server.json: name` |
| Cargo | `mcp-name: <serverName>` as visible markdown text (HTML comments stripped) | README visible text | `server.json: name` |
| OCI | `LABEL io.modelcontextprotocol.server.name="<serverName>"` in Dockerfile | Image annotation | `server.json: name` |
| MCPB | `identifier` URL must contain `mcp` + `fileSha256` present | `server.json` | — |

For JuTell (npm): add `"mcpName": "io.github.ju0o/jutell"` to `packages/cli/package.json` and ensure `server.json: name` matches exactly.

### 5.4 Namespace + auth (summary of §6)

- GitHub OAuth/OIDC → allowed namespace `io.github.ju0o/*` (or `io.github.<org>/*`). User/org must authenticate as that GitHub identity.
- DNS (`TXT v=MCPv1; k=...; p=...`) → reverse-DNS `com.example/*` (e.g. `com.jutell` would require owning `jutell.com`).
- HTTP (`/.well-known/mcp-registry-auth`) → same domain ownership.

### 5.5 Tooling (`mcp-publisher`)

| Command | Purpose |
|---|---|
| `mcp-publisher init` | Generate `server.json` template (auto-detects `package.json`) |
| `mcp-publisher login github` | GitHub OAuth device flow (or `login github-oidc` in Actions) |
| `mcp-publisher login dns/http ...` | Domain verification |
| `mcp-publisher publish [--file PATH] [--dry-run]` | Validate against schema → verify ownership → check namespace → publish to `https://registry.modelcontextprotocol.io` |
| `mcp-publisher logout` | Remove `~/.mcp_publisher_token` |
| `curl https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.ju0o/jutell` | Verify publish |

No `server.json` file, no `mcp-publisher` binary, and no manifest is currently checked into JuTell.

---

## 6. Ownership / Namespace

| Question | Answer | Implication for JuTell |
|---|---|---|
| **How are registry names formed?** | Reverse-DNS with exactly one `/` separating namespace from local name, e.g. `io.github.ju0o/jutell`, `io.github.my-org/weather`, `com.example/server`, `ai.example/server`. Regex: `^[a-zA-Z0-9.-]+/[a-zA-Z0-9._-]+$`, max 200 chars. | JuTell's natural choice is `io.github.ju0o/jutell`. Alternative `com.jutell/jutell` would require owning `jutell.com`. |
| **Must names be namespaced?** | Yes. Bare names (`jutell`) are invalid. Namespace proves ownership. | `jutell` alone cannot be registered; must be `io.github.ju0o/jutell`. |
| **Does GitHub owner affect namespace?** | Yes — GitHub auth *binds* the namespace to the authenticated GitHub username/org. `mcp-publisher login github` as `ju0o` grants publish rights only to `io.github.ju0o/*`. Publishing `io.github.other/jutell` as `ju0o` fails with `You do not have permission`. | `ju0o` must be the publisher identity. If `ju0o` is a personal account (not an org), it still qualifies — personal namespace is explicitly valid. Org namespaces (`io.github.ju0o-org/*`) would require `ju0o` to have org ownership. |
| **Is npm package ownership sufficient?** | Necessary but not sufficient. Registry checks *both*: (1) GitHub/DNS namespace auth *and* (2) package-type proof (`mcpName` for npm). Owning `jutell` on npm alone does not let someone else publish `io.github.attacker/jutell`. | `ju0o` already owns `jutell` on npm (per `npm whoami` / publish rights for `0.3.0`), so proof (2) is within reach; (1) requires GitHub identity match — which `ju0o` satisfies. |
| **Is domain ownership required?** | No, if using GitHub auth. Domain ownership only required if choosing domain-based namespace (`com.example/*`). | JuTell does not need to buy `jutell.com` if it uses `io.github.ju0o/jutell`. |
| **Is a personal GitHub namespace valid?** | Yes. Docs and schema explicitly allow `io.github.<username>/*` for personal accounts. No requirement to be an org. Many current listings are personal (`io.github.username/weather`). | `io.github.ju0o/jutell` is standards-compliant as a personal namespace. No org creation needed. |
| **Can JuTell claim its desired identifier?** | Yes, assuming `ju0o` remains the GitHub account holder and `jutell` npm owner. No collision detected at time of audit: search of `registry.modelcontextprotocol.io/?q=jutell` and `?q=ju0o` returned no `io.github.ju0o/jutell` entry (registry had no JuTell). The identifier `io.github.ju0o/jutell` is free. A nearby name `io.github.ju0o/jutell` does not conflict with other users' namespaces. | Low collision risk. However, until published, any other `ju0o`-impersonator with GitHub access could claim it — but they would still fail npm `mcpName` proof without npm ownership of `jutell`. Squatting risk is low. |
| **Should we reserve now?** | Task explicitly says **DO NOT reserve/register**. But note that premature reservation of `0.3.0` before V1 could need a version bump for V1 if registry version + npm version coupling is strict. | Defer reservation until publish-ready (public repo + next npm version). |

**Summary:** JuTell's existing GitHub `ju0o` + npm `jutell` ownership maps cleanly to `io.github.ju0o/jutell` under GitHub auth. No domain purchase, no org, no rename. Personal namespace is valid; collision risk is negligible.

---

## 7. JuTell Gap Analysis

Compare current `main@6e735c4` against requirements in §5–§6.

### 7.1 Detailed gap table

| Area | Current JuTell (`main@6e735c4`) | Registry requirement | Gap | V1 impact |
|---|---|---|---|---|
| **`mcpName` in npm package** | Absent in `packages/cli/package.json`. | **MUST** for npm verification: `package.json.mcpName == server.json.name` | **GAP** — add one line: `"mcpName": "io.github.ju0o/jutell"` | MUST if publishing, otherwise NO CHANGE |
| **`server.json` file** | Does not exist anywhere in repo (checked root, `packages/cli/`). | **MUST** to publish — registry validates against schema. | **GAP** — create `server.json` (or publish `mcp-publisher init` output). At least 7 required fields: `$schema`, `name`, `description`, `version`, `packages[0]{registryType,identifier,version,transport}` | MUST if publishing |
| **`name` (reverse DNS)** | No registry name chosen. npm name `jutell` exists, but no reverse-DNS server name. | Must be `io.github.ju0o/jutell` (GitHub auth). | **GAP** — decide name, ensure ≤200 chars, one `/`, matches `mcpName`. | MUST if publishing |
| **`description`** | Existing `package.json:description` is 78 chars: `JuTell by Ju0 — non-developer harness...` Too long for registry `description` (max 100 but needs capability-focused sentence). Registry wants capability description, not tagline. | Must be 1–100 chars, capability-focused, not implementation detail. | **MINOR GAP** — craft new description ≤100 chars, e.g. `"Local helper that explains AI code changes for non-developers"` (59 chars). | SHOULD fix before publish; no effect if not publishing |
| **`version` alignment** | `packages/cli: 0.3.0`, `apps/mcp-server: 0.1.0`, `assets/version.json: cli 0.3.0 / mcp 0.1.0`, `server.json` absent. | Registry `server.version` SHOULD align with `packages[].version` (npm version) to reduce confusion. Each `name@version` must be unique. | **GAP** — decide whether registry version `0.3.0` (align with npm) or distinct. Aligning is SHOULD, not MUST. JuTell currently treats MCP as part of CLI version (`0.3.0`), so `0.3.0` is natural. | SHOULD align; no urgency before next npm publish |
| **Package `identifier`** | `jutell` (unscoped). | Must match npm identifier exactly. | No gap — `jutell` is correct identifier (not `@ju0o/jutell`). | No change |
| **Transport declaration** | Stdio only (`StdioServerTransport`), no HTTP/SSE. | Must declare `transport: {"type":"stdio"}` in `packages[0]`. | No code change needed — just declare. | No change |
| **Invocation (`runtimeHint`, `runtimeArguments`, `packageArguments`)** | MCP server is internal to installed package: launched via `node packages/cli/assets/mcp-server/index.js` inside the installed global. No documented `npx` entry point. CLI does not expose `jutell mcp`. | SHOULD declare how client should run the server: `runtimeHint: "npx"` + `runtimeArguments: ["-y"]` if using `npx`, or document binary entry `jutell`/`node`. Schema allows either. | **GAP** — need to decide and document the actual `stdio` command the host will exec. Current install writes config that spawns the MCP via `node` with absolute path to `assets/mcp-server/index.js` (provider-specific). Registry entry must match what `mcp-publisher` will generate / what clients expect. Verify `mcp-publisher init` auto-detection picks this up; may need manual edit. | MUST document before publish; do not change runtime today |
| **Repository metadata** | `package.json: repository.url = https://github.com/ju0o/jutell.git` but GitHub repo is PRIVATE. `server.json: repository` not yet present. | SHOULD provide `repository: {source:"github", url:"https://github.com/ju0o/jutell"}` for transparency. Host requires *installation method* be public (npm is public) even if source is closed; but for local stdio, public repo URL is strongly expected for security review. Private URL would be unverifiable. | **BLOCKING GAP if private persists** — see §10. | MUST make public before registry publish |
| **License** | `MIT` — correct, permissive, registry-acceptable. | No registry license field, but downstream aggregators surface it. MIT is fine. | No gap. | No change |
| **README** | Current `README.md:130-151` focuses on `npm install -g jutell` + `jutell use <provider>`, no registry mention. | Not required for registry publish, but `websiteUrl` SHOULD point to README for custom setup. | No gap. | Optional to add badge/link after publish |
| **Build artifact / `files`** | `packages/cli: files: ["dist","assets","README.md","LICENSE"]` correctly ships MCP assets. | Registry validates package *exists on npm*, not local build. No extra build step. | No gap. | No change |
| **Ownership verification** | No `mcpName`, so `mcp-publisher publish --dry-run` would fail `"Registry validation failed for package"`. | Must pass ownership check before namespace check. | Covered by `mcpName` gap above. | — |

### 7.2 Minimal diff to become publish-ready

If JuTell decided to publish *today* (it should not, per §14), the smallest change set would be:

```diff
# File: packages/cli/package.json
{
  "name": "jutell",
  "version": "0.3.0",
+ "mcpName": "io.github.ju0o/jutell",
  ...
}
# New file: server.json (repo root or packages/cli/server.json — mcp-publisher discovers via package.json location)
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.ju0o/jutell",
  "description": "Local helper that explains AI code changes for non-developers",
  "title": "JuTell",
  "version": "0.3.0",
  "websiteUrl": "https://github.com/ju0o/jutell#readme",
  "repository": { "source": "github", "url": "https://github.com/ju0o/jutell" },
  "packages": [{
    "registryType": "npm",
    "identifier": "jutell",
    "version": "0.3.0",
    "transport": { "type": "stdio" }
    // runtimeHint / packageArguments left to mcp-publisher init auto-detect
  }]
}
# Prereqs outside repo diff:
# - publish jutell@0.3.0 with mcpName to npm (or next version)
# - make ju0o/jutell public
# - run: mcp-publisher login github  (as ju0o)  &&  mcp-publisher publish
```

No transport change, no MCP behavior change, no CLI flag change.

---

## 8. Provider Impact

Assessed per current official provider docs (access 2026-09-02). No speculation; mark `UNKNOWN` where no official statement exists.

### Codex

| Question | Finding | Source / confidence |
|---|---|---|
| Currently consumes official MCP Registry? | **No evidence.** OpenAI Codex CLI MCP docs describe manual config via `config.toml` TOML (`[mcp_servers.*]`, `command`, `args`) and marketplace-style discovery via repo-local `.agents/plugins/marketplace.json` or universal catalogs. No `registry.modelcontextprotocol.io` consumption found in Codex docs. There is *no* native `codex mcp add --registry <url>` or `--search` flag documented. | Codex MCP server setup guides (e.g., `cexll/codex-mcp-server` config examples use `npx -y @cexll/codex-mcp-server` directly; OpenCode hub search found no Codex-registry native feature) |
| Does registry listing change installation? | **No.** User would still add via `jutell use codex` (which writes `config.toml` block) or manually via `codex mcp` helper. Registry entry does not write Codex config. | `packages/cli` `use.ts` / `managed.ts` show Codex registration via `codexScopedPaths` → `config.toml` |
| Does it expose browse/search? | No. Codex does not surface a registry browser. Users discover via npm/GitHub/README/marketplace index. | No Codex registry UI found |
| Would `jutell use codex` still be needed? | **Yes.** Registry does not replace provider-specific setup (different config file locations, `BEGIN`/`END` marker blocks, skill + AGENTS.md). | Ibid |
| Net: discovery-only improvement? | **Yes — possible via external catalogs** (e.g., `777genius/universal-plugins-for-ai-agents` indexes Codex via `.agents/plugins/marketplace.json`), but not via official MCP Registry directly. | Universal plugins catalog docs |

**Verdict for Codex:** `NOT PROVIDED BY REGISTRY` for auto-install; `POSSIBLE / CLIENT-DEPENDENT` for ambient discoverability if Codex marketplace aggregators begin indexing the official registry feed.

### Claude Code

| Question | Finding | Source / confidence |
|---|---|---|
| Currently consumes official MCP Registry? | **Partially — not for auto-install.** Claude Code supports MCP via `claude mcp add <name> -- <command>` and managed distribution via `managed-mcp.json` + `allowedMcpServers`/`deniedMcpServers`, plus **plugin marketplaces** (`/plugin marketplace add`, `claude-plugins-official`). There is an *open* feature request to make `claude mcp add` registry-aware (`anthropics/claude-code#64633`, opened 2026-06-02, state `open` as of 2026-08-28, 6 comments). Comment from Claude maintainer `bcherny` on 2026-08-17: *"There's no registry search or discovery step built into `claude mcp add` yet, so leaving this open for that part."* | `code.claude.com/docs/en/mcp` (official install methods); `code.claude.com/docs/en/managed-mcp` + `plugin-marketplaces`; GitHub issue #64633 |
| Does listing change installation? | **No today.** Still requires `claude mcp add jutell -- ...` or marketplace plugin install. The registry is *not* in the call path. | Same issue + official docs |
| Does it expose search/discovery? | Not natively via `claude mcp` — but the plugin marketplace does provide `/plugin install mcp-registry@...` (search helper). Thoroughly: VS Code *does* consume official registry spec natively (reported by `darconadalabarga` in #64633), but Claude Code does not yet. | #64633 comment `darconadalabarga` 2026-06-04; `claude-directory.org` plugin listing for `mcp-registry` |
| Would `jutell use claude` still be needed? | **Yes** in practice. JuTell writes project-vs-global (`~/.claude.json` with `projects[targetRoot].mcpServers` vs top-level) and provides `jutell status/doctor`. Registry cannot replace that. | `packages/cli/src/installer/claude.ts` |
| Net | **PROVEN CURRENT BENEFIT = zero for auto-install; POSSIBLE via marketplace aggregator after future Claude Code registry integration.** Today it's purely branding/search at `registry.modelcontextprotocol.io` web UI. | — |

**Verdict for Claude Code:** `NOT PROVIDED BY REGISTRY` for one-click install today; `POSSIBLE / CLIENT-DEPENDENT` for discovery if Claude Code ships the registry-discovery feature (tracked but not shipped).

### OpenCode

| Question | Finding | Source / confidence |
|---|---|---|
| Currently consumes official MCP Registry? | **Not natively.** OpenCode manages MCP via `opencode.json` (`{mcp: { "id": {type:"local" , command:[...]} } }`) and tools `opencode mcp auth/debug`. An *external* MCP server (`AbbasSrour/opencode-mcp`) exists that adds `search-mcp-registry` via live `registry.modelcontextprotocol.io` API to *generate* `opencode.json` snippets — proving the registry is usable *as an LLM tool*, not as native install plumbing. Separate tracker lists `opencode-mcp-registry` but describes context bloat concerns — again, not native one-click install. | `opencode.ai/docs/mcp-servers` (official OpenCode MCP server docs — no registry mention, only manual config + remote/local examples); `github.com/AbbasSrour/opencode-mcp` README (documents `search-mcp-registry` tool); `github.com/devinoldenburg/opencode-mcp-registry` |
| Does listing change installation? | **No.** User still needs `jutell use opencode` or manual `opencode.json` edit. | Official docs |
| Does it expose browse/search? | Only via third-party `opencode-mcp` helper that an LLM calls; not built into `opencode` CLI. | Third-party repo |
| Would `jutell use opencode` still be needed? | **Yes.** | Same config path logic |

**Verdict for OpenCode:** `NOT PROVIDED BY REGISTRY` for auto-install; `POSSIBLE / CLIENT-DEPENDENT` for tool-assisted discovery via helper servers, not product-grade.

### Cross-provider summary

- **Official MCP Registry → auto-config / one-click install:** `NOT PROVIDED` for all three JuTell providers today.
- **Official MCP Registry → discoverability / trust metadata:** `POSSIBLE / CLIENT-DEPENDENT` via aggregators/marketplaces/VS Code-like clients; `PROVEN` only as a web-searchable catalog at `registry.modelcontextprotocol.io` and API for third-party indexes.
- **`jutell use <provider>` remains required** even after registry listing.

---

## 9. User Value

Compare current flow against a hypothetical registry presence.

**Current JuTell flow (proven, supported):**

```powershell
npm install -g jutell
jutell use codex      # or opencode / claude
# → .jutell.json + .agents/skills/beginner-bridge/SKILL.md + AGENTS.md + provider MCP block
#   then normal agent work → JuTell report
```

**Future with MCP Registry (after publish of `io.github.ju0o/jutell@0.3.0`):**

User *still* runs `npm install -g jutell` + `jutell use <provider>` for JuTell's skill/profile/voice setup. Registry makes JuTell *findable* at `registry.modelcontextprotocol.io/?q=jutell` and via API `GET /v0.1/servers?search=jutell`.

| Potential benefit | Classification | Evidence / notes |
|---|---|---|
| **Discoverability (browsing the web registry UI)** | **PROVEN CURRENT BENEFIT** | Anyone searching `jutell` at `registry.modelcontextprotocol.io` or via API aggregators (Glama indexes ~19k servers, Punching) would see JuTell's card (name, description, version, npm identifier, transport). Real, today. |
| **Trust metadata (namespace proof)** | **PROVEN CURRENT BENEFIT** | `io.github.ju0o/*` namespace proves the GitHub account `ju0o` owns the entry, and npm `mcpName` proves ownership of the `jutell` package. Visible without reading code. |
| **Standardized metadata for tools** | **PROVEN CURRENT BENEFIT** | `server.json` gives machines a canonical `registryType`, `identifier`, `version`, `transport` tuple — useful for future LLM-driven `opencode-mcp` style helpers that call registry APIs. |
| **Client-side browse/search inside Codex / Claude Code / OpenCode** | **NOT PROVIDED BY REGISTRY** (today) — `POSSIBLE / CLIENT-DEPENDENT` in future | None of the three providers ship a `registry search` in CLI today (see §8). Future clients that implement the OpenAPI spec *could*, but none do for JuTell's lane. |
| **One-click install (registry → writes config)** | **NOT PROVIDED BY REGISTRY** | Registry never runs installs; downstream marketplaces *might* provide one-click, but JuTell's multi-step flow (`jutell use` + skill + AGENTS.md) cannot be reduced to a single registry click. Overselling one-click would be false. |
| **Automatic config (writes `config.toml` / `opencode.json` / `.claude.json`)** | **NOT PROVIDED BY REGISTRY** | Registry metadata informs *how* to install, but JuTell's CLI writes provider config; registry does not execute that. |
| **Easier provider integration (less code for JuTell)** | **NOT PROVIDED** | JuTell's per-provider installers remain. Registry adds *another* distribution surface, not a replacement. |
| **Package/version discovery (is there a newer JuTell?)** | **PROVEN** for machines — API exposes `version`; `POSSIBLE` for humans if they check registry UI, but `npm view jutell version` already does this more directly. | Registry supports semver ordering and `version` pinning; Claude #64633 notes desire to "pin MCP Server versions and suggest updates" via registry — not yet shipped in Claude Code. |
| **SEO / ecosystem presence** | **POSSIBLE / CLIENT-DEPENDENT** | Listing surfaces JuTell in ecosystem lists that scrape `registry.modelcontextprotocol.io` (Glama, MCPrepository, LobeHub, etc.) — real but indirect benefit. Not guaranteed to move activation. |

**Bottom line for user value:** registry listing *does not* replace `jutell use`. It *does* give a verifiable public card and a machine-readable pointer. That is branding + trust + future-proofing, not activation. Value is real but small and non-blocking for V1.

---

## 10. Repository Visibility Implication

| Question | Finding |
|---|---|
| **Does registry publication require a public source repository?** | Not strictly *required by schema* (`repository` is OPTIONAL), but **effectively required for JuTell's path.** Docs `modelcontextprotocol.io/registry/about` § *Relationship with Server Developers*: *"Server developers can publish ... as long as the server's installation method is publicly available (e.g., an npm package or a Docker image on a public registry) or the server itself is publicly accessible."* Local stdio via public npm satisfies "public installation method" — so a **closed-source** server *could* be listed without a public repo. BUT: (a) JuTell's `repository.source: github` namespace auth ties to a GitHub identity; (b) security-review expectations and aggregator curation rely on browsing source; (c) publishing a server named `io.github.ju0o/jutell` that points to a 404/private repo undermines trust; (d) `mcp-publisher` auto-detects `repository.url` from `package.json` and that URL 404s if private. |
| **Does it require publicly accessible package only?** | Yes — the underlying npm package must be public on `registry.npmjs.org`. **Satisfied** (`jutell@0.3.0` is public). |
| **Does it require public manifest?** | The published *metadata* (`server.json`) becomes public at `registry.modelcontextprotocol.io/v0.1/servers/<name>` and via search. That's the whole point. No private metadata path on the official registry. |
| **Does it require GitHub verification?** | For `io.github.ju0o/*` namespace, **yes**: `mcp-publisher login github` must succeed as user `ju0o` (OAuth device flow) or via Actions OIDC with that repo. This check passes even if the repo is private (GitHub auth validates identity, not repo visibility), but the *usefulness* of the listing collapses if the repo link is private. |
| **Can JuTell publish while `ju0o/jutell` stays private?** | **Technically publishable (closed-source path), but NOT RECOMMENDED and arguably defeats the purpose.** The registry would accept a `server.json` with no `repository` or with `repository.url` pointing to a private URL, and npm proof would still pass. However: (1) the listing would show a repository link that 404s for everyone except `ju0o`; (2) downstream security scanning is delegated to the package registry + aggregators — a private repo blocks code inspection; (3) `ju0o/jutell` private → public is already on the V1 RC checklist anyway, so the marginal cost of making it public *before* registry publish is low and benefits both npm and registry. |

**Direct recommendation:** **Do NOT attempt registry publication while `ju0o/jutell` is private.** Make the repository public first (as a standalone V1 RC decision), then publish registry metadata. This is not a JuTell code change — it is a GitHub visibility toggle owned by `ju0o`.

---

## 11. Version / Release Implication

| Question | Finding |
|---|---|
| **Must registry entry version match npm version?** | **SHOULD, not MUST.** `server.json: version` and `packages[].version` are independent fields; registry allows `server.version = 1.2.3-1` with `packages[].version = 1.2.3` (prerelease labeling guidance in `mcp-publisher` docs). But mismatch confuses users; best practice is to align (e.g. both `0.3.0`). Schema warns: *"Version ranges are rejected"* and *"SHOULD follow semver"*. |
| **Does every npm release require registry update?** | **Yes, if you want the registry to reflect the new package.** Registry versions are immutable per `(name, version)` pair; publishing `jutell@0.4.0` to npm does not auto-update `registry.modelcontextprotocol.io`. You must `mcp-publisher publish` again with a new `server.json` version `0.4.0`. Otherwise registry stays on stale `0.3.0` while npm moves forward. This is an additive maintenance burden. |
| **Does registry metadata publish trigger separate release workflow?** | **Yes, separate step.** Two-phase release: (1) `npm publish` (requires `npm adduser` + `package.json` build) then (2) `mcp-publisher publish` (requires registry auth). Can be automated via GitHub Actions (`mcp-publisher login github-oidc` + `id-token: write`, see `docs/modelcontextprotocol-io/github-actions.mdx`). No GitHub Release required, but many teams couple the two in one Action. |
| **Should JuTell wait for next package version?** | **No technical need to wait, but pragmatically yes.** `0.3.0` is already published to npm without `mcpName`, so a registry entry for `0.3.0` would require **re-publishing** `0.3.0` with `mcpName` added — which npm rejects (immutable version). The `mcpName` field is *not* validated at npm publish time (it is inert to npm clients), but to pass registry ownership check the *published* tarball on `registry.npmjs.org` must contain `mcpName`. Since `0.3.0` on npm lacks it, publishing registry `0.3.0` would fail validation (`Registry validation failed for package`). The fix is to publish a new npm version (likely `0.3.1` or `0.4.0` or `1.0.0` for V1) that includes `mcpName`, then register that same version. Therefore registry publish should ride the *next* npm release, not retrofit `0.3.0`. |
| **Does registering 0.3.0 before V1 make sense?** | **No.** `0.3.0` is a pre-V1 artifact; V1 RC will likely be `1.0.0` or at least a new minor. Registering a stale `0.3.0` would immediately need `0.4.0`/`1.0.0` supersession. Better to debut the registry entry alongside the V1-compatible npm release. |

**Key constraint for planning:** registry entry and npm version are **coupled but not automatic**; each npm release after V1 implies an extra `mcp-publisher publish` step.

---

## 12. Other Discovery Paths

Lightweight surfaces, no scope expansion. Classified by V1 urgency.

| Surface | Current JuTell state | User value | Effort | External dependency | V1 priority |
|---|---|---|---|---|---|
| **npm package metadata (`package.json: keywords`, `description`, `repository`, `homepage`)** | `keywords` present (9 terms, includes `mcp`, `skill`, `codex`, `claude-code`); `description` generic harness tagline. No `mcpName` yet. | Proven — npm search ranks on keywords + description; insiders find packages by keyword search + `npm search mcp` | 5 min: enrich `keywords` (add `ai-agent`, `non-developer`, `report` if relevant) — but limited SEO effect. | None (inside repo) | **NICE TO HAVE** — tweak alongside `mcpName` addition |
| **GitHub `ju0o/jutell` Topics (`Topics` on repo page)** | Private repo, so topics are not publicly visible. After making public, adding topics like `mcp`, `model-context-protocol`, `claude-code`, `codex`, `opencode`, `ai-agent`, `non-developer`, `report` surfaces the repo in GitHub topic search. | Proven for GitHub discovery; follows from making repo public | 2 min in repo settings | Requires repo public | **NICE TO HAVE** (do when going public) |
| **GitHub repository description / README first line** | Description unknown (private); README hero is now strong (landing page at `README.md:1`). | Proven for social sharing + GitHub search snippet | 2 min | Repo public | **NICE TO HAVE** |
| **MCP-related directories (Glama `glama.ai`, `mcp.so`, `MCPrepository.com`)** | Not listed in those directories as of 2026-09-02 search; they scrape npm keywords and/or registry feeds. | Proven for LLM-driven discovery (many tool-chaining agents search these) | Deferred — most aggregate *from* official registry, so listing there first solves this. Direct manual submission to each is spam-prone. | Registry + keywords as upstream | **DEFER** (do registry, then aggregators auto-pick up) |
| **Provider-specific plugin/server directories** | Codex: universal plugins catalog `777genius/universal-plugins-for-ai-agents` (covers Codex/OpenCode/Gemini/Cursor) could index JuTell via `.agents/plugins/marketplace.json` submission. Claude Code: `claude-plugins-official` marketplace needs a plugin repo + `plugin.yaml`. | Proven for in-client install (`/plugin marketplace add` / `plugin-kit-ai add`) — higher install value than MCP Registry for these providers. | Cat-mediated, requires authoring a small plugin wrapper repo (not just `server.json`). | Maintained by third parties / Anthropic | **NICE TO HAVE after V1** — distinct from MCP Registry; evaluate after core V1 if demand exists. Do not conflate with registry. |
| **`smithery.ai` / `pulse` / `super` marketplaces** | Third-party MCP marketplaces not in official path; some mirror registry API. | Proven for niches but not canonical. | Manual submission, low signal. | External | **DEFER** |

**No surface is a must before V1.** Highest ROI among `NICE TO HAVE` is making the GitHub repo public with accurate Topics/description — because it feeds *both* npm discoverability and any future registry entry, and costs minutes.

---

## 13. MUST / SHOULD / NOT NEEDED

### Before any registry publish (not before V1):

| Priority | Action | Owner | Evidence path |
|---|---|---|---|
| **MUST** | Make `ju0o/jutell` GitHub repository **public** (or decide closed-source listing is acceptable — not recommended). | Repo owner `ju0o` | `package.json:7` `repository.url` 404s while private; §10 |
| **MUST** | Add `mcpName` to the *published* npm `package.json` and publish a new npm version (e.g. `0.3.1` or `1.0.0`). Existing `0.3.0` on npm lacks it and cannot be overwritten. | Maintainer + `npm` credentials | `packages/cli/package.json:2` needs `"mcpName": "io.github.ju0o/jutell"` |
| **MUST** | Create `server.json` at repo root (or `packages/cli/server.json` where `mcp-publisher init` will find `package.json`) with at least `name`, `description`, `version`, `packages[0]`. | Coding agent (when gate opens) | §5.1: required fields `name`, `description`, `version`, `packages` |
| **MUST** | Choose and lock `name = io.github.ju0o/jutell` and verify `package.json:mcpName == server.json:name`. | Maintainer | §6: personal `io.github.ju0o/*` valid |
| **MUST** | Verify `packages[0]` triple: `registryType: "npm"`, `identifier: "jutell"`, `version: <published npm version>`, `transport: {"type":"stdio"}`. | Maintainer | `server.schema.json: Package` |
| **SHOULD** | Set `title: "JuTell"`, `websiteUrl: "https://github.com/ju0o/jutell#readme"`, `repository: {source:"github", url:"https://github.com/ju0o/jutell"}` (public URL), align `server.version == packages[].version`, optionally set `runtimeHint: "npx"` if `mcp-publisher init` suggests it. | Maintainer | §5.1 |
| **SHOULD** | Craft `description` ≤100 chars, capability-focused (not implementation), e.g. `"Local helper that explains AI code changes for non-developers"` (≤100). | Maintainer / PM | Schema `description.maxLength:100` |
| **NOT NEEDED** | Change MCP transport (keep `stdio`), change package from unscoped `jutell` to scoped, buy `jutell.com`, create GH org, change CLI `bin.jutell` name, change license, change Node `>=18` engine, add `mcpb`/`oci` package entries. | N/A | §7: no gap |
| **NOT NEEDED** | Publish registry entry for stale `0.3.0` without a new npm version. | N/A | §11: immutable npm version would fail ownership check |

### Before V1 RC (independent of registry):

| Priority | Action | Why |
|---|---|---|
| **NOT NEEDED** | MCP Registry publication | Registry adds only discovery (see §9, §8); npm install already works and providers do not consume registry yet. External preview approval is not a V1 RC signal. |
| **NICE TO HAVE** | Make `ju0o/jutell` public + set Topics/description + ensure `keywords` are accurate | Feeds all discovery (GitHub, npm search, future registry) with minutes of work; also required *eventually* for registry. Can be done with V1 RC in one toggle. |
| **NOT NEEDED** | New marketplace plugins (Codex universal catalog, Claude official, Smithery, Pulse, etc.) | Separate surfaces, separate wrapper repos; defer until post-V1 demand is proven. |

---

## 14. V1 Blocker Decision

### Decision: **DEFER_AFTER_V1 — USEFUL_NON_BLOCKING**

| Option | Definition | Pick |
|---|---|---|
| **A. REQUIRED FOR V1** | Registry listing must land before V1 RC; V1 ships only after approval. | **Rejected** |
| **B. USEFUL BUT NON-BLOCKING** | Registry listing adds value, but V1 RC should not wait for it. | **Selected** — value is discovery, not activation, and providers don't consume it yet. |
| **C. NOT USEFUL / NOT APPLICABLE** | Registry is irrelevant to JuTell. | **Rejected** — it *is* applicable; a local stdio npm server like JuTell is explicitly within scope, and discovery value is proven (web catalog + trust proof). |

**Why B (defer) and not A or C:**

1. **User value is real but small and downstream.** Registry gives a verifiable public card + machine pointer, but JuTell activation remains `npm install -g jutell` + `jutell use <provider>`. No provider auto-installs today (§8), so no current friction removed by registry presence.
2. **Current installability is proven.** `jutell@0.3.0` on public npm + `README.md:22-29` landing page + Windows VERIFIED (§2) means a new user hitting GitHub/npm can succeed *without* the registry. JuTell's own docs never mention the registry and still allow success.
3. **Technical readiness is high but gated on repo visibility + next npm version.** Only diff between now and publish-ready is `mcpName` + `server.json` + public repo (§7.2) — trivial code — but the public-repo toggle and npm republishing are deliberate RC decisions, not drive-bys.
4. **Provider support is nascent/aggregator-mediated.** Codex, Claude Code, OpenCode do not natively poll `registry.modelcontextprotocol.io` for local npm stdio servers (§8). Over-investing before clients do risks wasted maintenance: each npm version would then require an extra `mcp-publisher publish`.
5. **External dependency/process risk.** Registry is in *preview* with possible breaking changes/data resets; token storage (`~/.mcp_publisher_token`), JWT expiry, and manual takedown policies are outside JuTell's control. V1 RC should not hinge on an external preview approval queue.
6. **External listing should not block V1.** PM principle from task brief: *"External listing/approval should NOT automatically block V1 if JuTell already has a valid public npm installation path."* JuTell does — so goto RC.

**Concrete blocker test:** *Would V1 be unshippable without registry listing?* No. *Would V1 be meaningfully worse without it for 95% of target users (vibe coders, non-developers via Codex/Claude/OpenCode)?* No — they find JuTell via npm/GitHub/README.

### Recommended guardrail (when to re-evaluate)

Re-open as `V1.x` after:
- `ju0o/jutell` is public,
- next npm release (post-0.3.0) ships with `mcpName`,
- *and* at least one of Codex/Claude Code/OpenCode announces native MCP Registry discovery (or a major downstream aggregator reports measurable JuTell traffic via registry card).

Until then, keep the audit and do not pollute the `main` branch with an unpublishable `server.json`.

---

## 15. Proposed Next Gate

**Gate name:** `V1-RC → V1.1 Registry Publish (optional)`

**Trigger:** V1 RC checklist completes (public GitHub toggle decided, next npm version tagged). Only then.

**Steps (in order, no work before trigger):**

1. **PM decision:** Approve `io.github.ju0o/jutell` as server name (recommended) and `server.json:description` copy (≤100 chars). Confirm repository will be **public**.
2. **Repo toggle:** `ju0o/jutell` → Public in GitHub settings (retains history, no code change).
3. **Source prep (≤1 h, single PR):**
   - `packages/cli/package.json` → add `"mcpName": "io.github.ju0o/jutell"` (and optionally enrich `keywords`)
   - Add `server.json` (run `mcp-publisher init` locally, then edit `description`/`websiteUrl`/`repository` as in §7.2 template; validate via `mcp-publisher publish --dry-run`)
   - Add GitHub Topics + description to `ju0o/jutell` (settings, not code)
4. **Release:** Bump npm version (likely `1.0.0` for V1 or `0.3.1` if patch) → `npm publish --access public`. Verify at `https://www.npmjs.com/package/jutell` that `mcpName` is present in tarball.
5. **Registry publish:** `mcp-publisher login github` as `ju0o` → `mcp-publisher publish`. Verify `curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.ju0o/jutell"`.
6. **Post-publish:** Add registry badge/link to `README.md` (optional), add GitHub Action (`mcp-publisher login github-oidc` + `publish`) to automate future version bumps. Track registry impressions vs npm installs for one quarter.

**Exit signal:** Registry card visible, search succeeds, version aligned. Takes ~2 h total post-RC; no product behavior change.

**If not triggered:** Close this audit as `docs/audits/...` and proceed to V1 RC without registry. No harm.

---

## 16. Sources

All URLs accessed **2026-09-02** (JST). Recorded as authoritative public sources; where GitHub markdown rendering failed, content is quoted from `modelcontextprotocol.io` mirror which sources the same `modelcontextprotocol/registry` repo commit.

| # | Source | What was used for | Access | Type |
|---|---|---|---|---|
| 1 | `https://modelcontextprotocol.io/registry/about` — *The MCP Registry* (preview notice, ecosystem diagram, relationship with package registries/aggregators/host apps, namespace via reverse DNS) | §3 definition, provider-aggregator split, preview status | 2026-09-02 | Official MCP docs |
| 2 | `https://github.com/modelcontextprotocol/registry` — README (Development Status: preview 2025-09-08, API freeze v0.1 2025-10-24, WG members, auth methods, namespace validation examples) | §3 who operates/status, §6 auth/namespace | 2026-09-02 | Official registry repo |
| 3 | `https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/draft/server.schema.json` — JSON Schema `draft 2025-12-11` (577 lines, definitions `ServerDetail`, `Package`, `Transport`, fields `name`, `description`, `version`, `packages`, etc.) | §5 required/optional fields, field names, lengths, patterns | 2026-09-02 | Official schema (generated from `openapi.yaml`) |
| 4 | `https://modelcontextprotocol.io/registry/quickstart` — *Quickstart: Publish an MCP Server to the MCP Registry* (6 steps: `mcpName`, `npm publish`, `mcp-publisher install`, `init`, `login github`, `publish`, `curl` verify, troubleshooting table) | §5 requirements, npm `mcpName` proof, publish flow | 2026-09-02 | Official MCP docs |
| 5 | `https://modelcontextprotocol.io/registry/authentication` — *How to Authenticate* (GitHub OAuth vs `github-oidc` vs DNS `TXT` vs HTTP `/.well-known/mcp-registry-auth`, Ed25519/P384 examples) | §6 namespace/auth table, personal vs org namespace | 2026-09-02 | Official docs |
| 6 | `https://modelcontextprotocol.io/registry/package-types` — *Supported Package Types* (`npm`/`pypi`/`cargo`/`nuget`/`oci`/`mcpb`, npm support limited to `registry.npmjs.org`, ownership verification strings, `mcpb` URL must contain `mcp` plus `fileSha256`) | §5 package types, npm identifier scoping | 2026-09-02 | Official docs |
| 7 | `https://modelcontextprotocol.info/blog/mcp-registry-preview` (2025-09-08) — *Introducing the MCP Registry* (open catalog/API, *"does not support private servers"*) | §10 private/public repo implication | 2026-09-02 | Official blog |
| 8 | `https://registry.modelcontextprotocol.io` — live web UI (recent servers, search `?q=jutell`, `?q=ju0o` returned no match, `/docs` OpenAPI) | §6 collision check, registry discoverability reality | 2026-09-02 | Official registry UI/API |
| 9 | `https://code.claude.com/docs/en/mcp` — *Connect Claude Code to tools via MCP* (install via `/plugin install mcp-xxx@...`, `claude mcp add <name> -- <command>`) | §8 Claude Code current install method (manual, no registry) | 2026-09-02 | Official provider doc (Anthropic) |
| 10 | `https://github.com/anthropics/claude-code/issues/64633` — `[FEATURE] MCP Server Registry Discovery` (open, 6 comments, maintainer `bcherny` 2026-08-17: *"There's no registry search or discovery step built into `claude mcp add` yet"*; `darconadalabarga` notes VS Code *does* consume official registry spec while Claude Code does not) | §8 Claude Code not consuming registry, VS Code does, future `registry-aware mcp add` proposed | 2026-09-02 | Official GitHub issue (provider repo) |
| 11 | `https://opencode.ai/docs/mcp-servers/` & `https://opencode.ai/docs/config` — OpenCode MCP servers & config (manual `opencode.json` with `type: local/remote`, `command`, `env`; `opencode mcp auth/debug`; no registry consumption) | §8 OpenCode current method | 2026-09-02 | Official provider docs |
| 12 | `https://github.com/AbbasSrour/opencode-mcp` — third-party `opencode-mcp` with `search-mcp-registry` (live API `registry.modelcontextprotocol.io`) and `generate-mcp-config` tools (proves registry is *tool*-accessible, not natively) | §8 OpenCode registry value is tool-assisted, not one-click | 2026-09-02 | Third-party (supplementary) |
| 13 | `https://modelcontextprotocol.info/tools/registry/cli/` — *Registry CLI Tool `mcp-publisher`* (`init`/`login`/`publish`/`logout`, token at `~/.mcp_publisher_token`, versioning guidance) | §5 tooling, version alignment | 2026-09-02 | Official docs mirror |
| 14 | `https://github.com/modelcontextprotocol/registry/blob/main/docs/.../quickstart.mdx` — publisher guide source (301 lines, `mcpName` MUST match `server.json:name`, `github login` device flow) | §5 step-by-step verification | 2026-09-02 | Official repo doc |
| 15 | Local inspection — `packages/cli/package.json`, `apps/mcp-server/src/index.ts:2`, `apps/mcp-server/package.json`, `packages/cli/assets/version.json`, `LICENSE`, `README.md:130-151`, `git show origin/main:README.md` (2026-09-02 fetch) | §2 current distribution reality, §7 gaps | 2026-09-02 | JuTell `main@6e735c4` (SSOT) |

> Note on source hierarchy: blog/SEO/Reddit were *not* primary; Glama (`glama.ai`) and aggregator pages were consulted only for cross-checking install counts and were not cited as authoritative.

---

## Appendix A: Recommended Decision Tables (for PM review)

### Table A — Gap matrix

| Area | Current JuTell (`main@6e735c4`) | Registry Requirement | Gap | V1 Impact |
|---|---|---|---|---|
| `mcpName` in npm package | absent (`packages/cli/package.json` has no `mcpName`) | Must equal `server.json:name` for npm ownership | **MUST add** if publishing (`"mcpName": "io.github.ju0o/jutell"`) | No impact now; blocks publish only |
| `server.json` | does not exist | Must pass schema `ServerDetail` (at least `name`, `description`, `version`, `packages[0]`) | **MUST create** | No impact now |
| Server `name` (reverse-DNS) | not chosen | `io.github.ju0o/jutell` (GitHub auth) — one `/`, ≤200 chars | **MUST decide** | No impact now |
| `description` | `package.json:description` 78 chars, harness tagline | Must be 1–100 chars capability sentence | **SHOULD craft new** | No impact now |
| `version` vs `packages[].version` | `cli 0.3.0`, `mcp 0.1.0`, should align | SHOULD align (both semver, `0.3.0`); stale `0.3.0` cannot be retrofitted without new npm version | **SHOULD wait for next npm release** | Defer to next npm tag (likely `1.0.0`) |
| Package triple | `registryType`/`identifier`/`transport` not declared | Must be `npm` / `jutell` / `0.3.0` / `stdio` | **MUST declare** | Declare only |
| Repository URL | `ju0o/jutell` PRIVATE | Should be public `https://github.com/ju0o/jutell` (closed-source technically allowed but trust-poor) | **MUST make public** before publish | Governance decision, not code |
| License | `MIT` | No registry license field; downstream surfaces it — MIT is fine | No change | — |
| Invocation (`runtimeHint` etc.) | Internal `node assets/mcp-server/index.js` via provider config; no `npx` docs | Should document `npx` or binary invocation for stdio | **SHOULD clarify** via `mcp-publisher init` output | No runtime change |
| CLI `jutell use` | Exists per provider | Registry does not replace; stays required | No change | — |

### Table B — Candidate actions

| Candidate Action | User Value | Effort | External Dependency | V1 Priority |
|---|---|---|---|---|
| **A. Make `ju0o/jutell` public + set Topics/description** | Medium — feeds GitHub + npm + future registry discovery for every visitor | 5 min (settings toggle) | None (owner action) | **NICE TO HAVE** — do with V1 RC, not before |
| **B. Add `mcpName` + `server.json` + publish `io.github.ju0o/jutell@0.3.0`** | Low now — registry card only; providers don't auto-install, npm path already works; stale version would be superseded immediately | 1–2 h plus re-publishing npm (blocked on repo public) | GitHub auth (ju0o), npm auth, preview registry approval | **DEFER_AFTER_V1** |
| **C. Publish registry entry at next npm version (`0.3.1`/`1.0.0`)** | Medium — fresh discovery trail tied to V1, avoids orphaning `0.3.0` | Same as B but timed correctly | Same as B | **OPTIONAL V1.1** gate (see §15) |
| **D. Submit to Glama / `mcp.so` / Pulse aggregators manually** | Low — most aggregators mirror official registry, so this is duplicate effort if B/C is done | 30 min each | Third-party curation | **DEFER** |
| **E. Build provider-specific marketplace plugins (`universal-plugins...`, `claude-plugins-official`)** | Medium *if* targeting in-client install | 0.5–1 day per marketplace (wrapper repo + manifests) | Anthropic / community catalogs | **DEFER** — separate surface, evaluate post-V1 demand |
| **F. Block V1 on registry approval** | Negative — delays V1, violates PM principle, adds preview dependency | — | External preview stability | **DO NOT DO** |

---

## Appendix B: npm vs MCP Registry — One-paragraph distinction (for README/memo)

> **npm is the warehouse; MCP Registry is the catalog card.** JuTell's *code* lives on **npm** (`registry.npmjs.org`, package `jutell@0.3.0`). A user installs it with `npm install -g jutell`. The **MCP Registry** (`registry.modelcontextprotocol.io`) never hosts that code — it only hosts a small `server.json` that says: *"server `io.github.ju0o/jutell` version `0.3.0` is available as npm package `jutell@0.3.0` via `stdio`."* Clients and aggregators can read that card to verify who owns the server and how to run it, but they still fetch the package from npm and write config themselves. For JuTell, npm is distribution; the registry is *optional discovery*.

---

*End of audit — no code changes, no registration, no publication performed.*
