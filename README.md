# JuTell — by Ju0

**English** | [한국어](README.ko.md)

> You started coding with AI. Now make sure you and your coding agent understand each other.

JuTell helps when a request is vague, and when an agent's result is hard to read. It checks project facts it can find itself, asks only the decision that truly changes the result, then gives you a short, honest explanation of the work.

You keep using your normal coding agent. JuTell does not provide Codex, Claude Code, or OpenCode; it helps you use one of them with more clarity.

![A real JuTell conversation: a normal request, one useful clarification, the coding agent working, and a plain-language result.](docs/assets/readme/beginner-conversation.svg)

## A 30-second example

**You:** “Please make signup simpler.”

**JuTell:** checks the existing signup screen and its required fields first. If “simpler” could mean two different things, it asks one plain question — for example, “Should I tidy the screen, or remove an optional field?”

**You:** “Tidy the screen. Keep every field.”

**Your coding agent:** makes the change.

**JuTell:** tells you what changed, what was actually checked, what it could not check yet, and whether you need to do anything next.

## Can I use JuTell?

| What you need | Current status |
|---|---|
| **Codex** | Supported |
| **Claude Code** | Beta |
| **OpenCode** | Beta |
| Windows | Tested |
| Ubuntu | Limited testing |
| macOS | Available / unverified |

You need a coding agent first. JuTell connects to an agent you already installed; it is not the agent or the AI model itself.

## Before installing

You need:

