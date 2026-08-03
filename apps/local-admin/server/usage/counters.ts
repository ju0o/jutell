import { promises as fs } from 'node:fs';
import type { StoragePaths } from '../storage/files.js';
import { readJson, writeJsonAtomically } from '../storage/files.js';

export type UsageCounters = {
  schemaVersion: 1;
  enabled: boolean;
  updatedAt: string | null;
  totalToolCalls: number;
  tools: Record<string, { calls: number; responseCharacters: number; lastCalledAt: string | null }>;
  templateCopies?: Record<string, { count: number; byTaskType: Record<string, number>; byProfile: Record<string, number>; lastCopiedAt: string | null }>;
};

export async function readUsageCounters(paths: StoragePaths): Promise<{ exists: boolean; corrupt: boolean; counters: UsageCounters | null }> {
  try {
    const value = await readJson<UsageCounters>(paths.usageCountersFile);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { exists: true, corrupt: true, counters: null };
    const record = value as Record<string, unknown>;
    if (record.schemaVersion !== 1 || typeof record.enabled !== 'boolean' || typeof record.totalToolCalls !== 'number' || typeof record.tools !== 'object' || record.tools === null || Array.isArray(record.tools)) {
      return { exists: true, corrupt: true, counters: null };
    }
    return { exists: true, corrupt: false, counters: value };
  } catch {
    return { exists: false, corrupt: false, counters: null };
  }
}

export async function deleteUsageCounters(paths: StoragePaths) {
  await fs.rm(paths.usageCountersFile, { force: true });
}

async function writeCounters(paths: StoragePaths, value: UsageCounters) {
  await writeJsonAtomically(paths.usageCountersFile, value);
}

export async function recordTemplateCopy(paths: StoragePaths, template: string, taskType: string, profile: string) {
  const current = await readUsageCounters(paths);
  if (current.corrupt) return { ok: false as const, reason: '카운터 파일 형식을 확인할 수 없어 보존하고 기록하지 않았습니다.' };
  const base: UsageCounters = current.counters ?? { schemaVersion: 1, enabled: true, updatedAt: null, totalToolCalls: 0, tools: {}, templateCopies: {} };
  const copies = base.templateCopies ?? (base.templateCopies = {});
  const item = copies[template] ?? { count: 0, byTaskType: {}, byProfile: {}, lastCopiedAt: null };
  item.count += 1;
  item.byTaskType[taskType] = (item.byTaskType[taskType] ?? 0) + 1;
  item.byProfile[profile] = (item.byProfile[profile] ?? 0) + 1;
  item.lastCopiedAt = new Date().toISOString();
  copies[template] = item;
  base.updatedAt = new Date().toISOString();
  await writeCounters(paths, base);
  return { ok: true as const };
}
