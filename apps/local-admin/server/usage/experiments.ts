import { promises as fs } from 'node:fs';
import type { FeatureId, Profile } from '../types.js';
import { FEATURE_IDS } from '../config/schema.js';
import type { StoragePaths } from '../storage/files.js';
import { readJson, writeJsonAtomically } from '../storage/files.js';

export type ExperimentStatus = 'in_progress' | 'completed';

export type UsageExperiment = {
  id: string;
  title: string;
  status: ExperimentStatus;
  profile: Profile;
  features: FeatureId[];
  environment: { provider: 'codex' | 'opencode' | 'other'; mcpEnabled: boolean; skillEnabled: boolean };
  measurement?: { toolCalls: number; responseCharacters: number; estimatedTokens: number; durationMs: number };
  evaluation?: { understanding: number; readability: number; accuracy: number; overall: number };
  issues: string[];
  decision: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type UsageExperimentsFile = {
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  experiments: UsageExperiment[];
};

export type ExperimentInput = Partial<Pick<UsageExperiment, 'title' | 'status' | 'profile' | 'features' | 'environment' | 'measurement' | 'evaluation' | 'issues' | 'decision' | 'notes'>>;

function emptyFile(): UsageExperimentsFile {
  const now = new Date().toISOString();
  return { schemaVersion: 1, createdAt: now, updatedAt: now, experiments: [] };
}

async function readFile(paths: StoragePaths): Promise<UsageExperimentsFile> {
  try {
    const value = await readJson<UsageExperimentsFile>(paths.usageExperimentsFile);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyFile();
    const record = value as Record<string, unknown>;
    if (record.schemaVersion !== 1 || !Array.isArray(record.experiments)) return emptyFile();
    return value;
  } catch {
    return emptyFile();
  }
}

async function writeFile(paths: StoragePaths, file: UsageExperimentsFile) {
  await writeJsonAtomically(paths.usageExperimentsFile, file);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateField(key: string, value: unknown): { ok: true } | { ok: false; error: string } {
  if (key === 'title') {
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > 100) return { ok: false, error: '실험 이름은 1~100자여야 합니다.' };
    return { ok: true };
  }
  if (key === 'status') {
    if (value !== 'in_progress' && value !== 'completed') return { ok: false, error: 'status는 in_progress 또는 completed여야 합니다.' };
    return { ok: true };
  }
  if (key === 'profile') {
    if (value !== 'minimal' && value !== 'balanced' && value !== 'learning' && value !== 'detailed') return { ok: false, error: '지원하지 않는 Profile입니다.' };
    return { ok: true };
  }
  if (key === 'features') {
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !FEATURE_IDS.includes(item as FeatureId))) return { ok: false, error: '활성 Feature 목록에 공식 Feature ID만 사용할 수 있습니다.' };
    if (new Set(value as string[]).size !== value.length) return { ok: false, error: '활성 Feature 목록에 중복이 있습니다.' };
    return { ok: true };
  }
  if (key === 'environment') {
    if (!isRecord(value) || (value.provider !== 'codex' && value.provider !== 'opencode' && value.provider !== 'other') || typeof value.mcpEnabled !== 'boolean' || typeof value.skillEnabled !== 'boolean') {
      return { ok: false, error: '환경 정보는 provider(코드닉스/OpenCode/기타)와 MCP·Skill 사용 여부만 저장할 수 있습니다.' };
    }
    return { ok: true };
  }
  if (key === 'measurement') {
    if (!isRecord(value)) return { ok: false, error: '측정 정보 형식이 올바르지 않습니다.' };
    for (const field of ['toolCalls', 'responseCharacters', 'estimatedTokens', 'durationMs']) {
      const number = value[field];
      if (typeof number !== 'number' || !Number.isInteger(number) || number < 0) return { ok: false, error: `${field}는 0 이상의 정수여야 합니다.` };
    }
    return { ok: true };
  }
  if (key === 'evaluation') {
    if (!isRecord(value)) return { ok: false, error: '평가 정보 형식이 올바르지 않습니다.' };
    for (const field of ['understanding', 'readability', 'accuracy', 'overall']) {
      const number = value[field];
      if (typeof number !== 'number' || !Number.isInteger(number) || number < 1 || number > 5) return { ok: false, error: `${field}는 1~5 사이의 정수여야 합니다.` };
    }
    return { ok: true };
  }
  if (key === 'issues') {
    if (!Array.isArray(value) || value.length > 20 || value.some((item) => typeof item !== 'string' || item.length === 0 || item.length > 200)) return { ok: false, error: '문제 목록은 20개 이하, 각 1~200자여야 합니다.' };
    return { ok: true };
  }
  if (key === 'decision') {
    if (typeof value !== 'string' || value.length > 500) return { ok: false, error: '최종 결정은 500자 이하여야 합니다.' };
    return { ok: true };
  }
  if (key === 'notes') {
    if (typeof value !== 'string' || value.length > 500) return { ok: false, error: '운영자 메모는 500자 이하여야 합니다.' };
    return { ok: true };
  }
  return { ok: false, error: `지원하지 않는 실험 항목입니다: ${key}` };
}

