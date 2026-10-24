import { readText, writeTextSafely } from '../config/managed.js';
import path from 'node:path';

export const JUTELL_AGENTS_BEGIN = '<!-- BEGIN JUTELL MANAGED BLOCK -->';
export const JUTELL_AGENTS_END = '<!-- END JUTELL MANAGED BLOCK -->';

const RECEIPT_LINES = `- 순서: 먼저 \`get_beginner_report_rules\`를 호출하고, 그다음에 영수증을 저장합니다.
- 영수증: 파일 쓰기 도구로 \`.jutell-local/receipt.json\`에 \`{"asked":["요청 요약"],"done":["한 일"],"checked":["직접 확인한 것"],"unchecked":["확인 못 한 것 (이유)"],"next":["해도 되고 안 해도 되는 추천"],"summary":"한 줄 요약"}\`을 쓰고(셸·heredoc 말고 반드시 파일 편집 도구로 씁니다), 프로젝트 로컬 npm 설치면 실제 프로젝트 루트를 따옴표로 감싼 \`npm exec --offline --no --prefix "<실제 프로젝트 루트>" -- jutell receipt\`를 사용합니다. 전역 설치면 기존 \`jutell receipt\`를 사용합니다. 이 경우 \`--prefix\`로 지정한 프로젝트에 영수증을 저장합니다. 인자 없이 한 번 실행해 출력을 답 맨 위에 그대로 붙입니다. 바뀐 파일은 영수증이 세므로 저장소 상태·브랜치·변경 비교는 보지 않습니다. 단, 요청이 테스트·실행 결과·화면 확인을 필요로 하면 실행하고, 실행하거나 읽지 않은 것(예: 다른 파일을 안 건드렸는지)은 checked가 아닌 unchecked에 씁니다. 직접 보지 않았으면 화면은 unchecked에 씁니다(파일을 읽은 것은 화면 확인이 아닙니다). 폴더 확인·형식 찾기 없이 바로 씁니다. 명령을 찾지 못하거나(exit 127) "알 수 없는 명령"이 나오면 재시도 없이 "영수증을 저장하지 못했어요. 프로젝트 로컬 설치는 npm exec --offline --no --prefix \"<실제 프로젝트 루트>\" -- jutell doctor, 전역 설치는 jutell doctor로 해결 방법을 확인하세요." 한 줄만 씁니다.
- 영수증이 최종 답입니다. 영수증 아래에는 아무것도 쓰지 않고, 붙이지 못했을 때만 \`직접 확인한 것:\`/\`확인 못 한 것:\` 두 줄을 씁니다. "설명형 변경 요약" 같은 내부 소제목은 쓰지 않습니다.
`;
const NO_RECEIPT_LINES = `- 최종 답에는 \`직접 확인한 것:\`과 \`확인 못 한 것:\` 두 줄(없으면 "없음")을 씁니다. "설명형 변경 요약" 같은 내부 소제목은 쓰지 않습니다.
`;
// Exact tool names, so agents call them directly instead of searching their (large) tool list.
// Verified in Codex session logs (tools.apply_patch, tools.mcp__jutell__get_beginner_report_rules,
// tools.exec_command). AGENTS.md is also read by OpenCode, so the Codex names are labelled as Codex's.
// Claude Code reads CLAUDE.md: Edit/Write, Bash, and the standard mcp__<server>__<tool> MCP naming.
export type GuidanceTarget = 'agents' | 'claude';
const B = '`';
const code = (name: string) => `${B}${name}${B}`;
const toolLine = (target: GuidanceTarget, receiptReport: boolean) => {
  const rules = code('mcp__jutell__get_beginner_report_rules');
  // Agent-specific names (incl. exec_command / ALL_TOOLS) appear only inside the labelled
  // "Codex:" sentence, because OpenCode reads the same AGENTS.md.
  const names = target === 'claude'
    ? `파일 편집 ${code('Edit')}/${code('Write')}, 보고 규칙 ${rules}, 셸 ${code('Bash')}.`
    : `Codex: 도구 목록(ALL_TOOLS) 검색 없이 파일 편집 ${code('apply_patch')}, 보고 규칙 ${rules}, 셸 ${code('exec_command')}.`;
  return `- 도구가 보이면 바로 호출하고, 안 보이면 검색하지 말고 Skill로 계속합니다. ${names}${receiptReport ? ` 영수증은 도구가 아닌 셸 명령이며, 로컬 설치면 npm --prefix로 프로젝트를 지정해 실행합니다.` : ''}\n`;
};
const managedBlockFor = (receiptReport: boolean, target: GuidanceTarget = 'agents') => {
  const receiptLines = `${toolLine(target, receiptReport)}${receiptReport ? RECEIPT_LINES : NO_RECEIPT_LINES}`;
  return `${JUTELL_AGENTS_BEGIN}
## JuTell

- 작업을 마치고 최종 답을 쓰기 직전에 jutell MCP 도구 \`get_beginner_report_rules\`를 SKILL.md를 읽었어도 반드시 한 번 호출합니다(MCP가 안 보일 때만 생략).
- 시작할 때 \`.agents/skills/beginner-bridge/SKILL.md\`·\`.jutell.json\`·요청에 나온 파일·바꿀 파일 등 필요한 파일만 명령 하나로 읽고, 읽은 파일은 다시 읽지 않습니다(고칠 때마다 바꾼 곳만 다시 확인). 그 규칙대로 최종 답을 씁니다.
- 코드나 문서를 바꾸기 전에 결과를 크게 바꿀 불확실함이 있는지 SKILL.md의 Intent Bridge 규칙으로 판단하고, 없거나 \`requestClarificationGuide\`가 꺼져 있으면 바로 진행합니다.
- JuTell MCP는 canonical \`jutell\` 서버를 우선하고, legacy \`beginner_bridge\`는 호환용으로만 씁니다.
- JuTell MCP가 이미 확보한 근거로 보고·검증·핸드오프의 모호함을 줄이면 우선 씁니다. 쓸 수 없거나 Provider 정책으로 막혀 있으면 작업을 멈추지 않고 JuTell Skill로 계속합니다. 실제로 호출해 응답을 받은 경우에만 JuTell MCP를 사용했다고 말합니다.
- 중간 안내에는 "JuTell 보고 규칙…", "beginner-bridge 지침…" 같은 문장, Skill·설정 파일 이름, 개발자 말("작업 트리 상태", "diff로", "커밋", "스테이징" 등)을 쓰지 않고, 지금 하는 일만 쉬운 말로 말합니다("지침"이라는 말도 쓰지 않습니다).
${receiptLines}- 명령어(예: git diff --check)는 그대로 쓰지 않고 무엇을 확인했는지 쉬운 말로 씁니다. 답과 영수증에서 \`<title>\`·\`<h1>\` 같은 코드 이름 대신 '브라우저 탭 제목', '페이지 맨 위 큰 제목'처럼 쉬운 말로 씁니다.
- 확인하지 않은 결과를 사실처럼 표현하지 않습니다. 실행한 테스트·명령은 최종 답과 영수증의 \`이번에 한 작업\`(done)에도 사용자가 쓴 말 그대로(예: '테스트') 적습니다.
- 비밀정보를 명령 출력이나 보고서에 포함하지 않습니다.
- 외부 전송 없이 현재 프로젝트의 로컬 설정을 기준으로 작업합니다.
${JUTELL_AGENTS_END}`;
};

