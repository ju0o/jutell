import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { readBridgeContext } from './config/bridge-config.js';
import { activeFeatures, beginnerReportRules, bridgeStatus, reportPreferences, safeReportRequirements } from './tools/bridge-tools.js';
import { recordToolCall } from './tools/usage-counters.js';

const server = new McpServer({
  name: 'JuTell',
  version: '1.0.1',
}, {
  instructions: 'JuTell by Ju0 is a local read-only report helper. Read only project configuration and approved report rules. Never access project code, Git diff, prompts, AI answers, secrets, or external networks. Skill mode remains available if this MCP server is disabled or unavailable. When both jutell and beginner_bridge servers are visible, prefer the canonical jutell server; use beginner_bridge only for compatibility. For owner-facing reports, apply the JuTell reporting guidance before composing the final answer. Prefer these tools over re-reading the JuTell Skill reference files when both are available, since a tool call returns the same project-specific rules in one step. Call get_beginner_report_rules once, at task completion, right before writing the final report — not after every file read, shell command, or edit, and not to verify work that is already done. If these tools are unavailable or blocked, fall back to the JuTell Skill files without interrupting the task, and never tell the user JuTell MCP was used unless a JuTell tool call actually returned a result in this task.',
});

const noInput = { inputSchema: {} } as const;

async function counted(toolName: string, run: () => Promise<CallToolResult>): Promise<CallToolResult> {
  const result = await run();
  const characters = result.content.reduce((sum, item) => {
    const text = (item as { type?: string; text?: string }).text;
    return sum + (typeof text === 'string' ? text.length : 0);
  }, 0);
  await recordToolCall(toolName, characters);
  return result;
}

server.registerTool('get_bridge_status', { ...noInput, description: 'Diagnostic only: return whether JuTell is configured and enabled for this project. Use when JuTell setup itself looks wrong (e.g. reports seem to ignore .jutell.json), not as part of a normal report — get_beginner_report_rules already includes what a report needs. Does not read project code or Git.' }, async () => counted('get_bridge_status', async () => {
  const context = await readBridgeContext();
  return { content: [{ type: 'text', text: JSON.stringify(bridgeStatus(context)) }] };
}));

server.registerTool('get_active_features', { ...noInput, description: 'Diagnostic only: list which JuTell report sections are on/off and what each safely omits when off. Use only when you need to explain JuTell\'s own configuration to the user; get_beginner_report_rules already returns the active sections needed to write a report, so call this instead of that only for that narrower question.' }, async () => counted('get_active_features', async () => {
  const context = await readBridgeContext();
  return { content: [{ type: 'text', text: JSON.stringify({ features: activeFeatures(context.config) }) }] };
}));

server.registerTool('get_report_preferences', { ...noInput, description: 'Diagnostic only: return the report Profile (minimal/balanced/learning/detailed) and length/file/glossary limits. Use only when asked how JuTell is configured; get_beginner_report_rules already includes these limits for normal report writing.' }, async () => counted('get_report_preferences', async () => {
  const context = await readBridgeContext();
  return { content: [{ type: 'text', text: JSON.stringify(reportPreferences(context.config)) }] };
}));

server.registerTool('get_beginner_report_rules', { ...noInput, description: 'The primary report-writing tool: returns this project\'s active report rules (which sections to include, length/voice limits, the evidence/status/diff rules, safety requirements) in one call. Call this once, right before writing the final owner-facing report for a completed task — it replaces reading report-format.md, risk-level-guide.md, and related Skill reference files by hand. Do not call it for non-report answers (plain questions, explanations, plans), and do not call it more than once per task just to double-check.' }, async () => counted('get_beginner_report_rules', async () => {
  const context = await readBridgeContext();
  return { content: [{ type: 'text', text: JSON.stringify(beginnerReportRules(context.config)) }] };
}));

server.registerTool('get_safe_report_requirements', { ...noInput, description: 'Return the fixed list of items (failures, unresolved risks, secrets exposure, data loss, out-of-scope changes) that a report must never omit, even when the active Profile would otherwise skip them. Use alongside get_beginner_report_rules only when a report involves a failure, risk, or safety-relevant change — most routine reports do not need a separate call for this.' }, async () => counted('get_safe_report_requirements', async () => {
  return { content: [{ type: 'text', text: JSON.stringify(safeReportRequirements()) }] };
}));

const transport = new StdioServerTransport();
await server.connect(transport);
