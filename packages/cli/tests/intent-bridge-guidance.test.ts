import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureJuTellAgentsBlock } from '../src/installer/agents.js';

// JUTELL-V2.0-INTENT-BRIDGE-MINIMUM-LOOP-01: guards the V2.0 minimum loop -
// a User -> Agent understanding-check that fires only on material ambiguity,
// separates said/understood/inferred/unknown, and caps itself at one
// round-trip. These are semantic-anchor checks against the actual guidance
// text (SKILL.md, the generated AGENTS.md block, and the MCP tool list),
// not brittle sentence-for-sentence pinning.

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const skillFile = path.join(repoRoot, '.agents', 'skills', 'beginner-bridge', 'SKILL.md');
const mcpIndexFile = path.join(repoRoot, 'apps', 'mcp-server', 'src', 'index.ts');

const temporaryRoots: string[] = [];
afterEach(async () => {
  for (const r of temporaryRoots.splice(0)) await fs.rm(r, { recursive: true, force: true });
});

describe('Intent Bridge trigger rule (A, B, C)', () => {
  it('names the given materially-ambiguous examples as cases that should show Intent Bridge', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    for (const example of ['로그인 화면 좀 더 깔끔하게 해줘', '이 버튼 좀 더 좋게 바꿔줘', '회원가입 좀 간단하게 만들어줘']) {
      expect(skill, `expected the trigger-example list to include "${example}"`).toContain(example);
    }
    // These must appear under the "보여줘야 하는 예" (should-show) heading, not the "보여주지 않는 예" heading.
    const showIndex = skill.indexOf('보여줘야 하는 예');
    const skipIndex = skill.indexOf('보여주지 않는 예');
    expect(showIndex, 'expected a "should show" examples heading').toBeGreaterThan(-1);
    expect(skipIndex, 'expected a "should not show" examples heading').toBeGreaterThan(showIndex);
  });

  it('names the given precise examples as cases that should proceed normally, even though they are short', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    const skipIndex = skill.indexOf('보여주지 않는 예');
    expect(skipIndex).toBeGreaterThan(-1);
    const afterSkipHeading = skill.slice(skipIndex);
    for (const example of ["README에서 'teh'를 'the'로 고쳐줘", 'list.js의 remove 함수 테스트 하나 추가해줘', "버튼 텍스트를 '로그인'에서 '시작하기'로 바꿔줘"]) {
      expect(afterSkipHeading, `expected "${example}" to appear in or after the "should not show" section`).toContain(example);
    }
  });

  it('explicitly rules out request length as the trigger condition', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/요청이 짧다는 이유만으로 보여주지 않는다/);
    expect(skill).toMatch(/짧아도 이미 명확함/);
  });
});

describe('Intent Bridge epistemic model (D, E)', () => {
  const skill = fs.readFile(skillFile, 'utf8');

  it('requires inferred information to be visibly labeled and never presented as user-said', async () => {
    const text = await skill;
    expect(text).toMatch(/JuTell이 추론한 것.*반드시 추론이라고 표시한다/);
    expect(text).toMatch(/절대 사용자가 직접 말한 것으로 바꿔 쓰지 않는다/);
  });

  it('requires unknown information to stay unknown, never silently filled or promoted to a requirement', async () => {
    const text = await skill;
    expect(text).toMatch(/아직 정하지 않은 것.*모르는 채로 남긴다/);
    expect(text).toMatch(/추측으로 채우거나 요구사항으로 바꾸지 않는다/);
  });

  it('keeps AGENT_SHOULD_CHECK scoped to repository/code facts, not user decisions', async () => {
    const text = await skill;
    expect(text).toMatch(/Agent가 먼저 확인할 것.*사용자가 결정할 일이 아니라/);
  });

  it('defines all five epistemic categories', async () => {
    const text = await skill;
    for (const category of ['USER_SAID', 'UNDERSTOOD', 'INFERRED', 'UNKNOWN', 'AGENT_SHOULD_CHECK']) {
      expect(text, `expected the ${category} category to be named`).toContain(category);
    }
  });
});