// The receipt lines are only written when `.jutell.json` keeps features.receiptReport on (default on).
async function receiptReportEnabled(projectRoot: string) {
  try {
    const config = JSON.parse((await readText(path.join(projectRoot, '.jutell.json'))) ?? '{}');
    return config?.features?.receiptReport !== false;
  } catch {
    return true;
  }
}

function markerPattern() {
  return new RegExp(`${JUTELL_AGENTS_BEGIN}[\\s\\S]*?${JUTELL_AGENTS_END}`, 'm');
}

export function agentsFile(projectRoot: string) {
  return path.join(projectRoot, 'AGENTS.md');
}

// Claude Code does not auto-discover `AGENTS.md` the way Codex/OpenCode do - it
// auto-loads `CLAUDE.md` instead (verified empirically: a project with only an
// AGENTS.md canary instruction was never followed, the same canary in CLAUDE.md
// always was). Without this, `jutell use claude` reports a healthy MCP
// connection while the agent never learns to read SKILL.md or call jutell_*
// tools, because the one file telling it to do that sits somewhere Claude Code
// doesn't automatically read. Same managed block, same markers, second file -
// see `ensureJuTellClaudeMdBlock` below, wired in from installer/claude.ts.
export function claudeMdFile(projectRoot: string) {
  return path.join(projectRoot, 'CLAUDE.md');
}

async function hasManagedBlock(file: string) {
  const content = await readText(file);
  return Boolean(content && markerPattern().test(content));
}

async function ensureManagedBlock(file: string, target: GuidanceTarget = 'agents') {
  const current = await readText(file) ?? '';
  const managedBlock = managedBlockFor(await receiptReportEnabled(path.dirname(file)), target);
  const next = markerPattern().test(current)
    ? current.replace(markerPattern(), managedBlock).replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
    : `${current.trimEnd()}${current.trimEnd() ? '\n\n' : ''}${managedBlock}\n`;
  if (next !== current) await writeTextSafely(file, next);
  return { changed: next !== current };
}

async function removeManagedBlock(file: string) {
  const current = await readText(file);
  if (!current || !markerPattern().test(current)) return { changed: false };
  const next = current.replace(markerPattern(), '').replace(/\n{3,}/g, '\n\n').trimEnd();
  await writeTextSafely(file, next ? `${next}\n` : '');
  return { changed: true };
}

export async function hasJuTellAgentsBlock(projectRoot: string) {
  return hasManagedBlock(agentsFile(projectRoot));
}

export async function ensureJuTellAgentsBlock(projectRoot: string) {
  return ensureManagedBlock(agentsFile(projectRoot));
}

export async function removeJuTellAgentsBlock(projectRoot: string) {
  return removeManagedBlock(agentsFile(projectRoot));
}

export async function hasJuTellClaudeMdBlock(projectRoot: string) {
  return hasManagedBlock(claudeMdFile(projectRoot));
}

export async function ensureJuTellClaudeMdBlock(projectRoot: string) {
  return ensureManagedBlock(claudeMdFile(projectRoot), 'claude');
}

export async function removeJuTellClaudeMdBlock(projectRoot: string) {
  return removeManagedBlock(claudeMdFile(projectRoot));
}
