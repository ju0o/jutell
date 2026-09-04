import { spawn } from 'node:child_process';

export type McpProbeResult = {
  ok: boolean;
  toolCount: number;
  serverName: string;
  error?: string;
};

const PROTOCOL_VERSION = '2025-03-26';
const TIMEOUT_MS = 15000;
const SHUTDOWN_GRACE_MS = 1500;

const INITIALIZE = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'jutell-doctor', version: '1.1.0' } },
});
const INITIALIZED = JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' });
const TOOLS_LIST = JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });

type ParsedMessage = {
  id?: unknown;
  result?: { serverInfo?: { name?: string }; tools?: unknown[] };
  error?: { message?: string };
};

function tryParse(line: string): ParsedMessage | undefined {
  try { return JSON.parse(line.trim()) as ParsedMessage; } catch { return undefined; }
}

export function probeMcpServer(entry: string): Promise<McpProbeResult> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [entry], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let buffer = '';
    let stderrText = '';
    let settled: McpProbeResult | undefined;
    let initializedSent = false;
    let toolsListSent = false;
    let receivedInitialize = false;
    let receivedTools = false;
    let serverName = '';

    const finish = (result: McpProbeResult) => {
      if (settled) return;
      settled = result;
      clearTimeout(timeout);
      try { child.stdin.end(); } catch { /* stdin already closed */ }
      try { child.kill(); } catch { /* already exited */ }
      const fallback = setTimeout(() => resolve(result), SHUTDOWN_GRACE_MS);
      child.once('exit', () => { clearTimeout(fallback); resolve(result); });
    };

    const timeout = setTimeout(() => {
      const phase = !receivedInitialize ? 'initialize 응답' : !receivedTools ? 'tools/list 응답' : '종료';
      const detail = stderrText.trim().slice(0, 200);
      finish({ ok: false, toolCount: 0, serverName, error: `${phase} 시간 초과${detail ? `: ${detail}` : ''}` });
    }, TIMEOUT_MS);

    const handleMessage = (message: ParsedMessage) => {
      if (message.id === 1) {
        receivedInitialize = true;
        if (message.error) {
          finish({ ok: false, toolCount: 0, serverName, error: `initialize 실패: ${message.error.message ?? '알 수 없는 오류'}` });
          return;
        }
        const name = message.result?.serverInfo?.name;
        if (typeof name === 'string') serverName = name;
        if (!initializedSent) {
          initializedSent = true;
          try { child.stdin.write(`${INITIALIZED}\n`); } catch { /* closed */ }
        }
        if (!toolsListSent) {
          toolsListSent = true;
          try { child.stdin.write(`${TOOLS_LIST}\n`); } catch { /* closed */ }
        }
        return;
      }
      if (message.id === 2) {
        receivedTools = true;
        if (message.error) {
          finish({ ok: false, toolCount: 0, serverName, error: `tools/list 실패: ${message.error.message ?? '알 수 없는 오류'}` });
          return;
        }
        const tools = message.result?.tools ?? [];
        finish({ ok: true, toolCount: tools.length, serverName });
        return;
      }
    };

    child.stdout.on('data', (chunk) => {
      buffer += String(chunk);
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.trim()) {
          const message = tryParse(line);
          if (message) handleMessage(message);
        }
        newlineIndex = buffer.indexOf('\n');
      }
    });

    child.stderr.on('data', (chunk) => { stderrText += String(chunk); });

    child.once('error', (error) => {
      finish({ ok: false, toolCount: 0, serverName, error: `프로세스 시작 실패: ${error.message}` });
    });

    child.once('exit', (code) => {
      if (settled) return;
      const detail = stderrText.trim().slice(0, 200);
      const phase = !receivedInitialize ? 'initialize 전' : !receivedTools ? 'tools/list 전' : '응답 후';
      finish({ ok: false, toolCount: 0, serverName, error: `프로세스가 ${phase} 종료됨(code ${code})${detail ? `: ${detail}` : ''}` });
    });

    try {
      child.stdin.write(`${INITIALIZE}\n`);
    } catch (error) {
      finish({ ok: false, toolCount: 0, serverName, error: `initialize 전송 실패: ${error instanceof Error ? error.message : String(error)}` });
    }
  });
}