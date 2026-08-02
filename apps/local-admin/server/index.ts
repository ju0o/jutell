import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { startLocalAdminServer } from './app.js';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(appRoot, '../..');
const apiPort = Number(process.env.BB_LOCAL_ADMIN_PORT ?? 8787);
const host = '127.0.0.1';

const started = await startLocalAdminServer({ projectRoot, host, port: apiPort });
console.log(`Beginner Bridge local API: http://${host}:${started.port}`);

if (process.argv.includes('--dev')) {
  const viteEntry = path.join(appRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  const vite = spawn(process.execPath, [viteEntry, '--host', host], {
    cwd: appRoot,
    env: { ...process.env, BB_LOCAL_ADMIN_PORT: String(started.port) },
    stdio: 'inherit',
  });
  console.log(`Beginner Bridge local admin: http://${host}:${process.env.BB_LOCAL_ADMIN_VITE_PORT ?? 5174}`);
  const close = () => {
    vite.kill();
    started.server.close();
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
  vite.on('exit', (code) => {
    started.server.close();
    process.exit(code ?? 0);
  });
} else {
  process.on('SIGINT', () => started.server.close(() => process.exit(0)));
  process.on('SIGTERM', () => started.server.close(() => process.exit(0)));
}
