import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';
import type { CliIo } from '../types.js';

export function codexDetected() {
  const result = spawnSync(process.platform === 'win32' ? 'codex.cmd' : 'codex', ['--version'], { stdio: 'ignore', windowsHide: true });
  return result.status === 0;
}

export function nodeMajorVersion() {
  const match = process.versions.node.match(/^(\d+)/);
  return match ? Number(match[1]) : 0;
}

export function operatingSystem() {
  if (process.platform === 'win32') return 'Windows';
  if (process.platform === 'darwin') return 'macOS';
  if (process.platform === 'linux') return 'Linux';
  return os.platform();
}

export async function openBrowser(url: string, io: CliIo) {
  try {
    const command = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
    const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
  } catch {
    io.write('기본 브라우저를 열지 못했습니다. 위 URL을 직접 열어주세요.');
  }
}
