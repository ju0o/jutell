import { promises as fs } from 'node:fs';
import path from 'node:path';

const BEGIN_MARKER = '# BEGINNER_BRIDGE_MCP_BEGIN';
const END_MARKER = '# BEGINNER_BRIDGE_MCP_END';
const RELATIVE_CONFIG_PATH = '.codex/config.toml';

export type CodexMcpRegistration = {
  path: string;
  exists: boolean;
  registered: boolean;
  conflict: boolean;
  preview: string;
};

function filePath(projectRoot: string) {
  return path.join(projectRoot, '.codex', 'config.toml');
}

function configuredServerEntry() {
  const configured = process.env.BEGINNER_BRIDGE_MCP_SERVER;
  return configured && path.isAbsolute(configured) ? configured : undefined;
}

export function buildMcpConfigBlock(enabled: boolean) {
  const serverEntry = configuredServerEntry();
  return [
    BEGIN_MARKER,
    '[mcp_servers.beginner_bridge]',
    'command = "node"',
    `args = [${JSON.stringify(serverEntry ?? 'apps/mcp-server/dist/index.js')}]`,
    'cwd = "."',
    `enabled = ${enabled ? 'true' : 'false'}`,
    'required = false',
    'default_tools_approval_mode = "prompt"',
    END_MARKER,
  ].join('\n');
}

async function readConfigFile(projectRoot: string) {
  try { return await fs.readFile(filePath(projectRoot), 'utf8'); } catch { return ''; }
}

export async function readCodexMcpRegistration(projectRoot: string, enabled = false): Promise<CodexMcpRegistration> {
  const text = await readConfigFile(projectRoot);
  const registered = text.includes(BEGIN_MARKER) && text.includes(END_MARKER);
  const conflict = !registered && /^\s*\[mcp_servers\.beginner_bridge\]\s*$/m.test(text);
  return { path: RELATIVE_CONFIG_PATH, exists: Boolean(text), registered, conflict, preview: buildMcpConfigBlock(enabled) };
}

async function backup(file: string) {
  try { await fs.copyFile(file, `${file}.previous`); } catch { /* no existing file to back up */ }
}

function replaceManagedBlock(text: string, block: string) {
  const pattern = new RegExp(`${BEGIN_MARKER}[\\s\\S]*?${END_MARKER}`, 'm');
  return text.replace(pattern, block).replace(/[ \t]*\n{3,}/g, '\n\n').trimEnd() + '\n';
}

export async function registerCodexMcp(projectRoot: string, enabled: boolean) {
  const file = filePath(projectRoot);
  const current = await readConfigFile(projectRoot);
  const existing = await readCodexMcpRegistration(projectRoot, enabled);
  if (existing.conflict) throw new Error('Codex 설정에 같은 이름의 관리되지 않는 MCP 항목이 있어 자동 변경하지 않았습니다.');
  await fs.mkdir(path.dirname(file), { recursive: true });
  if (current) await backup(file);
  const next = existing.registered ? replaceManagedBlock(current, buildMcpConfigBlock(enabled)) : `${current.trimEnd()}${current.trimEnd() ? '\n\n' : ''}${buildMcpConfigBlock(enabled)}\n`;
  await fs.writeFile(file, next, 'utf8');
  return readCodexMcpRegistration(projectRoot, enabled);
}

export async function removeCodexMcp(projectRoot: string) {
  const file = filePath(projectRoot);
  const current = await readConfigFile(projectRoot);
  const existing = await readCodexMcpRegistration(projectRoot);
  if (existing.conflict) throw new Error('관리되지 않는 같은 이름의 MCP 항목은 자동으로 제거하지 않습니다.');
  if (!existing.registered) return existing;
  await backup(file);
  const pattern = new RegExp(`\\n?${BEGIN_MARKER}[\\s\\S]*?${END_MARKER}\\n?`, 'm');
  const next = current.replace(pattern, '').replace(/\n{3,}/g, '\n\n').trim();
  await fs.writeFile(file, next ? `${next}\n` : '', 'utf8');
  return readCodexMcpRegistration(projectRoot);
}
