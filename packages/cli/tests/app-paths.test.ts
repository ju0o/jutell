import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { appConfigPaths } from '../src/config/paths.js';

describe('appConfigPaths (W4)', () => {
  it('darwin: documented paths, spaces and Korean home kept', () => {
    const paths = appConfigPaths('darwin', {}, '/Users/홍 길동/내 앱', '/Users/홍 길동');
    expect(paths.claudeDesktop).toBe('/Users/홍 길동/Library/Application Support/Claude/claude_desktop_config.json');
    expect(paths.cursor).toEqual({ global: '/Users/홍 길동/.cursor/mcp.json', project: '/Users/홍 길동/내 앱/.cursor/mcp.json' });
    expect(paths.windsurf).toEqual({ current: '/Users/홍 길동/.config/devin/mcp_config.json', legacy: '/Users/홍 길동/.codeium/windsurf/mcp_config.json' });
    expect(paths.vscode).toEqual({ workspace: '/Users/홍 길동/내 앱/.vscode/mcp.json', userProfile: undefined });
    expect(paths.copilot).toEqual({ user: '/Users/홍 길동/.copilot/mcp-config.json', project: '/Users/홍 길동/내 앱/.mcp.json' });
  });
  it('win32: %APPDATA% paths with a Korean, spaced home', () => {
    const env = { APPDATA: 'C:\\Users\\홍 길동\\AppData\\Roaming' };
    const paths = appConfigPaths('win32', env, 'C:\\Users\\홍 길동\\내 앱', 'C:\\Users\\홍 길동');
    expect(paths.claudeDesktop).toBe('C:\\Users\\홍 길동\\AppData\\Roaming\\Claude\\claude_desktop_config.json');
    expect(paths.windsurf.current).toBe('C:\\Users\\홍 길동\\AppData\\Roaming\\devin\\mcp_config.json');
    expect(paths.cursor.global).toBe('C:\\Users\\홍 길동\\.cursor\\mcp.json');
    expect(paths.cursor.project).toBe('C:\\Users\\홍 길동\\내 앱\\.cursor\\mcp.json');
    expect(paths.vscode.workspace).toBe('C:\\Users\\홍 길동\\내 앱\\.vscode\\mcp.json');
    expect(paths.vscode.userProfile).toBeUndefined();
  });
  it('win32 without %APPDATA% (or a relative one): unknown, never a guess', () => {
    for (const env of [{}, { APPDATA: '' }, { APPDATA: 'Roaming' }]) {
      const paths = appConfigPaths('win32', env, 'C:\\p', 'C:\\Users\\a');
      expect(paths.claudeDesktop).toBeUndefined();
      expect(paths.windsurf.current).toBeUndefined();
    }
  });
  it('linux: XDG_CONFIG_HOME set and unset; Claude Desktop not documented', () => {
    const without = appConfigPaths('linux', {}, '/home/홍 길동/p', '/home/홍 길동');
    expect(without.claudeDesktop).toBeUndefined();
    expect(without.windsurf.current).toBe('/home/홍 길동/.config/devin/mcp_config.json');
    expect(without.vscode.userProfile).toBe('/home/홍 길동/.config/Code/User/mcp.json');
    const withXdg = appConfigPaths('linux', { XDG_CONFIG_HOME: '/x/conf' }, '/p', '/home/a');
    expect(withXdg.windsurf.current).toBe('/x/conf/devin/mcp_config.json');
    expect(withXdg.vscode.userProfile).toBe('/x/conf/Code/User/mcp.json');
    expect(appConfigPaths('linux', { XDG_CONFIG_HOME: 'rel' }, '/p', '/home/a').vscode.userProfile).toBe('/home/a/.config/Code/User/mcp.json');
  });
  it('defaults home to JUTELL_HOME isolation', () => {
    const previous = process.env.JUTELL_HOME;
    process.env.JUTELL_HOME = '/tmp/jutell-iso-home';
    try { expect(appConfigPaths(process.platform, {}, path.resolve('/p')).cursor.global).toBe(path.join(path.resolve('/tmp/jutell-iso-home'), '.cursor', 'mcp.json')); }
    finally { if (previous === undefined) delete process.env.JUTELL_HOME; else process.env.JUTELL_HOME = previous; }
  });
});
