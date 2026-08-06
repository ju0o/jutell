import { spawn } from 'node:child_process';

export type McpProbeResult = {
  ok: boolean;
  toolCount: number;
  serverName: string;
  error?: string;
};

const INITIALIZE = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'jutell-doctor', version: '0.2.0' } },
});
const INITIALIZED = JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' });
const TOOLS_LIST = JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });

export function probeMcpServer(entry: string): Promise<McpProbeResult> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [entry], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let output = '';
    let errorText = '';
    let settled: McpProbeResult | undefined;
    const settle = (result: McpProbeResult) => {
      if (settled) return;
      settled = result;
      clearTimeout(timeout);
      try { child.kill(); } catch { /* already exited */ }
      const fallback = setTimeout(() => resolve(result), 1500);
      child.once('exit', () => { clearTimeout(fallback); resolve(result); });
    };
    const timeout = setTimeout(() => settle({ ok: false, toolCount: 0, serverName: '', error: '응답 시간 초과' }), 8000);
    child.stdout.on('data', (chunk) => {
      output += String(chunk);
      for (const line of output.split('\n')) {
        if (!line.trim()) continue;
        let message: { id?: unknown; result?: { serverInfo?: { name?: string }; tools?: unknown[] }; error?: { message?: string } } | undefined;
        try { message = JSON.parse(line.trim()); } catch { continue; }
        if (message?.id === 1) {
          if (message.error) { settle({ ok: false, toolCount: 0, serverName: '', error: message.error.message ?? 'initialize 오류' }); return; }
        }
        if (message?.id === 2) {
          const tools = message.result?.tools ?? [];
          settle({ ok: !message.error, toolCount: tools.length, serverName: '', error: message.error?.message });
          return;
        }
      }
    });
    child.stderr.on('data', (chunk) => { errorText += String(chunk); });
    child.once('error', (error) => settle({ ok: false, toolCount: 0, serverName: '', error: error.message }));
    child.once('exit', (code) => {
      if (settled) return;
      const detail = errorText.trim().slice(0, 200);
      settle({ ok: false, toolCount: 0, serverName: '', error: `프로세스가 종료됨(code ${code})${detail ? `: ${detail}` : ''}` });
    });
    child.stdin.write(`${INITIALIZE}\n`);
    child.stdin.write(`${INITIALIZED}\n`);
    child.stdin.write(`${TOOLS_LIST}\n`);
    child.stdin.end();
  });
}