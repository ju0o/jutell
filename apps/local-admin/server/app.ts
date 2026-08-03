import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { changedFields, DEFAULT_CONFIG, validateConfig } from './config/schema.js';
import { ensureStorage, getStoragePaths, readArray, readConfig, readJson, saveFeedback, writeJsonAtomically, type StoragePaths } from './storage/files.js';
import { validateFeedback } from './validation/feedback.js';
import { readCodexMcpRegistration, registerCodexMcp, removeCodexMcp, readOpenCodeRegistration, registerOpenCodeMcp, setOpenCodeMcpEnabled, providerDetected } from './mcp/config.js';
import { getMcpRuntimeState, startMcpRuntime, stopMcpRuntime } from './mcp/runtime.js';
import type { Config, Feedback, Readiness } from './types.js';

const MAX_BODY_BYTES = 512 * 1024;
let writeQueue = Promise.resolve();
let lastMcpCheckAt: string | null = null;

function withWriteLock<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  writeQueue = run.then(() => undefined, () => undefined);
  return run;
}

function json(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(payload);
}

function error(res: ServerResponse, status: number, message: string) {
  json(res, status, { error: message });
}

async function body(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error('요청이 너무 큽니다.');
    chunks.push(buffer);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new Error('JSON 형식이 올바르지 않습니다.');
  }
}

async function getHistory(paths: StoragePaths) {
  return readArray<{ id: string; changedAt: string; changedFields: unknown[]; status: string }>(paths.historyFile);
}

async function getFeedback(paths: StoragePaths) {
  return readArray<Feedback>(paths.feedbackFile);
}

function safeId(value: string | undefined) {
  return Boolean(value && /^[0-9a-f-]{36}$/i.test(value));
}

async function updateHistory(paths: StoragePaths, entry: { id: string; changedAt: string; changedFields: unknown[]; status: string }) {
  const history = await getHistory(paths);
  const next = history.map((item) => item.id === entry.id ? entry : item);
  await writeJsonAtomically(paths.historyFile, next.slice(-100));
}

async function saveConfig(paths: StoragePaths, next: Config) {
  return withWriteLock(async () => {
    const current = (await readConfig(paths)).config;
    const changes = changedFields(current, next);
    if (changes.length === 0) return { config: next, changed: false, historyRecorded: true };
    const entry = { id: randomUUID(), changedAt: new Date().toISOString(), changedFields: changes, status: 'pending' };
    const history = await getHistory(paths);
    await writeJsonAtomically(paths.historyFile, [...history, entry].slice(-100));
    try {
      await writeJsonAtomically(paths.configFile, next);
    } catch {
      await updateHistory(paths, { ...entry, status: 'failed' });
      throw new Error('설정을 저장하지 못했습니다. 기존 설정을 유지했습니다.');
    }
    await updateHistory(paths, { ...entry, status: 'applied' });
    return { config: next, changed: true, historyRecorded: true };
  });
}

async function readOverview(paths: StoragePaths) {
  const result = await readConfig(paths);
  const history = await getHistory(paths);
  let metadata: { configVersion?: number; skillVersion?: string } = {};
  try { metadata = await readJson<typeof metadata>(paths.metadataFile); } catch { /* safe default */ }
  return {
    ...result,
    metadata,
    lastChangedAt: history.at(-1)?.changedAt ?? null,
  };
}

async function exists(file: string) {
  try { await fs.access(file); return true; } catch { return false; }
}

