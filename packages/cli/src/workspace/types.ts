export type WorkspaceDirKey = 'public' | 'private' | 'session' | 'review' | 'archive' | 'export' | 'backup' | 'operator';

export type WorkspaceDirs = Record<WorkspaceDirKey, string>;

export type JuTellRuntimeMode =
  | {
      kind: 'workspace';
      workspaceRoot: string;
      configPath: string;
      dirs: WorkspaceDirs;
      config: WorkspaceConfig;
    }
  | {
      kind: 'project';
      projectRoot: string;
    };

export type ResolveWorkspaceResult =
  | { state: 'workspace'; mode: { kind: 'workspace'; workspaceRoot: string; configPath: string; dirs: WorkspaceDirs; config: WorkspaceConfig } }
  | { state: 'project'; mode: { kind: 'project'; projectRoot: string }; reason?: string }
  | { state: 'error'; issues: WorkspaceIssue[]; workspaceRoot?: string };

export type WorkspaceSettings = {
  profile: 'minimal' | 'balanced' | 'learning' | 'detailed';
  features: Record<string, boolean>;
  limits: {
    maxMainFiles: number;
    maxGlossaryTerms: number;
    compactReportMaxSentences: number;
  };
  mcp: {
    enabled: boolean;
    autoStart: boolean;
  };
};

export type WorkspaceConfig = {
  version: 2;
  dirs: WorkspaceDirs;
  settings: WorkspaceSettings;
};

export type WorkspaceIssue = {
  level: string;
  path: string;
  message: string;
  allowed?: string[];
  suggested?: string;
};

export type WorkspaceValidationResult =
  | { valid: true; config: WorkspaceConfig }
  | { valid: false; issues: WorkspaceIssue[] };