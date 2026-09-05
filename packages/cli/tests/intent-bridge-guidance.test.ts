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
const reportSpecFile = path.join(repoRoot, 'docs', 'BEGINNER_REPORT_SPEC.md');

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

// JUTELL-V2.3-MINIMUM-COMPLETION-CONTRACT-01: guards the V2.3 completion
// contract built on top of V2.0 (understanding-check), V2.1 (clarification
// quality) and V2.2 (scope guardrail). Answers: before saying a request is
// done, has the Agent actually checked that the requested outcome happened
// and that what was supposed to stay untouched actually stayed untouched?
// This is connective tissue only - it reuses the existing 확인 완료/추가
// 확인 필요/일부 확인/작업 보류/범위 밖 report-status model and the existing
// 통과/일부 통과/실패/실행하지 못함/실행하지 않음/검증 수단 없음 verification-
// result vocabulary, and adds no parallel completion system.

describe('Requested outcome must be verified before 확인 완료 (A)', () => {
  it('names 원하는 것 as the first thing verification checks, ahead of any other evidence', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/원하는 것 — 사용자가 실제로 요청한 결과가 실제로 일어났는지/);
    const orderIndex = skill.indexOf('확인 순서는 다음과 같다');
    const outcomeIndex = skill.indexOf('원하는 것 — 사용자가 실제로 요청한 결과가 실제로 일어났는지');
    const regressionIndex = skill.indexOf('위 변경과 직접 관련된 회귀 증거');
    expect(orderIndex).toBeGreaterThan(-1);
    expect(outcomeIndex).toBeGreaterThan(orderIndex);
    expect(regressionIndex).toBeGreaterThan(outcomeIndex);
  });

  it('lists 이번 요청이 실제로 원하는 결과를 만들어냈는지 as a required-before-확인완료 item in the report spec', async () => {
    const spec = await fs.readFile(reportSpecFile, 'utf8');
    expect(spec).toContain('이번 요청이 실제로 원하는 결과(직접 범위)를 만들어냈는지');
  });
});

describe('Explicit preserved requirement must be verified before 확인 완료 (B)', () => {
  it('names 건드리지 말 것·유지할 것 as the second verification priority, reusing V2.2 vocabulary', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/건드리지 말 것·유지할 것 — 사용자가 말했거나 요청 자체로 명백한 보존 조건이 실제로 유지됐는지/);
  });

  it('lists explicit DO_NOT_CHANGE/PRESERVE_BEHAVIOR as important unconfirmed items in the report spec', async () => {
    const spec = await fs.readFile(reportSpecFile, 'utf8');
    expect(spec).toContain('사용자가 명시했거나 요청 자체로 명백한 건드리지 말 것');
    expect(spec).toContain('사용자가 명시했거나 요청 자체로 명백한 유지할 것');
  });

  it('does not use 확인 완료 when a required item is unconfirmed, per the completion gate', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/이 중 하나라도 확인하지 못했다면 `확인 완료` 대신 `추가 확인 필요`·`일부 확인`·`작업 보류` 중 이번 요청과 실제로 맞는 상태를 쓴다/);
  });
});

describe('User-stated completion condition becomes required evidence (C)', () => {
  it('folds a user-stated completion condition into the same preserved-requirements check, with the test-pass and mobile-check examples', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/사용자가 이번 요청에서 완료 조건으로 직접 말한 것\(예: "테스트까지 통과하게 해줘", "모바일에서 안 깨지는 것까지 확인해줘"\)도 여기 포함한다/);
  });

  it('lists a user-stated completion condition in the report spec important-unconfirmed-item extension', async () => {
    const spec = await fs.readFile(reportSpecFile, 'utf8');
    expect(spec).toContain('사용자가 이번 요청에서 완료 조건으로 직접 말한 것');
  });
});

