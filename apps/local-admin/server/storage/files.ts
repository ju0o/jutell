import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { validateConfig, type ValidationResult } from '../config/schema.js';
import type { Config, Feedback } from '../types.js';

export type StoragePaths = {
  projectRoot: string;
  configFile: string;
  legacyConfigFile: string;
  localDir: string;
  legacyLocalDir: string;
  feedbackFile: string;
  historyFile: string;
  metadataFile: string;
};

export function getStoragePaths(projectRoot: string): StoragePaths {
  const preferredLocalDir = path.join(projectRoot, '.jutell-local');
  const legacyLocalDir = path.join(projectRoot, '.beginner-bridge-local');
  const localDir = existsSync(preferredLocalDir) || !existsSync(legacyLocalDir) ? preferredLocalDir : legacyLocalDir;
  return {
    projectRoot,
    configFile: path.join(projectRoot, '.jutell.json'),
    legacyConfigFile: path.join(projectRoot, '.beginner-bridge.json'),
    localDir,
    legacyLocalDir,
    feedbackFile: path.join(localDir, 'beta-feedback.json'),
    historyFile: path.join(localDir, 'settings-history.json'),
    metadataFile: path.join(localDir, 'metadata.json'),
  };
}

export async function ensureStorage(paths: StoragePaths) {
  await fs.mkdir(paths.localDir, { recursive: true });
  for (const [file, fallback] of [
    [paths.feedbackFile, []],
    [paths.historyFile, []],
    [paths.metadataFile, { configVersion: 1, skillVersion: 'not-recorded' }],
  ] as const) {
    try {
      await fs.access(file);
    } catch {
      await writeJsonAtomically(file, fallback);
    }
  }
}

export async function readJson<T>(file: string): Promise<T> {
  const text = await fs.readFile(file, 'utf8');
  return JSON.parse(text) as T;
}

export async function readConfig(paths: StoragePaths): Promise<{ config: Config; fallback: boolean; warning?: string }> {
  try {
    const configFile = await fs.access(paths.configFile).then(() => paths.configFile).catch(() => paths.legacyConfigFile);
    const result = validateConfig(await readJson<unknown>(configFile));
    if (result.ok) return { config: result.value, fallback: false };
    return { config: (await readDefaultConfig()), fallback: true, warning: result.error };
  } catch {
    return { config: await readDefaultConfig(), fallback: true, warning: '설정 파일을 읽을 수 없어 기본 설정을 사용합니다.' };
  }
}

async function readDefaultConfig(): Promise<Config> {
  const { DEFAULT_CONFIG } = await import('../config/schema.js');
  return structuredClone(DEFAULT_CONFIG);
}

export async function writeJsonAtomically(file: string, value: unknown) {
  const directory = path.dirname(file);
  await fs.mkdir(directory, { recursive: true });
  const tempFile = path.join(directory, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  await fs.writeFile(tempFile, JSON.stringify(value, null, 2) + '\n', 'utf8');
  try {
    JSON.parse(await fs.readFile(tempFile, 'utf8'));
    const backupFile = `${file}.previous`;
    try { await fs.rm(backupFile, { force: true }); } catch { /* best effort */ }
    try { await fs.rename(file, backupFile); } catch { /* first write has no old file */ }
    try {
      await fs.rename(tempFile, file);
      await fs.rm(backupFile, { force: true });
    } catch (error) {
      try { await fs.rm(file, { force: true }); } catch { /* preserve original error */ }
      try { await fs.rename(backupFile, file); } catch { /* preserve original error */ }
      throw error;
    }
  } finally {
    await fs.rm(tempFile, { force: true });
  }
}

export async function readArray<T>(file: string): Promise<T[]> {
  const value = await readJson<unknown>(file);
  if (!Array.isArray(value)) throw new Error('저장된 목록 형식이 올바르지 않습니다.');
  return value as T[];
}

export async function saveFeedback(paths: StoragePaths, items: Feedback[]) {
  await writeJsonAtomically(paths.feedbackFile, items);
}
