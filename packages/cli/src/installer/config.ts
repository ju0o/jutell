import { promises as fs } from 'node:fs';
import { backupFile, readBridgeConfig, writeBridgeConfig, writeTextSafely } from '../config/managed.js';
import type { BridgeConfig, ScopePaths, Profile } from '../types.js';

async function readObject(paths: ScopePaths): Promise<Record<string, unknown> | undefined> {
  try {
    const raw = await fs.readFile(paths.configFile, 'utf8');
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  } catch { return undefined; }
}

export async function ensureBridgeConfig(paths: ScopePaths, profile: Profile | undefined) {
  const loaded = await readBridgeConfig(paths);
  const current = await readObject(paths);
  if (!current || !loaded.valid) {
    const next = { ...loaded.config, ...(profile ? { profile } : {}) };
    await writeBridgeConfig(paths, next);
    return { config: next, created: true, replacedInvalid: loaded.exists && !loaded.valid };
  }
  const next = {
    ...current,
    version: 1,
    ...(profile ? { profile } : {}),
    mcp: (() => { const m = current.mcp as BridgeConfig['mcp'] | undefined; return { enabled: m?.enabled === true }; })(),
  } as BridgeConfig & Record<string, unknown>;
  const before = JSON.stringify(current, null, 2);
  const after = JSON.stringify(next, null, 2);
  if (before !== after) await writeTextSafely(paths.configFile, `${after}\n`);
  return { config: next, created: false, replacedInvalid: false };
}

export async function setMcpEnabled(paths: ScopePaths, enabled: boolean) {
  const loaded = await readBridgeConfig(paths);
  const current = await readObject(paths);
  const next = { ...(current ?? loaded.config), version: 1, mcp: { ...(loaded.config.mcp ?? { enabled: false }), enabled } } as BridgeConfig;
  await writeBridgeConfig(paths, next);
  return next;
}

export async function setMcpDisabled(paths: ScopePaths) {
  return setMcpEnabled(paths, false);
}

export async function backupBridgeConfig(paths: ScopePaths) {
  await backupFile(paths.configFile);
}
