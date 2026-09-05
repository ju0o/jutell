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

// JUTELL-V2.1-CLARIFICATION-QUALITY-01: guards the V2.1 clarification-quality
// refinement on top of the V2.0 minimum loop above - triage unresolved items
// before ever asking, allow a legitimate zero-question path, cap ASK_USER at
// one question chosen by product impact (not by technical difficulty or list
// order), replace the generic closing confirmation with the decision question
// itself, and forbid re-asking the same choice in different words.

describe('AGENT_CHECK is resolved before ASK_USER is considered (A)', () => {
  it('names AGENT_CHECK as a repository/code/environment fact-finding step the Agent does before building a question', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/질문을 만들기 전에, Agent가 스스로 확인할 수 있는 사실은 먼저 확인한다/);
  });

  it('sequences AGENT_CHECK before the ASK_USER question in both the trigger list and the zero-question flow', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    const triageIndex = skill.indexOf('AGENT_CHECK — 먼저 저장소에서 확인한다');
    const oneQuestionIndex = skill.indexOf('### 질문은 최대 하나');
    expect(triageIndex).toBeGreaterThan(-1);
    expect(oneQuestionIndex).toBeGreaterThan(triageIndex);

    const flowIndex = skill.indexOf('### 질문 없이 진행하는 경로');
    const checkStepIndex = skill.indexOf('Agent가 확인 가능한 사실(AGENT_CHECK)을 먼저 확인한다');
    expect(checkStepIndex).toBeGreaterThan(flowIndex);
  });
});

describe('Zero-question path is explicitly allowed (B)', () => {
  it('states plainly that Intent Bridge does not always require a user question', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/Intent Bridge가 항상 사용자 질문을 요구하지는 않는다/);
  });

  it('allows proceeding without a question when only SAFE_INFERENCE / NON_BLOCKING_UNKNOWN remain, and forbids the generic closing question in that case', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/남은 것이 SAFE_INFERENCE나 NON_BLOCKING_UNKNOWN뿐이고 실제 BLOCKING_UNKNOWN이 남지 않으면/);
    expect(skill).toMatch(/판단할 실제 사용자 결정이 남아 있지 않으므로 "이대로 진행해도 될까요\?" 같은 형식적인 확인 질문도 만들지 않는다/);
  });
});

describe('Maximum one user question (C)', () => {
  it('caps ASK_USER at one question and requires removing AGENT_CHECK/SAFE_INFERENCE/NON_BLOCKING_UNKNOWN items before choosing it', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/ASK_USER가 필요하면 질문은 최대 하나다/);
    expect(skill).toMatch(/질문을 고르기 전에 다음을 모두 제외한다/);
  });

  it('picks the item with the largest divergence from what the user plausibly intended, not the most technical, hardest, or first-listed item', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/사용자가 실제로 원했을 것과 가장 크게 달라지는 항목 하나만 고른다/);
    expect(skill).toMatch(/가장 기술적인 항목/);
    expect(skill).toMatch(/구현이 가장 어려운 항목/);
    expect(skill).toMatch(/목록에서 첫 번째로 나온 항목/);
    expect(skill).toMatch(/질문의 가치가 구현 편의보다 우선한다/);
  });

  it('forbids a scoring system, confidence percentages, or a question-ranking engine', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/점수판, confidence 퍼센트, 질문 순위를 매기는 엔진을 따로 만들지 않는다/);
  });
});

describe('The specific decision question replaces the generic closing confirmation (D)', () => {
  it('no longer ends the fixed template with a generic "proceed as-is?" line', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    const templateStart = skill.indexOf('제가 이렇게 이해했어요.');
    const templateEnd = skill.indexOf('```', templateStart);
    expect(templateStart).toBeGreaterThan(-1);
    const template = skill.slice(templateStart, templateEnd);
    expect(template).not.toMatch(/이대로 진행해도 될까요\?/);
  });

  it('states that when a real user decision remains, the closing sentence itself is that decision question', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/그 결정을 묻는 문장 하나만 덧붙인다. 이 문장 자체가 질문이다/);
    expect(skill).toMatch(/실제 사용자 결정이 남아 있지 않으면 이 문장을 만들지 않는다/);
  });
});