describe('Existing status model reused - no new completion enum (D)', () => {
  it('never introduces COMPLETE_VERIFIED / COMPLETE_WITH_UNVERIFIED / INCOMPLETE anywhere in the guidance', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    const reportFormat = await fs.readFile(reportFormatFile, 'utf8');
    const spec = await fs.readFile(reportSpecFile, 'utf8');
    for (const text of [skill, reportFormat, spec]) {
      expect(text).not.toMatch(/COMPLETE_VERIFIED|COMPLETE_WITH_UNVERIFIED|\bINCOMPLETE\b/);
    }
  });

  it('states the completion gate explicitly reuses the five existing report statuses and adds none', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/새로운 보고서 상태를 만들지 않고 위 다섯 가지 기존 상태만 사용한다/);
  });

  it('still lists exactly the five existing report statuses, unchanged, in the format reference and the spec', async () => {
    const reportFormat = await fs.readFile(reportFormatFile, 'utf8');
    const spec = await fs.readFile(reportSpecFile, 'utf8');
    expect(reportFormat).toMatch(/확인 완료, 추가 확인 필요, 일부 확인, 작업 보류, 범위 밖/);
    for (const status of ['확인 완료', '추가 확인 필요', '일부 확인', '작업 보류', '범위 밖']) {
      expect(spec, `expected the spec to still list report status "${status}"`).toContain(status);
    }
  });
});

describe('No new visible DONE-WHEN block (E)', () => {
  it('adds no new DONE WHEN / COMPLETION CONTRACT / ACCEPTANCE CHECKLIST heading (a pre-existing inline mention of template vocabulary is not a new block)', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    const reportFormat = await fs.readFile(reportFormatFile, 'utf8');
    const spec = await fs.readFile(reportSpecFile, 'utf8');
    for (const text of [skill, reportFormat, spec]) {
      expect(text).not.toMatch(/^#{1,3}\s*(DONE WHEN|COMPLETION CONTRACT|ACCEPTANCE CHECKLIST)/im);
    }
    // the one legitimate pre-existing mention (template vocabulary reference) still stays inline, not a heading
    expect(skill).toMatch(/어휘\(WHY·IMPORTANT·DO NOT CHANGE·DONE WHEN 등\)/);
  });

  it('keeps the completion gate inside the internal execution procedure, not a new report section template', async () => {
    const reportFormat = await fs.readFile(reportFormatFile, 'utf8');
    // the report-format templates (## headings) gain no new section for this
    const sectionHeadings = [...reportFormat.matchAll(/^## .+$/gm)].map((m) => m[0]);
    expect(sectionHeadings.some((h) => /완료 조건|Completion|Done/i.test(h))).toBe(false);
  });
});

describe('Task-shaped smallest relevant verification (F, G)', () => {
  it('gives the README-typo-is-diff-enough and phone-field-needs-tests examples', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/README 오타 하나처럼 작은 작업은 diff 확인만으로 충분하고, 전화번호 입력 필드 제거처럼 검증·테스트와 실제로 연결된 작업은 관련 테스트까지 실행한다/);
  });

  it('explicitly refuses to run unrelated verification merely because a full suite exists', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/프로젝트에 전체 테스트나 검증 수단이 있다는 이유만으로 이번 요청과 관계없는 검증까지 실행하지 않는다/);
  });
});

describe('Directly-related tests required when they support outcome/preserved behavior (H)', () => {
  it('requires directly-related tests regardless of whether a project-wide suite exists', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/위 1·2번과 직접 관련된 테스트는 그 테스트가 실제로 그 결과나 보존 조건을 확인해줄 때 실행한다 — 프로젝트에 전체 테스트가 있는지 여부와 관계없다/);
  });
});

describe('Unavailable secondary verification does not automatically mean 작업 보류 (I)', () => {
  it('ties browser/visual verification necessity to whether it was a core completion condition, not an automatic hold', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/이런 보조 확인 수단이 없다는 사실만으로 바로 `작업 보류`가 되지는 않는다 — 그 확인이 이번 요청의 완료 조건 자체였는지에 따라 달라진다/);
  });

  it('does not launch a browser for verification unless materially needed for this request', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/실제 화면 확인이 이번 요청의 결과나 완료 조건을 뒷받침하는 데 실제로 필요한 경우가 아니면 이 확인만을 위해 브라우저를 새로 켜지 않는다/);
  });
});

