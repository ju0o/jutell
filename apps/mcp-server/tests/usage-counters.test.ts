import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/config/bridge-config.js';
import { recordToolCall, resolveCountersFile } from '../src/tools/usage-counters.js';

async function makeProject(localCountersEnabled: boolean): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-counters-'));
  const config = { ...structuredClone(DEFAULT_CONFIG), usageMeasurement: { localCountersEnabled } };
  await fs.writeFile(path.join(root, '.jutell.json'), `${JSON.stringify(config)}\n`, 'utf8');
  return root;
}

describe('JuTell MCP local usage counters', () => {
  it('does not create any file while recording is OFF', async () => {
    const root = await makeProject(false);
    await recordToolCall('get_bridge_status', 120, root);
    await expect(fs.access(path.join(root, '.jutell-local', 'usage-counters.json'))).rejects.toThrow();
    await fs.rm(root, { recursive: true, force: true });
  });

  it('counts tool calls and response characters only while ON', async () => {
    const root = await makeProject(true);
    await recordToolCall('get_bridge_status', 120, root);
    await recordToolCall('get_bridge_status', 80, root);
    await recordToolCall('get_active_features', 500, root);
    const file = await resolveCountersFile(root);
    const value = JSON.parse(await fs.readFile(file, 'utf8'));
    expect(value.totalToolCalls).toBe(3);
    expect(value.tools.get_bridge_status.calls).toBe(2);
    expect(value.tools.get_bridge_status.responseCharacters).toBe(200);
    expect(value.tools.get_active_features.responseCharacters).toBe(500);
    expect(typeof value.tools.get_bridge_status.lastCalledAt).toBe('string');
    await fs.rm(root, { recursive: true, force: true });
  });

  it('keeps concurrent writes intact', async () => {
    const root = await makeProject(true);
    await Promise.all(Array.from({ length: 6 }, () => recordToolCall('get_report_preferences', 10, root)));
    const file = await resolveCountersFile(root);
    const value = JSON.parse(await fs.readFile(file, 'utf8'));
    expect(value.totalToolCalls).toBe(6);
    expect(value.tools.get_report_preferences.calls).toBe(6);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('never overwrites a corrupt counters file and still succeeds', async () => {
    const root = await makeProject(true);
    const file = await resolveCountersFile(root);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, '{ not valid json', 'utf8');
    await recordToolCall('get_bridge_status', 10, root);
    expect(await fs.readFile(file, 'utf8')).toBe('{ not valid json');
    await fs.rm(root, { recursive: true, force: true });
  });

  it('stops recording once the setting is turned off', async () => {
    const root = await makeProject(true);
    await recordToolCall('get_bridge_status', 10, root);
    await fs.writeFile(path.join(root, '.jutell.json'), `${JSON.stringify({ ...structuredClone(DEFAULT_CONFIG), usageMeasurement: { localCountersEnabled: false } })}\n`, 'utf8');
    await recordToolCall('get_bridge_status', 10, root);
    const file = await resolveCountersFile(root);
    const value = JSON.parse(await fs.readFile(file, 'utf8'));
    expect(value.totalToolCalls).toBe(1);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('records nothing when the project root has no JuTell settings', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-counters-empty-'));
    await recordToolCall('get_bridge_status', 10, root);
    await expect(fs.access(path.join(root, '.jutell-local', 'usage-counters.json'))).rejects.toThrow();
    await fs.rm(root, { recursive: true, force: true });
  });
});
