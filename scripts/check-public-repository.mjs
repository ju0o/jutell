#!/usr/bin/env node
// 공개 저장소 안전 검사 (탐지 전용, 자동 삭제·수정 없음)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_SCAN_BYTES = 512 * 1024;
const SKIP_CONTENT = ['.git', 'node_modules', 'dist', 'coverage', 'assets'];

function trackedFiles() {
  return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

// 정적 문자열을 조각으로 만들어 스크립트 자신이 탐지되지 않게 한다
const P = (parts) => parts.join('');
const PATTERNS = {
  apiKey: new RegExp(P(['[A-Za-z0-9_-]*', 'api', '[_-]?', 'key', '[A-Za-z0-9_-]*', '\\s*[=:]\\s*["\']([^"\']{12,})']), 'i'),
  token: new RegExp(P(['\\b(secret|token|password|cookie|api[_-]?key)\\b\\s*[=:]\\s*["\']([^"\']{10,})']), 'i'),
  skKey: new RegExp(P(['sk-', '[A-Za-z0-9]{16,}'])),
  winPath: new RegExp(P(['[A-Za-z]:\\\\[^\\s"\']{3,}'])),
};

const FOUNDATION_REQUIRED = [
  'docs/foundation/VISION.md',
  'docs/foundation/PRODUCT_PHILOSOPHY.md',
  'docs/foundation/NON_GOALS.md',
  'docs/foundation/ARCHITECTURE.md',
  'docs/foundation/DESIGN_PRINCIPLES.md',
  'docs/foundation/CLOUD_PHILOSOPHY.md',
  'docs/foundation/PRODUCT_BOUNDARY.md',
];

const FORBIDDEN_PATH = [
  { re: /(^|\/)\.jutell-local\//i, label: '.jutell-local 추적' },
  { re: /(^|\/)\.beginner-bridge-local\//i, label: '.beginner-bridge-local 추적' },
  { re: /(^|\/)\.jutell-private\//i, label: '비공개 메모 디렉터리 추적' },
  { re: /(^|\/)private\//i, label: 'private 디렉터리 추적' },
  { re: /(^|\/)docs\/private\//i, label: 'docs/private 추적' },
  { re: /\.private\.md$/i, label: '비공개 마크다운 추적' },
  { re: /\.internal\.md$/i, label: '내부 메모 추적' },
  { re: /(^|\/)jutell-[^/]*-test\//i, label: '테스트 프로젝트 추적' },
  { re: /(^|\/)\.env$/i, label: '.env 추적' },
  { re: /\.pem$/i, label: '인증서 키 추적' },
  { re: /\.key$/i, label: '키 파일 추적' },
  { re: /\.token$/i, label: '토큰 파일 추적' },
  { re: /\.local\.json$/i, label: '로컬 내보내기 추적' },
  { re: /\.backup\.json$/i, label: '백업 파일 추적' },
];

function scanText(file, content) {
  const findings = [];
  if (PATTERNS.winPath.test(content)) findings.push('절대 Windows 경로');
  if (PATTERNS.skKey.test(content)) findings.push('API Key 형태(sk-...)');
  if (PATTERNS.apiKey.test(content)) findings.push('api key 형태');
  if (PATTERNS.token.test(content)) findings.push('token·cookie·secret 값 가능성');
  return findings;
}

let hardIssues = 0;
const warnings = [];

for (const file of trackedFiles()) {
  const lower = file.toLowerCase();
  for (const rule of FORBIDDEN_PATH) {
    if (rule.re.test(lower)) {
      hardIssues += 1;
      console.log(`[위반] ${rule.label}: ${file}`);
    }
  }
  if (SKIP_CONTENT.some((part) => file.split(/[\\/]/).includes(part))) continue;
  if (file.endsWith('package-lock.json')) continue;
  const abs = path.join(root, file);
  if (!existsSync(abs)) continue;
  try {
    if (!statSync(abs).isFile()) continue;
    if (statSync(abs).size > MAX_SCAN_BYTES) continue;
  } catch { continue; }
  const content = readFileSync(abs, 'utf8');
  for (const finding of scanText(file, content)) {
    warnings.push(`${finding}: ${file}`);
  }
}

for (const file of FOUNDATION_REQUIRED) {
  if (!trackedFiles().includes(file)) {
    hardIssues += 1;
    console.log(`[위반] Foundation 필수 문서 미추적: ${file}`);
  }
}

for (const warning of [...new Set(warnings)]) {
  console.log(`[가능성] ${warning}`);
}

console.log(`\n공개 안전 검사 완료 — 위반 ${hardIssues}건, 가능성 경고 ${new Set(warnings).size}건`);
console.log('자동 삭제·수정은 하지 않습니다. 운영자 승인 후 직접 조치하세요.');
process.exit(hardIssues > 0 ? 1 : 0);