describe('False verification remains forbidden (J) and unrun verification cannot be reported as passed (K)', () => {
  it('reinforces the unconditional rule with the canonical phrase, alongside the pre-existing one', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/실행하지 못한 검증을 통과했다고 쓰지 않는다\. 확인하지 못한 것은 확인했다고 쓰지 않는다\./);
  });

  it('does not add a separate false-verification subsystem or new vocabulary for it', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).not.toMatch(/false.?verification|FALSE_VERIFICATION/i);
  });
});

describe('One-round-trip cap remains global across the request, no second post-work questionnaire (L, M, N)', () => {
  it('routes a completion-blocking decision found after the one question was used to 작업 보류 / 사용자 결정 필요, not a second question', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/이미 질문을 한 번 사용했다면, 같은 내용을 다른 말로 다시 묻지 않는다/);
    expect(skill).toMatch(/보고서 상태를 `작업 보류`로 두고, 남은 결정 하나를 `사용자 결정 필요`로 짧게 설명한 뒤 사용자의 다음 답을 기다린다/);
  });

  it('frames this as reusing the existing one-question rule, not a new question engine', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/이것도 별도의 질문 엔진이 아니라 이 절의 한 번만 확인한다 규칙과 기존 보고서 상태를 그대로 적용한 것이다/);
  });

  it('keeps the original one-question-per-request cap sentence unchanged', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/이 확인은 요청당 최대 한 번이다/);
  });
});

describe('Evidence reuse encouraged (O)', () => {
  it('tells the Agent not to reread files or rerun verification already proven by existing evidence', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/이미 작업 중에 확보한 근거로 위 조건이 증명됐다면, 형식을 맞추려고 같은 파일을 다시 읽거나 같은 검증을 다시 실행하지 않는다/);
  });
});

describe('Agent-inferred completion stays labeled as inference, no forced checklist (part of O/F)', () => {
  it('labels self-derived completion checks as INFERRED, never silently promoted to USER_SAID', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/이는 추론\(INFERRED\)이며, 사용자가 말한 것\(USER_SAID\)으로 바꿔 쓰지 않는다/);
  });

  it('only surfaces the said-vs-inferred distinction when materially useful, not as a routine checklist', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/이 구분이 사용자 이해에 실제로 중요할 때만 보고서에 드러내고, 매번 체크리스트로 보여주지 않는다/);
  });
});

describe('V2.0/V2.1/V2.2 guidance preserved under the completion contract (P)', () => {
  it('keeps the Intent Bridge trigger rule, epistemic model, and one-question-max sections unchanged', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/요청이 짧다는 이유만으로 보여주지 않는다/);
    expect(skill).toMatch(/ASK_USER가 필요하면 질문은 최대 하나다/);
    expect(skill).toMatch(/`requestClarificationGuide`\s*Feature가 꺼져 있으면 이 절차 전체를 적용하지 않고 평소처럼 바로 진행한다/);
  });

  it('keeps the V2.2 scope categories (DIRECT_SCOPE/NECESSARY_SUPPORTING_CHANGE/DO_NOT_CHANGE/PRESERVE_BEHAVIOR/OUT_OF_SCOPE) intact', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/직접 범위: 사용자가 실제로 요청한 변경 대상 그 자체/);
    expect(skill).toMatch(/필수 관련 수정: 직접 범위를 올바르고 안전하고 일관되게 완료하기 위해 함께 손봐야 하는 부분/);
    expect(skill).toMatch(/건드리면 안 되는 부분: 사용자가 직접 말했거나/);
    expect(skill).toMatch(/유지해야 할 동작: 구현 파일은 바뀌어도 계속 그대로 동작해야 하는 기능/);
    expect(skill).toMatch(/범위 밖: 이번 요청이 요구하지 않는 부분/);
  });

  it('runs all pre-existing V2.0/V2.1/V2.2 tests in this same file unmodified (structural: the describe blocks above this one still exist)', async () => {
    const src = await fs.readFile(new URL(import.meta.url), 'utf8');
    expect(src).toContain("describe('Intent Bridge trigger rule (A, B, C)'");
    expect(src).toContain("describe('DO_NOT_CHANGE reuses existing vocabulary (A)'");
  });
});

