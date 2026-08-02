import { spawn, type ChildProcess } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export type McpRuntimeState = { state: 'running' | 'stopped' | 'starting' | 'error'; error?: string };
let child: ChildProcess | undefined;
let state: McpRuntimeState = { state: 'stopped' };

function serverEntry(projectRoot: string) {
  const configured = process.env.BEGINNER_BRIDGE_MCP_SERVER;
  return configured && path.isAbsolute(configured) ? configured : path.join(projectRoot, 'apps', 'mcp-server', 'dist', 'index.js');
}

export function getMcpRuntimeState(): McpRuntimeState {
  return { ...state };
}

export async function startMcpRuntime(projectRoot: string) {
  if (child && state.state === 'running') return getMcpRuntimeState();
  try { await fs.access(serverEntry(projectRoot)); } catch { throw new Error('MCP 서버 빌드가 없습니다. 먼저 apps/mcp-server에서 npm run build를 실행하세요.'); }
  state = { state: 'starting' };
  const processHandle = spawn(process.execPath, [serverEntry(projectRoot)], {
    cwd: projectRoot,
    stdio: ['pipe', 'ignore', 'ignore'],
    windowsHide: true,
  });
  child = processHandle;
  processHandle.once('spawn', () => { state = { state: 'running' }; });
  processHandle.once('error', () => { child = undefined; state = { state: 'error', error: 'MCP 서버를 시작하지 못했습니다.' }; });
  processHandle.once('exit', (code) => { child = undefined; if (state.state !== 'error') state = code === 0 ? { state: 'stopped' } : { state: 'error', error: 'MCP 서버가 예기치 않게 종료되었습니다.' }; });
  await new Promise((resolve) => setTimeout(resolve, 25));
  return getMcpRuntimeState();
}

export async function stopMcpRuntime() {
  if (!child) { state = { state: 'stopped' }; return getMcpRuntimeState(); }
  child.stdin?.end();
  child.kill();
  child = undefined;
  state = { state: 'stopped' };
  return getMcpRuntimeState();
}
