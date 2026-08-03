export type AgentProviderId = 'codex' | 'opencode';
export type AgentProviderStatus = 'supported' | 'beta' | 'planned';

export type AgentProvider = {
  id: AgentProviderId;
  label: string;
  status: AgentProviderStatus;
  description: string;
};

export const AGENT_PROVIDERS: AgentProvider[] = [
  { id: 'codex', label: 'Codex', status: 'supported', description: '현재 실제 연결을 지원합니다.' },
  { id: 'opencode', label: 'OpenCode', status: 'beta', description: '로컬 stdio MCP 등록을 베타로 지원합니다.' },
];

export function findProvider(id: string) {
  return AGENT_PROVIDERS.find((provider) => provider.id === id);
}