describe('No new MCP tool / UI / storage / Feature flag / status enum for the completion contract (Q)', () => {
  it('keeps the MCP tool count at exactly 5 (unchanged from V2.0/V2.1/V2.2)', async () => {
    const src = await fs.readFile(mcpIndexFile, 'utf8');
    const toolNames = [...src.matchAll(/registerTool\('([a-z_]+)'/g)].map((m) => m[1]);
    expect(toolNames).toEqual(['get_bridge_status', 'get_active_features', 'get_report_preferences', 'get_beginner_report_rules', 'get_safe_report_requirements']);
  });

  it('does not mention completion-contract concepts inside the MCP server (guidance-only, no runtime policy code)', async () => {
    const src = await fs.readFile(mcpIndexFile, 'utf8');
    expect(src).not.toMatch(/REQUESTED_OUTCOME|PRESERVED_REQUIREMENTS|completion contract/i);
  });

  it('introduces no new Feature ID for the completion contract', async () => {
    const managed = await fs.readFile(path.join(repoRoot, 'packages', 'cli', 'src', 'config', 'managed.ts'), 'utf8');
    expect(managed).not.toMatch(/completionContract|REQUESTED_OUTCOME|PRESERVED_REQUIREMENTS/);
  });
});

// JUTELL-V2.3-STRUCTURAL-COMPLETION-GUARD-01: two prior prose-only fixes
// (JUTELL-V2.3-PREMATURE-COMPLETION-FIX-01, JUTELL-V2.3-STATUS-SELECTION-
// GATE-FIX-02) were both read verbatim by the Agent in live dogfood and
// both still produced 확인 완료 next to a known completion-critical gap
// (JUTELL-V2.3-COMPLETION-CONTRACT-DOGFOOD-01 and its two retests). A
// structural discovery (JUTELL-V2.3-COMPLETION-DECISION-ARCHITECTURE-
// DISCOVERY-02) found the report *template* itself lists risk/evidence and
// status as independent sibling bullets, and a pre-existing, older
// definition of 확인 완료 (§11.5, "scope-relative completion") gives a
// textually legitimate route around distant procedural prose. This fix
// replaces prose-only enforcement with one optional report field,
// `완료에 필수적인 미확인`, placed immediately before `보고서 상태` in the
// report templates themselves - so the two facts sit adjacent in the
// Agent's own output, not several steps apart in the underlying procedure.
// No new status, no new section, no mock-specific logic, no runtime
// validator - this is the smallest structural option, tried before a
// heavier one.

describe('The optional completion-critical field exists in the report templates (A)', () => {
  it('the simple-task report template includes 완료에 필수적인 미확인 as a bullet', async () => {
    const reportFormat = await fs.readFile(reportFormatFile, 'utf8');
    const templateStart = reportFormat.indexOf('```md');
    const templateEnd = reportFormat.indexOf('```', templateStart + 5);
    const template = reportFormat.slice(templateStart, templateEnd);
    expect(template).toMatch(/완료에 필수적인 미확인: <있을 때만>/);
  });

  it('the spec lists it as an optional item in the 6-item base report structure', async () => {
    const spec = await fs.readFile(reportSpecFile, 'utf8');
    expect(spec).toMatch(/\* 완료에 필수적인 미확인 \(있을 때만 — `보고서 상태` 바로 앞에 적는다\)/);
  });
});

describe('The field is placed immediately before 보고서 상태 (B)', () => {
  it('in the report-format.md template, the field bullet is the line directly above the 보고서 상태 bullet', async () => {
    const reportFormat = await fs.readFile(reportFormatFile, 'utf8');
    const templateStart = reportFormat.indexOf('```md');
    const templateEnd = reportFormat.indexOf('```', templateStart + 5);
    const template = reportFormat.slice(templateStart, templateEnd);
    const lines = template.split('\n').map((l) => l.trim()).filter(Boolean);
    const statusIndex = lines.findIndex((l) => l.startsWith('- 보고서 상태:'));
    expect(statusIndex).toBeGreaterThan(0);
    expect(lines[statusIndex - 1]).toMatch(/^- 완료에 필수적인 미확인:/);
  });

  it('in the spec §4 structure list, the field is listed directly above 보고서 상태', async () => {
    const spec = await fs.readFile(reportSpecFile, 'utf8');
    const idx = spec.indexOf('필요한 경우 마지막에 다음 항목을 추가한다.');
    const section = spec.slice(idx, idx + 300);
    const lines = section.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('*'));
    const statusIndex = lines.findIndex((l) => l === '* 보고서 상태');
    expect(statusIndex).toBeGreaterThan(0);
    expect(lines[statusIndex - 1]).toMatch(/^\* 완료에 필수적인 미확인/);
  });
});

