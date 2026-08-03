export type Profile = 'minimal' | 'balanced' | 'learning' | 'detailed';
export type FeatureId =
  | 'changeSummary'
  | 'userVisibleChanges'
  | 'internalChanges'
  | 'mainFiles'
  | 'glossary'
  | 'validationResults'
  | 'riskAssessment'
  | 'userActions'
  | 'nextActionSuggestions'
  | 'requestClarificationGuide'
  | 'manualEditGuidance'
  | 'requestBuilder';

export type Limits = {
  maxMainFiles: number;
  maxGlossaryTerms: number;
  compactReportMaxSentences: number;
};

export type McpSettings = {
  enabled: boolean;
  autoStart: boolean;
};

export type CodexPreparation = 'not_registered' | 'registered' | 'enabled' | 'error';
export type ActualConnection = 'not_checked' | 'success' | 'failure';

export type Config = {
  version: 1;
  profile: Profile;
  features: Record<FeatureId, boolean>;
  limits: Limits;
  mcp: McpSettings;
  usageMeasurement: { localCountersEnabled: boolean };
  voice?: { preset?: 'default' | 'plain' | 'learning' | 'jutell' };
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

export type FeedbackInput = Omit<Feedback, 'id' | 'createdAt' | 'updatedAt'>;

export type Readiness = {
  config: { exists: boolean; valid: boolean; profile: Profile; activeFeatures: number };
  skill: { exists: boolean };
  agents: { exists: boolean; jutellBlock: boolean };
  safetyRules: { exists: boolean };
  sessionApplied: 'manual_check_required';
};
