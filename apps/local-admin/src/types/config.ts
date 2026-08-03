export type Profile = 'minimal' | 'balanced' | 'learning' | 'detailed';
export type FeatureId =
  | 'changeSummary'
  | 'userVisibleChanges'
  | 'internalChanges'
  | 'mainFiles'
  | 'glossary'
  | 'validationResults'
  | 'riskAssessment'
  | 'userActions';

export type Config = {
  version: 1;
  profile: Profile;
  features: Record<FeatureId, boolean>;
  limits: {
    maxMainFiles: number;
    maxGlossaryTerms: number;
    compactReportMaxSentences: number;
  };
  mcp: {
    enabled: boolean;
    autoStart: boolean;
  };
  voice?: { preset?: 'default' | 'plain' | 'learning' | 'jutell' };
};

export type McpStatus = {
  settings: { enabled: boolean; autoStart: boolean };
  server: { state: 'running' | 'stopped' | 'starting' | 'error'; error?: string };
  codex: { registered: boolean; path: string; conflict: boolean };
  preparation: 'not_registered' | 'registered' | 'enabled' | 'error';
  connection: { state: 'not_checked' | 'success' | 'failure'; lastCheckedAt: string | null };
  skillFallback: { available: boolean; message: string };
};

export type Feedback = {
  id: string;
  date: string;
  projectAlias: string;
  taskType: string;
  profile: Profile;
  activeFeatures: FeatureId[];
  perceivedLength: 'short' | 'appropriate' | 'long';
  understandable: 'yes' | 'partial' | 'no';
  mostUsefulFeature: string;
  unnecessaryFeature: string;
  missingInfo: string;
  inaccurateContent: string;
  reuseConfig: 'yes' | 'no' | 'unknown';
  improvementIdea: string;
  severity: 'low' | 'medium' | 'high';
  status: 'noted' | 'needs_reproduction' | 'planned' | 'improving' | 'confirmed';
  createdAt: string;
  updatedAt: string;
};

export type ConfigResponse = {
  config: Config;
  fallback: boolean;
  warning?: string;
  metadata: { configVersion?: number; skillVersion?: string };
  lastChangedAt: string | null;
};

export type FeedbackInput = Omit<Feedback, 'id' | 'createdAt' | 'updatedAt'>;

export type Readiness = {
  config: { exists: boolean; valid: boolean; profile: Profile; activeFeatures: number };
  skill: { exists: boolean };
  agents: { exists: boolean; jutellBlock: boolean };
  safetyRules: { exists: boolean };
  sessionApplied: 'manual_check_required';
};
