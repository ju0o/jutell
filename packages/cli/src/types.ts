import type { PathLike } from 'node:fs';

export type InstallScope = 'project' | 'global';
export type Profile = 'minimal' | 'balanced' | 'learning' | 'detailed';

export type CliOptions = {
  scope: InstallScope;
  profile?: Profile;
  yes: boolean;
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
};

export type CliIo = {
  write: (message: string) => void;
  error: (message: string) => void;
  ask: (message: string) => Promise<boolean>;
};

export type ScopePaths = {
  scope: InstallScope;
  targetRoot: string;
  skillRoot: string;
  configFile: string;
  codexConfigFile: string;
  dataRoot: string;
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
    autoStart: boolean;
  };
};

export type StatusResult = {
  cliVersion: string;
  skillVersion: string;
  mcpVersion: string;
  adminVersion: string;
  installationScope: InstallScope;
  codexDetected: boolean;
  skillInstalled: boolean;
  mcpRegistered: boolean;
  mcpEnabled: boolean;
  profile: Profile;
  activeFeatureCount: number;
  configLocation: string;
  localAdmin: '실행 중' | '중지됨' | '확인 필요';
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