async function readReadiness(projectRoot: string, paths: StoragePaths): Promise<Readiness> {
  const configExists = await exists(paths.configFile) || await exists(paths.legacyConfigFile);
  const agentsPath = path.join(projectRoot, 'AGENTS.md');
  const skillPath = path.join(projectRoot, '.agents', 'skills', 'beginner-bridge', 'SKILL.md');
  const [agentsExists, skillExists] = await Promise.all([exists(agentsPath), exists(skillPath)]);
  const agentsText = agentsExists ? await fs.readFile(agentsPath, 'utf8') : '';
  let safetyExists = false;
  if (skillExists) {
    try {
      const skill = await fs.readFile(skillPath, 'utf8');
      safetyExists = skill.includes('비밀정보') && skill.includes('중요한 미확인 사항');
    } catch { safetyExists = false; }
  }
  const config = await readConfig(paths);
  return {
    config: { exists: configExists, valid: configExists && !config.fallback, profile: config.config.profile, activeFeatures: Object.values(config.config.features).filter(Boolean).length },
    skill: { exists: skillExists },
    agents: { exists: agentsExists, jutellBlock: agentsText.includes('<!-- BEGIN JUTELL MANAGED BLOCK -->') && agentsText.includes('<!-- END JUTELL MANAGED BLOCK -->') },
    safetyRules: { exists: safetyExists },
    sessionApplied: 'manual_check_required',
  };
}

async function readProviderStatuses(projectRoot: string, config: Config) {
  const [codex, opencode] = await Promise.all([
    readCodexMcpRegistration(projectRoot, config.mcp.enabled),
    readOpenCodeRegistration(projectRoot, config.mcp.enabled),
  ]);
  const base = { lastCheckedAt: lastMcpCheckAt };
  return [
    { id: 'codex', label: 'Codex', status: 'supported', detected: providerDetected('codex'), registered: codex.registered, conflict: codex.conflict, enabled: codex.enabled, ...base },
    { id: 'opencode', label: 'OpenCode', status: 'beta', detected: providerDetected('opencode'), registered: opencode.registered, conflict: opencode.conflict, enabled: opencode.enabled, ...base },
    { id: 'claude-code', label: 'Claude Code', status: 'planned', detected: false, registered: false, conflict: false, enabled: false, ...base },
    { id: 'cline', label: 'Cline', status: 'planned', detected: false, registered: false, conflict: false, enabled: false, ...base },
  ];
}

async function readMcpStatus(projectRoot: string, paths: StoragePaths) {
  const config = (await readConfig(paths)).config;
  const codex = await readCodexMcpRegistration(projectRoot, config.mcp.enabled);
  const preparation = codex.conflict ? 'error' : !codex.registered ? 'not_registered' : config.mcp.enabled ? 'enabled' : 'registered';
  return {
    settings: config.mcp,
    server: getMcpRuntimeState(),
    codex: { registered: codex.registered, path: codex.path, conflict: codex.conflict, enabled: codex.enabled },
    providers: await readProviderStatuses(projectRoot, config),
    preparation,
    connection: { state: 'not_checked' as const, lastCheckedAt: lastMcpCheckAt },
    skillFallback: { available: true, message: 'MCP를 끄거나 사용할 수 없어도 AGENTS.md, Skill, 설정 파일 방식은 계속 사용할 수 있습니다.' },
  };
}

type ProviderAction = 'connect' | 'disconnect' | 'default';

async function providerRequest(input: unknown): Promise<{ provider: 'codex' | 'opencode' } | { error: string }> {
  const value = input && typeof input === 'object' ? input as { provider?: unknown; confirm?: unknown } : {};
  const provider = value.provider;
  if (provider !== 'codex' && provider !== 'opencode') return { error: '연결할 Agent를 codex 또는 opencode 중에서 선택하세요.' };
  if (value.confirm !== true) return { error: 'Provider 연결 변경 확인이 필요합니다.' };
  return { provider };
}

async function applyProviderAction(projectRoot: string, provider: 'codex' | 'opencode', action: ProviderAction, config: Config) {
  const opencode = await readOpenCodeRegistration(projectRoot, config.mcp.enabled);
  const codex = await readCodexMcpRegistration(projectRoot, config.mcp.enabled);
  if (action === 'disconnect') {
    if (provider === 'codex') await registerCodexMcp(projectRoot, false);
    else await setOpenCodeMcpEnabled(projectRoot, false);
    return config;
  }
  if (action === 'default' && provider !== 'codex' && codex.registered && codex.enabled) await registerCodexMcp(projectRoot, false);
  if (action === 'default' && provider !== 'opencode' && opencode.registered && opencode.enabled) await setOpenCodeMcpEnabled(projectRoot, false);
  if (provider === 'codex') await registerCodexMcp(projectRoot, true);
  else await registerOpenCodeMcp(projectRoot, true);
  if (action === 'connect' || action === 'default') return { ...config, mcp: { ...config.mcp, enabled: true } };
  return config;
}

