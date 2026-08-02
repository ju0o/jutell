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
  status: 'noted' | 'needs_reproduction' | 'planned' | 'confirmed';
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
