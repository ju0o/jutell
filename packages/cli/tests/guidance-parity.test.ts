import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureJuTellAgentsBlock } from '../src/installer/agents.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const skillFile = path.join(repoRoot, '.agents', 'skills', 'beginner-bridge', 'SKILL.md');
const mcpIndexFile = path.join(repoRoot, 'apps', 'mcp-server', 'src', 'index.ts');
const agentInstallerFile = path.join(repoRoot, 'packages', 'cli', 'src', 'installer', 'agents.ts');

const temporaryRoots: string[] = [];
afterEach(async () => {
  for (const r of temporaryRoots.splice(0)) await fs.rm(r, { recursive: true, force: true });
});

describe('M2.6 Codex Experience Parity guidance', () => {
  it('AGENTS managed block contains canonical jutell preference and legacy fallback', async () => {
    // Read the rendered managed block (not the .ts source), since the source
    // escapes backticks for the template literal (\`jutell\`) and a raw-text
    // grep would need to duplicate that escaping instead of testing behavior.
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-guidance-agents-'));
    temporaryRoots.push(tmp);
    await ensureJuTellAgentsBlock(tmp);
    const text = await fs.readFile(path.join(tmp, 'AGENTS.md'), 'utf8');
    expect(text).toContain('canonical `jutell`');
    expect(text).toContain('canonical `jutell` 서버를 우선하고, legacy `beginner_bridge`');
    expect(text).toContain('호환용으로만 씁니다');
    // also early report rule guidance
    expect(text).toContain('그 규칙대로 최종 답을 씁니다');
    expect(text).not.toMatch(/JuTell 보고 규칙을 (먼저 )?적용/);
  });

  it('AGENTS block has the agent write receipt.json with its file tool and run jutell receipt without a shell pipe', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-guidance-receipt-'));
    temporaryRoots.push(tmp);
    await ensureJuTellAgentsBlock(tmp);
    const text = await fs.readFile(path.join(tmp, 'AGENTS.md'), 'utf8');
    expect(text).toContain('파일 쓰기 도구로 `.jutell-local/receipt.json`');
    expect(text).toContain('인자 없이 `jutell receipt`');
    expect(text).not.toMatch(/echo '|\| jutell receipt|--file -|npx/);
    expect(text).toContain('"summary"');
    expect(text).toContain('영수증을 저장하지 못했어요. 터미널에서 jutell doctor를 실행하면 해결 방법을 알려 줘요.');
    expect(text.indexOf('get_beginner_report_rules`를 호출하고, 그다음에 영수증')).toBeGreaterThan(0);
    expect(text).toContain('영수증이 최종 답입니다. 영수증 아래에는 아무것도 쓰지 않고');
    expect(text).toContain('반드시 파일 편집 도구로 씁니다');
    expect(text).toContain('테스트·실행 결과·화면 확인을 필요로 하면 실행하고');
    expect(text).toContain('checked가 아닌 unchecked에 씁니다');
    expect(text).toContain('필요한 파일을 명령 하나로 읽고, 읽은 파일은 다시 읽지 않습니다');
    expect(text).toContain("실행한 테스트·명령은 최종 답과 영수증의 \`이번에 한 작업\`(done)에도 사용자가 쓴 말 그대로(예: '테스트') 적습니다");
    expect(text).toContain("'브라우저 탭 제목', '페이지 맨 위 큰 제목'");
  });

  it('AGENTS block drops the receipt lines when receiptReport is off', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-guidance-noreceipt-'));
    temporaryRoots.push(tmp);
    await fs.writeFile(path.join(tmp, '.jutell.json'), JSON.stringify({ features: { receiptReport: false } }), 'utf8');
    await ensureJuTellAgentsBlock(tmp);
    const text = await fs.readFile(path.join(tmp, 'AGENTS.md'), 'utf8');
    expect(text).not.toContain('jutell receipt');
    expect(text).toContain('`직접 확인한 것:`과 `확인 못 한 것:` 두 줄');
  });

  it('SKILL.md contains MCP server selection and early report application', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toContain('## MCP 서버 선택');
    expect(skill).toContain('canonical `jutell` 서버를 사용한다');
    expect(skill).toContain('호환용으로만 사용');
    expect(skill).toContain('소유자 대상 구현·보고 작업이면 최종 답변을 작성하기 전에 JuTell 보고 규칙');
  });

  it('MCP server instructions prefer canonical jutell', async () => {
    const src = await fs.readFile(mcpIndexFile, 'utf8');
    expect(src).toContain('prefer the canonical jutell server');
    expect(src).toContain('beginner_bridge only for compatibility');
    expect(src).toContain('apply the JuTell reporting guidance before composing the final answer');
  });

  it('repeated ensureJuTellAgentsBlock does not duplicate guidance', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-guidance-'));
    temporaryRoots.push(tmp);
    await fs.writeFile(path.join(tmp, 'AGENTS.md'), '# 기존\n', 'utf8');
    await ensureJuTellAgentsBlock(tmp);
    const first = await fs.readFile(path.join(tmp, 'AGENTS.md'), 'utf8');
    expect(first.match(/BEGIN JUTELL MANAGED BLOCK/g)).toHaveLength(1);
    expect(first.match(/canonical `jutell`/g)).toHaveLength(1);
    expect(first).toContain('호환용으로만 씁니다');
    await ensureJuTellAgentsBlock(tmp);
    const second = await fs.readFile(path.join(tmp, 'AGENTS.md'), 'utf8');
    expect(second).toBe(first);
    expect(second.match(/BEGIN JUTELL MANAGED BLOCK/g)).toHaveLength(1);
    expect(second.match(/canonical `jutell`/g)).toHaveLength(1);
  });

  it('legacy beginner_bridge wording remains compatibility-safe (not deleted)', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    // ensure legacy not presented as deprecated removal but as fallback
    expect(skill).not.toMatch(/beginner_bridge.*삭제|삭제.*beginner_bridge/);
    expect(skill).toContain('호환용');
    const installer = await fs.readFile(agentInstallerFile, 'utf8');
    expect(installer).not.toMatch(/remove.*beginner_bridge|delete.*beginner_bridge/i);
  });
});

