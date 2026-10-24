import path from 'node:path';
import { appConfigPaths, packageRoot } from '../config/paths.js';
import type { JsonMcpEntry, JsonMcpSpec } from './json-mcp.js';

/**
 * GUI apps (cycle-3 W5). Kept apart from AGENT_PROVIDERS on purpose: those drive the
 * bare `jutell` auto-detect and setup, and decision 18 says GUI apps are only
 * connected when the person types `jutell use <app>` themselves.
 * Only values from the plan's doc table or W0 measurement live here.
 */
export type GuiAppId = 'cursor' | 'claude-desktop' | 'vscode' | 'windsurf';
export type GuiScope = 'project' | 'global';

export type GuiAppFile = {
  /** Internal id for --json, e.g. `cursor-project`. */
  id: string;
  app: GuiAppId;
  /** Easy name for screens, e.g. "Cursor (이 프로젝트)". */
  label: string;
  scope: GuiScope;
  /** undefined: path not confirmed for this OS ("문서로 확인 안 됨"). */
  file: string | undefined;
  rootKey: JsonMcpSpec['rootKey'];
  /** false: status only (Windsurf, Copilot format). JuTell never writes it. */
  writable: boolean;
};

export type GuiApp = {
  id: GuiAppId;
  label: string;
  aliases: string[];
  /** 'status-only': `use` only explains (decision 15). */
  mode: 'write' | 'status-only';
  /** Scopes `use` can write. Claude Desktop has no project file: always global. */
  scopes: GuiScope[];
  restartHint: string;
};

export const GUI_APPS: GuiApp[] = [
  { id: 'cursor', label: 'Cursor', aliases: [], mode: 'write', scopes: ['project', 'global'], restartHint: '바뀐 연결은 Cursor를 다시 시작하면 적용돼요.' },
  { id: 'claude-desktop', label: 'Claude Desktop', aliases: [], mode: 'write', scopes: ['global'], restartHint: 'Claude Desktop을 완전히 종료한 뒤 다시 여세요.' },
  { id: 'vscode', label: 'VS Code', aliases: [], mode: 'write', scopes: ['project', 'global'], restartHint: 'VS Code에서 MCP: List Servers → jutell → Restart Server를 실행하세요.' },
  { id: 'windsurf', label: 'Windsurf', aliases: [], mode: 'status-only', scopes: [], restartHint: '' },
];

export function findGuiApp(name: string | undefined) {
  if (!name) return undefined;
  return GUI_APPS.find((app) => app.id === name || app.aliases.includes(name));
}

/** Every config file JuTell knows for GUI apps on this OS, writable or status-only. */
export function guiAppFiles(projectRoot: string, platform: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env): GuiAppFile[] {
  const paths = appConfigPaths(platform, env, projectRoot);
  return [
    { id: 'cursor-project', app: 'cursor', label: 'Cursor (이 프로젝트)', scope: 'project', file: paths.cursor.project, rootKey: 'mcpServers', writable: true },
    { id: 'cursor-global', app: 'cursor', label: 'Cursor (모든 폴더)', scope: 'global', file: paths.cursor.global, rootKey: 'mcpServers', writable: true },
    { id: 'claude-desktop', app: 'claude-desktop', label: 'Claude Desktop', scope: 'global', file: paths.claudeDesktop, rootKey: 'mcpServers', writable: true },
    { id: 'vscode-project', app: 'vscode', label: 'VS Code (이 프로젝트)', scope: 'project', file: paths.vscode.workspace, rootKey: 'servers', writable: true },
    // Q10: our own JSONC editor, only where W0 measured the path (Linux). Elsewhere guidance only.
    { id: 'vscode-global', app: 'vscode', label: 'VS Code (사용자 프로필)', scope: 'global', file: paths.vscode.userProfile, rootKey: 'servers', writable: true },
    { id: 'windsurf', app: 'windsurf', label: 'Windsurf', scope: 'global', file: paths.windsurf.current, rootKey: 'mcpServers', writable: false },
    { id: 'windsurf-legacy', app: 'windsurf', label: 'Windsurf (예전 위치)', scope: 'global', file: paths.windsurf.legacy, rootKey: 'mcpServers', writable: false },
    { id: 'copilot-project', app: 'vscode', label: 'Copilot 형식 (이 프로젝트 .mcp.json)', scope: 'project', file: paths.copilot.project, rootKey: 'mcpServers', writable: false },
    { id: 'copilot-user', app: 'vscode', label: 'Copilot 형식 (~/.copilot)', scope: 'global', file: paths.copilot.user, rootKey: 'mcpServers', writable: false },
  ];
}

export function serverEntryPath() {
  return path.join(packageRoot(), 'assets', 'mcp-server', 'index.js');
}

/**
 * W5 entries. Global ones always pin JUTELL_PROJECT_ROOT to an absolute project path (decision 13).
 * No approval / sandboxEnabled keys anywhere (decision 17).
 */
export function buildGuiEntry(file: GuiAppFile, projectRoot: string): JsonMcpEntry {
  const base = { command: process.execPath, args: [serverEntryPath()] };
  if (file.id === 'cursor-project') return { type: 'stdio', ...base, env: { JUTELL_PROJECT_ROOT: '${workspaceFolder}' } };
  if (file.id === 'vscode-project') return { type: 'stdio', ...base, cwd: '${workspaceFolder}' };
  if (file.id === 'claude-desktop') return { ...base, env: { JUTELL_PROJECT_ROOT: projectRoot } };
  return { type: 'stdio', ...base, env: { JUTELL_PROJECT_ROOT: projectRoot } };
}

export function globalPinWarning(app: GuiApp, projectRoot: string) {
  return `주의: 이 앱은 모든 폴더에서 \`${projectRoot}\`의 지도·영수증을 씁니다. 다른 프로젝트에서는 \`jutell use ${app.id}${app.id === 'claude-desktop' ? '' : ' --global'}\`을 다시 실행하세요.`;
}
