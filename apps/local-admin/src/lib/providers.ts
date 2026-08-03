export type AgentProviderId = 'codex' | 'claude-code' | 'cline';

export type AgentProvider = {
  id: AgentProviderId;
  label: string;
  status: 'supported' | 'planned';
  description: string;
};

export const AGENT_PROVIDER_CATALOG: AgentProvider[] = [
  { id: 'codex', label: 'Codex', status: 'supported', description: '현재 실제 연결을 지원합니다.' },
  { id: 'claude-code', label: 'Claude Code', status: 'planned', description: 'Provider 확장을 준비 중입니다.' },
  { id: 'cline', label: 'Cline', status: 'planned', description: 'Provider 확장을 준비 중입니다.' },
];

export const CURRENT_AGENT_PROVIDER = AGENT_PROVIDER_CATALOG[0];
