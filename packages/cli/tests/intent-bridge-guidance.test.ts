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
const reportFormatFile = path.join(repoRoot, '.agents', 'skills', 'beginner-bridge', 'references', 'report-format.md');

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

// JUTELL-V2.2-MINIMUM-SCOPE-GUARDRAIL-01: guards the V2.2 scope guardrail
// built on top of V2.0's understanding-check and V2.1's clarification-quality
// triage above - what the Agent may change, what it must leave alone, and
// what supporting edits are legitimate versus scope creep. Reuses existing
// vocabulary (건드리면 안 되는 것 / 유지할 것 / 범위 밖) rather than
// inventing a parallel system, and folds every internal category into the
// existing epistemic model instead of adding a sixth one.

describe('DO_NOT_CHANGE reuses existing vocabulary (A)', () => {
  it('names 건드리지 말 것 as an Intent Bridge field, distinct from 유지할 것', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toContain('건드리지 말 것 (있을 때만)');
    expect(skill).toMatch(/사용자가 말했거나 요청 자체로 명백히 손대면 안 되는 부분/);
  });

  it('reuses the exact "색상은 건드리지 마" / "기능은 건드리지 마" style examples already used elsewhere in the product', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toContain('색상은 건드리지 마');
    expect(skill).toContain('기능은 건드리지 마');
  });
});

describe('PRESERVE_BEHAVIOR stays distinct from file immutability (B)', () => {
  it('defines 유지할 것 as behavior that must keep working even when its implementing files are edited', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/유지할 것 \(있을 때만\)\n\(파일은 바뀌어도 계속 그대로 동작해야 하는 것\)/);
  });

  it('explicitly refuses to equate "file touched" with "behavior changed"', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    const count = [...skill.matchAll(/"파일을 건드렸다"를? ?"동작이 바뀌었다"/g)].length;
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('distinguishes DO_NOT_CHANGE from PRESERVE_BEHAVIOR in one explicit sentence', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/건드리지 말 것과 유지할 것은 다르다/);
  });
});

describe('No permanent CAN_CHANGE field (C)', () => {
  it('explicitly declines to add a separate "what may be changed" field, folding it into the existing 원하는 것 field', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/Intent Bridge의 "원하는 것"이 곧 직접 범위이며, 이를 별도의 "무엇을 바꿔도 되는지" 필드로 다시 만들지 않는다/);
  });

  it('the template itself has no 무엇을 바꿔도 되는지 / CAN_CHANGE field', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    const templateStart = skill.indexOf('제가 이렇게 이해했어요.');
    const templateEnd = skill.indexOf('```', templateStart);
    const template = skill.slice(templateStart, templateEnd);
    expect(template).not.toMatch(/무엇을 바꿔도 되는지|CAN_CHANGE/);
  });
});

describe('NECESSARY_SUPPORTING_CHANGE is explicitly allowed without asking (D, E, F)', () => {
  it('names the four conditions: required for correctness/safety/consistency, same feature area, no new capability, no reversing a decision already made', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/직접 범위를 올바르고 안전하고 일관되게 완료하기 위해 함께 손봐야 하는 부분/);
    expect(skill).toMatch(/같은 기능 영역 안에 머물고, 요청하지 않은 새 기능을 더하지 않고, 사용자가 이미 정한 것을 뒤집지 않는 한 필수 관련 수정은 따로 허락을 구하지 않고 진행한다/);
  });

  it('gives the field-removal example (removing a field requires updating its validation/tests/labels)', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/필드 하나를 없애면 그 필드를 참조하던 검증·테스트·안내 문구도 함께 정리한다/);
  });

  it('explicitly warns against over-constraining a supporting change into a literal one-line edit', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/"한 줄만 고친다"로 좁게 해석해 안전한 완료에 필요한 관련 수정까지 막지 않는다/);
  });

  it('clarifies that touching/inspecting a do-not-change area for a supporting change is not the same as changing its value', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/이 부분을 열어보거나 필수 관련 수정으로 훑어보는 것과, 실제로 그 값이나 동작을 바꾸는 것을 같은 것으로 보지 않는다 — 후자만 금지한다/);
  });
});

describe('Beneficial-but-unauthorized changes never execute silently (G, H)', () => {
  it('states plainly that a better-seeming improvement outside the direct scope is not performed without authorization', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/Agent가 보기에 더 나은 개선이라도 사용자 허락 없이는 범위를 넓히지 않는다/);
  });

  it('routes an unauthorized-but-useful improvement to the existing 범위 밖 / next-action-suggestion reporting path instead of a new suggestion engine', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/유용하면 최종 보고서에서 범위 밖 관찰이나 기존 다음 행동 제안\(최대 3개\)으로만 짧게 알리고, 건드리지 않았다는 사실 자체를 숨기지 않는다/);
    const reportFormat = await fs.readFile(reportFormatFile, 'utf8');
    expect(reportFormat).toMatch(/조용히 수행하지 않는다.*다음 행동 제안\(6\.6\)이나 범위 밖 관찰로 짧게만 언급/);
  });

  it('forbids turning the current task into the discovered improvement task', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/지금 요청을 그 개선 작업으로 바꾸지 않는다/);
  });
});

