# Changelog

Notable user-facing changes to JuTell. See [GitHub Releases](https://github.com/ju0o/jutell/releases) for the full history and exact publish dates.

## v2.2.0 — 2026-10-25

**Cycle 3: connect JuTell to GUI apps, with careful config edits you can undo.**

- **GUI app connect:** `jutell use cursor`, `jutell use claude-desktop` and `jutell use vscode` register JuTell in the app's MCP config, and `jutell disconnect <app>` removes it. Cursor and VS Code use the project file by default; `--global` writes the user file. Each command prints the file it changed, the rule files it prepares, and how to restart the app. Paths not confirmed on an OS (Claude Desktop on Linux, VS Code user profile on macOS/Windows) get guidance and the JSON only; Windsurf is status only.
- **Codex app and IDE extension:** `jutell status`, `provider status` and `use codex` note that the Codex CLI, desktop app and IDE extension share one config, with the restart step for each.
- **Safe JSONC editing:** JuTell changes only its own entry in `mcp.json`-style files. Comments, trailing commas, other servers, unknown keys, line endings and BOM are kept byte-for-byte. Files are backed up before writing, re-checked after, and restored if anything fails. Values you added to JuTell's `args` are kept on updates.
- **Rollback:** an app file JuTell created is deleted only when it is empty again and carries JuTell's marker; folders only when JuTell made them and they are empty. Rollback restores the app file, its backups and marker.
- **Server project root:** the MCP server uses `JUTELL_PROJECT_ROOT` (absolute, existing folder) when set, so GUI apps find the right project.
- **status / doctor / uninstall:** GUI app lines are grouped under one heading; a file that can't be read is shown as a warning instead of exit 1 in read-only commands; uninstall lists only leftovers that really exist.
- **map.html:** smaller page (about 41% smaller on a 200-feature map), an overview table with links to each feature, one line for empty roles, dark mode, print and mobile styles. It no longer shows lines meant only for `JuTellMap.md`.
- **Windows:** CI runs a PowerShell end-to-end check (home folder with Korean letters and spaces, temp `%APPDATA%`), and CI actions are pinned to exact versions.
- **README:** new "Connect a GUI app" section (English and Korean) with the command, file per OS, restart step and removal for each app, plus a short table on the npm page.

## v2.1.0 — 2026-10-24

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