describe('Intent Bridge one-round-trip cap (F)', () => {
  it('caps the check at one per request and forbids repeating it', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/이 확인은 요청당 최대 한 번이다/);
    expect(skill).toMatch(/JuTell이 Intent Bridge를 다시 반복하지 않는다/);
  });

  it('hands remaining ambiguity back to normal Agent judgment instead of a JuTell-run questionnaire engine', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/평소 Agent의 판단과 질문 방식을 따른다/);
    expect(skill).toMatch(/여러 번 되묻는 질문 엔진을 만들지 않는다/);
  });
});

describe('Intent Bridge feature gate (G)', () => {
  it('is fully inactive when requestClarificationGuide is off', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    // Both the dedicated section and the execution-procedure step must gate on the feature.
    expect(skill).toMatch(/`requestClarificationGuide`\s*Feature가 꺼져 있으면 이 절차 전체를 적용하지 않고 평소처럼 바로 진행한다/);
    expect(skill).toMatch(/`requestClarificationGuide`가 켜져 있고 그런 불확실함이 있으면/);
  });

  it('the trigger step in AGENTS.md also names the feature gate, so a bare Codex session sees it before any change', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-intent-bridge-agents-'));
    temporaryRoots.push(tmp);
    await ensureJuTellAgentsBlock(tmp);
    const text = await fs.readFile(path.join(tmp, 'AGENTS.md'), 'utf8');
    expect(text).toMatch(/실제로 코드나 문서를 바꾸기 전에는.*Intent Bridge 규칙으로 판단합니다/);
    expect(text).toMatch(/requestClarificationGuide.*꺼져 있으면 평소처럼 바로 진행합니다/);
  });
});

describe('No new MCP tool required for Intent Bridge (H)', () => {
  it('keeps the MCP tool count at exactly 5 (unchanged from before this task)', async () => {
    const src = await fs.readFile(mcpIndexFile, 'utf8');
    const toolNames = [...src.matchAll(/registerTool\('([a-z_]+)'/g)].map((m) => m[1]);
    expect(toolNames).toEqual(['get_bridge_status', 'get_active_features', 'get_report_preferences', 'get_beginner_report_rules', 'get_safe_report_requirements']);
  });

  it('does not mention Intent Bridge inside the MCP server (it is a Skill-only, pre-completion behavior)', async () => {
    const src = await fs.readFile(mcpIndexFile, 'utf8');
    expect(src).not.toMatch(/Intent Bridge/i);
  });
});

describe('Auto Invocation completion behavior remains intact (I)', () => {
  it('keeps the existing get_beginner_report_rules completion-boundary trigger unchanged', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toContain('소유자 대상 구현·보고 작업이면 최종 답변을 작성하기 전에 JuTell 보고 규칙');
    expect(skill).toMatch(/최종 보고를 쓰기 직전 한 번만 한다/);
  });

  it('keeps the MCP server preference-with-fallback instructions unchanged', async () => {
    const src = await fs.readFile(mcpIndexFile, 'utf8');
    expect(src).toContain('prefer the canonical jutell server');
    expect(src).toContain('Call get_beginner_report_rules once, at task completion');
  });
});

describe('Intent Bridge stays short and reuses existing vocabulary, not a new parallel system', () => {
  it('points to templates/request-builder/ for optional vocabulary instead of duplicating all 8 steps inline', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/templates\/request-builder\/.*참고해도 되지만/);
    expect(skill).toMatch(/8단계 템플릿 전체를 대화에 그대로 옮기지 않는다/);
  });

  it('requires empty fields to be omitted, not shown blank', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/값이 있는 항목만 보여주고, 빈 항목은 만들지 않는다/);
    expect(skill).toMatch(/모든 필드를 강제로 채우지 않는다/);
  });

  it('forbids translating plain user speech into developer jargon', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/사용자의 평소 말투를 개발자 용어로 바꿔 쓰지 않는다/);
  });
});
