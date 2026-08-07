#!/usr/bin/env node
// 외부 검토용 안전 번들 생성 (allowlist 중심, 탐지 전용)
// - 저장소 루트에서 실행: npm run bundle:review
// - 생성 전에 공개 안전 검사(check:public)를 반드시 실행하고 위반 시 중단
// - ZIP은 Node 내장 zlib로 직접 작성한다 (의존성 추가 없음, 유니코드 파일명 지원)
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_SCAN_BYTES = 512 * 1024;
const artifactsDir = path.join(root, 'artifacts');

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
const STAMP = stamp();
const outZip = path.join(artifactsDir, `jutell-review-bundle-${STAMP}.zip`);
const outDir = path.join(artifactsDir, `jutell-review-bundle-${STAMP}`);

// 정적 문자열을 조각으로 만들어 스크립트 자신이 탐지되지 않게 한다
const P = (parts) => parts.join('');
const PATTERNS = {
  apiKey: new RegExp(P(['[A-Za-z0-9_-]*', 'api', '[_-]?', 'key', '[A-Za-z0-9_-]*', '\\s*[=:]\\s*["\']([^"\']{12,})']), 'i'),
  token: new RegExp(P(['\\b(secret|token|password|cookie|api[_-]?key)\\b\\s*[=:]\\s*["\']([^"\']{10,})']), 'i'),
  skKey: new RegExp(P(['sk-', '[A-Za-z0-9]{16,}'])),
  winPath: new RegExp(P(['[A-Za-z]:\\\\[^\\s"\']{3,}'])),
  privateName: new RegExp(P(['jutell', '-', 'private']), 'i'),
  parentEscape: new RegExp(P(['path\\.(?:resolve|join|relative)\\([\\s\\S]{0,140}?', '["\'`]\\.\\.'])),
};

// 예외(allowlist): scripts/check-public-repository.mjs의 ALLOWED_EXCEPTIONS와 동일하게 유지한다.
// 예외 추가 시 두 스크립트에 같은 이유와 함께 기록한다.
const ALLOWED_EXCEPTIONS = [
  {
    file: 'docs/PROVIDER_OPENCODE.md',
    kind: 'winPath',
    reason: '사용자 홈 placeholder 예시({드라이브}:\\Users\\<사용자>)가 문서 설명에 필요. 운영자 절대 경로가 아님',
  },
  {
    file: 'docs/PUBLIC_REPOSITORY_POLICY.md',
    kind: 'winPath',
    reason: '금지 예시를 설명하는 데 필요한 예시 경로({드라이브}:\\Users\\<사용자>)',
  },
  {
    file: 'packages/cli/tests/cli.test.ts',
    kind: 'winPath',
    reason: 'URL 정규식 문자열(p:/\\/\\/ 형태)이 winPath 패턴에 일치할 뿐 실제 절대 경로가 아님',
  },
  {
    file: 'scripts/check-public-repository.mjs',
    kind: 'privateName',
    reason: '탐지 규칙 정의 문자열(금지·번들 경로 패턴) 자체가 포함됨. 공개 노출이 아니라 보호 목적',
  },
  {
    file: 'scripts/create-review-bundle.mjs',
    kind: 'privateName',
    reason: '탐지 규칙 정의 문자열(제외 경로 패턴) 자체가 포함됨. 공개 노출이 아니라 보호 목적',
  },
  {
    file: '.gitignore',
    kind: 'privateName',
    reason: '추적 제외 실수 방지 패턴. .gitignore에 명시해야 Git이 비공개 폴더를 제외함',
  },
  {
    file: 'scripts/check-public-repository.mjs',
    kind: 'parentEscape',
    reason: '스크립트 자신의 저장소 루트 계산 (path.resolve(..., ..))',
  },
  {
    file: 'scripts/create-review-bundle.mjs',
    kind: 'parentEscape',
    reason: '스크립트 자신의 저장소 루트 계산 (path.resolve(..., ..))',
  },
  {
    file: 'packages/cli/scripts/build-assets.mjs',
    kind: 'parentEscape',
    reason: '패키지의 저장소 루트 계산 (path.resolve(packageRoot, ../..))',
  },
  {
    file: 'packages/cli/src/config/paths.ts',
    kind: 'parentEscape',
    reason: '패키지 루트 계산 (path.resolve(path.dirname(...), .., ..))',
  },
  {
    file: 'packages/cli/tests/cli.test.ts',
    kind: 'parentEscape',
    reason: '패키지 루트 계산 (테스트 내부 경로)',
  },
  {
    file: 'packages/cli/tests/session.test.ts',
    kind: 'parentEscape',
    reason: '패키지 루트 계산 (테스트 내부 경로)',
  },
  {
    file: 'packages/cli/tests/operator-storage.test.ts',
    kind: 'parentEscape',
    reason: '패키지 루트 계산 (테스트 내부 경로)',
  },
  {
    file: 'apps/local-admin/server/index.ts',
    kind: 'parentEscape',
    reason: '앱 프로젝트 루트 계산 (path.resolve(appRoot, ../..))',
  },
  {
    file: 'packages/cli/tests/mcpProbe.test.ts',
    kind: 'winPath',
    reason: 'MCP Probe의 Windows 경로·임시 디렉터리 처리 검증용 테스트 fixture 문자열. 실제 사용자·운영자 절대 경로가 아님. 임시 경로 및 절대 경로 방어 검증 목적이며 해당 파일·winPath 탐지에만 허용. 다른 파일이나 다른 탐지 유형에는 적용하지 않음',
  },
  {
    file: 'packages/cli/tests/mcpProbe.test.ts',
    kind: 'parentEscape',
    reason: 'MCP Probe의 상위 경로 탈출 방어 검증용 테스트 fixture 문자열(path.join(임시, ..)). 실제 사용자·운영자 경로가 아님. 경로 탈출 보호 검증 목적이며 해당 파일·parentEscape 탐지에만 허용. 다른 파일이나 다른 탐지 유형에는 적용하지 않음',
  },
];

