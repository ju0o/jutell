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
  it('rejects an unknown Profile, Feature, and invalid limit', () => {
    expect(validateConfig({ ...DEFAULT_CONFIG, profile: 'unknown' }).ok).toBe(false);
    expect(validateConfig({ ...DEFAULT_CONFIG, features: { ...DEFAULT_CONFIG.features, unknown: true } }).ok).toBe(false);
    expect(validateConfig({ ...DEFAULT_CONFIG, limits: { ...DEFAULT_CONFIG.limits, maxMainFiles: 0 } }).ok).toBe(false);
    expect(validateConfig({ ...DEFAULT_CONFIG, mcp: { enabled: true, autoStart: false, unsupported: true } }).ok).toBe(false);
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
