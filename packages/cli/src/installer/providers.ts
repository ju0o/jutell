export type AgentProviderId = 'codex' | 'opencode' | 'claude-code' | 'cline';
export type AgentProviderStatus = 'supported' | 'beta' | 'planned';

export type AgentProvider = {
  id: AgentProviderId;
  label: string;
  status: AgentProviderStatus;
  description: string;
  aliases?: string[];
};

export const AGENT_PROVIDERS: AgentProvider[] = [
  { id: 'codex', label: 'Codex', status: 'supported', description: '현재 실제 연결을 지원합니다.' },
  { id: 'opencode', label: 'OpenCode', status: 'beta', description: '로컬 stdio MCP 등록을 베타로 지원합니다.' },
  { id: 'claude-code', label: 'Claude Code', status: 'beta', description: 'MCP 등록을 베타로 지원합니다.', aliases: ['claude'] },
  { id: 'cline', label: 'Cline', status: 'planned', description: '연결 준비 중입니다.' },
];

export function findProvider(id: string) {
  return AGENT_PROVIDERS.find((provider) => provider.id === id || provider.aliases?.includes(id));
}

export function supportedProviders() {
  return AGENT_PROVIDERS.filter((provider) => provider.status !== 'planned');
}

export function supportedProviderNames() {
  return supportedProviders().map((provider) => provider.label).join('와 ');
}
