import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureJuTellAgentsBlock, ensureJuTellClaudeMdBlock } from '../src/installer/agents.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const skillFile = path.join(repoRoot, '.agents', 'skills', 'beginner-bridge', 'SKILL.md');
// SKILL.md keeps only the always-needed rules; the rest moved verbatim into references/ (skill-slim).
// Rule-text pins read SKILL.md together with those reference files, so no rule can silently disappear.
const skillReferenceFiles = ['procedure.md', 'intent-bridge.md'].map((name) => path.join(path.dirname(skillFile), 'references', name));
async function readSkillWithReferences() {
  return (await Promise.all([skillFile, ...skillReferenceFiles].map((file) => fs.readFile(file, 'utf8')))).join('\n');
}

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
    expect(text).toContain('필요한 파일만 명령 하나로 읽고, 읽은 파일은 다시 읽지 않습니다');
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
    const skill = await readSkillWithReferences();
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
    const skill = await readSkillWithReferences();
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
    expect(text).toMatch(/이미 확보한 근거로 보고·검증·핸드오프의 모호함을 줄이면 우선 씁니다/);
    expect(text).toMatch(/쓸 수 없거나 Provider 정책으로 막혀 있으면 작업을 멈추지 않고 JuTell Skill로 계속/);
    expect(text).toMatch(/실제로 호출해 응답을 받은 경우에만 JuTell MCP를 사용했다고 말합니다/);
  });

  it('SKILL.md gives the same completion-boundary trigger and does not require MCP on every step', async () => {
    const skill = await readSkillWithReferences();
    expect(skill).toMatch(/최종 보고를 쓰기 직전 한 번만 한다/);
    expect(skill).toMatch(/파일을 읽거나 도구를 쓸 때마다.*반복 확인하지 않는다/);
    expect(skill).toMatch(/MCP를 사용할 수 없으면 `references\/report-format\.md` 등 이 Skill의 참고 문서로 대신한다/);
  });

  it('no surface tells the Agent it MUST call JuTell MCP every time', async () => {
    const skill = await readSkillWithReferences();
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
    const skill = await readSkillWithReferences();
    expect(skill).toContain('이 섹션만을 위해 파일을 다시 읽거나 git diff를 다시 실행하지 않는다');
    expect(skill).toMatch(/저장소 재탐색, 테스트 재실행.*만들지 않는다/);
  });
});

describe('slim SKILL.md (skill-slim)', () => {
  it('stays small: SKILL.md is re-sent on every agent step', async () => {
    expect((await fs.stat(skillFile)).size).toBeLessThanOrEqual(6144);
  });

  it('keeps the every-time rules in SKILL.md itself', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    for (const text of [
      '`references/report-format.md`',
      '맨 아래 줄은 항상 `한 줄 요약:`으로 끝낸다',
      'checked(직접 확인한 것)에는 실제로 실행하거나 읽은 것만 쓴다',
      '요청이 테스트·실행 결과·화면 확인을 필요로 하면 관련 테스트를 실행한다',
      '다음 행동 제안은 최대 3개',
      '`.jutell-local/receipt.json`을 파일 편집 도구로(셸 금지) 쓰고, 인자 없이 `jutell receipt`를 한 번 실행',
      '비밀정보를 출력할 수 있는 명령은 실행하지 않는다',
      '`get_beginner_report_rules`를 한 번 호출한다',
      // Dogfooder fixes
      '`unchecked`는 빼지 말고, 없으면 없다고 쓴다',
      '사용자가 말한 조건을 모두 확인했을 때만 완료',
      '적용하지 않을 상황:',
      '사용자에게 질문하기로 했을 때, 또는 불확실함을 어떻게 분류할지 애매할 때 읽는다',
      '다음 AI에게 넘기기(핸드오프)를 요청받았을 때, 설정 파일 오류가 있을 때',
      '원문을 붙여 넣지 않는다',
      "'종료 코드 0' 대신 '테스트 통과'",
      '요청에 이름이 나오지 않은 TODO·할 일·작업 목록 파일(예: TODO.md, tasks)은 찾지도(목록 보기·검색 포함) 읽지도 않는다',
      '일관된 존댓말',
    ]) expect(skill).toContain(text);
  });

  it('points to every moved section, and the moved sections exist in references/', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toContain('`references/procedure.md`');
    expect(skill).toContain('`references/intent-bridge.md`');
    expect(skill).toContain('필요할 때만');
    const [procedure, intent] = await Promise.all(skillReferenceFiles.map((file) => fs.readFile(file, 'utf8')));
    for (const heading of ['## 적용 전 읽기', '## 적용하지 않을 상황', '## 설정 해석 절차', '## MCP 서버 선택', '## 실행 절차', '## 작업 유형별 출력', '## 코드 또는 Diff 설명']) expect(procedure).toContain(heading);
    for (let rule = 1; rule <= 19; rule += 1) expect(procedure).toMatch(new RegExp(`^${rule}\\. `, 'm'));
    for (const heading of ['## Intent Bridge', '### 언제 보여주나', '#### ASK_USER 판단 기준', '### 질문은 최대 하나', '### 형식', '### 위험이 있는 요청', '### 한 번만 확인한다']) expect(intent).toContain(heading);
  });
});

