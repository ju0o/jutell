# jutell

**Your coding agent writes the code. JuTell helps you understand what happened.**

JuTell sits beside Codex, Claude Code, or OpenCode and turns their work into a plain-language report: what changed, what's actually verified, what's still unknown, and what to do next.

```bash
npm install -g jutell
jutell
```

`jutell` finds the coding agents you already have installed, asks for one approval, connects them, and hands you straight back to your normal session — no per-agent setup command needed for a normal first run.

| Agent | Status |
|---|---|
| Codex | Supported |
| Claude Code | Beta |
| OpenCode | Beta |

To connect (or reconnect) one specific agent by hand, use `jutell use codex` / `jutell use claude` / `jutell use opencode` — this is the manual/repair path, not the normal first run.

**한국어 사용자라면:** 전체 문서와 한국어 안내는 [GitHub 저장소의 README.ko.md](https://github.com/ju0o/jutell/blob/main/README.ko.md)에 있습니다.

Full docs, images, and the complete feature walkthrough live on [GitHub](https://github.com/ju0o/jutell#readme).

<details>
<summary>Build from source instead (contributors / verifying the repo directly)</summary>

Most people should use the npm install above.

```bash
cd packages/cli
npm install
npm pack
npm install -g ./jutell-1.1.0.tgz
```
</details>

The legacy `beginner-bridge` command is a compatibility alias for the same functionality and tells you to switch to `jutell` when you run it. The CLI does not collect or transmit your project code, prompts, AI answers, Git diffs, or secrets.
