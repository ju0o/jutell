import { readText, writeTextSafely } from '../config/managed.js';
import path from 'node:path';

export const JUTELL_AGENTS_BEGIN = '<!-- BEGIN JUTELL MANAGED BLOCK -->';
export const JUTELL_AGENTS_END = '<!-- END JUTELL MANAGED BLOCK -->';

const managedBlock = `${JUTELL_AGENTS_BEGIN}
## JuTell

- 코드 또는 문서 변경 후 \`.agents/skills/beginner-bridge/SKILL.md\`와 \`.jutell.json\`을 먼저 읽습니다.
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
