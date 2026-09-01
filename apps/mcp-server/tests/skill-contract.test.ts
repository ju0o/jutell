import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const referenceFile = path.join(repoRoot, '.agents', 'skills', 'beginner-bridge', 'references', 'explained-diff-format.md');

describe('explainedDiff skill document contract (J01-TEST-002)', () => {
  const reference = readFileSync(referenceFile, 'utf8');

  it('mandates the four required explanation sections and the optional customization section', () => {
    expect(reference).toContain('무엇을 바꿨나요?');
    expect(reference).toContain('왜 바꿨나요?');
    expect(reference).toContain('어디를 바꿨나요?');
    expect(reference).toContain('실제 중요한 변경');
    expect(reference).toContain('내가 직접 다듬고 싶다면?');
  });

  it('defines the exact unknown-reason sentence instead of allowing invented reasons', () => {
    expect(reference).toContain('변경 이유는 Agent 결과에서 확인되지 않았습니다.');
    expect(reference).toContain('파일 이름만으로 변경 이유를 만들어내지 않는다.');
  });

  it('requires code evidence before offering customization hints and omits the section otherwise', () => {
    expect(reference).toContain('코드 근거가 없으면 이 항목을 만들지 않는다.');
    expect(reference).toContain('억지로 채우지 않는다.');
  });

  it('forbids presenting risky areas as simple visual customization points', () => {
    expect(reference).toContain('인증, 권한, 결제, 데이터베이스 처리 같은 영역은 간단한 다듬기 대상으로 제시하지 않는다.');
    expect(reference).toContain('간단한 화면 수정 대상이 아니라 주의가 필요한 변경입니다.');
  });

  it('requires grouping related changes and forbids repeating the whole diff', () => {
    expect(reference).toContain('기능 단위로 묶는다');
    expect(reference).toContain('전체 Diff 원문을 다시 출력하지 않는다.');
  });

  it('stays compatible with the existing report format and glossary systems', () => {
    expect(reference).toContain('기존 6개 보고 항목을 대체하지 않는다');
    expect(reference).toContain('별도의 보고 체계나 용어 체계를 만들지 않는다');
    expect(reference).toMatch(/glossary/);
  });

  it('requires readable code snippets to reuse already-inspected evidence only', () => {
    expect(reference).toContain('중요한 코드 블록이 이미 작업 과정에서 확인되었고');
    expect(reference).toContain('사용자 이해에 실제 도움이 될 때만 1~2개까지 보여준다');
    expect(reference).toContain('이 섹션만을 위해 파일을 다시 읽지 않는다');
    expect(reference).toContain('이 섹션만을 위해 git diff를 다시 실행하지 않는다');
    expect(reference).toContain('[중요한 코드]');
    expect(reference).toContain('[쉽게 보면]');
    expect(reference).toContain('[영향]');
  });
});

describe('handoff template contract (V1.5.3)', () => {
  const handoff = readFileSync(path.join(repoRoot, 'templates', 'request-builder', 'NEXT_AGENT_HANDOFF.md'), 'utf8');

  it('provides the lightweight next-agent handoff sections', () => {
    expect(handoff).toContain('다음 AI에게 전달하기');
    expect(handoff).toContain('지금 하던 일');
    expect(handoff).toContain('방금 끝난 것');
    expect(handoff).toContain('확인된 것');
    expect(handoff).toContain('아직 확인하지 못한 것');
    expect(handoff).toContain('다음에 해줬으면 하는 것');
    expect(handoff).toContain('먼저 보면 좋은 파일');
    expect(handoff).toContain('건드리면 안 되는 것');
    expect(handoff).toContain('사용자 결정이 필요한 것');
  });

  it('forbids reconstructing repository evidence only for handoff', () => {
    expect(handoff).toMatch(/이미 아는|이미 확인한|현재 작업/);
    expect(handoff).toMatch(/다시 읽|재실행|자동으로 보내지/);
  });
});