- **A coding agent:** Codex, Claude Code, or OpenCode already installed. Codex is the fully supported connection; Claude Code and OpenCode are Beta.
- **Node.js:** JuTell is installed with `npm`, which comes with Node.js. If you do not have it, install the current Node.js release from [nodejs.org](https://nodejs.org/en/download).
- **A terminal:** PowerShell on Windows, or Terminal on Ubuntu/macOS. It is just the place where you paste the two commands below.
- **Internet access:** npm downloads JuTell during installation.

## Install, step by step

![JuTell setup in five steps: install, run jutell, an agent is detected, approve the connection, then return to your agent.](docs/assets/readme/beginner-install.svg)

### Step 1 — Open PowerShell or Terminal

On Windows, search for **PowerShell** and open it. On Ubuntu or macOS, open **Terminal**.

### Step 2 — Install JuTell

Paste this, then press Enter:

```bash
npm install -g jutell
```

> **Permission error on Ubuntu/Linux?** If this fails with `EACCES` / `permission denied`, it's a
> common npm global-folder ownership issue on Linux, not something specific to JuTell. Avoid
> `sudo npm install -g jutell` — it can leave root-owned files that cause the same problem again
> later. See [Ubuntu/Linux install permission error](docs/CLI_INSTALLATION.md) for two safe fixes.

### Step 3 — Run JuTell

```bash
jutell
```

Or paste the normal install path together:

```bash
npm install -g jutell
jutell
```

### Step 4 — Approve the detected agent connection

JuTell looks for Codex, Claude Code, and OpenCode that are already on your computer. Read the short preview and approve the connection you want. It only manages JuTell’s own setup blocks and keeps other agent settings in place.

### Step 5 — Return to your normal coding agent

Setup finishes in the terminal. There is no new dashboard you must keep open. Go back to Codex, Claude Code, or OpenCode and use it as usual.

### Step 6 — What successful setup looks like

You should see that an agent was found and connected, without an error. Then run `jutell status` if you want a short connection summary. If it says there is a problem, run `jutell doctor` for the next step to take.

## First things to try

Start with a request you can recognize easily:

1. “Change the login button to blue.”
2. “Please make signup simpler.”
3. “Make the empty search box show a helpful message.”

For the first and third, JuTell should let your agent get on with a clear request. For “make signup simpler,” it should check the project first and ask only if a real choice remains. It should not turn your request into a technical questionnaire.

## After your agent finishes

![A short result comparison: a technical agent message becomes a JuTell result with changed, verified, not checked, and next action.](docs/assets/readme/beginner-result.svg)

Here is the kind of short result to expect:

```text
Changed
- The signup screen spacing was simplified. Every field stays.

Verified
- The signup screen test passed.

Not checked yet
- I did not open the screen in a real browser.

Your next action
- Open signup once and check the new spacing.
```

JuTell does not call something “verified” unless it was actually checked. A code-based expectation and an unchecked browser result stay clearly labeled.

## How do I know it is working?

```bash
jutell status
```

Look for a readable summary of JuTell’s installation and your agent connection. It separates “configured” from “actually checked,” so an untested tool call is not presented as a failure.

```bash
jutell doctor
```

Use this when setup looks wrong. It checks JuTell files, configuration, permissions, and whether anything would be sent outside your computer. Its normal output avoids showing full paths or secret values.

## Something went wrong

| If this happens | Try this |
|---|---|
| No agent was found | Install and open a supported coding agent first, then run `jutell` again. |
| Connection failed | Run `jutell doctor`, then follow its message. |
| You want to reconnect one agent | Run `jutell` again, or use the manual connection commands in Advanced. |
| You want to turn JuTell off | Run `jutell off`. Your settings and local journal stay. |
| You want to remove JuTell | Run `jutell uninstall`. It keeps local data unless you explicitly add `--remove-data`. |
| `EACCES` / permission denied installing on Ubuntu/Linux | See [Ubuntu/Linux install permission error](docs/CLI_INSTALLATION.md). Avoid `sudo npm install -g jutell`. |

## What JuTell does — and does not do

JuTell helps make a request clear before work, and makes the result understandable after work. It keeps **what changed**, **what was verified**, **what is expected**, and **what was not checked** separate.

It does not replace your coding agent, provide an AI model, guarantee agent correctness, find every dependency, automatically verify browser behavior, or make the approval decision for you.

## Trust and privacy

JuTell explains work using files, Git, and command output already on your computer. It does not collect or send your project code, prompts, raw agent answers, diffs, or secrets. Telemetry is off by default, and storage or transmission for it is not implemented at this stage.

Read the details in [Privacy principles](docs/PRIVACY_PRINCIPLES.md). For the full scope and limitations, see [Product scope](docs/PRODUCT_SCOPE.md).

## What's new

**`jutell@2.0.0` is published on npm.** It helps before work starts as well as after it finishes: project facts are checked first, only a real decision is asked, and verified / expected / not-checked remain separate.

## Install, control & advanced

### Useful commands

| Command | What it does |
|---|---|
| `jutell` | Finds installed supported agents and offers to connect them. |
| `jutell status` | Shows installation, connection, profile, and feature status. |
| `jutell doctor` | Checks setup problems. |
| `jutell on` / `jutell off` | Turns JuTell’s connection on or off. |
| `jutell setup` | Prepares the Skill, default config, and MCP connection again. |
| `jutell provider` | Shows detailed agent connection status. |
| `jutell upgrade` | Refreshes JuTell’s installed Skill/config/MCP to the current version. |
| `jutell uninstall` | Removes JuTell’s managed setup. |

MCP is an optional local connection that lets a coding agent use JuTell more directly. You do not need to understand or configure it for the normal install path; JuTell’s reporting fallback remains available if MCP is off. See [CLI install & commands](docs/CLI_INSTALLATION.md) and [MCP integration](docs/MCP_INTEGRATION.md) when you need the technical details.

You can tune reports with a project `.jutell.json` file created by the CLI. Available profiles are `minimal`, `balanced`, `learning`, and `detailed`; they change explanation length, never the underlying facts or risk.

If you are verifying the repository source instead of installing from npm, `npm pack` creates `jutell-2.0.0.tgz` in `packages/cli`; ordinary users do not need this path.

For contributors: [Changelog](CHANGELOG.md) · [Documentation map](docs/DOCUMENTATION_MAP.md) · [OpenCode connection](docs/PROVIDER_OPENCODE.md) · [GitHub Releases](https://github.com/ju0o/jutell/releases)

## JuTell by Ju0

Ju0 is the parent brand; JuTell is its product.
