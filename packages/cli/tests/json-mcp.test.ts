import { lstat, mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { normalizeConfigPath, readJsonMcp, registerJsonMcp, removeJsonMcp, type JsonMcpEntry, type JsonMcpSpec } from '../src/installer/json-mcp.js';
import { parseJsoncObject } from '../src/config/jsonc.js';

const SERVER = '/opt/jutell/node_modules/jutell/assets/mcp-server/index.js';
const ENTRY: JsonMcpEntry = { type: 'stdio', command: 'node', args: [SERVER] };
const CURSOR: JsonMcpSpec = { rootKey: 'mcpServers' };
const VSCODE: JsonMcpSpec = { rootKey: 'servers' };

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });
async function temp() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'jutell-json-mcp-'));
  dirs.push(dir);
  return dir;
}
async function fileWith(text: string, name = 'mcp.json') {
  const dir = await temp();
  const file = path.join(dir, name);
  await writeFile(file, text);
  return { dir, file };
}

const USER_FILE = [
  '// my servers',
  '{',
  '  /* keep me */',
  '  "mcpServers": {',
  '    "other": { "command": "npx", "args": ["-y", "x"] }, // trailing note',
  '  },',
  '  "unknownTopKey": [1, 2, 3,],',
  '}',
  '',
].join('\n');