describe('exact tool names, so agents do not search their tool list', () => {
  const CODEX_ONLY = ['apply_patch', 'exec_command', 'ALL_TOOLS'];
  const CODEX_SENTENCE = /Codex: [^.]*\./g;

  async function blocks(receiptReport?: boolean) {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-tool-names-'));
    temporaryRoots.push(tmp);
    if (receiptReport === false) await fs.writeFile(path.join(tmp, '.jutell.json'), JSON.stringify({ version: 1, profile: 'balanced', features: { receiptReport: false } }));
    // `use codex` and `use opencode` both write AGENTS.md through ensureJuTellAgentsBlock (use.ts);
    // `use claude` writes CLAUDE.md through ensureJuTellClaudeMdBlock (installer/claude.ts).
    await ensureJuTellAgentsBlock(tmp);
    await ensureJuTellClaudeMdBlock(tmp);
    return { agents: await fs.readFile(path.join(tmp, 'AGENTS.md'), 'utf8'), claude: await fs.readFile(path.join(tmp, 'CLAUDE.md'), 'utf8') };
  }

  it('Codex AGENTS.md: exact Codex names, all inside the labelled "Codex:" sentence', async () => {
    const { agents } = await blocks();
    expect(agents).toContain('- 도구가 보이면 바로 호출하고, 안 보이면 검색하지 말고 Skill로 계속합니다. Codex: 도구 목록(ALL_TOOLS) 검색 없이 파일 편집 `apply_patch`, 보고 규칙 `mcp__jutell__get_beginner_report_rules`, 셸 `exec_command`. `jutell receipt`는 도구가 아닌 셸 명령입니다.');
  });

  it('OpenCode AGENTS.md (same file): no Codex name appears outside the "Codex:" label', async () => {
    const { agents } = await blocks();
    const unlabelled = agents.replace(CODEX_SENTENCE, '');
    for (const name of CODEX_ONLY) expect(unlabelled).not.toContain(name);
    expect(unlabelled).not.toContain('`Edit`');
    expect(unlabelled).not.toContain('`Bash`');
  });

  it('CLAUDE.md: Claude Code names only, no Codex names or ALL_TOOLS', async () => {
    const { claude } = await blocks();
    expect(claude).toContain('- 도구가 보이면 바로 호출하고, 안 보이면 검색하지 말고 Skill로 계속합니다. 파일 편집 `Edit`/`Write`, 보고 규칙 `mcp__jutell__get_beginner_report_rules`, 셸 `Bash`. `jutell receipt`는 도구가 아닌 셸 명령입니다.');
    for (const name of CODEX_ONLY) expect(claude).not.toContain(name);
    expect(claude).not.toContain('Codex:');
  });

  it('with receiptReport off, the tool names stay but the receipt command is not mentioned', async () => {
    const { agents, claude } = await blocks(false);
    for (const text of [agents, claude]) {
      expect(text).toContain('mcp__jutell__get_beginner_report_rules');
      expect(text).not.toContain('jutell receipt');
    }
  });

  it('SKILL.md (shared by every agent): call visible tools directly, else continue with the Skill; Codex names labelled', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toContain('도구가 보이면 바로 호출하고, 안 보이면 검색하지 말고 Skill로 계속한다(Codex: `mcp__jutell__get_beginner_report_rules`, `apply_patch`). `jutell receipt`는 셸 명령이다.');
    expect(skill.replace(/\(Codex: [^)]*\)/g, '')).not.toContain('apply_patch');
    expect(skill).not.toContain('exec_command');
    expect(skill).not.toContain('ALL_TOOLS');
  });

  it('screen checks: if you did not see it yourself, it goes to unchecked (SKILL.md and AGENTS.md)', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    const { agents } = await blocks();
    expect(skill).toContain('직접 보지 않았으면 화면은 unchecked에 쓴다(파일을 읽은 것은 화면 확인이 아니다).');
    expect(agents).toContain('직접 보지 않았으면 화면은 unchecked에 씁니다(파일을 읽은 것은 화면 확인이 아닙니다).');
  });

  it('scope rule opens only requested, changed, and check-needed files (B3)', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toContain('요청에 적힌 파일, 바꿀 파일, 그리고 확인(규칙 3·5)에 직접 필요한 파일만 연다.');
  });
});
