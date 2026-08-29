import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { readBridgeContext } from './config/bridge-config.js';
import { activeFeatures, beginnerReportRules, bridgeStatus, reportPreferences, safeReportRequirements } from './tools/bridge-tools.js';
import { recordToolCall } from './tools/usage-counters.js';

const server = new McpServer({
  name: 'JuTell',
  version: '0.3.0',
}, {
  instructions: 'JuTell by Ju0 is a local read-only report helper. Read only project configuration and approved report rules. Never access project code, Git diff, prompts, AI answers, secrets, or external networks. Skill mode remains available if this MCP server is disabled or unavailable. When both jutell and beginner_bridge servers are visible, prefer the canonical jutell server; use beginner_bridge only for compatibility. For owner-facing reports, apply the JuTell reporting guidance before composing the final answer.',
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

server.registerTool('get_bridge_status', { ...noInput, description: 'Return local JuTell configuration and availability status.' }, async () => counted('get_bridge_status', async () => {
  const context = await readBridgeContext();
  return { content: [{ type: 'text', text: JSON.stringify(bridgeStatus(context)) }] };
}));

server.registerTool('get_active_features', { ...noInput, description: 'Return active JuTell features and their safe omissions.' }, async () => counted('get_active_features', async () => {
  const context = await readBridgeContext();
  return { content: [{ type: 'text', text: JSON.stringify({ features: activeFeatures(context.config) }) }] };
}));

server.registerTool('get_report_preferences', { ...noInput, description: 'Return the current report Profile and limits.' }, async () => counted('get_report_preferences', async () => {
  const context = await readBridgeContext();
  return { content: [{ type: 'text', text: JSON.stringify(reportPreferences(context.config)) }] };
}));

server.registerTool('get_beginner_report_rules', { ...noInput, description: 'Return only the active report rules needed for the current project configuration.' }, async () => counted('get_beginner_report_rules', async () => {
  const context = await readBridgeContext();
  return { content: [{ type: 'text', text: JSON.stringify(beginnerReportRules(context.config)) }] };
}));

server.registerTool('get_safe_report_requirements', { ...noInput, description: 'Return information that must never be hidden from a final report.' }, async () => counted('get_safe_report_requirements', async () => {
  return { content: [{ type: 'text', text: JSON.stringify(safeReportRequirements()) }] };
}));

const transport = new StdioServerTransport();
await server.connect(transport);
