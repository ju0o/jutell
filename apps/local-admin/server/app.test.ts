import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  it('accepts an older configuration without the optional mcp section', () => {
    const { mcp, ...oldConfig } = DEFAULT_CONFIG;
    void mcp;
    const result = validateConfig(oldConfig);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.mcp).toEqual({ enabled: false, autoStart: false });
  });
  it('fills missing helper feature keys with the selected Profile defaults', () => {
    const { nextActionSuggestions, requestClarificationGuide, manualEditGuidance, requestBuilder, ...oldFeatures } = DEFAULT_CONFIG.features;
    void nextActionSuggestions; void requestClarificationGuide; void manualEditGuidance; void requestBuilder;
    const minimal = { version: 1, profile: 'minimal' as const, features: oldFeatures, limits: { maxMainFiles: 3, maxGlossaryTerms: 1, compactReportMaxSentences: 8 } };
    const result = validateConfig(minimal);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.features.nextActionSuggestions).toBe(false);
      expect(result.value.features.requestClarificationGuide).toBe(false);
      expect(result.value.features.manualEditGuidance).toBe(false);
      expect(result.value.features.requestBuilder).toBe(true);
    }
  });
  it('rejects an unknown Profile, Feature, and invalid limit', () => {
    expect(validateConfig({ ...DEFAULT_CONFIG, profile: 'unknown' }).ok).toBe(false);
    expect(validateConfig({ ...DEFAULT_CONFIG, features: { ...DEFAULT_CONFIG.features, unknown: true } }).ok).toBe(false);
    expect(validateConfig({ ...DEFAULT_CONFIG, limits: { ...DEFAULT_CONFIG.limits, maxMainFiles: 0 } }).ok).toBe(false);
    expect(validateConfig({ ...DEFAULT_CONFIG, mcp: { enabled: true, autoStart: false, unsupported: true } }).ok).toBe(false);
  });
  it('accepts an older configuration without usageMeasurement and defaults to OFF', () => {
    const { usageMeasurement, ...oldConfig } = DEFAULT_CONFIG;
    void usageMeasurement;
    const result = validateConfig(oldConfig);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.usageMeasurement).toEqual({ localCountersEnabled: false });
  });
  it('rejects a non-boolean usageMeasurement setting', () => {
    expect(validateConfig({ ...DEFAULT_CONFIG, usageMeasurement: { localCountersEnabled: 'yes' } }).ok).toBe(false);
  });
});

