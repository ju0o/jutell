#!/usr/bin/env node
// 공개 저장소 안전 검사 (탐지 전용, 자동 삭제·수정 없음)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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

// 예외(allowlist): 위험이 아님을 확인한 항목만 기록한다.
// - file: 예외 적용 파일 (git ls-files 기준 경로)
// - kind: PATTERNS 키 또는 'path'
// - reason: 예외 이유
// - scope: 허용 범위 (kind 탐지로 한정)
const ALLOWED_EXCEPTIONS = [
  {
    file: 'docs/PROVIDER_OPENCODE.md',
    kind: 'winPath',
    reason: '사용자 홈 placeholder 예시({드라이브}:\\Users\\<사용자>)가 문서 설명에 필요. 운영자 절대 경로가 아님',
    scope: '해당 파일의 winPath 탐지에만 적용',
  },
  {
    file: 'docs/PUBLIC_REPOSITORY_POLICY.md',
    kind: 'winPath',
    reason: '금지 예시를 설명하는 데 필요한 예시 경로({드라이브}:\\Users\\<사용자>)',
    scope: '해당 파일의 winPath 탐지에만 적용',
  },
  {
    file: 'packages/cli/tests/cli.test.ts',
    kind: 'winPath',
    reason: 'URL 정규식 문자열(p:/\\/\\/ 형태)이 winPath 패턴에 일치할 뿐 실제 절대 경로가 아님',
    scope: '해당 파일의 winPath 탐지에만 적용',
  },
];

function isAllowed(file, kind) {
  return ALLOWED_EXCEPTIONS.some((entry) => entry.file === file && entry.kind === kind);
}

for (const entry of ALLOWED_EXCEPTIONS) {
  if (!Object.keys(PATTERNS).includes(entry.kind)) {
    console.error(`[설정 오류] ALLOWED_EXCEPTIONS의 kind가 유효하지 않음: ${entry.kind} (${entry.file})`);
    process.exit(1);
  }
}