describe('The field is omitted, not shown empty, when no completion-critical gap exists (C)', () => {
  it('states the field is only created when a completion-critical gap is known, and otherwise not created at all', async () => {
    const reportFormat = await fs.readFile(reportFormatFile, 'utf8');
    expect(reportFormat).toMatch(/완료에 필수적인 미확인이 없으면 이 항목 자체를 만들지 않는다/);
  });

  it('the SKILL.md rule tells the Agent not to create the item for non-critical gaps', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/완료에 필수적이지 않은 미확인까지 이 항목을 만들어 곧장 `작업 보류`로 만들지 않는다 — 그런 경우는 이 항목을 만들지 않고 기존 상태 우선순위를 따른다/);
  });
});

describe('The field value must describe the actual gap, not just 있음 (D)', () => {
  it('report-format.md explicitly forbids a bare 있음 value and requires a short concrete description', async () => {
    const reportFormat = await fs.readFile(reportFormatFile, 'utf8');
    expect(reportFormat).toMatch(/값은 "있음"처럼 비워두지 않고 무엇이 미확인·실패 상태인지 한 문장으로 짧게 적는다/);
    expect(reportFormat).toMatch(/외부 신원 인증 서비스 실제 연결/);
  });

  it('the spec worked example shows a concrete description, not a boolean', async () => {
    const spec = await fs.readFile(reportSpecFile, 'utf8');
    expect(spec).toMatch(/완료에 필수적인 미확인: 외부 신원 인증 서비스 실제 연결/);
  });
});

describe('Field present forbids 확인 완료 (E)', () => {
  it('report-format.md states the field blocks 확인 완료 on the very next line', async () => {
    const reportFormat = await fs.readFile(reportFormatFile, 'utf8');
    expect(reportFormat).toMatch(/이 항목이 있으면 바로 다음 줄의 `보고서 상태`에 `확인 완료`를 쓸 수 없다/);
  });

  it('SKILL.md states the same invariant: a report with this item does not use 확인 완료', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/이 항목이 있는 보고서에는 `확인 완료`를 쓰지 않는다/);
  });

  it('the step-19 pre-submit checklist checks the field against the adjacent status line, not a private recollection', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/`완료에 필수적인 미확인` 항목을 적었다면, 바로 다음 줄의 `보고서 상태`가 `확인 완료`가 아닌가/);
  });

  it('passing a related test does not override the field once it is written', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/관련 검증이 통과했다는 사실이 이 판단을 뒤집지 않는다 — 테스트는 실제로 다룬 범위만 증명한다/);
  });
});

describe('§11.5 scope-relative definition cannot exclude a known completion-critical gap (F)', () => {
  it('preserves the original, useful scope-relative meaning of 확인 완료', async () => {
    const spec = await fs.readFile(reportSpecFile, 'utf8');
    expect(spec).toMatch(/`확인 완료`는 프로젝트 전체가 완벽하게 정상 작동한다는 의미가 아니다\./);
    expect(spec).toMatch(/AI Agent가 확인한 작업 범위 안에서 필요한 검증이 완료됐다는 의미다\./);
  });

  it('adds the missing precedence: a known completion-critical gap cannot be defined out of scope', async () => {
    const spec = await fs.readFile(reportSpecFile, 'utf8');
    expect(spec).toMatch(/이 "확인한 작업 범위"를 이용해 완료에 필수적인 미확인·실패를 조용히 빼놓을 수는 없다/);
    expect(spec).toMatch(/그 항목을 단순히 확인 범위 밖으로 제외해서 `확인 완료`를 사용할 수 없다/);
  });

  it('the precedence clause ties back to the same §4 field, not a separate rule', async () => {
    const spec = await fs.readFile(reportSpecFile, 'utf8');
    expect(spec).toMatch(/그런 항목은 §4의 `완료에 필수적인 미확인` 항목에 적고, 이 항목이 있으면 `확인 완료`를 쓰지 않는다/);
  });
});