// JUTELL-V1.X-AUTO-INVOCATION-01
describe('spontaneous JuTell MCP preference (with Skill fallback)', () => {
  it('AGENTS managed block prefers MCP when it reduces ambiguity, and falls back without forcing it', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-guidance-mcp-'));
    temporaryRoots.push(tmp);
    await ensureJuTellAgentsBlock(tmp);
    const text = await fs.readFile(path.join(tmp, 'AGENTS.md'), 'utf8');
    expect(text).toMatch(/모호함을 줄이면 우선 씁니다/);
    expect(text).toMatch(/쓸 수 없거나 Provider 정책으로 막혀 있으면 작업을 멈추지 않고 JuTell Skill로 계속/);
    expect(text).toMatch(/실제로 호출해 응답을 받은 경우에만 JuTell MCP를 사용했다고 말합니다/);
  });

  it('SKILL.md gives the same completion-boundary trigger and does not require MCP on every step', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/최종 보고를 쓰기 직전 한 번만 한다/);
    expect(skill).toMatch(/파일을 읽거나 도구를 쓸 때마다.*반복 확인하지 않는다/);
    expect(skill).toMatch(/MCP를 사용할 수 없으면 `references\/report-format\.md` 등 이 Skill의 참고 문서로 대신한다/);
  });

  it('no surface tells the Agent it MUST call JuTell MCP every time', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    const agents = await fs.readFile(path.join(repoRoot, 'AGENTS.md'), 'utf8');
    const installer = await fs.readFile(agentInstallerFile, 'utf8');
    const mcpSrc = await fs.readFile(mcpIndexFile, 'utf8');
    for (const text of [skill, agents, installer, mcpSrc]) {
      expect(text).not.toMatch(/반드시.*(호출|사용)한다/);
      expect(text).not.toMatch(/\bmust call\b/i);
      expect(text).not.toMatch(/every (task|response|message|turn|tool use)/i);
    }
  });

  it('does not tell the Agent to reread files or rerun tests merely to satisfy JuTell', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toContain('이 섹션만을 위해 파일을 다시 읽거나 git diff를 다시 실행하지 않는다');
    expect(skill).toMatch(/저장소 재탐색, 테스트 재실행.*만들지 않는다/);
  });
});
