import { promises as fs } from 'node:fs';
import path from 'node:path';

export const REQUEST_TEMPLATE_DIR = 'templates/request-builder';

export const REQUEST_TEMPLATE_LIST = [
  { name: 'README.md', description: '사용법과 공통 선택지 설명' },
  { name: 'DESIGN_REQUEST.md', description: '화면 모양이나 분위기 변경' },
  { name: 'FEATURE_REQUEST.md', description: '새 기능·화면 추가' },
  { name: 'BUG_REPORT_REQUEST.md', description: '문제(버그) 신고' },
  { name: 'PROJECT_PLANNING_REQUEST.md', description: '프로젝트 계획' },
  { name: 'CODE_REVIEW_REQUEST.md', description: '작업 검토' },
  { name: 'NEXT_AGENT_HANDOFF.md', description: '다음 Agent에게 작업 전달' },
  { name: 'MANUAL_EDIT_GUIDE.md', description: '사용자 직접 수정 안내' },
];

async function exists(file: string) {
  try { await fs.access(file); return true; } catch { return false; }
}

export async function findRequestTemplatesRoot(projectRoot: string): Promise<{ root: string; source: 'project' | 'assets' } | null> {
  const candidates = [
    { root: path.join(projectRoot, REQUEST_TEMPLATE_DIR), source: 'project' as const },
    ...(process.env.JUTELL_TEMPLATES_ROOT ? [{ root: process.env.JUTELL_TEMPLATES_ROOT, source: 'assets' as const }] : []),
  ];
  for (const candidate of candidates) {
    if (await exists(path.join(candidate.root, 'README.md'))) return candidate;
  }
  return null;
}

export async function readRequestTemplates(projectRoot: string) {
  const found = await findRequestTemplatesRoot(projectRoot);
  if (!found) return { templates: [], source: 'unavailable' };
  const templates = [];
  for (const item of REQUEST_TEMPLATE_LIST) {
    try {
      templates.push({ ...item, content: await fs.readFile(path.join(found.root, item.name), 'utf8') });
    } catch { /* 파일이 없으면 목록에서 제외 */ }
  }
  return { templates, source: found.source };
}