describe('json-mcp adapter (W3)', () => {
  it('(a) keeps comments, trailing commas, unknown keys and other servers byte for byte', async () => {
    const { file } = await fileWith(USER_FILE);
    const result = await registerJsonMcp(CURSOR, file, ENTRY);
    expect(result.status).toBe('written');
    const after = await readFile(file, 'utf8');
    const anchor = '// trailing note\n';
    const at = USER_FILE.indexOf(anchor) + anchor.length;
    expect(after.slice(0, at)).toBe(USER_FILE.slice(0, at));
    expect(after.endsWith(USER_FILE.slice(at))).toBe(true);
    // Only an insertion: the original is exactly what is left around it.
    expect(after.length).toBeGreaterThan(USER_FILE.length);
    const parsed = parseJsoncObject(after)!;
    expect((parsed.mcpServers as Record<string, unknown>).jutell).toEqual(ENTRY);
    expect((parsed.mcpServers as Record<string, unknown>).other).toEqual({ command: 'npx', args: ['-y', 'x'] });
    expect(parsed.unknownTopKey).toEqual([1, 2, 3]);
  });

  it('(a) adds the root key when missing and leaves the rest untouched', async () => {
    const original = '{\n  "inputs": [] // x\n}\n';
    const { file } = await fileWith(original);
    expect((await registerJsonMcp(VSCODE, file, ENTRY)).status).toBe('written');
    const after = await readFile(file, 'utf8');
    expect(after.startsWith('{\n  "inputs": [],')).toBe(true);
    expect(after).toContain(' // x\n}\n');
    expect(parseJsoncObject(after)).toEqual({ inputs: [], servers: { jutell: ENTRY } });
  });

  it('(b) creates a missing file and fills an empty one; no backup for a new file', async () => {
    const dir = await temp();
    const file = path.join(dir, 'sub', 'mcp.json');
    const created = await registerJsonMcp(VSCODE, file, ENTRY);
    expect(created.status).toBe('written');
    expect(created.backup).toBeUndefined();
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ servers: { jutell: ENTRY } });
    const empty = await fileWith('  \n');
    expect((await registerJsonMcp(CURSOR, empty.file, ENTRY)).status).toBe('written');
    expect(JSON.parse(await readFile(empty.file, 'utf8'))).toEqual({ mcpServers: { jutell: ENTRY } });
  });

  it('(c) an invalid file is not changed and no backup is made', async () => {
    for (const bad of ['{ "mcpServers": {', '[1]', '{ "mcpServers": [] }', '{ "mcpServers": { "a": 1 } } x']) {
      const { dir, file } = await fileWith(bad);
      const result = await registerJsonMcp(CURSOR, file, ENTRY);
      expect(result.status).toBe('invalid');
      expect(result.message).toContain('형식');
      expect(await readFile(file, 'utf8')).toBe(bad);
      expect(await readdir(dir)).toEqual(['mcp.json']);
      expect((await readJsonMcp(CURSOR, file)).parseOk).toBe(false);
    }
  });

  it('(d) a same-named entry that is not JuTell is a conflict: not written, not removed', async () => {
    const original = '{ "mcpServers": { "jutell": { "command": "python", "args": ["mine.py"] } } }';
    const { file } = await fileWith(original);
    expect((await readJsonMcp(CURSOR, file)).conflict).toBe(true);
    expect((await registerJsonMcp(CURSOR, file, ENTRY)).status).toBe('conflict');
    expect((await removeJsonMcp(CURSOR, file)).status).toBe('conflict');
    expect(await readFile(file, 'utf8')).toBe(original);
  });

  it('(e) running again with the same entry does not touch the file (same mtime)', async () => {
    const { file } = await fileWith(USER_FILE);
    await registerJsonMcp(CURSOR, file, ENTRY);
    const before = await stat(file);
    const text = await readFile(file, 'utf8');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect((await registerJsonMcp(CURSOR, file, ENTRY)).status).toBe('unchanged');
    expect((await stat(file)).mtimeMs).toBe(before.mtimeMs);
    expect(await readFile(file, 'utf8')).toBe(text);
  });

  it('(f) removing a last entry without its own comma keeps comments after the previous comma (review #41)', async () => {
    const head = '{\n  "mcpServers": {\n    "o": {"command":"x"}';
    const between = ' // other server note\n    // jutell below\n';
    const tail = '  }\n}\n';
    const { file } = await fileWith(`${head},${between}    "jutell": {"command":"node","args":["/opt/j/assets/mcp-server/index.js"]}\n${tail}`);
    expect((await removeJsonMcp(CURSOR, file)).status).toBe('written');
    expect(await readFile(file, 'utf8')).toBe(`${head}${between}${tail}`);
  });

  it('(f)(l) remove takes out only the JuTell entry, keeps an empty server object and the file', async () => {
    const { file } = await fileWith(USER_FILE);
    await registerJsonMcp(CURSOR, file, ENTRY);
    const removed = await removeJsonMcp(CURSOR, file);
    expect(removed.status).toBe('written');
    expect(await readFile(file, 'utf8')).toBe(USER_FILE);
    const dir = await temp();
    const own = path.join(dir, 'mcp.json');
    await registerJsonMcp(VSCODE, own, ENTRY);
    expect((await removeJsonMcp(VSCODE, own)).status).toBe('written');
    expect(await readFile(own, 'utf8')).toBe('{\n  "servers": {}\n}\n');
    expect((await removeJsonMcp(VSCODE, own)).status).toBe('absent');
  });

  it('(f) remove in the middle of other servers keeps their bytes', async () => {
    const original = '{\n  "mcpServers": {\n    "a": { "command": "a" },\n    "jutell": { "command": "node", "args": ["' + SERVER + '"] },\n    "b": { "command": "b" }\n  }\n}\n';
    const { file } = await fileWith(original);
    expect((await removeJsonMcp(CURSOR, file)).status).toBe('written');
    expect(await readFile(file, 'utf8')).toBe('{\n  "mcpServers": {\n    "a": { "command": "a" },\n    "b": { "command": "b" }\n  }\n}\n');
  });

  it('(g)(g2) a linked file is refused, with the entry to paste into the real file', async () => {
    const real = await fileWith(USER_FILE);
    const dir = await temp();
    const link = path.join(dir, 'mcp.json');
    await symlink(real.file, link);
    const result = await registerJsonMcp(CURSOR, link, ENTRY);
    expect(result.status).toBe('link');
    expect(result.message).toContain('링크라서 직접 바꾸지 않았어요');
    expect(JSON.parse(result.suggestion!)).toEqual({ mcpServers: { jutell: ENTRY } });
    expect(await readFile(real.file, 'utf8')).toBe(USER_FILE);
    expect((await lstat(link)).isSymbolicLink()).toBe(true);
    expect((await removeJsonMcp(CURSOR, link)).status).toBe('link');
  });

  it('(g) a directory in place of the file is refused', async () => {
    const dir = await temp();
    await mkdir(path.join(dir, 'mcp.json'));
    expect((await registerJsonMcp(CURSOR, path.join(dir, 'mcp.json'), ENTRY)).status).toBe('not-file');
  });

  it('(g) a project file whose folder points outside the project is refused', async () => {
    const project = await temp();
    const outside = await temp();
    await symlink(outside, path.join(project, '.cursor'), 'dir');
    const result = await registerJsonMcp(CURSOR, path.join(project, '.cursor', 'mcp.json'), ENTRY, { projectRoot: project });
    expect(result.status).toBe('outside-project');
    expect(await readdir(outside)).toEqual([]);
    const ok = await registerJsonMcp(CURSOR, path.join(project, '.vscode', 'mcp.json'), ENTRY, { projectRoot: project });
    expect(ok.status).toBe('written');
  });

  it('(h) a failing write leaves the original and no temp file', async () => {
    const { dir, file } = await fileWith(USER_FILE);
    const result = await registerJsonMcp(CURSOR, file, ENTRY, { write: async () => { throw new Error('disk full'); } });
    expect(result.status).toBe('invalid');
    expect(await readFile(file, 'utf8')).toBe(USER_FILE);
    expect((await readdir(dir)).filter((name) => name.includes('jutell-tmp'))).toEqual([]);
  });

  it('(h) a write that leaves broken JSON is rolled back', async () => {
    const { file } = await fileWith(USER_FILE);
    const result = await registerJsonMcp(CURSOR, file, ENTRY, { write: async (target) => { await writeFile(target, '{ broken'); } });
    expect(result.status).toBe('invalid');
    expect(await readFile(file, 'utf8')).toBe(USER_FILE);
  });

  it('(h2) a change by the app between read and write stops the write', async () => {
    const { file } = await fileWith(USER_FILE);
    const changed = USER_FILE.replace('"x"', '"y"');
    const result = await registerJsonMcp(CURSOR, file, ENTRY, { beforeWrite: async () => { await writeFile(file, changed); } });
    expect(result.status).toBe('changed-during-write');
    expect(result.message).toContain('앱을 닫고 다시 실행하세요');
    expect(await readFile(file, 'utf8')).toBe(changed);
  });

  it('(i) CRLF and BOM are kept', async () => {
    const original = `\uFEFF${USER_FILE.replace(/\n/g, '\r\n')}`;
    const { file } = await fileWith(original);
    await registerJsonMcp(CURSOR, file, ENTRY);
    const after = await readFile(file, 'utf8');
    expect(after.startsWith('\uFEFF// my servers\r\n')).toBe(true);
    expect(after.replace(/\r\n/g, '').includes('\n')).toBe(false);
    await removeJsonMcp(CURSOR, file);
    expect(await readFile(file, 'utf8')).toBe(original);
  });

  it('(j) keys the person added to the JuTell entry survive a path update; removal names them with the backup', async () => {
    const old = '/old/jutell/assets/mcp-server/index.js';
    const original = JSON.stringify({ mcpServers: { jutell: { command: 'node', args: [old], disabledTools: ['x'], env: { MY: '1', JUTELL_PROJECT_ROOT: '/p' } } } }, null, 2);
    const { file } = await fileWith(original);
    const state = await readJsonMcp(CURSOR, file, SERVER);
    expect(state).toMatchObject({ registered: true, stale: true });
    const entry: JsonMcpEntry = { ...ENTRY, env: { JUTELL_PROJECT_ROOT: '/q' } };
    expect((await registerJsonMcp(CURSOR, file, entry)).status).toBe('written');
    const after = (parseJsoncObject(await readFile(file, 'utf8'))!.mcpServers as Record<string, Record<string, unknown>>).jutell;
    expect(after).toEqual({ command: 'node', args: [SERVER], disabledTools: ['x'], env: { MY: '1', JUTELL_PROJECT_ROOT: '/q' }, type: 'stdio' });
    const removed = await removeJsonMcp(CURSOR, file);
    expect(removed.userKeys).toEqual(['disabledTools', 'env.MY']);
    expect(removed.backup).toBeTruthy();
    expect(removed.message).toContain(removed.backup!);
    expect(await readFile(removed.backup!, 'utf8')).toContain('disabledTools');
  });

  it('(k) Windows backslash and forward-slash paths are the same JuTell entry', async () => {
    const winEscaped = 'C:\\Users\\홍 길동\\AppData\\Roaming\\npm\\node_modules\\jutell\\assets\\mcp-server\\index.js';
    const original = JSON.stringify({ mcpServers: { jutell: { command: 'C:\\Program Files\\nodejs\\node.exe', args: [winEscaped] } } }, null, 2);
    expect(original).toContain('\\\\Users\\\\홍 길동');
    const { file } = await fileWith(original);
    const forward = 'c:/Users/홍 길동/AppData/Roaming/npm/node_modules/jutell/assets/mcp-server/index.js';
    expect(normalizeConfigPath(winEscaped)).toBe(forward);
    expect(await readJsonMcp(CURSOR, file, forward)).toMatchObject({ registered: true, stale: false, conflict: false });
    expect((await removeJsonMcp(CURSOR, file)).status).toBe('written');
    expect(parseJsoncObject(await readFile(file, 'utf8'))).toEqual({ mcpServers: {} });
  });

  it('a backup is made before changing an existing file', async () => {
    const { file } = await fileWith(USER_FILE);
    const result = await registerJsonMcp(CURSOR, file, ENTRY);
    expect(result.backup).toBe(`${file}.previous`);
    expect(await readFile(`${file}.jutell-original`, 'utf8')).toBe(USER_FILE);
  });
});
