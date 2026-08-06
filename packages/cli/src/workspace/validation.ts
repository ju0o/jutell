import { ALLOWED_MCP, ALLOWED_SETTINGS, ALLOWED_TOP_LEVEL, DIR_VALUE_ERRORS, DIR_VALUE_PATTERN, PROFILE_VALUES, REQUIRED_DIR_KEYS, SECRET_KEY_PATTERN, WORKSPACE_CONFIG_VERSION } from './schema.js';
import type { WorkspaceConfig, WorkspaceIssue, WorkspaceValidationResult } from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function levenshtein(a: string, b: string) {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return matrix[a.length][b.length];
}

function suggest(field: string, allowed: readonly string[]) {
  const ranked = allowed
    .map((candidate) => ({ candidate, distance: levenshtein(field.toLowerCase(), candidate.toLowerCase()) }))
    .filter((entry) => entry.distance > 0 && entry.distance <= 2)
    .sort((a, b) => a.distance - b.distance);
  return ranked[0]?.candidate;
}

function secretLike(key: string, value: unknown): boolean {
  if (SECRET_KEY_PATTERN.test(key)) return true;
  if (typeof value === 'string' && SECRET_KEY_PATTERN.test(value)) return true;
  return false;
}

function isRelativeDirValue(value: unknown): string | null {
  if (typeof value !== 'string') return '문자열이 아닙니다.';
  if (value.length === 0) return DIR_VALUE_ERRORS.empty;
  if (/^[A-Za-z]:[\\/]/.test(value) || value.startsWith('/') || value.startsWith('\\')) return DIR_VALUE_ERRORS.absolute;
  if (value.split(/[\\/]/).includes('..')) return DIR_VALUE_ERRORS.escape;
  if (!DIR_VALUE_PATTERN.test(value)) return DIR_VALUE_ERRORS.pattern;
  return null;
}

function collectUnknownFields(record: Record<string, unknown>, allowed: readonly string[], path: string, issues: WorkspaceIssue[]) {
  for (const key of Object.keys(record)) {
    if (allowed.includes(key)) continue;
    issues.push({
      level: path || '최상위',
      path: path ? `${path}.${key}` : key,
      message: `정의되지 않은 항목입니다.`,
      allowed: [...allowed],
      suggested: suggest(key, allowed),
    });
  }
}

export function validateWorkspaceConfig(value: unknown): WorkspaceValidationResult {
  const issues: WorkspaceIssue[] = [];

  if (!isRecord(value)) {
    return { valid: false, issues: [{ level: '최상위', path: '', message: '설정은 JSON 객체여야 합니다.', allowed: ALLOWED_TOP_LEVEL }] };
  }

  collectUnknownFields(value, ALLOWED_TOP_LEVEL, '', issues);

  if (!('version' in value)) {
    issues.push({ level: '최상위', path: 'version', message: 'version이 없습니다. 2를 사용하세요.', allowed: ALLOWED_TOP_LEVEL });
  } else if (value.version !== WORKSPACE_CONFIG_VERSION) {
    issues.push({ level: '최상위', path: 'version', message: `지원하지 않는 version입니다. 2를 사용하세요.`, allowed: ALLOWED_TOP_LEVEL });
  }

  if (!isRecord(value.dirs)) {
    issues.push({ level: 'dirs', path: 'dirs', message: 'dirs가 없거나 객체가 아닙니다. 8개 폴더 항목이 모두 필요합니다.', allowed: [...REQUIRED_DIR_KEYS] });
  } else {
    collectUnknownFields(value.dirs, REQUIRED_DIR_KEYS, 'dirs', issues);
    for (const key of REQUIRED_DIR_KEYS) {
      if (!(key in value.dirs)) {
        issues.push({ level: 'dirs', path: `dirs.${key}`, message: '필수 폴더 항목이 없습니다.', allowed: [...REQUIRED_DIR_KEYS] });
      }
    }
    const seen = new Map<string, string>();
    for (const key of REQUIRED_DIR_KEYS) {
      if (!(key in value.dirs)) continue;
      const raw = value.dirs[key];
      if (secretLike(key, raw)) {
        issues.push({ level: 'dirs', path: `dirs.${key}`, message: '비밀 정보로 보이는 값은 저장할 수 없습니다.' });
        continue;
      }
      const error = isRelativeDirValue(raw);
      if (error) {
        issues.push({ level: 'dirs', path: `dirs.${key}`, message: error });
        continue;
      }
      const resolved = raw as string;
      if (seen.has(resolved)) {
        issues.push({ level: 'dirs', path: `dirs.${key}`, message: `같은 폴더 이름이 ${seen.get(resolved)}와 중복됩니다.` });
        continue;
      }
      seen.set(resolved, key);
    }
  }

  if (value.settings === undefined) {
    issues.push({ level: 'settings', path: 'settings', message: 'settings가 없습니다.', allowed: ALLOWED_SETTINGS });
  } else if (!isRecord(value.settings)) {
    issues.push({ level: 'settings', path: 'settings', message: 'settings는 객체여야 합니다.', allowed: ALLOWED_SETTINGS });
  } else {
    collectUnknownFields(value.settings, ALLOWED_SETTINGS, 'settings', issues);
    if (value.settings.profile !== undefined && !PROFILE_VALUES.includes(value.settings.profile as never)) {
      issues.push({ level: 'settings', path: 'settings.profile', message: '지원하지 않는 profile입니다.', allowed: [...PROFILE_VALUES], suggested: suggest(String(value.settings.profile), PROFILE_VALUES) });
    }
    if (value.settings.features !== undefined && !isRecord(value.settings.features)) {
      issues.push({ level: 'settings', path: 'settings.features', message: 'features는 객체여야 합니다.' });
    }
    if (value.settings.limits !== undefined && !isRecord(value.settings.limits)) {
      issues.push({ level: 'settings', path: 'settings.limits', message: 'limits는 객체여야 합니다.' });
    }
    if (value.settings.mcp !== undefined) {
      if (!isRecord(value.settings.mcp)) {
        issues.push({ level: 'settings.mcp', path: 'settings.mcp', message: 'mcp는 객체여야 합니다.', allowed: ALLOWED_MCP });
      } else {
        collectUnknownFields(value.settings.mcp, ALLOWED_MCP, 'settings.mcp', issues);
        for (const key of ALLOWED_MCP) {
          if (key in value.settings.mcp && typeof value.settings.mcp[key] !== 'boolean') {
            issues.push({ level: 'settings.mcp', path: `settings.mcp.${key}`, message: 'true 또는 false여야 합니다.', allowed: ALLOWED_MCP });
          }
        }
      }
    }
  }

  if (issues.length > 0) return { valid: false, issues };

  return {
    valid: true,
    config: value as unknown as WorkspaceConfig,
  };
}

export function formatWorkspaceIssues(issues: WorkspaceIssue[]): string {
  const lines: string[] = [];
  lines.push('Workspace 설정에 문제가 있습니다.');
  lines.push('');
  for (const issue of issues) {
    lines.push(`문제 위치: ${issue.path || '(전체)'}`);
    lines.push(`${issue.message}`);
    if (issue.allowed) lines.push(`허용되는 항목: ${issue.allowed.join(', ')}`);
    if (issue.suggested) lines.push(`혹시 \`${issue.suggested}\`를 입력하려던 것인지 확인해주세요.`);
    lines.push('');
  }
  lines.push('파일은 자동으로 수정하지 않았습니다.');
  lines.push('설정을 수정한 뒤 `jutell workspace doctor`를 다시 실행해주세요.');
  return lines.join('\n');
}