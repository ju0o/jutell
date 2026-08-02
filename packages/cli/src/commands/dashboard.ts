import { promises as fs } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { assets } from '../config/paths.js';
import { exists } from '../config/managed.js';
import { openBrowser } from '../process/system.js';
import type { CliIo, CliOptions, ScopePaths } from '../types.js';

const contentTypes: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

async function readMarker(file: string) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) as { pid?: number; port?: number }; } catch { return undefined; }
}

async function alive(pid: number | undefined) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function serveStatic(req: IncomingMessage, res: ServerResponse, root: string) {
  const requestPath = decodeURIComponent(new URL(req.url ?? '/', 'http://127.0.0.1').pathname);
  const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  if (!relative || relative.includes('..')) { res.statusCode = 400; res.end('잘못된 요청입니다.'); return; }
  const file = path.join(root, relative);
  if (!(await exists(file))) { res.statusCode = 404; res.end('파일을 찾을 수 없습니다.'); return; }
  res.statusCode = 200;
  res.setHeader('Content-Type', contentTypes[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  res.end(await fs.readFile(file));
}

export async function dashboardCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  const marker = path.join(paths.dataRoot, 'dashboard.json');
  const existing = await readMarker(marker);
  if (existing && await alive(existing.pid)) {
    const url = `http://127.0.0.1:${existing.port}`;
    io.write(`로컬 관리자 화면이 이미 실행 중입니다.\n${url}`);
    if (options.openBrowser) await openBrowser(url, io);
    return { started: false, url };
  }
  await fs.rm(marker, { force: true });
  process.env.BEGINNER_BRIDGE_MCP_SERVER = path.join(assets().mcpServer, 'index.js');
  const module = await import(pathToFileURL(assets().localAdminServer).href) as { handleApiRequest: (req: IncomingMessage, res: ServerResponse, projectRoot: string) => Promise<void> };
  const server = createServer((req, res) => {
    if ((req.url ?? '/').startsWith('/api/')) void module.handleApiRequest(req, res, paths.targetRoot);
    else void serveStatic(req, res, assets().localAdmin);
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); }); });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await fs.mkdir(paths.dataRoot, { recursive: true });
  await fs.writeFile(marker, `${JSON.stringify({ pid: process.pid, port })}\n`, 'utf8');
  const url = `http://127.0.0.1:${port}`;
  io.write(`Beginner Bridge 로컬 관리자를 실행했습니다.\n${url}\n종료하려면 이 터미널에서 Ctrl+C를 누르세요.`);
  if (options.openBrowser) await openBrowser(url, io);
  const close = async () => { await fs.rm(marker, { force: true }); server.close(); };
  process.once('SIGINT', () => void close().then(() => process.exit(0)));
  process.once('SIGTERM', () => void close().then(() => process.exit(0)));
  await new Promise<void>((resolve) => server.once('close', resolve));
  return { started: true, url };
}
