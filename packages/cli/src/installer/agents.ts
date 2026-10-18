import { readText, writeTextSafely } from '../config/managed.js';
import path from 'node:path';

export const JUTELL_AGENTS_BEGIN = '<!-- BEGIN JUTELL MANAGED BLOCK -->';
export const JUTELL_AGENTS_END = '<!-- END JUTELL MANAGED BLOCK -->';

const RECEIPT_LINES = `- 순서: 먼저 \`get_beginner_report_rules\`를 호출하고, 그다음에 영수증을 저장합니다.
- 영수증: 파일 쓰기 도구로 \`.jutell-local/receipt.json\`에 \`{"asked":["요청한 것"],"done":["한 일"],"checked":["직접 확인한 것"],"unchecked":["확인 못 한 것 (이유)"],"next":["해도 되고 안 해도 되는 추천"],"summary":"한 줄 요약"}\`을 쓰고(셸 명령·heredoc·리디렉션으로 쓰지 않고 반드시 파일 편집 도구로 씁니다), 인자 없이 \`jutell receipt\`를 한 번 실행해 출력을 답 맨 위에 그대로 붙입니다(바뀐 파일 목록은 JuTell이 직접 셉니다). 폴더가 있는지 확인하지 말고 바로 쓰며, 형식을 찾지 않습니다. 명령을 찾지 못하거나(exit 127) "알 수 없는 명령"이 나오면 다시 시도하지 말고 "영수증을 저장하지 못했어요. 터미널에서 jutell doctor를 실행하면 해결 방법을 알려 줘요." 한 줄만 씁니다.
- 영수증이 최종 답입니다. 영수증 아래에는 아무것도 쓰지 않고, 확인 내용도 다시 쓰지 않습니다(\`직접 확인한 것\`/\`확인 못 한 것\`은 영수증 안에 있습니다). 영수증을 붙이지 못했을 때만 그 두 줄을 씁니다. "설명형 변경 요약" 같은 내부 소제목은 쓰지 않습니다.
`;
const NO_RECEIPT_LINES = `- 최종 답에는 \`직접 확인한 것:\`과 \`확인 못 한 것:\` 두 줄(없으면 "없음")을 씁니다. "설명형 변경 요약" 같은 내부 소제목은 쓰지 않습니다.
`;
const managedBlockFor = (receiptReport: boolean) => {
  const receiptLines = receiptReport ? RECEIPT_LINES : NO_RECEIPT_LINES;
  return `${JUTELL_AGENTS_BEGIN}
## JuTell

- 작업을 마치고 최종 답을 쓰기 직전에 jutell MCP 도구 \`get_beginner_report_rules\`를 반드시 한 번 호출합니다. SKILL.md를 읽었어도 이 호출을 생략하지 않습니다(MCP가 안 보일 때만 생략).
- 코드 또는 문서 변경 후 \`.agents/skills/beginner-bridge/SKILL.md\`와 \`.jutell.json\`을 먼저 한 번만 읽고(다시 읽지 않습니다), 그 규칙대로 최종 답을 씁니다.
- 실제로 코드나 문서를 바꾸기 전에는, 요청에 결과를 크게 바꿀 수 있는 불확실함이 있는지 SKILL.md의 Intent Bridge 규칙으로 판단합니다. 불확실함이 없거나 \`requestClarificationGuide\`가 꺼져 있으면 평소처럼 바로 진행합니다.
- JuTell MCP가 보이면 canonical \`jutell\` 서버를 사용합니다. \`jutell\`과 legacy \`beginner_bridge\`가 모두 보이면 \`jutell\`을 우선하고 \`beginner_bridge\`는 호환용으로만 사용합니다.
- JuTell MCP를 사용할 수 있고 이미 확보한 근거로 보고·검증·핸드오프의 모호함을 줄여줄 때는 그 도구를 우선합니다. 사용할 수 없거나 Provider 정책으로 막혀 있으면 작업을 멈추지 않고 JuTell Skill로 계속합니다. 실제로 호출해 응답을 받은 경우에만 JuTell MCP를 사용했다고 말합니다.
- 중간 안내에는 "JuTell 보고 규칙…", "beginner-bridge 지침…" 같은 문장, Skill·설정 파일 이름, 개발자 말("작업 트리 상태", "diff로", "커밋", "스테이징" 등)을 쓰지 않고, 지금 하는 일만 쉬운 말로 말합니다("지침"이라는 말도 쓰지 않습니다).
${receiptLines}- 명령어(예: git diff --check)는 그대로 쓰지 않고 무엇을 확인했는지 쉬운 말로 씁니다. 답과 영수증에서 \`<title>\`·\`<h1>\` 같은 코드 이름 대신 '브라우저 탭 제목', '페이지 맨 위 큰 제목'처럼 쉬운 말로 씁니다.
- 확인하지 않은 결과를 사실처럼 표현하지 않습니다.
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

async function ensureManagedBlock(file: string) {
  const current = await readText(file) ?? '';
  const managedBlock = managedBlockFor(await receiptReportEnabled(path.dirname(file)));
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
  return ensureManagedBlock(claudeMdFile(projectRoot));
}

export async function removeJuTellClaudeMdBlock(projectRoot: string) {
  return removeManagedBlock(claudeMdFile(projectRoot));
}