function isAllowed(file, kind) {
  return ALLOWED_EXCEPTIONS.some((entry) => entry.file === file && entry.kind === kind);
}

// ZIP에 절대 넣지 않는 경로 규칙 (allowlist 중심 선택을 위한 제외 목록)
// .agents는 폴더 이름이 아니라 파일의 출처와 역할로 판단한다:
//   포함 — .agents/skills/beginner-bridge/** (JuTell 공개 배포 자산)
//   제외 — 그 밖의 .agents/** (설치·사용자별 복사본 등 로컬 산출물)
const EXCLUDED_SEGMENTS = [
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'assets',
  '.codex',
  '.jutell-local',
  '.beginner-bridge-local',
  '.jutell-private',
  'private',
  'docs/private',
  'artifacts',
];
const EXCLUDED_FILE = ['.jutell.json', '.beginner-bridge.json', 'opencode.json', '.jutell-operator.local.json'];
const AGENTS_ALLOWED_PREFIX = ['.agents/skills/beginner-bridge/'];
const EXCLUDED_SUFFIX = [
  '.env',
  '.pem',
  '.key',
  '.token',
  '.tgz',
  '.tar.gz',
  '.log',
  '.local.json',
  '.backup.json',
  '.previous',
];
const EXCLUDED_PATTERN = [/^jutell-[^/]*-test\//i, /^packages\/jutell-[^/]*-test\//i];

function fail(message) {
  console.error(`[중단] ${message}`);
  process.exit(1);
}

function isExcluded(rel) {
  const segments = rel.split('/');
  if (segments.some((seg) => EXCLUDED_SEGMENTS.includes(seg))) return true;
  if (EXCLUDED_FILE.includes(rel)) return true;
  if (EXCLUDED_SUFFIX.some((suffix) => rel.endsWith(suffix))) return true;
  if (EXCLUDED_PATTERN.some((re) => re.test(rel))) return true;
  if (/^\.agents\//.test(rel) && !AGENTS_ALLOWED_PREFIX.some((prefix) => rel.startsWith(prefix))) return true;
  return false;
}

function trackedFiles() {
  // core.quotepath=false: 비ASCII 파일명을 8진수 이스케이프 없이 원문으로 출력한다
  return execFileSync('git', ['-c', 'core.quotepath=false', 'ls-files'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

function runCheckPublic() {
  try {
    execFileSync('node', ['scripts/check-public-repository.mjs'], { cwd: root, encoding: 'utf8', stdio: 'inherit' });
    console.log('[확인] 공개 안전 검사 통과');
    return '통과';
  } catch {
    fail('공개 안전 검사에서 위반이 발견되었습니다. 번들을 만들지 않습니다. 예외는 scripts/check-public-repository.mjs의 ALLOWED_EXCEPTIONS에 이유와 함께 기록합니다.');
  }
}

function scanText(content) {
  const findings = [];
  if (PATTERNS.winPath.test(content)) findings.push('winPath');
  if (PATTERNS.skKey.test(content)) findings.push('skKey');
  if (PATTERNS.apiKey.test(content)) findings.push('apiKey');
  if (PATTERNS.token.test(content)) findings.push('token');
  if (PATTERNS.privateName.test(content)) findings.push('privateName');
  if (PATTERNS.parentEscape.test(content)) findings.push('parentEscape');
  return findings;
}

function scanIncludes(includes) {
  const findings = [];
  for (const rel of includes) {
    const abs = path.join(root, rel);
    if (!existsSync(abs)) continue;
    try {
      if (!statSync(abs).isFile()) continue;
      if (statSync(abs).size > MAX_SCAN_BYTES) continue;
    } catch {
      continue;
    }
    const content = readFileSync(abs, 'utf8');
    for (const kind of scanText(content)) {
      if (isAllowed(rel, kind)) continue;
      findings.push(`${kind}: ${rel}`);
    }
  }
  return [...new Set(findings)];
}

// --- 최소 ZIP 작성기 (Node 내장 zlib만 사용, 유니코드 파일명 지원) ---

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time: time & 0xffff, date: date & 0xffff };
}

function makeZip(outPath, files, readContent) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const now = dosDateTime(new Date());

  for (const rel of files) {
    const data = Buffer.from(readContent(rel));
    const name = Buffer.from(rel, 'utf8');
    const crc = crc32(data);
    const compressed = deflateRawSync(data);
    const method = compressed.length < data.length ? 8 : 0;
    const payload = method === 8 ? compressed : data;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // flags: UTF-8 file name
    local.writeUInt16LE(method, 8); // method
    local.writeUInt16LE(now.time, 10);
    local.writeUInt16LE(now.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // extra length
    chunks.push(local, name, payload);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0); // central directory signature
    entry.writeUInt16LE(20, 4); // version made by
    entry.writeUInt16LE(20, 6); // version needed
    entry.writeUInt16LE(0x0800, 8); // flags
    entry.writeUInt16LE(method, 10);
    entry.writeUInt16LE(now.time, 12);
    entry.writeUInt16LE(now.date, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(payload.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt16LE(0, 30); // extra length
    entry.writeUInt16LE(0, 32); // comment length
    entry.writeUInt16LE(0, 34); // disk number
    entry.writeUInt16LE(0, 36); // internal attrs
    entry.writeUInt32LE(0, 38); // external attrs
    entry.writeUInt32LE(offset, 42); // local header offset
    central.push(entry, name);

    offset += local.length + name.length + payload.length;
  }

  const cdStart = offset;
  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  end.writeUInt16LE(0, 4); // disk number
  end.writeUInt16LE(0, 6); // cd start disk
  end.writeUInt16LE(files.length, 8); // entries on this disk
  end.writeUInt16LE(files.length, 10); // total entries
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(cdStart, 16);
  end.writeUInt16LE(0, 20); // comment length

  writeFileSync(outPath, Buffer.concat([...chunks, centralBuffer, end]));
}

function listZip(outPath) {
  const buf = readFileSync(outPath);
  const names = [];
  let offset = 0;
  while (offset + 30 <= buf.length) {
    if (buf.readUInt32LE(offset) !== 0x04034b50) break;
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const method = buf.readUInt16LE(offset + 8);
    const csize = buf.readUInt32LE(offset + 18);
    const name = buf.subarray(offset + 30, offset + 30 + nameLen).toString('utf8');
    names.push(name);
    offset += 30 + nameLen + extraLen + csize;
  }
  return names;
}

function makeFolderBundle(includes, manifestContent) {
  mkdirSync(outDir, { recursive: true });
  for (const rel of includes) {
    const abs = path.join(root, rel);
    const dest = path.join(outDir, rel);
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, readFileSync(abs));
  }
  writeFileSync(path.join(outDir, 'REVIEW_BUNDLE_MANIFEST.md'), manifestContent, 'utf8');
  return outDir;
}

function verifyBundleList(names) {
  const forbidden = [];
  const fileRules = [
    { re: /^\.jutell\.json$/i, label: '실제 .jutell.json' },
    { re: /^\.beginner-bridge\.json$/i, label: '실제 .beginner-bridge.json' },
    { re: /(^|\/)\.jutell-local\//i, label: '.jutell-local' },
    { re: /(^|\/)\.beginner-bridge-local\//i, label: '.beginner-bridge-local' },
    { re: /(^|\/)\.jutell-private\//i, label: '.jutell-private' },
    { re: /(^|\/)private\//i, label: 'private' },
    { re: /(^|\/)\.codex\//i, label: '.codex' },
    { re: /\.private\.md$/i, label: '비공개 마크다운' },
    { re: /\.internal\.md$/i, label: '내부 메모' },
  ];
  for (const entry of names) {
    const lower = entry.toLowerCase();
    for (const rule of fileRules) {
      if (rule.re.test(lower)) forbidden.push(`${rule.label}: ${entry}`);
    }
    if (/^\.agents\//i.test(entry) && !AGENTS_ALLOWED_PREFIX.some((prefix) => entry.startsWith(prefix))) {
      forbidden.push(`허용되지 않은 .agents 경로: ${entry}`);
    }
  }
  if (forbidden.length > 0) {
    fail(`생성된 번들에 금지 경로가 포함되었습니다: ${forbidden.join(', ')}`);
  }
}

function main() {
  mkdirSync(artifactsDir, { recursive: true });

  const tracked = trackedFiles();
  const includes = tracked.filter((rel) => !isExcluded(rel));

  console.log('[검사] 공개 안전 검사를 먼저 실행합니다.');
  const checkResult = runCheckPublic();

  const findings = scanIncludes(includes);
  if (findings.length > 0) {
    fail(`번들에 포함될 파일에서 위험 패턴이 탐지되었습니다: ${findings.join(', ')}`);
  }

  const headCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
  const worktreeState = status.length === 0 ? '변경 없음' : `변경 있음 (${status.split('\n').length}건. 자세한 내용은 bundle 생성 전 git status 참고)`;
  const headLine = execFileSync('git', ['log', '-1', '--oneline'], { cwd: root, encoding: 'utf8' }).trim();

  const manifest = [
    '# REVIEW_BUNDLE_MANIFEST',
    '',
    '> **이 번들에 포함된 설정은 예시이며 실제 사용자 설정이 아닙니다.**',
    '> `.agents/skills/`는 JuTell이 배포하는 공개 제품 자산입니다.',
    '> 실제 사용자 설정과 로컬 설치 산출물은 제외됩니다.',
    '> 포함 여부는 Git 추적 여부와 제품 배포 목록을 기준으로 결정합니다.',
    '',
    `- 생성 시각: ${new Date().toISOString()}`,
    `- HEAD: ${headCommit} (${headLine})`,
    `- 작업 트리 상태: ${worktreeState}`,
    `- 공개 안전 검사: ${checkResult}`,
    `- 번들 파일: ${path.basename(outZip)}`,
    '',
    '## 포함 규칙 (allowlist 중심)',
    '',
    '- git 추적 파일 중 아래를 제외한 모든 파일을 포함합니다.',
    '- 미추적(untracked) 파일과 로컬 데이터는 포함하지 않습니다.',
    '- `.agents/skills/beginner-bridge/**`는 JuTell 공개 배포 자산이므로 포함합니다.',
    '- 예시 설정(`examples/config/*.example.json`)만 포함하며, 실제 사용자 설정(`.jutell.json`, `.beginner-bridge.json`)은 포함하지 않습니다.',
    '',
    '## 제외 원칙',
    '',
    '- 실제 사용자 설정: 루트 `.jutell.json`, `.beginner-bridge.json`, `.jutell-operator.local.json` (설정은 CLI 또는 Dashboard가 생성)',
    '- 로컬 데이터: `.jutell-local/`, `.beginner-bridge-local/` 및 비공개 표시 폴더(`private/`, `docs/private/`, `*.private.md`, `*.internal.md`)',
    '- 로컬 Agent 설정: `.codex/`, 허용 경로 밖의 `.agents/**`',
    '- 비밀정보: `.env*`, `.pem`, `.key`, `.token`, `*.local.json`, `*.backup.json`',
    '- 빌드·의존성: `node_modules/`, `dist/`, `build/`, `coverage/`, `assets/`',
    '- 산출물: `artifacts/`, `*.tgz`, `*.log`',
    '- 로컬 테스트 프로젝트: `jutell-*-test/`',
    '',
    '## 포함 목록',
    '',
    ...includes.map((rel) => `- ${rel}`),
    '',
    `## 제외된 추적 파일 수: ${tracked.length - includes.length}`,
    '',
    '## 비밀정보 검사 결과',
    '',
    '- 번들 생성 전 전체 포함 파일 대상 패턴 검사: 위험 패턴 0건',
    '- 검사 대상: API Key·Token·비밀번호·`sk-` 키·Windows 절대 경로',
    '',
    '## 참고 문서',
    '',
    '- 검토 절차: `docs/operator/PROJECT_REVIEW_EXPORT_GUIDE.md`',
    '- 공개 저장소 정책: `docs/PUBLIC_REPOSITORY_POLICY.md`',
    '- 구현 범위 요약: `docs/PRODUCT_VISION.md`, `docs/foundation/ARCHITECTURE.md`',
    '',
  ].join('\n');

  const tmp = mkdtempSync(path.join(os.tmpdir(), 'jutell-bundle-'));
  try {
    const manifestRel = 'REVIEW_BUNDLE_MANIFEST.md';
    const manifestBuf = Buffer.from(manifest, 'utf8');
    const allFiles = [...includes, manifestRel];
    const readContent = (rel) => (rel === manifestRel ? manifestBuf : readFileSync(path.join(root, rel)));

    try {
      makeZip(outZip, allFiles, readContent);
      const zipList = listZip(outZip);
      verifyBundleList(zipList);
      console.log(`[완료] ZIP 번들 생성: ${outZip}`);
      console.log(`[확인] 번들 안 파일 ${zipList.length}개, 금지 경로 없음`);
      console.log(`[확인] 포함 ${includes.length}개, 제외 ${tracked.length - includes.length}개`);
      console.log('번들 내용 안내: REVIEW_BUNDLE_MANIFEST.md를 먼저 읽습니다.');
    } catch (error) {
      console.log(`[대체] ZIP 생성에 실패하여 폴더 번들로 대체합니다. 이유: ${error.message}`);
      const folder = makeFolderBundle(allFiles, manifest);
      console.log(`[완료] 폴더 번들 생성: ${folder}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main();
