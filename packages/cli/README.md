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

First, go to your project folder:

```bash
cd /path/to/your-project
```

```bash
npm install -g jutell
jutell
```

JuTell creates or updates `AGENTS.md`, `.agents/`, `.jutell.json`, and `.jutell-local/` in that
folder. When you connect Codex, it also adds connection settings to `~/.codex/config.toml`.

For non-interactive or automated runs, use `jutell --yes` to skip the `(Y/n)` prompt.

**Don't want to install anything?** JuTell's normal job is a one-time connection - it hands you
back to your own agent and gets out of the way - so you can just run it without installing:

```bash
npx jutell@latest
```

No install files are left, but the connection settings and project files remain; it also sidesteps
npm's global-folder permission errors entirely. Node.js is still required either way.

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

Then check it honestly (real output; the CLI speaks Korean, trimmed to the key lines) — note that it does **not** claim the agent session picked it up, because it
cannot see that from here:

```console
$ jutell status
JuTell 상태

CLI: 2.1.0
Skill: 설치됨
AGENTS.md: JuTell 블록 있음
JuTell 연결 정책: 켜짐
Codex MCP (전역, Codex는 프로젝트 설정을 읽지 않음): 활성화됨 (명령 감지됨)
OpenCode MCP: 미등록 (명령 미감지)
Claude Code MCP (현재 프로젝트(local)): 미등록 (명령 미감지)
MCP 서버 응답: 확인하지 않음
현재 Agent 세션 적용: 직접 확인 필요
Profile: balanced
설치 범위 (설정·Skill·AGENTS.md): 현재 프로젝트
Telemetry: 비활성화
외부 전송: 없음
```


And when something looks wrong (summary, translated):

```console
$ jutell doctor
OK       Node version: Node 22.22.1
OK       Skill file: verified
OK       Skill version: 2.1.0 (installed copy matches)
OK       MCP server live connection (Stdio): JuTell server responded with 5 tools
OK       External transmission code: no outbound patterns in the MCP build
Check    Current agent session applied: must be confirmed in that agent's session
Warning  Codex MCP: not registered
```

`doctor` marks every line OK / warning / needs-a-closer-look, and never prints full paths or secret
values.

### Work receipt (`jutell receipt`)

After the agent finishes, it writes what it did to `.jutell-local/receipt.json` and runs
`jutell receipt`. JuTell compares that with Git and the project map, and labels who wrote each line.
Real output from a practice project where the request was "make the login button blue":

```text
==============================
  JuTell 작업 영수증
==============================
[요청 대조]  요청 1개 중 1개 바뀐 곳 있음  [Git 기준 · 지도 대조]
 1. 로그인 버튼을 파란색으로  [AI가 적음]
    → 바뀐 곳 있음: src/pages/Login.tsx  [Git 기준 · 지도: 로그인]

[바뀐 파일]  [Git 기준]
 1. src/pages/Login.tsx

[확인]  [AI가 적음 · ⓘ 줄은 JuTell이 적음]
 ✔ 직접 확인한 것: `npm test` 실행해서 3개 통과  [AI가 적음]
 ✖ 확인 못 한 것: 브라우저 화면은 열어 보지 않음  [AI가 적음]
 ⓘ 위 테스트·명령 결과는 AI가 알려 준 내용이에요. JuTell이 직접 돌려 보지는 않았어요  [JuTell이 적음]
==============================
한 줄 요약: 로그인 버튼을 파란색으로 바꿨어요  [AI가 적음] · 요청 1개 중 1개 처리  [Git 기준]
```

`[AI가 적음]` = written by the AI, `[Git 기준]` = taken from Git, `[JuTell이 적음]` = written by JuTell.

### Project map (`JuTellMap.md`)

Real map from the same project (hidden marker comments omitted):

```markdown
# JuTell 지도 — 이 프로젝트는 어떻게 생겼나요?
표와 목록은 JuTell이 자동으로 다시 채워요. 설명 글은 마음대로 고쳐도 되지만, 숨은 칸 표시(HTML 주석)는 지우지 마세요.

## 할 일 [지도로 짐작]
- src/api/todos.ts — 기능
- src/components/TodoList.tsx — 화면

## 로그인 [지도로 짐작]
- src/pages/Login.tsx — 화면
```

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
`packages/cli` creates `jutell-2.1.0.tgz`; ordinary users do not need this path.

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
