# Changelog

Notable user-facing changes to JuTell. See [GitHub Releases](https://github.com/ju0o/jutell/releases) for the full history and exact publish dates.

## v2.1.0 — 2026-10-24 (unreleased — not yet published to npm)

Not yet published on npm. The latest npm release is still v2.0.1.

**Cycle 2: a project map, a receipt that checks the AI's claims, and a steadier setup.**

- **JuTellMap:** `jutell` writes `JuTellMap.md`, a feature map that groups files by feature (guessed from file names, freely editable), plus an easy-to-read `.jutell-local/map.html`. `jutell map --list` / `--show` print it in the terminal; the map is refreshed on each receipt and your descriptions and moved lines are kept.
- **Work receipt:** `jutell receipt` prints a one-page receipt and saves it in `.jutell-local/reports/`. `[요청 대조]` compares each request with the files Git actually saw change, using the map.
- **Labels on every line:** each line says where it comes from: `[AI가 적음]` (the AI's claim), `[Git 기준]` (checked against Git), `[지도 …]` (matched with the map), `[JuTell이 적음]` (JuTell's own notes, such as the `ⓘ` line saying test results were reported by the AI, not run by JuTell). Checked lines that mention a command keep their result, with the command shown as code.
- **Before-work baseline:** files that were already changed before the work are marked, and the note says whether the baseline is from setup or from the last receipt.
- **Stabilization:** `jutell --yes` repairs a stale receipt command when the install method changes; `doctor` checks the receipt command; `uninstall` removes only JuTell's blocks and leaves a pre-existing empty `AGENTS.md`; npm workspaces get a working receipt command; the Skill has a one-line fallback when the receipt command fails.
- **Windows:** setup, uninstall, and folder cleanup were fixed and are covered by CI on Windows and macOS.

- `doctor` exits with code 1 when any check is `오류` (error).
- `jutell use codex` / setup keeps user TOML tables, removes stale JuTell subtables, and validates TOML before writing.
- `jutell --yes` or non-interactive runs never open the admin page/browser.

## v2.0.1

Published on npm.

**A maintenance release that ships fixes already on `main` — and the real README to npm.**

- `jutell use claude` now also writes `CLAUDE.md`, so Claude Code actually discovers JuTell. Before this, the connection was registered but Claude Code never picked up the rules.
- `jutell migrate --clean` actually removes the legacy Codex entry; `status` and `use` now point at the canonical one.
- `doctor` and `status` warn when `.jutell.json` limit values were silently defaulted instead of read.
- The npm package page now shows the full README (what JuTell does, real command output, supported agents) instead of a short stub.
- Ko-fi support link added to the package metadata.

**Compatibility:** no commands removed, no configuration changes required.

## v2.0.0

Published on npm.

**JuTell now helps before your agent starts, not only after it finishes.**

- It checks project facts itself and asks only high-value user decisions — at most one concise question per request.
- It protects requested scope: what you asked for, plus strictly necessary supporting work. Unrelated improvements are left untouched.
- Completion verification is tied to what you actually asked for, reusing already-gathered evidence instead of running unrelated checks.
- The existing easy-to-read reports stay: verified / expected / not-checked kept separate, with concrete next actions only when something genuinely needs you.
- Install, provider support (Codex supported; Claude Code and OpenCode beta), and platform claims are unchanged.

**Compatibility:** no commands removed. Existing `.jutell.json`, `AGENTS.md`, and MCP registrations are preserved automatically — nothing to reconfigure.

**What JuTell still doesn't promise:** correct interpretation isn't guaranteed, not every semantic dependency is discovered, code correctness isn't independently certified, and your approval judgment is never replaced. JuTell makes requests clearer and evidence checkable.

## v1.1.0

Published on npm.

**Install once. Use your coding agent normally.**

- Run `jutell` once and JuTell finds every supported coding agent (Codex, Claude Code, OpenCode) already installed on your machine.
- One approval connects all of them — no per-agent setup wizard for a normal first run.
- Setup returns you straight to your terminal; the local dashboard is no longer opened automatically (`jutell dashboard` opens it on demand).
- GitHub documentation is now available in both English (primary `README.md`) and Korean (`README.ko.md`), with clearer, plain-language explanations of what's supported and what's still beta.
- JuTell remains available automatically through your coding agent's normal workflow, while avoiding unnecessary extra work when its live connection isn't needed for a given task.

**Compatibility:** no commands removed. `jutell use <provider>` remains supported as the manual connect/repair path. The legacy `beginner-bridge` command and its configuration compatibility are unchanged. Existing `.jutell.json`, `AGENTS.md`, and MCP registrations are preserved automatically — nothing to reconfigure.

**Known limitations:** OpenCode and Claude Code connections remain beta. macOS is expected to work (JuTell is Node-based) but has not yet been directly verified by the maintainer. Linux support has been verified in a single Ubuntu environment, not across all distributions.

## v1.0.1

Published on npm. See [GitHub Releases](https://github.com/ju0o/jutell/releases) for details.

## v1.0.0

Initial public release. See [GitHub Releases](https://github.com/ju0o/jutell/releases) for details.