const FORBIDDEN_PATH = [
  { re: /^\.jutell\.json$/i, label: '루트 .jutell.json 추적 (실제 사용자 설정)' },
  { re: /^\.beginner-bridge\.json$/i, label: '루트 .beginner-bridge.json 추적 (실제 사용자 설정)' },
  { re: /^opencode\.json$/i, label: '루트 opencode.json 추적 (실제 사용자 설정, 예시는 examples/config/opencode.example.json)' },
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

// .agents는 폴더 이름이 아니라 파일의 출처와 역할로 판단한다.
// JuTell이 배포하는 공개 제품 Skill(.agents/skills/beginner-bridge/**)만 허용하고,
// 설치 과정에서 생성되는 사용자별 Skill 복사본 등 그 밖의 .agents/**는 위반으로 처리한다.
const AGENTS_ALLOWED_PREFIX = ['.agents/skills/beginner-bridge/'];

// Review Bundle 안의 실제 설정 파일 규칙 (allowlist)
// 예시 파일(examples/config/jutell.example.json 등)은 통과 대상이다.
const BUNDLE_FORBIDDEN_ENTRY = [
  { re: /^\.jutell\.json$/i, label: '번들 안 실제 .jutell.json' },
  { re: /^\.beginner-bridge\.json$/i, label: '번들 안 실제 .beginner-bridge.json' },
  { re: /^opencode\.json$/i, label: '번들 안 실제 opencode.json' },
  { re: /(^|\/)\.jutell-local\//i, label: '번들 안 .jutell-local' },
  { re: /(^|\/)\.beginner-bridge-local\//i, label: '번들 안 .beginner-bridge-local' },
  { re: /(^|\/)\.jutell-private\//i, label: '번들 안 .jutell-private' },
  { re: /(^|\/)private\//i, label: '번들 안 private' },
  { re: /(^|\/)\.codex\//i, label: '번들 안 .codex' },
  { re: /(^|\/)\.env$/i, label: '번들 안 .env' },
  { re: /\.private\.md$/i, label: '번들 안 비공개 마크다운' },
  { re: /\.internal\.md$/i, label: '번들 안 내부 메모' },
];

// ZIP의 파일 이름 목록만 읽는다 (Node 내장 모듈만 사용, 압축 해제 없음)
function zipEntryNames(zipPath) {
  const buf = readFileSync(zipPath);
  const names = [];
  let offset = 0;
  while (offset + 30 <= buf.length) {
    if (buf.readUInt32LE(offset) !== 0x04034b50) break;
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const csize = buf.readUInt32LE(offset + 18);
    names.push(buf.subarray(offset + 30, offset + 30 + nameLen).toString('utf8'));
    offset += 30 + nameLen + extraLen + csize;
  }
  return names;
}

function scanBundleZip(zipPath) {
  const names = zipEntryNames(zipPath);
  const issues = [];
  for (const entry of names) {
    for (const rule of BUNDLE_FORBIDDEN_ENTRY) {
      if (rule.re.test(entry)) issues.push(`${rule.label}: ${entry}`);
    }
    if (/^\.agents\//i.test(entry) && !AGENTS_ALLOWED_PREFIX.some((prefix) => entry.startsWith(prefix))) {
      issues.push(`번들 안 허용되지 않은 .agents 경로: ${entry}`);
    }
  }
  return { names, issues: [...new Set(issues)] };
}

function scanText(file, content) {
  const findings = [];
  if (PATTERNS.winPath.test(content)) findings.push('winPath');
  if (PATTERNS.skKey.test(content)) findings.push('skKey');
  if (PATTERNS.apiKey.test(content)) findings.push('apiKey');
  if (PATTERNS.token.test(content)) findings.push('token');
  return findings;
}

// 탐지 수준: [위반](FAIL, exit 1) = 금지 경로 추적·Foundation 필수 문서 누락
//           [가능성](WARN) = 콘텐츠 패턴 탐지. allowlist 예외는 WARN에서 제외한다.
let hardIssues = 0;
const warnings = [];
let allowedSkips = 0;

const allTracked = trackedFiles();

for (const file of allTracked) {
  const lower = file.toLowerCase();
  for (const rule of FORBIDDEN_PATH) {
    if (rule.re.test(lower)) {
      hardIssues += 1;
      console.log(`[위반] ${rule.label}: ${file}`);
    }
  }
  if (/^\.agents\//i.test(file) && !AGENTS_ALLOWED_PREFIX.some((prefix) => file.startsWith(prefix))) {
    hardIssues += 1;
    console.log(`[위반] 허용되지 않은 .agents 경로 추적 (허용: ${AGENTS_ALLOWED_PREFIX.join(', ')}): ${file}`);
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
  for (const kind of scanText(file, content)) {
    if (isAllowed(file, kind)) {
      allowedSkips += 1;
      continue;
    }
    warnings.push(`${kind}: ${file}`);
  }
}

for (const file of FOUNDATION_REQUIRED) {
  if (!allTracked.includes(file)) {
    hardIssues += 1;
    console.log(`[위반] Foundation 필수 문서 미추적: ${file}`);
  }
}

// Review Bundle 검사: artifacts/*.zip 안에 실제 사용자 설정이 있으면 위반.
// 예시 설정(examples/config/jutell.example.json 등)은 위 규칙에 걸리지 않아 통과한다.
const artifactsDir = path.join(root, 'artifacts');
let bundleChecked = 0;
let bundleAllowedExamples = 0;
if (existsSync(artifactsDir)) {
  for (const entry of readdirSync(artifactsDir)) {
    if (!entry.toLowerCase().endsWith('.zip')) continue;
    const zipPath = path.join(artifactsDir, entry);
    try {
      const { names, issues } = scanBundleZip(zipPath);
      bundleChecked += 1;
      if (issues.length > 0) {
        hardIssues += issues.length;
        for (const issue of issues) {
          console.log(`[위반] Review Bundle 검사(${entry}): ${issue}`);
        }
      } else {
        bundleAllowedExamples += names.filter((name) => /^examples\//.test(name)).length;
      }
    } catch (error) {
      hardIssues += 1;
      console.log(`[위반] Review Bundle 검사(${entry}): ZIP을 읽을 수 없습니다 (${error.message})`);
    }
  }
}

for (const warning of [...new Set(warnings)]) {
  console.log(`[가능성] ${warning}`);
}

let summary = `\n공개 안전 검사 완료 — 위반(FAIL) ${hardIssues}건, 가능성(WARN) ${new Set(warnings).size}건, allowlist 예외 제외 ${allowedSkips}건`;
if (bundleChecked > 0) {
  summary += `, Review Bundle 검사 ${bundleChecked}개(안전)`;
}
if (bundleAllowedExamples > 0) {
  summary += `, 번들 안 예시 설정 ${bundleAllowedExamples}개 확인`;
}
console.log(summary);
console.log('예외 기록: ALLOWED_EXCEPTIONS(파일 경로·탐지 유형·이유·허용 범위). 자동 삭제·수정은 하지 않습니다.');
process.exit(hardIssues > 0 ? 1 : 0);