describe('A broader scope decision reuses the existing V2.1 ASK_USER rule, not a new engine (I)', () => {
  it('gates the one allowed scope question on the same two ASK_USER conditions already defined for Intent Bridge', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/이번 요청 없이는 직접 범위를 안전하고 올바르게 완료할 수 없고, 그 답에 따라 결과가 크게 달라지거나 사용자 의도를 어길 위험이 있을 때만 위 Intent Bridge의 ASK_USER 판단 기준을 그대로 적용해 최대 한 번 묻는다/);
  });

  it('explicitly refuses a separate scope-only question system', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/범위 전용 질문 체계를 새로 만들지 않는다/);
  });
});

describe('Inferred scope stays labeled as inference (J)', () => {
  it('keeps the SAFE_INFERENCE non-promotion rule intact, which scope inferences fall under', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/SAFE_INFERENCE를 조용히 사용자 의도로 승격하지 않는다/);
  });

  it('shows the two new scope fields only when meaningful, same as every other optional Intent Bridge field', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/사용자가 말했거나 요청 자체로 명백할 때만 이 두 필드를 보여주고, 모든 요청에 습관적으로 채우지 않는다/);
  });
});

describe('Precise requests gain no new ceremony from the scope guardrail (K)', () => {
  it('keeps the precise-request bypass examples and heading order unchanged', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    for (const example of ["README에서 'teh'를 'the'로 고쳐줘", 'list.js의 remove 함수 테스트 하나 추가해줘', "버튼 텍스트를 '로그인'에서 '시작하기'로 바꿔줘"]) {
      expect(skill).toContain(example);
    }
  });

  it('states the direct/supporting/do-not-change/preserve/out-of-scope split applies silently even when Intent Bridge itself is not shown', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/정밀한 요청처럼 Intent Bridge를 보여줄 필요가 없을 때도 조용히 적용되는 내부 판단이다/);
  });
});

describe('Unrelated broad refactor is explicitly forbidden (L)', () => {
  it('names OUT_OF_SCOPE (범위 밖) as anything the current request does not require, regardless of Agent opinion', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/범위 밖: 이번 요청이 요구하지 않는 부분/);
  });
});

describe('AGENT_DISCOVERED_CONSTRAINT folds into the existing AGENT_CHECK category, not a sixth one', () => {
  it('documents a discovered technical constraint (e.g. element IDs the login code depends on) as an AGENT_CHECK usage note', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/AGENT_CHECK에는 필수 관련 수정 범위를 정하는 데 필요한 기술적 제약 확인도 포함된다/);
    expect(skill).toMatch(/이런 제약은 사용자의 의도가 아니라 Agent가 직접 확인한 구현 사실이며, 새로운 분류를 따로 만들지 않고 이 AGENT_CHECK 안에서 다룬다/);
  });
});

describe('V2.0/V2.1 guidance remains intact under the scope guardrail (M)', () => {
  it('keeps the one-question-max and zero-question-path sections unchanged', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/ASK_USER가 필요하면 질문은 최대 하나다/);
    expect(skill).toMatch(/Intent Bridge가 항상 사용자 질문을 요구하지는 않는다/);
  });

  it('keeps the feature gate and one-round-trip cap unchanged', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/`requestClarificationGuide`\s*Feature가 꺼져 있으면 이 절차 전체를 적용하지 않고 평소처럼 바로 진행한다/);
    expect(skill).toMatch(/이 확인은 요청당 최대 한 번이다/);
  });
});

describe('No new MCP tool / UI / storage / policy engine for the scope guardrail (N)', () => {
  it('keeps the MCP tool count at exactly 5 (unchanged from V2.0/V2.1)', async () => {
    const src = await fs.readFile(mcpIndexFile, 'utf8');
    const toolNames = [...src.matchAll(/registerTool\('([a-z_]+)'/g)].map((m) => m[1]);
    expect(toolNames).toEqual(['get_bridge_status', 'get_active_features', 'get_report_preferences', 'get_beginner_report_rules', 'get_safe_report_requirements']);
  });

  it('does not mention scope/guardrail concepts inside the MCP server (guidance-only, no runtime policy code)', async () => {
    const src = await fs.readFile(mcpIndexFile, 'utf8');
    expect(src).not.toMatch(/DO_NOT_CHANGE|CAN_CHANGE|PRESERVE_BEHAVIOR|scope guardrail/i);
  });

  it('introduces no new Feature ID - the scope guardrail rides on the existing requestClarificationGuide gate', async () => {
    const managed = await fs.readFile(path.join(repoRoot, 'packages', 'cli', 'src', 'config', 'managed.ts'), 'utf8');
    expect(managed).toContain("'requestClarificationGuide'");
    expect(managed).not.toMatch(/scopeGuardrail|scopeGuidance|DO_NOT_CHANGE/);
  });
});
