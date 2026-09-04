# Changelog

Notable user-facing changes to JuTell. See [GitHub Releases](https://github.com/ju0o/jutell/releases) for the full history and exact publish dates.

## v1.1.0 (release candidate — not yet published to npm)

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
