import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveScope } from '../src/config/paths.js';
import { BEGIN_MARKER, END_MARKER, codexUninstallBlocker, userKeysInManagedBlock } from '../src/config/managed.js';
import { JUTELL_AGENTS_BEGIN, JUTELL_AGENTS_END, receiptCommandFor, writtenReceiptCommands } from '../src/installer/agents.js';
import { recordReceiptBaseline } from '../src/commands/receipt/index.js';
import { getDoctorResults } from '../src/commands/status.js';

const roots: string[] = [];
const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE, CODEX_HOME: process.env.CODEX_HOME };
afterEach(async () => {
  for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});
const tmp = async () => { const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-rv-'))); roots.push(root); return root; };
const isolate = (root: string) => { process.env.HOME = root; process.env.USERPROFILE = root; process.env.CODEX_HOME = path.join(root, '.codex'); };

describe('#34 review follow-ups', () => {
  it('user keys inside the managed block are found also in multi-line arrays and inline tables', () => {
    const block = `${BEGIN_MARKER}\n[mcp_servers.jutell]\ncommand = "node"\nargs = [\n  "a",\n  "b = c",\n]\nenv = { TOKEN_NAME = "x", OTHER = "y" }\nstartup_timeout_sec = 9\n[mcp_servers.jutell.tools.get_rules]\napproval_mode = "approve"\nnote = "mine"\n${END_MARKER}\n`;
    const keys = userKeysInManagedBlock(block);
    expect(keys).toEqual(expect.arrayContaining(['mcp_servers.jutell.env', 'mcp_servers.jutell.startup_timeout_sec', 'mcp_servers.jutell.tools.get_rules.note']));
    // A line inside the multi-line array that looks like `key =` is not a key, and JuTell's own keys are not reported.
    expect(keys.some((key) => key.includes('"b') || key.endsWith('.args') || key.endsWith('.command') || key.endsWith('approval_mode'))).toBe(false);
    expect(keys).toHaveLength(3);
  });

  it.skipIf(process.platform === 'win32')('the symlink notice says the link was left alone on purpose and what to delete', async () => {
    const root = await tmp(); isolate(root);
    await fs.mkdir(path.join(root, '.codex'));
    await fs.writeFile(path.join(root, 'real.toml'), '');
    await fs.symlink(path.join(root, 'real.toml'), path.join(root, '.codex', 'config.toml'));
    const message = await codexUninstallBlocker(resolveScope('project', root));
    expect(message).toContain('링크가 깨지지 않게 그대로 두었으니');
    expect(message).toContain('JUTELL_CLI_MCP_BEGIN');
    expect(message).not.toContain('링크를 그대로 두려고');
  });

  it.skipIf(process.platform === 'win32')('no baseline is recorded when .jutell-local cannot be prepared safely (a link out of the project)', async () => {
    const root = await tmp();
    const project = path.join(root, 'p'); const outside = path.join(root, 'outside');
    await fs.mkdir(project); await fs.mkdir(outside);
    await fs.writeFile(path.join(project, 'a.txt'), '1\n');
    execFileSync('git', ['init', '-q'], { cwd: project });
    await fs.symlink(outside, path.join(project, '.jutell-local'));
    await recordReceiptBaseline(resolveScope('project', project));
    expect(await fs.readdir(outside)).toEqual([]);
  });
});

describe('#35 review follow-ups', () => {
  it('receipt command: own node_modules, npm workspaces member (hoisted), or global', async () => {
    const root = await tmp();
    const member = path.join(root, 'apps', 'web');
    await fs.mkdir(path.join(member, 'node_modules', 'jutell'), { recursive: true });
    await fs.mkdir(path.join(root, 'node_modules', 'jutell'), { recursive: true });
    expect(await receiptCommandFor(member, path.join(member, 'node_modules', 'jutell'))).toBe('npm exec --offline --no -- jutell receipt');
    expect(await receiptCommandFor(member, path.join(root, 'node_modules', 'jutell'))).toBe('npm exec --offline --no --prefix . -- jutell receipt');
    expect(await receiptCommandFor(member, path.join(os.tmpdir(), 'elsewhere', 'jutell'))).toBe('jutell receipt');
  });

  it('doctor warns when AGENTS.md still names the receipt command of an earlier install and says to run `jutell --yes`', async () => {
    const root = await tmp(); isolate(path.join(root, 'home'));
    const project = path.join(root, 'proj');
    await fs.mkdir(project);
    // Written while JuTell was installed inside the project; this test runs the repo's JuTell, i.e. not that one.
    await fs.writeFile(path.join(project, 'AGENTS.md'), `${JUTELL_AGENTS_BEGIN}\n- ③ \`npm exec --offline --no -- jutell receipt\`\n${JUTELL_AGENTS_END}\n`);
    expect(await writtenReceiptCommands(project)).toEqual([{ file: 'AGENTS.md', command: 'npm exec --offline --no -- jutell receipt' }]);
    const check = (await getDoctorResults(resolveScope('project', project))).find((item) => item.name === '영수증 명령');
    expect(check?.status).toBe('주의');
    expect(check?.detail).toContain('jutell --yes');
    expect(check?.detail).toContain('AGENTS.md');
  }, 60_000);

  it('the receipt failure rule is self-contained in SKILL.md (not a pointer to AGENTS.md), so block-less agents keep it', async () => {
    const skill = await fs.readFile(path.join(__dirname, '..', 'assets', 'skill', 'SKILL.md'), 'utf8');
    expect(skill).toMatch(/^14\. 영수증 명령이 실패하면/m);
    expect(skill).not.toContain('AGENTS.md의 실패 문장');
    expect(Buffer.byteLength(skill)).toBeLessThanOrEqual(6144);
  });
});
