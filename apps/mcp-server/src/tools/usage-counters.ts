import { promises as fs, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { readBridgeContext } from '../config/bridge-config.js';

export type ToolCounter = {
  calls: number;
  responseCharacters: number;
  lastCalledAt: string | null;
};

export type TemplateCopyCounter = {
  count: number;
  byTaskType: Record<string, number>;
  byProfile: Record<string, number>;
  lastCopiedAt: string | null;
};

export type UsageCounters = {
  schemaVersion: 1;
  enabled: boolean;
  updatedAt: string | null;
  totalToolCalls: number;
  tools: Record<string, ToolCounter>;
  templateCopies?: Record<string, TemplateCopyCounter>;
};

function stderrSummary(message: string) {
  try { process.stderr.write(`JuTell usage counters: ${message}\n`); } catch { /* 안전한 요약 실패도 무시 */ }
}

async function localDir(projectRoot: string) {
  const preferred = path.join(projectRoot, '.jutell-local');
  const legacy = path.join(projectRoot, '.beginner-bridge-local');
  return existsSync(preferred) || !existsSync(legacy) ? preferred : legacy;
}

export async function resolveCountersFile(projectRoot: string): Promise<string> {
  return path.join(await localDir(projectRoot), 'usage-counters.json');
}

async function exists(file: string) {
  try { await fs.access(file); return true; } catch { return false; }
}

async function readCounters(file: string): Promise<{ state: 'missing' | 'corrupt'; value: null } | { state: 'ok'; value: UsageCounters }> {
  if (!await exists(file)) return { state: 'missing', value: null };
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { state: 'corrupt', value: null };
    const value = parsed as Record<string, unknown>;
    if (value.schemaVersion !== 1 || typeof value.enabled !== 'boolean' || typeof value.totalToolCalls !== 'number' || typeof value.tools !== 'object' || value.tools === null || Array.isArray(value.tools)) return { state: 'corrupt', value: null };
    return { state: 'ok', value: parsed as UsageCounters };
  } catch { return { state: 'corrupt', value: null }; }
}

async function writeCounters(file: string, value: UsageCounters): Promise<boolean> {
  const directory = path.dirname(file);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await fs.mkdir(directory, { recursive: true });
      const tempFile = path.join(directory, `.usage-counters.${process.pid}.${randomUUID()}.tmp`);
      await fs.writeFile(tempFile, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
      try {
        await fs.rename(tempFile, file);
      } catch (error) {
        await fs.rm(tempFile, { force: true });
        throw error;
      }
      return true;
    } catch { /* 재시도 */ }
  }
  return false;
}

const writeQueue: Promise<void>[] = [];

export async function recordToolCall(toolName: string, responseCharacters: number, projectRoot = process.cwd()): Promise<void> {
  try {
    const context = await readBridgeContext(projectRoot);
    if (!context.config.usageMeasurement.localCountersEnabled) return;
    const file = await resolveCountersFile(projectRoot);
    const run = (writeQueue.at(-1) ?? Promise.resolve()).then(async () => {
      const current = await readCounters(file);
      if (current.state === 'corrupt') throw new Error('corrupt counters file kept untouched');
      const base: UsageCounters = current.state === 'ok' ? structuredClone(current.value) : { schemaVersion: 1, enabled: true, updatedAt: null, totalToolCalls: 0, tools: {}, templateCopies: {} };
      const tool = base.tools[toolName] ?? { calls: 0, responseCharacters: 0, lastCalledAt: null };
      tool.calls += 1;
      tool.responseCharacters += responseCharacters;
      tool.lastCalledAt = new Date().toISOString();
      base.tools[toolName] = tool;
      base.totalToolCalls += 1;
      base.updatedAt = new Date().toISOString();
      if (!await writeCounters(file, base)) throw new Error('counters write failed');
    });
    writeQueue.push(run.catch(() => undefined));
    try { await run; } catch (error) { stderrSummary(error instanceof Error ? error.message : 'record failed without affecting the tool response'); }
  } catch (error) {
    stderrSummary(error instanceof Error ? error.message : 'record failed without affecting the tool response');
  }
}
