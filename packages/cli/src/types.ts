import type { PathLike } from 'node:fs';

export type InstallScope = 'project' | 'global';
export type Profile = 'minimal' | 'balanced' | 'learning' | 'detailed';

export type CliOptions = {
  scope: InstallScope;
  profile?: Profile;
  yes: boolean;
  activateMcp: boolean;
  oneCommand: boolean;
  statusOnly: boolean;
  json: boolean;
  verbose: boolean;
  openBrowser: boolean;
  fix: boolean;
  skillOnly: boolean;
  mcpOnly: boolean;
  disableSkill: boolean;
  disableMcp: boolean;
  disableAll: boolean;
  keepData: boolean;
  removeData: boolean;
  page?: number;
  agent?: string;
  role?: string;
  title?: string;
};

export type CliChoice = {
  value: string;
  label: string;
  note?: string;
};

export type CliIo = {
  write: (message: string) => void;
  error: (message: string) => void;
  ask: (message: string, defaultYes?: boolean) => Promise<boolean>;
  choose: (message: string, choices: CliChoice[], defaultValue?: string) => Promise<string | undefined>;
};

export type ScopePaths = {
  scope: InstallScope;
  targetRoot: string;
  skillRoot: string;
  configFile: string;
  legacyConfigFile: string;
  codexConfigFile: string;
  opencodeConfigFile: string;
  dataRoot: string;
  legacyDataRoot: string;
};

export type BridgeConfig = {
  version: 1;
  profile: Profile;
  features: Record<string, boolean>;
  limits: {
    maxMainFiles: number;
    maxGlossaryTerms: number;
    compactReportMaxSentences: number;
  };
  mcp?: {
    enabled: boolean;
  };
  usageMeasurement?: {
    localCountersEnabled: boolean;
  };
  voice?: { preset?: 'default' | 'plain' | 'learning' | 'jutell' };
};

export type StatusResult = {
  cliVersion: string;
  skillVersion: string;
  mcpVersion: string;
  adminVersion: string;
  installationScope: InstallScope;
  configExists: boolean;
  configValid: boolean;
  codexDetected: boolean;
  opencodeDetected: boolean;
  skillInstalled: boolean;
  agentsManaged: boolean;
  mcpRegistered: boolean;
  mcpEnabled: boolean;
  codexPreparation: 'not_registered' | 'registered' | 'enabled' | 'error';
  opencodePreparation: 'not_registered' | 'registered' | 'enabled' | 'conflict';
  anyProviderRegistered: boolean;
  anyProviderEnabled: boolean;
  actualConnection: 'not_checked' | 'success' | 'failure';
  opencode: { registered: boolean; conflict: boolean; enabled: boolean };
  profile: Profile;
  activeFeatureCount: number;
  configLocation: string;
  localAdmin: '실행 중' | '중지됨' | '확인 필요';
  usageCountersEnabled: boolean;
  telemetry: '비활성화';
  externalTransmission: '없음';
  warnings: string[];
};

export type CheckResult = {
  name: string;
  status: '정상' | '주의' | '오류' | '직접 확인 필요';
  detail: string;
};

export type AssetPaths = {
  root: string;
  skill: string;
  mcpServer: string;
  localAdmin: string;
  localAdminServer: string;
  defaultConfig: string;
  version: string;
};

export type FileSnapshot = { file: string; existed: boolean; content?: string };

export type PathExists = (path: PathLike) => Promise<boolean>;
