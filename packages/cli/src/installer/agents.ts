import { readText, writeTextSafely } from '../config/managed.js';
import path from 'node:path';

export const JUTELL_AGENTS_BEGIN = '<!-- BEGIN JUTELL MANAGED BLOCK -->';
export const JUTELL_AGENTS_END = '<!-- END JUTELL MANAGED BLOCK -->';

const managedBlock = `${JUTELL_AGENTS_BEGIN}
## JuTell

- 코드 또는 문서 변경 후 \`.agents/skills/beginner-bridge/SKILL.md\`와 \`.jutell.json\`을 먼저 읽습니다. 소유자 대상 구현/보고 전에는 JuTell 보고 규칙을 먼저 적용해 최종 답변을 작성합니다.
- 실제로 코드나 문서를 바꾸기 전에는, 요청에 결과를 크게 바꿀 수 있는 불확실함이 있는지 SKILL.md의 Intent Bridge 규칙으로 판단합니다. 불확실함이 없거나 \`requestClarificationGuide\`가 꺼져 있으면 평소처럼 바로 진행합니다.
- JuTell MCP가 보이면 canonical \`jutell\` 서버를 사용합니다. \`jutell\`과 legacy \`beginner_bridge\`가 모두 보이면 \`jutell\`을 우선하고 \`beginner_bridge\`는 호환용으로만 사용합니다.
- JuTell MCP를 사용할 수 있고 이미 확보한 근거로 보고·검증·핸드오프의 모호함을 줄여줄 때는 그 도구를 우선합니다. 사용할 수 없거나 Provider 정책으로 막혀 있으면 작업을 멈추지 않고 JuTell Skill로 계속합니다. 실제로 호출해 응답을 받은 경우에만 JuTell MCP를 사용했다고 말합니다.
- 확인하지 않은 결과를 사실처럼 표현하지 않습니다.
- 비밀정보를 명령 출력이나 보고서에 포함하지 않습니다.
- 외부 전송 없이 현재 프로젝트의 로컬 설정을 기준으로 작업합니다.
${JUTELL_AGENTS_END}`;

function markerPattern() {
  return new RegExp(`${JUTELL_AGENTS_BEGIN}[\\s\\S]*?${JUTELL_AGENTS_END}`, 'm');
}

export function agentsFile(projectRoot: string) {
  return path.join(projectRoot, 'AGENTS.md');
}

export async function hasJuTellAgentsBlock(projectRoot: string) {
  const content = await readText(agentsFile(projectRoot));
  return Boolean(content && markerPattern().test(content));
}

export async function ensureJuTellAgentsBlock(projectRoot: string) {
  const file = agentsFile(projectRoot);
  const current = await readText(file) ?? '';
  const next = markerPattern().test(current)
    ? current.replace(markerPattern(), managedBlock).replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
    : `${current.trimEnd()}${current.trimEnd() ? '\n\n' : ''}${managedBlock}\n`;
  if (next !== current) await writeTextSafely(file, next);
  return { changed: next !== current };
}

export async function removeJuTellAgentsBlock(projectRoot: string) {
  const file = agentsFile(projectRoot);
  const current = await readText(file);
  if (!current || !markerPattern().test(current)) return { changed: false };
  const next = current.replace(markerPattern(), '').replace(/\n{3,}/g, '\n\n').trimEnd();
  await writeTextSafely(file, next ? `${next}\n` : '');
  return { changed: true };
}
