#!/usr/bin/env node
// 협업 베타 세션 기록 파일 생성 (로컬 전용, 외부 전송 없음)
// - 사용법: npm run session:new
// - 템플릿: docs/operator/COLLABORATION_BETA_SESSION_FORM.md (공개)
// - 출력: .jutell-local/collaboration-sessions/YYYY-MM-DD-session-NNN.md
// - 기존 파일은 덮어쓰지 않으며, 에디터를 자동으로 열지 않습니다.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatePath = path.join(root, 'docs', 'operator', 'COLLABORATION_BETA_SESSION_FORM.md');
const sessionDir = path.join(root, '.jutell-local', 'collaboration-sessions');

const today = new Date();
const p = (n) => String(n).padStart(2, '0');
const dateStamp = `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;

// 오늘 날짜의 기존 세션 번호를 찾아 다음 번호를 정한다 (덮어쓰기 방지)
mkdirSync(sessionDir, { recursive: true });
let nextNumber = 1;
while (true) {
  const candidate = path.join(sessionDir, `${dateStamp}-session-${p(nextNumber)}.md`);
  if (!readExists(candidate)) break;
  nextNumber += 1;
}

const sessionId = `${dateStamp}-session-${p(nextNumber)}`;
const outFile = path.join(sessionDir, `${sessionId}.md`);

let template;
try {
  template = readFileSync(templatePath, 'utf8');
} catch {
  console.error(`[오류] 템플릿을 읽을 수 없습니다: ${templatePath}`);
  process.exit(1);
}

const filled = template
  .replace('- 날짜:', `- 날짜: ${dateStamp}`)
  .replace('- 세션 ID:', `- 세션 ID: ${sessionId}`);

writeFileSync(outFile, filled, 'utf8');
console.log(`[완료] 협업 세션 기록 생성: ${outFile}`);
console.log('안내: 이 파일은 로컬 전용(.jutell-local/)이며 Git과 Review Bundle에 포함되지 않습니다.');
console.log('안내: 프롬프트·답변 원문은 직접 붙여 넣을 때만 기록하고, 민감정보는 넣지 않습니다.');

function readExists(file) {
  try {
    readFileSync(file, 'utf8');
    return true;
  } catch {
    return false;
  }
}
