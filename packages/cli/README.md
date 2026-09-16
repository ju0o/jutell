# JuTell

**Tell your agent what you mean. Understand what it did.**

[![npm version](https://img.shields.io/npm/v/jutell.svg)](https://www.npmjs.com/package/jutell)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/ju0o/jutell/blob/main/LICENSE)
[![node: >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
![Codex: Supported](https://img.shields.io/badge/Codex-Supported-brightgreen)
![Claude Code: Beta](https://img.shields.io/badge/Claude%20Code-Beta-yellow)
![OpenCode: Beta](https://img.shields.io/badge/OpenCode-Beta-yellow)

For people who can tell a coding agent what they want, but don't want to read code or logs just to
know whether it actually worked.

```bash
npm install -g jutell
jutell
```
```

**Don't want to install anything?** JuTell's normal job is a one-time connection - it hands you
back to your own agent and gets out of the way - so you can just run it without installing:

```bash
npx jutell@latest
```

Same flow, nothing left on your machine, and it sidesteps npm's global-folder permission errors
entirely. Node.js is still required either way.

That's the whole setup. `jutell` finds the coding agents already installed on your machine, asks
for one approval, connects them, and hands you straight back to your normal session.

JuTell sits **beside** a coding agent you already use — Codex, Claude Code, or OpenCode. It checks
project facts before work and separates verified from assumed after it. It is not an AI model, and
it does not provide or replace your agent.

## The problem it solves

AI coding agents made writing code faster. They didn't fix two older problems:

- **Before work** — it's hard to explain exactly what you mean, and an agent that guesses wrong can
  quietly do the wrong thing.
- **After work** — a wall of diffs and "I tested it" don't tell you what's real and what's assumed.

JuTell doesn't write code. It makes the conversation around the code honest, on both ends.

## What it actually looks like

A real first run, on a project with OpenCode installed:

```console
$ jutell
JuTell

Found coding agents:

Codex        not detected
OpenCode     found
Claude Code  not detected

Connecting JuTell...
OpenCode connected.

Open a new conversation in OpenCode and JuTell applies automatically.
```

Then check it honestly — note that it does **not** claim the agent session picked it up, because it
cannot see that from here:

```console
$ jutell status
JuTell status

CLI: 2.0.1
Skill: installed
AGENTS.md: JuTell block present
OpenCode MCP: enabled (auto-start on new session)
Codex MCP: not registered
Current agent session applied: needs direct confirmation
Profile: balanced
Telemetry: disabled
External transmission: none
```

And when something looks wrong:

```console
$ jutell doctor
OK       Node version: Node 22.22.1
OK       Skill file: verified
OK       Skill version: 2.0.1 (installed copy matches)
OK       MCP server live connection (Stdio): JuTell server responded with 5 tools
OK       External transmission code: no outbound patterns in the MCP build
Check    Current agent session applied: must be confirmed in that agent's session
Warning  Codex MCP: not registered
```

`doctor` marks every line OK / warning / needs-a-closer-look, and never prints full paths or secret
values.

## The rule it follows

JuTell does not call something "verified" unless it actually checked it. On a real run that changed
an empty-search message's styling, it reported:

| | |
|---|---|
| Code checked | the style values actually changed |
| Test checked | the existing test still passed |
| Real browser view | **not checked** — no browser was available |
| Your action | Open the screen once and look. |

It does not turn "looks right in code" into "confirmed on screen."

If you are verifying the source instead of installing from npm, `npm pack` in
`packages/cli` creates `jutell-2.0.1.tgz`; ordinary users do not need this path.

## Supported agents & platforms

| What you need | Status |
|---|---|
| **Codex** | Supported |
| **Claude Code** | Beta |
| **OpenCode** | Beta |
| Windows | Tested |
| Ubuntu | Limited testing |
| macOS | Available / unverified |

You need a coding agent first — JuTell connects to one you already installed.

## Commands

| Command | What it does |
|---|---|
| `jutell` | Finds installed agents and offers to connect them. |
| `jutell status` | Installation, connection, profile, and feature status. |
| `jutell doctor` | Checks for setup problems. |
| `jutell use codex` / `claude` / `opencode` | Connect one agent by hand (repair path). |
| `jutell on` / `jutell off` | Turn the connection on or off. |
| `jutell upgrade` | Refresh the installed Skill/config/MCP. |
| `jutell uninstall` | Remove JuTell's managed setup. |

Reports can be tuned with a project `.jutell.json` — profiles `minimal`, `balanced`, `learning`,
`detailed` change explanation length, never the underlying facts or risk.

## First things to try

1. "Change the login button to blue."
2. "Please make signup simpler."
3. "Make the empty search box show a helpful message."

For 1 and 3, JuTell should let your agent get on with it. For "make signup simpler," it should read
the project first and ask **one** grounded question only if a real choice remains — not turn your
request into a questionnaire.

## What JuTell is — and is not

**Is:** a communication layer beside your coding agent · clarifies material intent before work ·
explains actual work and evidence after it.

**Is not:** an AI model · a replacement coding agent · a correctness guarantee · a full autonomous
debugger · a multi-agent orchestrator.

## Trust and privacy

JuTell explains work using files, Git, and command output already on your computer. It does not
collect or send your project code, prompts, raw agent answers, diffs, or secrets. Telemetry is off
by default and its storage/transmission is not implemented at this stage.

## Install trouble on Ubuntu/Linux

If `npm install -g jutell` fails with `EACCES` / permission denied, that's a common npm global
folder ownership issue, not something specific to JuTell. **Avoid `sudo npm install -g jutell`** —
it leaves root-owned files that cause the same problem again.

The fastest way past it is to skip the global install: `npx jutell@latest`. Two permanent fixes:
[Ubuntu/Linux install permission error](https://github.com/ju0o/jutell/blob/main/docs/CLI_INSTALLATION.md).

## 한국어

전체 한국어 문서는 [README.ko.md](https://github.com/ju0o/jutell/blob/main/README.ko.md)에 있습니다.
비개발자도 "승인해도 되는가", "무엇을 직접 확인해야 하는가"를 판단할 수 있게 하는 것이 목적입니다.

## More

Full walkthrough with images, a real report, a real failure, and an honest efficiency snapshot:
[GitHub README](https://github.com/ju0o/jutell#readme) ·
[2.0.0 release showcase](https://github.com/ju0o/jutell/blob/main/docs/releases/2.0.0-showcase.md) ·
[Changelog](https://github.com/ju0o/jutell/blob/main/CHANGELOG.md) ·
[MCP integration](https://github.com/ju0o/jutell/blob/main/docs/MCP_INTEGRATION.md)

## Support

JuTell is free and MIT-licensed, and it stays that way. If it saved you time:

[![Support on Ko-fi](https://img.shields.io/badge/Ko--fi-support-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/ju0o___)

Not supporting changes nothing — every feature stays available to everyone.