describe('Case D shape (dogfood-reproduced) yields the completion-critical field (G)', () => {
  it('names the exact reproduced example (external identity verification becoming mandatory after a field is removed)', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/필드 제거로 외부 서비스 연결처럼 이미 중요한 미확인 사항으로 보는 항목에 새로 의존하게 됐는데 그 연결이 확인되지 않은 경우/);
  });

  it('the spec §11.3 worked example shows the field populated for exactly this shape, with 일부 확인 as the resulting status (not hardcoded elsewhere)', async () => {
    const spec = await fs.readFile(reportSpecFile, 'utf8');
    expect(spec).toMatch(/> 완료에 필수적인 미확인: 외부 신원 인증 서비스 실제 연결\n> 보고서 상태: 일부 확인/);
  });
});

describe('Case C shape (secondary, non-critical browser gap) does not qualify for the field (H)', () => {
  it('keeps the pre-existing V2.3 unavailable-secondary-verification clause unchanged - a non-critical gap never triggers 작업 보류', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/이런 보조 확인 수단이 없다는 사실만으로 바로 `작업 보류`가 되지는 않는다/);
  });

  it('the spec explicitly routes a non-critical visual-only gap to 추가 확인 필요 without creating the field', async () => {
    const spec = await fs.readFile(reportSpecFile, 'utf8');
    expect(spec).toMatch(/문구, 색상, 일반 여백처럼 핵심 동작에 영향을 주지 않는 시각적 확인만 남은 경우에는 이 항목을 만들지 않고 `추가 확인 필요`를 사용할 수 있다/);
  });
});

describe('Case A shape (simple, fully-supported README task) does not qualify for the field (I)', () => {
  it('keeps the task-shaped verification priority order and its README/phone-field contrast unchanged', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/README 오타 하나처럼 작은 작업은 diff 확인만으로 충분하고, 전화번호 입력 필드 제거처럼 검증·테스트와 실제로 연결된 작업은 관련 테스트까지 실행한다/);
  });

  it('the field is conditioned on a known gap existing, so a precise evidence-complete request never creates it', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/완료에 필수적인 미확인·실패\(그것이 없으면 원하는 것이 실제로 성공하지 못하거나 보존·완료 조건이 실제로 성립하지 않는 경우\)가 있으면/);
  });
});

describe('No new status enum (J)', () => {
  it('never introduces PREMATURE_COMPLETION, COMPLETION_CRITICAL, or any other new status/label token', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    const reportFormat = await fs.readFile(reportFormatFile, 'utf8');
    const spec = await fs.readFile(reportSpecFile, 'utf8');
    for (const text of [skill, reportFormat, spec]) {
      expect(text).not.toMatch(/PREMATURE_COMPLETION|COMPLETION_CRITICAL|COMPLETE_VERIFIED|COMPLETE_WITH_UNVERIFIED|\bINCOMPLETE\b/);
    }
  });

  it('still lists exactly the five existing report statuses, unchanged', async () => {
    const reportFormat = await fs.readFile(reportFormatFile, 'utf8');
    expect(reportFormat).toMatch(/확인 완료, 추가 확인 필요, 일부 확인, 작업 보류, 범위 밖/);
  });
});

