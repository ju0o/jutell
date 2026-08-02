import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, validateConfig } from './config/schema.js';
import { startLocalAdminServer } from './app.js';
import { getStoragePaths, writeJsonAtomically } from './storage/files.js';

let root = '';
let server: Awaited<ReturnType<typeof startLocalAdminServer>>['server'];
let base = '';

async function request(route: string, options?: RequestInit) {
  const response = await fetch(base + route, options);
  return { status: response.status, body: await response.json() as Record<string, any> };
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'beginner-bridge-admin-'));
  await writeJsonAtomically(path.join(root, '.beginner-bridge.json'), DEFAULT_CONFIG);
  const started = await startLocalAdminServer({ projectRoot: root, port: 0 });
  server = started.server;
  base = `http://127.0.0.1:${started.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await fs.rm(root, { recursive: true, force: true });
});

describe('config validation', () => {
  it('accepts the baseline configuration', () => expect(validateConfig(DEFAULT_CONFIG).ok).toBe(true));
  it('rejects an unknown Profile, Feature, and invalid limit', () => {
    expect(validateConfig({ ...DEFAULT_CONFIG, profile: 'unknown' }).ok).toBe(false);
    expect(validateConfig({ ...DEFAULT_CONFIG, features: { ...DEFAULT_CONFIG.features, unknown: true } }).ok).toBe(false);
    expect(validateConfig({ ...DEFAULT_CONFIG, limits: { ...DEFAULT_CONFIG.limits, maxMainFiles: 0 } }).ok).toBe(false);
  });
});

describe('local config API', () => {
  it('reads, saves, records history, and resets configuration', async () => {
    const initial = await request('/api/config');
    expect(initial.status).toBe(200);
    expect(initial.body.config.profile).toBe('balanced');
    const next = { ...DEFAULT_CONFIG, profile: 'learning', limits: { ...DEFAULT_CONFIG.limits, maxGlossaryTerms: 6 } };
    const saved = await request('/api/config', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(next) });
    expect(saved.status).toBe(200);
    expect(saved.body.changed).toBe(true);
    const history = await request('/api/config/history');
    expect(history.body.history.at(-1).status).toBe('applied');
    const reset = await request('/api/config/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: true }) });
    expect(reset.body.config.profile).toBe('balanced');
  });

  it('rejects invalid JSON settings without replacing the existing file', async () => {
    const configFile = getStoragePaths(root).configFile;
    await fs.writeFile(configFile, '{ invalid json', 'utf8');
    const invalid = await request('/api/config', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...DEFAULT_CONFIG, profile: 'bad' }) });
    expect(invalid.status).toBe(400);
    expect(await fs.readFile(configFile, 'utf8')).toBe('{ invalid json');
  });

  it('deletes configuration history only after confirmation', async () => {
    await request('/api/config/history', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: false }) });
    const rejected = await request('/api/config/history', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: false }) });
    expect(rejected.status).toBe(400);
    const deleted = await request('/api/config/history', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: true }) });
    expect(deleted.body.history).toEqual([]);
  });
});

describe('feedback API', () => {
  const feedback = { date: '2026-08-02', projectAlias: '작은 앱 A', taskType: 'feature', profile: 'balanced', activeFeatures: ['changeSummary'], perceivedLength: 'appropriate', understandable: 'yes', mostUsefulFeature: '변경 요약', unnecessaryFeature: '', missingInfo: '', inaccurateContent: '', reuseConfig: 'yes', improvementIdea: '없음', severity: 'low', status: 'noted' };

  it('creates, updates, deletes one, and deletes all feedback', async () => {
    const created = await request('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(feedback) });
    expect(created.status).toBe(201);
    const id = created.body.feedback.id;
    const updated = await request(`/api/feedback/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...feedback, status: 'confirmed' }) });
    expect(updated.body.feedback.status).toBe('confirmed');
    const removed = await request(`/api/feedback/${id}`, { method: 'DELETE' });
    expect(removed.body.feedback).toEqual([]);
    await request('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(feedback) });
    const all = await request('/api/feedback', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: true }) });
    expect(all.body.feedback).toEqual([]);
  });

  it('does not accept a path-like feedback identifier', async () => {
    const response = await request('/api/feedback/not-a-path');
    expect(response.status).toBe(400);
  });
});
