export const WORKSPACE_CONFIG_FILE = 'jutell.workspace.json';

export const WORKSPACE_CONFIG_VERSION = 2 as const;

export const REQUIRED_DIR_KEYS = ['public', 'private', 'session', 'review', 'archive', 'export', 'backup', 'operator'] as const;

export const PROFILE_VALUES = ['minimal', 'balanced', 'learning', 'detailed'] as const;

export const ALLOWED_TOP_LEVEL = ['version', 'dirs', 'settings'];

export const ALLOWED_SETTINGS = ['profile', 'features', 'limits', 'mcp'];

export const ALLOWED_MCP = ['enabled', 'autoStart'];

export const DIR_VALUE_PATTERN = /^[A-Za-z0-9._-]+$/;

export const SECRET_KEY_PATTERN = /(token|password|secret|api[_-]?key|cookie|url|access[_-]?key)/i;

export const DIR_VALUE_ERRORS = {
  empty: '빈 문자열은 허용하지 않습니다.',
  absolute: '절대 경로는 허용하지 않습니다. Workspace 안의 상대 폴더 이름만 사용하세요.',
  escape: '`..`를 포함한 경로는 Workspace 밖으로 나갈 수 있어 거부합니다.',
  pattern: '폴더 이름에는 영문·숫자·점·밑줄·하이픈만 사용할 수 있습니다.',
};

export function defaultDirs() {
  return {
    public: 'public',
    private: 'private',
    session: 'session',
    review: 'review',
    archive: 'archive',
    export: 'export',
    backup: 'backup',
    operator: 'operator',
  };
}

export function defaultConfig() {
  return {
    version: WORKSPACE_CONFIG_VERSION,
    dirs: defaultDirs(),
    settings: {
      profile: 'balanced' as const,
      features: {},
      limits: {
        maxMainFiles: 5,
        maxGlossaryTerms: 3,
        compactReportMaxSentences: 12,
      },
      mcp: {
        enabled: false,
        autoStart: false,
      },
    },
  };
}