describe('No new section / DONE-WHEN block (K)', () => {
  it('the field is a bullet inside the existing 위험과 사용자 확인 section, not a new heading', async () => {
    const reportFormat = await fs.readFile(reportFormatFile, 'utf8');
    const sectionHeadings = [...reportFormat.matchAll(/^## .+$/gm)].map((m) => m[0]);
    expect(sectionHeadings.some((h) => /완료 조건|완료에 필수적|Status Selection|Gate/i.test(h))).toBe(false);
  });

  it('adds no visible DONE WHEN / COMPLETION CONTRACT / ACCEPTANCE CHECKLIST heading anywhere', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    const reportFormat = await fs.readFile(reportFormatFile, 'utf8');
    const spec = await fs.readFile(reportSpecFile, 'utf8');
    for (const text of [skill, reportFormat, spec]) {
      expect(text).not.toMatch(/^#{1,3}\s*(DONE WHEN|COMPLETION CONTRACT|ACCEPTANCE CHECKLIST)/im);
    }
  });
});

describe('No new MCP / UI / storage / Feature flag, and no mock-specific logic (L)', () => {
  it('keeps the MCP tool count at exactly 5 and adds no new Feature ID', async () => {
    const src = await fs.readFile(mcpIndexFile, 'utf8');
    const toolNames = [...src.matchAll(/registerTool\('([a-z_]+)'/g)].map((m) => m[1]);
    expect(toolNames).toEqual(['get_bridge_status', 'get_active_features', 'get_report_preferences', 'get_beginner_report_rules', 'get_safe_report_requirements']);
    const managed = await fs.readFile(path.join(repoRoot, 'packages', 'cli', 'src', 'config', 'managed.ts'), 'utf8');
    expect(managed).not.toMatch(/completionContract|REQUESTED_OUTCOME|PRESERVED_REQUIREMENTS|PREMATURE_COMPLETION|STATUS_SELECTION_GATE/);
  });

  it('mentions no mocks, stubs, or a dependency-classification system - the field is general, not mock-detection', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    const reportFormat = await fs.readFile(reportFormatFile, 'utf8');
    const spec = await fs.readFile(reportSpecFile, 'utf8');
    for (const text of [skill, reportFormat, spec]) {
      expect(text).not.toMatch(/\bmocks?\b|\bstubs?\b|모킹|스텁|dependency analyzer|integration test/i);
    }
  });
});

describe('V2.0/V2.1/V2.2 guidance remains intact under the structural completion guard (M)', () => {
  it('keeps the Intent Bridge trigger rule, one-question-max, and feature gate unchanged', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/요청이 짧다는 이유만으로 보여주지 않는다/);
    expect(skill).toMatch(/ASK_USER가 필요하면 질문은 최대 하나다/);
    expect(skill).toMatch(/`requestClarificationGuide`\s*Feature가 꺼져 있으면 이 절차 전체를 적용하지 않고 평소처럼 바로 진행한다/);
  });

  it('keeps the V2.2 scope categories and the pre-existing pre-submit checklist bullets intact', async () => {
    const skill = await fs.readFile(skillFile, 'utf8');
    expect(skill).toMatch(/직접 범위: 사용자가 실제로 요청한 변경 대상 그 자체/);
    expect(skill).toMatch(/건드리면 안 되는 부분: 사용자가 직접 말했거나/);
    expect(skill).toMatch(/원하는 것과 사용자가 말한 건드리지 말 것·유지할 것·완료 조건을 실제로 확인했는가/);
    expect(skill).toMatch(/검증 결과와 보고서 상태가 일치하는가/);
  });
});

describe('Existing report-format parity remains valid (N)', () => {
  it('keeps the §18 canonical example (no completion-critical gap) unaffected - field stays absent, 추가 확인 필요 unchanged', async () => {
    const spec = await fs.readFile(reportSpecFile, 'utf8');
    expect(spec).toMatch(/- 보고서 상태: 추가 확인 필요\n```/);
  });

  it('keeps the minimal-report and general-report sections untouched (field is scoped to the 6-item base structure only)', async () => {
    const reportFormat = await fs.readFile(reportFormatFile, 'utf8');
    expect(reportFormat).toMatch(/작업 완료 여부: <완료\/미완료>/);
    expect(reportFormat).toMatch(/기본 6개 항목을 유지한다/);
  });
});