function validatePartial(input: ExperimentInput): { ok: true; value: ExperimentInput } | { ok: false; error: string } {
  for (const [key, value] of Object.entries(input)) {
    const result = validateField(key, value);
    if (!result.ok) return result;
  }
  return { ok: true, value: input };
}

export async function readUsageExperiments(paths: StoragePaths) {
  const file = await readFile(paths);
  return { summary: summarize(file), experiments: file.experiments };
}

export async function createUsageExperiment(paths: StoragePaths, input: ExperimentInput): Promise<{ ok: true; experiment: UsageExperiment } | { ok: false; error: string }> {
  const validated = validatePartial(input);
  if (!validated.ok) return validated;
  const file = await readFile(paths);
  const maxId = file.experiments.reduce((max, item) => {
    const number = Number(item.id.replace(/^EXP-/, ''));
    return Number.isInteger(number) && number > max ? number : max;
  }, 0);
  const now = new Date().toISOString();
  const experiment: UsageExperiment = {
    id: `EXP-${String(maxId + 1).padStart(3, '0')}`,
    title: typeof validated.value.title === 'string' ? validated.value.title : '제목 없는 실험',
    status: validated.value.status ?? 'in_progress',
    profile: validated.value.profile ?? 'balanced',
    features: validated.value.features ?? [],
    environment: validated.value.environment ?? { provider: 'codex', mcpEnabled: false, skillEnabled: true },
    issues: validated.value.issues ?? [],
    decision: validated.value.decision ?? '',
    notes: validated.value.notes ?? '',
    createdAt: now,
    updatedAt: now,
    ...(validated.value.measurement ? { measurement: validated.value.measurement } : {}),
    ...(validated.value.evaluation ? { evaluation: validated.value.evaluation } : {}),
  };
  file.experiments.push(experiment);
  file.updatedAt = now;
  await writeFile(paths, file);
  return { ok: true, experiment };
}

export async function updateUsageExperiment(paths: StoragePaths, id: string, input: ExperimentInput): Promise<{ ok: true; experiment: UsageExperiment } | { ok: false; error: string }> {
  const validated = validatePartial(input);
  if (!validated.ok) return validated;
  const file = await readFile(paths);
  const index = file.experiments.findIndex((item) => item.id === id);
  if (index < 0) return { ok: false, error: '실험 기록을 찾을 수 없습니다.' };
  const current = file.experiments[index];
  const now = new Date().toISOString();
  const next: UsageExperiment = {
    ...current,
    title: validated.value.title !== undefined ? validated.value.title : current.title,
    status: validated.value.status !== undefined ? validated.value.status : current.status,
    profile: validated.value.profile !== undefined ? validated.value.profile : current.profile,
    features: validated.value.features !== undefined ? validated.value.features : current.features,
    environment: validated.value.environment !== undefined ? validated.value.environment : current.environment,
    issues: validated.value.issues !== undefined ? validated.value.issues : current.issues,
    decision: validated.value.decision !== undefined ? validated.value.decision : current.decision,
    notes: validated.value.notes !== undefined ? validated.value.notes : current.notes,
    ...(validated.value.measurement !== undefined ? { measurement: validated.value.measurement } : current.measurement ? { measurement: current.measurement } : {}),
    ...(validated.value.evaluation !== undefined ? { evaluation: validated.value.evaluation } : current.evaluation ? { evaluation: current.evaluation } : {}),
    updatedAt: now,
  };
  file.experiments[index] = next;
  file.updatedAt = now;
  await writeFile(paths, file);
  return { ok: true, experiment: next };
}

export async function deleteAllUsageExperiments(paths: StoragePaths) {
  await fs.rm(paths.usageExperimentsFile, { force: true });
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export function summarize(file: UsageExperimentsFile) {
  const experiments = file.experiments;
  const evaluated = experiments.filter((item) => item.evaluation);
  const measured = experiments.filter((item) => item.measurement);
  const profileCounts = new Map<string, number>();
  const disabledCounts = new Map<string, number>();
  const issueCounts = new Map<string, number>();
  for (const item of experiments) {
    profileCounts.set(item.profile, (profileCounts.get(item.profile) ?? 0) + 1);
    for (const id of FEATURE_IDS) {
      if (!item.features.includes(id)) disabledCounts.set(id, (disabledCounts.get(id) ?? 0) + 1);
    }
    for (const issue of item.issues) issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
  }
  const mostUsedProfile = profileCounts.size === 0 ? null : [...profileCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const mostDisabledFeatures = [...disabledCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id);
  const topIssues = [...issueCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([text, count]) => ({ text, count }));
  return {
    total: experiments.length,
    completed: experiments.filter((item) => item.status === 'completed').length,
    inProgress: experiments.filter((item) => item.status === 'in_progress').length,
    averageUnderstanding: average(evaluated.map((item) => item.evaluation!.understanding)),
    averageReadability: average(evaluated.map((item) => item.evaluation!.readability)),
    averageAccuracy: average(evaluated.map((item) => item.evaluation!.accuracy)),
    averageResponseCharacters: average(measured.map((item) => item.measurement!.responseCharacters)),
    averageToolCalls: average(measured.map((item) => item.measurement!.toolCalls)),
    mostUsedProfile,
    mostDisabledFeatures,
    topIssues,
  };
}
