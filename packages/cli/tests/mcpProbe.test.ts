import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { probeMcpServer } from '../src/process/mcpProbe.js';

const temporaryRoots: string[] = [];

async function mkdtemp() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-mcprobe-'));
  temporaryRoots.push(dir);
  return dir;
}

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) await fs.rm(root, { recursive: true, force: true });
});

function writeMockServer(dir: string, options: { mode: 'ok' | 'chunked' | 'stderr-noise' | 'wrong-protocol' | 'exit-immediately' | 'slow' | 'bad-json' }) {
  const file = path.join(dir, 'server.mjs');
  const initJson = JSON.stringify({ jsonrpc: '2.0', id: 1, result: { serverInfo: { name: 'mock' }, capabilities: {} } });
  const toolsJson = JSON.stringify({ jsonrpc: '2.0', id: 2, result: { tools: [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }, { name: 'e' }] } });
  let body: string;
  if (options.mode === 'exit-immediately') {
    body = 'process.exit(1);\n';
  } else if (options.mode === 'bad-json') {
    body = "process.stdout.write('not-json\\n');\nsetTimeout(() => process.exit(0), 200);\n";
  } else if (options.mode === 'wrong-protocol') {
    body = "process.stdin.on('data', () => { process.stdout.write('hello\\n'); });\nsetTimeout(() => process.exit(0), 400);\n";
  } else if (options.mode === 'slow') {
    body = `process.stdin.on('data', () => {});
      setTimeout(() => {
        process.stdout.write(${JSON.stringify(initJson)} + '\\n');
        process.stdout.write(${JSON.stringify(toolsJson)} + '\\n');
      }, 400);
    `;
  } else if (options.mode === 'chunked') {
    body = `
      let buf = '';
      process.stdin.on('data', (chunk) => {
        buf += chunk.toString();
        let idx = buf.indexOf('\\n');
        while (idx !== -1) {
          const line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (!line.trim()) { idx = buf.indexOf('\\n'); continue; }
          const msg = JSON.parse(line);
          if (msg.id === 1) {
            process.stdout.write(${JSON.stringify(initJson)} + '\\n');
            process.stdout.write(${JSON.stringify(toolsJson)} + '\\n');
          }
          idx = buf.indexOf('\\n');
        }
      });
    `;
  } else {
    const stderrNoise = options.mode === 'stderr-noise' ? "process.stderr.write('boot log line\\n');\n  " : '';
    body = `
      ${stderrNoise}let buf = '';
      process.stdin.on('data', (chunk) => {
        buf += chunk.toString();
        let idx = buf.indexOf('\\n');
        while (idx !== -1) {
          const line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (!line.trim()) { idx = buf.indexOf('\\n'); continue; }
          const msg = JSON.parse(line);
          if (msg.id === 1) {
            process.stdout.write(${JSON.stringify(initJson)} + '\\n');
            process.stdout.write(${JSON.stringify(toolsJson)} + '\\n');
          }
          idx = buf.indexOf('\\n');
        }
      });
    `;
  }
  return fs.writeFile(file, body, 'utf8').then(() => file);
}

describe('MCP stdio probe', () => {
  it('initialize → initialized → tools/list 흐름으로 5개 도구를 받는다', async () => {
    const dir = await mkdtemp();
    const entry = await writeMockServer(dir, { mode: 'ok' });
    const r = await probeMcpServer(entry);
    expect(r.ok).toBe(true);
    expect(r.toolCount).toBe(5);
    expect(r.serverName).toBe('mock');
  }, 10000);

  it('응답이 청크로 분할돼도 파싱한다', async () => {
    const dir = await mkdtemp();
    const entry = await writeMockServer(dir, { mode: 'chunked' });
    const r = await probeMcpServer(entry);
    expect(r.ok).toBe(true);
    expect(r.toolCount).toBe(5);
  }, 10000);

  it('stderr에 로그가 있어도 stdout 응답에 영향을 주지 않는다', async () => {
    const dir = await mkdtemp();
    const entry = await writeMockServer(dir, { mode: 'stderr-noise' });
    const r = await probeMcpServer(entry);
    expect(r.ok).toBe(true);
  }, 10000);

  it('initialize 응답이 없으면 timeout 또는 프로세스 종료로 실패한다', async () => {
    const dir = await mkdtemp();
    const entry = await writeMockServer(dir, { mode: 'wrong-protocol' });
    const r = await probeMcpServer(entry);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/시간 초과|종료/);
  }, 20000);

  it('프로세스가 즉시 종료하면 실패 메시지에 stderr가 포함된다', async () => {
    const dir = await mkdtemp();
    const entry = await writeMockServer(dir, { mode: 'exit-immediately' });
    const r = await probeMcpServer(entry);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/종료|초과/);
  }, 20000);

  it('잘못된 entry 경로는 프로세스 시작 실패로 처리한다', async () => {
    const r = await probeMcpServer(path.join(os.tmpdir(), 'jutell-nonexistent-entry.mjs'));
    expect(r.ok).toBe(false);
  }, 10000);

  it('이전 경로가 command에 남아 있으면 존재하지 않아 실패한다', async () => {
    const r = await probeMcpServer('D:\\jutell_deleted_dir\\mcp-server\\index.js');
    expect(r.ok).toBe(false);
  }, 10000);
});

describe('MCP stdio probe — full integration against built assets', () => {
  it('실제 JuTell MCP 서버 자산에서 initialize/tools/list 응답을 받는다', async () => {
    const packageRoot = path.resolve(import.meta.dirname, '..');
    const entry = path.join(packageRoot, 'assets', 'mcp-server', 'index.js');
    const exists = await fs.stat(entry).then(() => true).catch(() => false);
    if (!exists) {
      console.warn('skipped: assets/mcp-server/index.js not built');
      return;
    }
    const r = await probeMcpServer(entry);
    expect(r.ok).toBe(true);
    expect(r.toolCount).toBe(5);
  }, 20000);
});

describe('Windows provider command detection (shell:true resolution)', () => {
  it('node --version 명령을 shell:true로 실행하면 감지에 성공한다 (Windows .cmd 동작 회귀)', async () => {
    if (process.platform !== 'win32') return;
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync('node', ['--version'], { stdio: 'ignore', windowsHide: true, shell: true });
    expect(r.status).toBe(0);
    expect(r.error).toBeUndefined();
  });
  it('shell:false로 opencode.cmd를 직접 실행하면 EINVAL/ENOENT로 실패해야 한다 (회귀 전 동작 확인)', async () => {
    if (process.platform !== 'win32') return;
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync('opencode.cmd', ['--version'], { stdio: 'ignore', windowsHide: true });
    expect(r.status).not.toBe(0);
    expect(r.error).toBeTruthy();
  });
});

describe('Spawn helper parity (sanity)', () => {
  it('probeMcpServer는 child.stdin을 닫지 않은 채 응답을 기다린다', async () => {
    const dir = await mkdtemp();
    const file = path.join(dir, 'server.mjs');
    await fs.writeFile(file, `
      process.stdin.on('data', () => {});
      setTimeout(() => {
        const init = JSON.stringify({ jsonrpc: '2.0', id: 1, result: { serverInfo: { name: 'live' }, capabilities: {} } });
        process.stdout.write(init + '\\n');
        const tools = JSON.stringify({ jsonrpc: '2.0', id: 2, result: { tools: [{ name: 'x' }] } });
        process.stdout.write(tools + '\\n');
      }, 300);
    `, 'utf8');
    const r = await probeMcpServer(file);
    expect(r.ok).toBe(true);
    expect(r.serverName).toBe('live');
  }, 10000);
});