describe('Duplicate equivalent confirmation is forbidden (E)', () => {
  it('forbids appending a generic confirmation after, or instead of, the one decision question', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/일반적인 확인 문구를 결정 질문 대신, 또는 결정 질문에 이어 덧붙이지 않는다/);
  });

  it('forbids re-asking the same choice in different words after the one question is asked', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/질문 하나를 물은 뒤에는 같은 내용을 다른 말로 다시 확인하지 않는다/);
    expect(skill).toMatch(/같은 선택을 다른 표현으로 두 번 묻는 형태를 만들지 않는다/);
  });
});

describe('Technical repository facts must not be asked of the user when inspectable (F)', () => {
  it('gives the CSS-framework and component-location questions as bad examples the Agent should check instead of asking', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toContain('어떤 CSS 프레임워크를 쓰고 계신가요?');
    expect(skill).toContain('로그인 버튼이 있는 컴포넌트가 어디인가요?');
    expect(skill).toMatch(/사용자는 저장소 조회 도구가 아니다/);
  });

  it('lists concrete inspectable facts the Agent checks itself before ever asking', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    for (const fact of ['현재 사용 중인 framework', '파일·컴포넌트 위치', '현재 화면 구조', '기존 스타일', '기존 입력 필드', '현재 동작', '테스트 framework', '기존 반응형 처리 방식']) {
      expect(skill, `expected AGENT_CHECK examples to include "${fact}"`).toContain(fact);
    }
  });
});

describe('SAFE_INFERENCE stays labeled as inference (G)', () => {
  it('requires SAFE_INFERENCE to be reversible, non-constraining, and still visibly labeled as inference', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/되돌릴 수 있고 결과를 크게 제한하지 않는, 위험이 낮은 추론/);
    expect(skill).toMatch(/이때도 필요한 곳에는 추론이라는 표시를 남긴다/);
  });

  it('forbids silently promoting a safe inference to user intent', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/SAFE_INFERENCE를 조용히 사용자 의도로 승격하지 않는다/);
  });
});

describe('NON_BLOCKING_UNKNOWN does not force a question (H)', () => {
  it('keeps a safely-unknown item unknown instead of forcing a question, and allows surfacing it in Intent Bridge or the final report', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/작업을 안전하게 진행할 수 있으면, 억지로 질문을 만들지 않는다/);
    expect(skill).toMatch(/필요하면 Intent Bridge의 "아직 정하지 않은 것" 항목이나 최종 보고서에 남긴다/);
  });
});

describe('BLOCKING_UNKNOWN may require ASK_USER (I)', () => {
  it('names guessing-could-be-materially-wrong as the condition that makes an unknown eligible for ASK_USER', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/추측이 실제로 잘못된 제품 결과로 이어질 수 있으면 BLOCKING_UNKNOWN이 되고, ASK_USER 대상이 될 수 있다/);
  });

  it('gives the behavior-change, field-removal, payment-flow, and polish-vs-redesign examples without over-generalizing them', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    for (const example of ['기존 동작이 실제로 바뀔 수 있는지', '기존 필드가 실제로 삭제될 수 있는지', '결제 흐름 요구사항이 실제로 바뀔 수 있는지', '가벼운 정리인지, 전체적인 느낌을 바꾸는 재설계인지']) {
      expect(skill, `expected BLOCKING_UNKNOWN examples to include "${example}"`).toContain(example);
    }
    expect(skill).toMatch(/이 예시를 다른 상황까지 과도하게 일반화하지 않는다/);
  });
});

describe('Risk-adjacent requests lean toward ASK_USER without a new risk system', () => {
  it('reuses the existing risk-level-guide vocabulary for payment/auth/data-loss areas', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/`references\/risk-level-guide\.md`의 위험 어휘를 그대로 재사용한다/);
    expect(skill).toContain('결제, 로그인과 인증·권한, 데이터베이스 구조나 데이터 손실');
  });

  it('does not force every payment/auth/data request to ask, and keeps the same two-condition rule', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/결제·인증·데이터 관련 요청이라는 이유만으로 모든 요청에 자동으로 질문하지 않는다/);
    expect(skill).toMatch(/새로운 위험 분류 체계를 따로 만들지 않는다/);
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