function confirmBody(input: unknown, message: string) {
  return Boolean(input && typeof input === 'object' && (input as { confirm?: unknown }).confirm === true) ? null : message;
}

export async function handleApiRequest(req: IncomingMessage, res: ServerResponse, projectRoot: string) {
  const paths = getStoragePaths(projectRoot);
  try {
    await ensureStorage(paths);
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const method = req.method ?? 'GET';
    if (!url.pathname.startsWith('/api/')) return error(res, 404, '요청한 주소를 찾을 수 없습니다.');

    if (method === 'GET' && url.pathname === '/api/config') return json(res, 200, await readOverview(paths));
    if (method === 'GET' && url.pathname === '/api/readiness') return json(res, 200, await readReadiness(projectRoot, paths));
    if (method === 'GET' && url.pathname === '/api/mcp/status') return json(res, 200, await readMcpStatus(projectRoot, paths));
    if (method === 'POST' && url.pathname === '/api/mcp/preview') {
      const config = (await readConfig(paths)).config;
      const codex = await readCodexMcpRegistration(projectRoot, config.mcp.enabled);
      return json(res, 200, { path: codex.path, preview: codex.preview, registered: codex.registered, conflict: codex.conflict, note: '프로젝트의 .codex/config.toml에 JuTell 관리 블록만 추가합니다.' });
    }
    if (method === 'POST' && url.pathname === '/api/mcp/register') {
      const errorMessage = confirmBody(await body(req), 'Codex 연결 설정 생성 확인이 필요합니다.');
      if (errorMessage) return error(res, 400, errorMessage);
      const config = (await readConfig(paths)).config;
      return json(res, 200, { registration: await registerCodexMcp(projectRoot, config.mcp.enabled) });
    }
    if (method === 'POST' && url.pathname === '/api/mcp/remove') {
      const errorMessage = confirmBody(await body(req), 'Codex 연결 설정 제거 확인이 필요합니다.');
      if (errorMessage) return error(res, 400, errorMessage);
      return json(res, 200, { registration: await removeCodexMcp(projectRoot) });
    }
    if (method === 'POST' && (url.pathname === '/api/mcp/connect' || url.pathname === '/api/mcp/disconnect' || url.pathname === '/api/mcp/set-default')) {
      const requested = await providerRequest(await body(req));
      if ('error' in requested) return error(res, 400, requested.error);
      const { provider } = requested;
      const action: ProviderAction = url.pathname === '/api/mcp/connect' ? 'connect' : url.pathname === '/api/mcp/disconnect' ? 'disconnect' : 'default';
      const config = (await readConfig(paths)).config;
      const next = await applyProviderAction(projectRoot, provider, action, config);
      if (action === 'connect' || action === 'default') await saveConfig(paths, next);
      return json(res, 200, { providers: await readProviderStatuses(projectRoot, next) });
    }
    if (method === 'POST' && url.pathname === '/api/mcp/start') {
      const config = (await readConfig(paths)).config;
      if (!config.mcp.enabled) return error(res, 409, 'MCP 연결이 꺼져 있습니다. 먼저 MCP 사용을 켜세요.');
      return json(res, 200, { server: await startMcpRuntime(projectRoot) });
    }
    if (method === 'POST' && url.pathname === '/api/mcp/stop') return json(res, 200, { server: await stopMcpRuntime() });
    if (method === 'POST' && url.pathname === '/api/mcp/check') {
      lastMcpCheckAt = new Date().toISOString();
      return json(res, 200, { connection: { state: 'not_checked', lastCheckedAt: lastMcpCheckAt, message: '실제 도구 호출 여부는 새 Codex 세션에서 직접 확인할 수 있습니다.' } });
    }
    if (method === 'GET' && url.pathname === '/api/config/history') return json(res, 200, { history: await getHistory(paths) });
    if (method === 'PUT' && url.pathname === '/api/config') {
      const result = validateConfig(await body(req));
      if (!result.ok) return error(res, 400, result.error);
      const saved = await saveConfig(paths, result.value);
      return json(res, 200, { ...saved, ...(await readOverview(paths)) });
    }
    if (method === 'POST' && url.pathname === '/api/config/reset') {
      const input = await body(req);
      if (!input || typeof input !== 'object' || (input as { confirm?: unknown }).confirm !== true) {
        return error(res, 400, '기본값 복원 확인이 필요합니다.');
      }
      const saved = await saveConfig(paths, structuredClone(DEFAULT_CONFIG));
      return json(res, 200, { ...saved, ...(await readOverview(paths)) });
    }
    if (method === 'DELETE' && url.pathname === '/api/config/history') {
      const input = await body(req);
      if (!input || typeof input !== 'object' || (input as { confirm?: unknown }).confirm !== true) {
        return error(res, 400, '설정 기록 삭제 확인이 필요합니다.');
      }
      await withWriteLock(() => writeJsonAtomically(paths.historyFile, []));
      return json(res, 200, { history: [] });
    }
    if (method === 'GET' && url.pathname === '/api/feedback') return json(res, 200, { feedback: await getFeedback(paths) });
    if (method === 'POST' && url.pathname === '/api/feedback') {
      const result = validateFeedback(await body(req));
      if (!result.ok) return error(res, 400, result.error);
      const now = new Date().toISOString();
      const item: Feedback = { ...result.value, id: randomUUID(), createdAt: now, updatedAt: now };
      await withWriteLock(async () => {
        const items = await getFeedback(paths);
        await saveFeedback(paths, [...items, item]);
      });
      return json(res, 201, { feedback: item });
    }
    const feedbackMatch = url.pathname.match(/^\/api\/feedback\/([^/]+)$/);
    if (feedbackMatch && !safeId(feedbackMatch[1])) return error(res, 400, '피드백 식별자가 올바르지 않습니다.');
    if (feedbackMatch && method === 'PUT') {
      const result = validateFeedback(await body(req));
      if (!result.ok) return error(res, 400, result.error);
      const item = await withWriteLock(async () => {
        const items = await getFeedback(paths);
        const index = items.findIndex((item) => item.id === feedbackMatch[1]);
        if (index < 0) return null;
        const updated: Feedback = { ...result.value, id: items[index].id, createdAt: items[index].createdAt, updatedAt: new Date().toISOString() };
        items[index] = updated;
        await saveFeedback(paths, items);
        return updated;
      });
      if (!item) return error(res, 404, '피드백을 찾을 수 없습니다.');
      return json(res, 200, { feedback: item });
    }
    if (feedbackMatch && method === 'DELETE') {
      const next = await withWriteLock(async () => {
        const items = await getFeedback(paths);
        const updated = items.filter((item) => item.id !== feedbackMatch[1]);
        if (updated.length === items.length) return null;
        await saveFeedback(paths, updated);
        return updated;
      });
      if (!next) return error(res, 404, '피드백을 찾을 수 없습니다.');
      return json(res, 200, { feedback: next });
    }
    if (method === 'DELETE' && url.pathname === '/api/feedback') {
      const input = await body(req);
      if (!input || typeof input !== 'object' || (input as { confirm?: unknown }).confirm !== true) {
        return error(res, 400, '피드백 전체 삭제 확인이 필요합니다.');
      }
      await withWriteLock(() => saveFeedback(paths, []));
      return json(res, 200, { feedback: [] });
    }
    return error(res, 404, '요청한 주소를 찾을 수 없습니다.');
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : '로컬 요청을 처리하지 못했습니다.';
    return error(res, 500, message.includes('요청이 너무 큽니다') || message.includes('JSON 형식') ? message : '로컬 저장을 처리하지 못했습니다.');
  }
}

export type LocalAdminServerOptions = { projectRoot: string; host?: string; port?: number };

export async function startLocalAdminServer(options: LocalAdminServerOptions): Promise<{ server: Server; port: number }> {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 8787;
  const server = createServer((req, res) => {
    void handleApiRequest(req, res, options.projectRoot);
  });
  server.once('close', () => { void stopMcpRuntime(); });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  return { server, port: typeof address === 'object' && address ? address.port : port };
}
