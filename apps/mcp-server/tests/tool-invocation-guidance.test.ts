import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// JUTELL-V1.X-AUTO-INVOCATION-01: guards the wording that decides whether an
// Agent spontaneously reaches for JuTell MCP tools instead of only falling
// back to the Skill reference files.
const indexFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'index.ts');
const src = readFileSync(indexFile, 'utf8');

describe('MCP server instructions state a clear invocation trigger', () => {
  it('keeps the existing canonical-server preference intact', () => {
    expect(src).toContain('prefer the canonical jutell server');
    expect(src).toContain('beginner_bridge only for compatibility');
    expect(src).toContain('apply the JuTell reporting guidance before composing the final answer');
  });

  it('names a concrete completion-boundary trigger, not "call on every tool use"', () => {
    expect(src).toMatch(/once,\s*at task completion/);
    expect(src).toMatch(/not after every file read, shell command, or edit/);
  });

  it('states the fallback explicitly and does not interrupt the task when MCP is unavailable', () => {
    expect(src).toMatch(/unavailable or blocked/);
    expect(src).toMatch(/fall back to the JuTell Skill files without interrupting the task/);
  });

  it('keeps the MCP-used claim and the Skill-fallback path epistemically separate', () => {
    expect(src).toMatch(/never tell the user JuTell MCP was used unless a JuTell tool call actually returned a result/);
  });

  it('never phrases MCP usage as an unconditional requirement', () => {
    expect(src).not.toMatch(/\bmust call\b/i);
    expect(src).not.toMatch(/every (task|response|message|turn)/i);
    expect(src).not.toMatch(/반드시.*(호출|사용)/);
  });
});

describe('individual tool descriptions distinguish primary vs. diagnostic-only use', () => {
  it('positions get_beginner_report_rules as the one call to make before writing a report', () => {
    expect(src).toMatch(/get_beginner_report_rules'[\s\S]{0,20}description:\s*'The primary report-writing tool/);
    expect(src).toMatch(/Call this once, right before writing the final owner-facing report/);
    expect(src).toMatch(/it replaces reading report-format\.md, risk-level-guide\.md/);
    expect(src).toMatch(/do not call it more than once per task just to double-check/);
  });

  it('marks the status/preference/feature tools as diagnostic-only so they are not called on every task', () => {
    for (const tool of ['get_bridge_status', 'get_active_features', 'get_report_preferences']) {
      const match = src.match(new RegExp(`${tool}'[\\s\\S]{0,400}?description:\\s*'([^']*)'`));
      expect(match, `expected to find a description for ${tool}`).toBeTruthy();
      expect(match![1]).toMatch(/^Diagnostic only/);
    }
  });

  it('does not tell the Agent to call a tool after every file read or edit', () => {
    expect(src).not.toMatch(/call (this|it) after every/i);
  });
});