describe('local config API', () => {
  it('깨끗한 저장소에서 동시 첫 요청을 처리하고 서버를 계속 유지한다', async () => {
    const paths = getStoragePaths(root);
    const routes = ['/api/config', '/api/readiness', '/api/mcp/status', '/api/config/history', '/api/feedback'];
    const responses = await Promise.all(Array.from({ length: 12 }, (_, index) => request(routes[index % routes.length])));

    expect(responses.every((response) => response.status === 200)).toBe(true);
    for (const file of [paths.feedbackFile, paths.historyFile, paths.metadataFile]) {
      expect(JSON.parse(await fs.readFile(file, 'utf8'))).toBeDefined();
    }
    expect((await fs.readdir(paths.localDir)).filter((file) => file.endsWith('.tmp'))).toEqual([]);
    expect((await request('/api/config')).status).toBe(200);
    expect((await request('/api/mcp/status')).status).toBe(200);
    expect((await request('/api/feedback')).status).toBe(200);
  });

  it('기존 피드백을 동시 초기화 중에도 보존한다', async () => {
    const paths = getStoragePaths(root);
    const existing = [{ id: 'existing-feedback', status: 'noted' }];
    await fs.mkdir(paths.localDir, { recursive: true });
    await fs.writeFile(paths.feedbackFile, `${JSON.stringify(existing)}\n`, 'utf8');

    await Promise.all(Array.from({ length: 10 }, () => request('/api/config')));

    expect(JSON.parse(await fs.readFile(paths.feedbackFile, 'utf8'))).toEqual(existing);
  });

  it('같은 밀리초에도 원자 저장 임시 파일 이름이 충돌하지 않는다', async () => {
    const paths = getStoragePaths(root);
    const file = path.join(paths.localDir, 'same-millisecond.json');
    const now = vi.spyOn(Date, 'now').mockReturnValue(1785698841804);
    try {
      await Promise.all(Array.from({ length: 10 }, (_, index) => writeJsonAtomically(file, { index })));
    } finally {
      now.mockRestore();
    }

    expect(JSON.parse(await fs.readFile(file, 'utf8'))).toHaveProperty('index');
    expect((await fs.readdir(paths.localDir)).filter((name) => name.includes('same-millisecond') && name.endsWith('.tmp'))).toEqual([]);
  });

  it('저장 초기화 실패를 안전한 API 오류로 반환하고 서버를 유지한다', async () => {
    const invalidRoot = path.join(root, 'not-a-project-directory');
    await fs.writeFile(invalidRoot, 'not a directory', 'utf8');
    const started = await startLocalAdminServer({ projectRoot: invalidRoot, port: 0 });
    const invalidBase = `http://127.0.0.1:${started.port}`;
    try {
      const first = await fetch(`${invalidBase}/api/config`);
      const firstBody = await first.json() as { error?: string };
      expect(first.status).toBe(500);
      expect(firstBody.error).toBe('로컬 저장을 처리하지 못했습니다.');
      expect(firstBody.error).not.toContain('not-a-project-directory');

      const second = await fetch(`${invalidBase}/api/config`);
      expect(second.status).toBe(500);
    } finally {
      await new Promise<void>((resolve) => started.server.close(() => resolve()));
    }
  });

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

  it('reports repository readiness without claiming the current session applied the Skill', async () => {
    const readiness = await request('/api/readiness');
    expect(readiness.status).toBe(200);
    expect(readiness.body.sessionApplied).toBe('manual_check_required');
    expect(readiness.body.agents.jutellBlock).toBe(false);
    expect(readiness.body.config.valid).toBe(true);
  });

  it('keeps MCP status separate from Codex tool connection and preserves Skill fallback', async () => {
    const status = await request('/api/mcp/status');
    expect(status.status).toBe(200);
    expect(status.body.server.state).toBe('stopped');
    expect(status.body.preparation).toBe('not_registered');
    expect(status.body.connection.state).toBe('not_checked');
    expect(status.body.skillFallback.available).toBe(true);
    const start = await request('/api/mcp/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(start.status).toBe(409);
    const checked = await request('/api/mcp/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(checked.body.connection.state).toBe('not_checked');
  });

  it('previews, adds, and removes only the managed Codex MCP block', async () => {
    const codexDir = path.join(root, '.codex');
    await fs.mkdir(codexDir, { recursive: true });
    const codexFile = path.join(codexDir, 'config.toml');
    await fs.writeFile(codexFile, '[mcp_servers.other]\ncommand = "other"\n', 'utf8');
    const preview = await request('/api/mcp/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(preview.body.path).toBe('.codex/config.toml');
    expect(preview.body.preview).toContain('apps/mcp-server/dist/index.js');
    expect(preview.body.preview).not.toContain(root);
    const registered = await request('/api/mcp/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: true }) });
    expect(registered.status).toBe(200);
    const afterRegister = await fs.readFile(codexFile, 'utf8');
    expect(afterRegister).toContain('[mcp_servers.other]');
    expect(afterRegister).toContain('# BEGINNER_BRIDGE_MCP_BEGIN');
    expect(await fs.readFile(`${codexFile}.previous`, 'utf8')).toContain('[mcp_servers.other]');
    const removed = await request('/api/mcp/remove', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: true }) });
    expect(removed.status).toBe(200);
    const afterRemove = await fs.readFile(codexFile, 'utf8');
    expect(afterRemove).toContain('[mcp_servers.other]');
    expect(afterRemove).not.toContain('# BEGINNER_BRIDGE_MCP_BEGIN');
  });

  it('rejects invalid JSON settings without replacing the existing file', async () => {
    const configFile = getStoragePaths(root).configFile;
    await fs.writeFile(configFile, '{ invalid json', 'utf8');
    const invalid = await request('/api/config', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...DEFAULT_CONFIG, profile: 'bad' }) });
    expect(invalid.status).toBe(400);
    expect(await fs.readFile(configFile, 'utf8')).toBe('{ invalid json');
  });

  it('reports provider statuses without claiming detection', async () => {
    const status = await request('/api/mcp/status');
    expect(status.status).toBe(200);
    expect(status.body.providers).toHaveLength(4);
    const ids = status.body.providers.map((provider: { id: string }) => provider.id);
    expect(ids).toEqual(['codex', 'opencode', 'claude-code', 'cline']);
    const codex = status.body.providers.find((provider: { id: string }) => provider.id === 'codex');
    expect(codex).toMatchObject({ status: 'supported', registered: false, conflict: false, enabled: false });
    const planned = status.body.providers.find((provider: { id: string }) => provider.id === 'claude-code');
    expect(planned).toMatchObject({ status: 'planned', detected: false, registered: false });
    expect(typeof codex.detected).toBe('boolean');
  });

  it('connects OpenCode with confirmation and preserves the Codex entry', async () => {
    const opencodeFile = path.join(root, 'opencode.json');
    await fs.writeFile(opencodeFile, JSON.stringify({ model: 'deepseek/deepseek-chat', mcp: { jira: { type: 'remote', url: 'https://example.com/mcp' } } }, null, 2), 'utf8');
    const rejected = await request('/api/mcp/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'opencode', confirm: false }) });
    expect(rejected.status).toBe(400);
    const connected = await request('/api/mcp/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'opencode', confirm: true }) });
    expect(connected.status).toBe(200);
    const opencode = connected.body.providers.find((provider: { id: string }) => provider.id === 'opencode');
    expect(opencode).toMatchObject({ registered: true, enabled: true });
    const text = await fs.readFile(opencodeFile, 'utf8');
    expect(text).toContain('"jira"');
    expect(text).toContain('// BEGIN JUTELL MANAGED BLOCK');
    const config = (await request('/api/config')).body.config;
    expect(config.mcp.enabled).toBe(true);
    expect(await fs.readFile(`${opencodeFile}.previous`, 'utf8')).toContain('deepseek-chat');
  });

  it('disconnects only the selected provider', async () => {
    await request('/api/mcp/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'codex', confirm: true }) });
    const opencodeFile = path.join(root, 'opencode.json');
    await fs.writeFile(opencodeFile, JSON.stringify({ mcp: { jira: {} } }, null, 2), 'utf8');
    await request('/api/mcp/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'opencode', confirm: true }) });
    const disconnected = await request('/api/mcp/disconnect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'opencode', confirm: true }) });
    expect(disconnected.status).toBe(200);
    const opencode = disconnected.body.providers.find((provider: { id: string }) => provider.id === 'opencode');
    const codex = disconnected.body.providers.find((provider: { id: string }) => provider.id === 'codex');
    expect(opencode).toMatchObject({ registered: true, enabled: false });
    expect(codex).toMatchObject({ registered: true, enabled: true });
    const config = (await request('/api/config')).body.config;
    expect(config.mcp.enabled).toBe(true);
  });

  it('switches the default provider and deactivates the other', async () => {
    const opencodeFile = path.join(root, 'opencode.json');
    await fs.writeFile(opencodeFile, JSON.stringify({ model: 'deepseek/deepseek-chat' }, null, 2), 'utf8');
    await request('/api/mcp/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'codex', confirm: true }) });
    await request('/api/mcp/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'opencode', confirm: true }) });
    const switched = await request('/api/mcp/set-default', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'opencode', confirm: true }) });
    expect(switched.status).toBe(200);
    const opencode = switched.body.providers.find((provider: { id: string }) => provider.id === 'opencode');
    const codex = switched.body.providers.find((provider: { id: string }) => provider.id === 'codex');
    expect(opencode).toMatchObject({ registered: true, enabled: true });
    expect(codex).toMatchObject({ registered: true, enabled: false });
  });

  it('rejects provider actions for planned agents', async () => {
    const response = await request('/api/mcp/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'cline', confirm: true }) });
    expect(response.status).toBe(400);
  });

  it('deletes configuration history only after confirmation', async () => {
    await request('/api/config/history', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: false }) });
    const rejected = await request('/api/config/history', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: false }) });
    expect(rejected.status).toBe(400);
    const deleted = await request('/api/config/history', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: true }) });
    expect(deleted.body.history).toEqual([]);
  });

  it('reports unavailable templates and returns project templates with content', async () => {
    const unavailable = await request('/api/request-templates');
    expect(unavailable.status).toBe(200);
    expect(unavailable.body.source).toBe('unavailable');
    expect(unavailable.body.templates).toEqual([]);

    const templateDir = path.join(root, 'templates', 'request-builder');
    await fs.mkdir(templateDir, { recursive: true });
    await fs.writeFile(path.join(templateDir, 'README.md'), '# Request Builder\n', 'utf8');
    await fs.writeFile(path.join(templateDir, 'FEATURE_REQUEST.md'), '# 기능 요청서\n', 'utf8');
    const available = await request('/api/request-templates');
    expect(available.status).toBe(200);
    expect(available.body.source).toBe('project');
    expect(available.body.templates.map((item: { name: string }) => item.name)).toContain('FEATURE_REQUEST.md');
    expect(available.body.templates.find((item: { name: string }) => item.name === 'FEATURE_REQUEST.md').content).toBe('# 기능 요청서\n');
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

describe('usage experiments API', () => {
  async function exists(file: string) {
    try { await fs.access(file); return true; } catch { return false; }
  }

  it('creates no files while recording is OFF and rejects template copies', async () => {
    const paths = getStoragePaths(root);
    const list = await request('/api/usage-experiments');
    expect(list.status).toBe(200);
    expect(list.body.experiments).toEqual([]);
    const counters = await request('/api/usage-counters');
    expect(counters.status).toBe(200);
    expect(counters.body.exists).toBe(false);
    expect(await exists(paths.usageCountersFile)).toBe(false);
    expect(await exists(paths.usageExperimentsFile)).toBe(false);
    const copy = await request('/api/usage-experiments/template-copy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ template: 'FEATURE_REQUEST.md', taskType: 'feature' }) });
    expect(copy.status).toBe(409);
    expect(await exists(paths.usageCountersFile)).toBe(false);
  });

  it('creates, updates, summarizes, and deletes all experiments', async () => {
    const paths = getStoragePaths(root);
    const created = await request('/api/usage-experiments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: '보고서 길이 비교', profile: 'balanced', features: ['changeSummary', 'glossary'], environment: { provider: 'codex', mcpEnabled: true, skillEnabled: true } }) });
    expect(created.status).toBe(201);
    expect(created.body.experiment.id).toBe('EXP-001');
    expect(created.body.experiment.features).toEqual(['changeSummary', 'glossary']);

    const patched = await request('/api/usage-experiments/EXP-001', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'completed', evaluation: { understanding: 5, readability: 4, accuracy: 5, overall: 5 }, issues: ['용어 설명이 길다'], decision: 'balanced 유지' }) });
    expect(patched.status).toBe(200);
    expect(patched.body.experiment.evaluation.understanding).toBe(5);

    const list = await request('/api/usage-experiments');
    expect(list.body.summary.completed).toBe(1);
    expect(list.body.summary.averageUnderstanding).toBe(5);
    expect(list.body.summary.mostUsedProfile).toBe('balanced');
    expect(list.body.summary.mostDisabledFeatures).toContain('internalChanges');

    const invalid = await request('/api/usage-experiments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: '' }) });
    expect(invalid.status).toBe(400);
    const missing = await request('/api/usage-experiments/EXP-999', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ decision: '유지' }) });
    expect(missing.status).toBe(404);

    const rejected = await request('/api/usage-experiments', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: false }) });
    expect(rejected.status).toBe(400);
    const deleted = await request('/api/usage-experiments', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: true }) });
    expect(deleted.status).toBe(200);
    expect(await exists(paths.usageExperimentsFile)).toBe(false);
  });

  it('records template copies and deletes counters after enabling the setting', async () => {
    const paths = getStoragePaths(root);
    const settings = await request('/api/usage-settings', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ localCountersEnabled: true }) });
    expect(settings.status).toBe(200);
    expect(settings.body.config.usageMeasurement.localCountersEnabled).toBe(true);
    expect(settings.body.changed).toBe(true);

    const copy = await request('/api/usage-experiments/template-copy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ template: 'FEATURE_REQUEST.md', taskType: 'feature' }) });
    expect(copy.status).toBe(200);
    const counters = await request('/api/usage-counters');
    expect(counters.body.counters.templateCopies['FEATURE_REQUEST.md'].count).toBe(1);
    expect(counters.body.counters.templateCopies['FEATURE_REQUEST.md'].byProfile.balanced).toBe(1);

    const bad = await request('/api/usage-experiments/template-copy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ template: '../../secret', taskType: 'x' }) });
    expect(bad.status).toBe(400);

    const rejected = await request('/api/usage-counters', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: false }) });
    expect(rejected.status).toBe(400);
    const deleted = await request('/api/usage-counters', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: true }) });
    expect(deleted.status).toBe(200);
    const after = await request('/api/usage-counters');
    expect(after.body.exists).toBe(false);

    expect(await exists(paths.feedbackFile)).toBe(true);
    expect(await exists(paths.historyFile)).toBe(true);
  });

  it('rejects a wrong usage-settings value', async () => {
    const settings = await request('/api/usage-settings', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ localCountersEnabled: 'yes' }) });
    expect(settings.status).toBe(400);
  });
});
