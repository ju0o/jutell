import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readBridgeContext } from './config/bridge-config.js';
import { activeFeatures, beginnerReportRules, bridgeStatus, reportPreferences, safeReportRequirements } from './tools/bridge-tools.js';

const server = new McpServer({
  name: 'JuTell',
  version: '0.1.0',
}, {
  instructions: 'JuTell by Ju0 is a local read-only report helper. Read only project configuration and approved report rules. Never access project code, Git diff, prompts, AI answers, secrets, or external networks. Skill mode remains available if this MCP server is disabled or unavailable.',
});

const noInput = { inputSchema: {} } as const;

server.registerTool('get_bridge_status', { ...noInput, description: 'Return local JuTell configuration and availability status.' }, async () => {
  const context = await readBridgeContext();
  return { content: [{ type: 'text', text: JSON.stringify(bridgeStatus(context)) }] };
});

server.registerTool('get_active_features', { ...noInput, description: 'Return active JuTell features and their safe omissions.' }, async () => {
  const context = await readBridgeContext();
  return { content: [{ type: 'text', text: JSON.stringify({ features: activeFeatures(context.config) }) }] };
});

server.registerTool('get_report_preferences', { ...noInput, description: 'Return the current report Profile and limits.' }, async () => {
  const context = await readBridgeContext();
  return { content: [{ type: 'text', text: JSON.stringify(reportPreferences(context.config)) }] };
});

server.registerTool('get_beginner_report_rules', { ...noInput, description: 'Return only the active report rules needed for the current project configuration.' }, async () => {
  const context = await readBridgeContext();
  return { content: [{ type: 'text', text: JSON.stringify(beginnerReportRules(context.config)) }] };
});

server.registerTool('get_safe_report_requirements', { ...noInput, description: 'Return information that must never be hidden from a final report.' }, async () => {
  return { content: [{ type: 'text', text: JSON.stringify(safeReportRequirements()) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
