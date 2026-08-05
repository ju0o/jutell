import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { CliIo, CliOptions, ScopePaths } from '../../types.js';
import {
  todayStamp, readSessionMeta, saveSessionMeta,
  pageFileName, pageTemplate, pageLabel,
} from './storage.js';
import { resolveSessionRoot } from './operator-storage.js';
import { askText, arrowList } from './prompt.js';

const AGENT_CHOICES = ['OpenCode', 'Codex', 'Claude Code', 'Cline'];

export async function createPageCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  const { root } = await resolveSessionRoot(paths);
  const stamp = todayStamp();
  const dir = path.join(root, stamp);
  const meta = await readSessionMeta(dir);
  if (!meta) {
    throw new Error('오늘 Session이 없습니다. `jutell session new`로 시작하세요.');
  }
  if (meta.status === 'finished') {
    throw new Error('오늘 Session은 마감되었습니다. Page는 더 추가하지 않습니다.');
  }

  let agent = options.agent;
  if (!agent) {
    const picked = await arrowList('사용 Agent 선택:', AGENT_CHOICES);
    if (picked === null || picked === -1) throw new Error('Agent 선택이 필요합니다. `--agent <이름>`을 지정할 수도 있습니다.');
    agent = AGENT_CHOICES[picked];
  }

  let role = options.role ?? (await askText('집중할 역할:'));
  if (!role) throw new Error('역할 입력이 필요합니다. `--role <역할>`을 지정할 수도 있습니다.');

  let title = options.title ?? (await askText('Page 제목:'));
  if (!title) throw new Error('제목 입력이 필요합니다. `--title <제목>`을 지정할 수도 있습니다.');

  const number = (meta.pages.reduce((max, page) => Math.max(max, page.number), 0)) + 1;
  const page = { number, agent, role, title, file: pageFileName({ number, agent, title }) };
  const filePath = path.join(dir, page.file);
  if (await exists(filePath)) {
    throw new Error(`Page 파일이 이미 있습니다. 덮어쓰지 않습니다: ${page.file}`);
  }
  await fs.writeFile(filePath, pageTemplate(page, stamp), 'utf8');
  meta.pages.push(page);
  meta.currentPage = number;
  await saveSessionMeta(dir, meta);
  io.write(`Page 추가 완료: ${pageLabel(page)}`);
  io.write(`파일: ${page.file} (작업 01이 함께 생성됩니다)`);
  return 0;
}

async function exists(file: string) {
  try { await fs.access(file); return true; } catch { return false; }
}
