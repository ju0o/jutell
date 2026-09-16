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
    expect(text).toContain('`jutell`과 legacy `beginner_bridge`');
    expect(text).toContain('호환용으로만 사용');
    // also early report rule guidance
    expect(text).toContain('소유자 대상 구현/보고 전에는 JuTell 보고 규칙');
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
    expect(first).toContain('호환용으로만 사용');
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
    expect(text).toMatch(/사용할 수 있고.*모호함을 줄여줄 때는.*우선/);
    expect(text).toMatch(/사용할 수 없거나 Provider 정책으로 막혀 있으면 작업을 멈추지 않고 JuTell Skill로 계속/);
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

// JUTELL-V2.0.1-EFFICIENCY-OPTIMIZATION-01
describe('efficiency guidance prefers precise Skill use and MCP completion rules', () => {
  it('AGENTS managed block keeps JuTell/.jutell.json/Intent Bridge/MCP preference/fallback/trust rules', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-efficiency-agents-'));
    temporaryRoots.push(tmp);
    await ensureJuTellAgentsBlock(tmp);
    const text = await fs.readFile(path.join(tmp, 'AGENTS.md'), 'utf8');
    expect(text).toContain('## JuTell');
    expect(text).toContain('`.jutell.json`');
    expect(text).toMatch(/실제로 코드나 문서를 바꾸기 전에는.*Intent Bridge 규칙으로 판단합니다/);
    expect(text).toMatch(/사용할 수 있고.*모호함을 줄여줄 때는.*우선/);
    expect(text).toMatch(/사용할 수 없거나 Provider 정책으로 막혀 있으면 작업을 멈추지 않고 JuTell Skill로 계속/);
    expect(text).toContain('확인하지 않은 결과를 사실처럼 표현하지 않습니다');
    expect(text).toContain('비밀정보를 명령 출력이나 보고서에 포함하지 않습니다');
  });

  it('AGENTS no longer tells every task to ritual-read the full SKILL.md', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-efficiency-no-ritual-'));
    temporaryRoots.push(tmp);
    await ensureJuTellAgentsBlock(tmp);
    const text = await fs.readFile(path.join(tmp, 'AGENTS.md'), 'utf8');
    expect(text).not.toMatch(/SKILL\.md`와 `\.jutell\.json`을 먼저 읽습니다/);
    expect(text).toMatch(/SKILL\.md 전체를 처음부터 끝까지 의식적으로 다시 읽지 않습니다/);
    expect(text).toMatch(/모호한 요청에는 Intent Bridge·범위 안내만 필요한 만큼 확인/);
  });

  it('completion guidance prefers get_beginner_report_rules and avoids report-format/risk rereads after MCP success', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-efficiency-mcp-once-'));
    temporaryRoots.push(tmp);
    await ensureJuTellAgentsBlock(tmp);
    const agents = await fs.readFile(path.join(tmp, 'AGENTS.md'), 'utf8');
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(agents).toContain('get_beginner_report_rules');
    expect(agents).toMatch(/성공한 뒤에는 최종 보고만을 위해 `references\/report-format\.md`나 `references\/risk-level-guide\.md`를 다시 읽지 않습니다/);
    expect(skill).toMatch(/get_beginner_report_rules` 결과에 따라 하나의 비개발자용 최종 보고를 작성한다/);
    expect(skill).toMatch(/MCP를 쓸 수 없거나 막히거나 실패했을 때만 `references\/report-format\.md` 등 이 Skill의 참고 문서로 대신한다/);
    expect(skill).toMatch(/MCP를 사용할 수 있으면 이 확인을 MCP 도구 호출 한 번으로 처리하고 참고 문서를 여러 개 다시 읽지 않는다/);
  });

  it('MCP-unavailable path still falls back to Skill references safely', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-efficiency-fallback-'));
    temporaryRoots.push(tmp);
    await ensureJuTellAgentsBlock(tmp);
    const agents = await fs.readFile(path.join(tmp, 'AGENTS.md'), 'utf8');
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(agents).toMatch(/호출이 실패해도 마찬가지로 Skill·참고 문서로 계속합니다/);
    expect(skill).toMatch(/MCP를 사용할 수 없으면 `references\/report-format\.md` 등 이 Skill의 참고 문서로 대신한다/);
    expect(skill).toMatch(/보고서 형식이 필요하고 JuTell MCP의 `get_beginner_report_rules`를 쓸 수 없으면 `references\/report-format\.md`를 읽는다/);
    expect(skill).toMatch(/위험도 판단이 필요하고 JuTell MCP의 `get_beginner_report_rules`를 쓸 수 없으면 `references\/risk-level-guide\.md`를 읽는다/);
  });
});
