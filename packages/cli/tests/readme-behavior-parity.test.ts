import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AGENT_PROVIDERS } from '../src/installer/providers.js';

// JUTELL-V1.X-PUBLIC-SURFACE-REWRITE-01: a Release README Gate. These checks
// exist because the public-surface audit found four real, shipping surfaces
// that kept claiming bare `jutell` opens the dashboard on a normal connect,
// after that behavior was deliberately removed from default.ts. They check
// semantic anchors (does the claim/fact appear, in the right place) rather
// than pinning exact sentences, so normal copy edits don't make this brittle.

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const version = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8')).version as string;

function read(relPath: string) {
  return readFileSync(path.join(repoRoot, relPath), 'utf8');
}

const defaultTs = read(path.join('packages', 'cli', 'src', 'commands', 'default.ts'));
// default.ts documents its own current contract with these two comments -
// use them as the live source of truth for what "normal current behavior" is,
// instead of a second hardcoded copy of the behavior description.
const NORMAL_CONNECT_DOES_NOT_OPEN_DASHBOARD = /auto-launch the dashboard/i.test(defaultTs);

describe('bare `jutell` dashboard-behavior copy matches default.ts (Release README Gate #2)', () => {
  it('sanity-checks the source-of-truth comment is still present in default.ts', () => {
    expect(NORMAL_CONNECT_DOES_NOT_OPEN_DASHBOARD).toBe(true);
  });

  const surfaces: Array<[string, string]> = [
    ['CLI --help banner', path.join('packages', 'cli', 'src', 'output', 'format.ts')],
    ['docs/CLI_INSTALLATION.md', path.join('docs', 'CLI_INSTALLATION.md')],
    ['docs/MCP_INTEGRATION.md', path.join('docs', 'MCP_INTEGRATION.md')],
    ['docs/START_HERE.md', path.join('docs', 'START_HERE.md')],
    ['README.md', 'README.md'],
    ['README.ko.md', 'README.ko.md'],
  ];

  for (const [label, relPath] of surfaces) {
    it(`${label} does not claim a normal connect opens the dashboard`, () => {
      const text = read(relPath);
      // The one true stale claim found by the audit: "prepares the
      // connection, then opens the admin screen" as the normal outcome.
      expect(text).not.toMatch(/연결을 준비한 뒤 관리자 화면을 엽니다/);
      expect(text).not.toMatch(/opens the (local )?(admin|dashboard) screen (at the end|automatically)/i);
    });
  }
});

describe('README install path leads with bare `jutell`, not a provider-specific command (Release README Gate #3)', () => {
  for (const [label, relPath] of [['README.md', 'README.md'], ['README.ko.md', 'README.ko.md']] as const) {
    it(`${label} shows "npm install -g jutell" followed by bare "jutell" as the install flow`, () => {
      const text = read(relPath);
      const installBlock = text.match(/```bash\nnpm install -g jutell\njutell\n```/);
      expect(installBlock, `${label} should show the two-line install block (npm install -g jutell, then bare jutell)`).toBeTruthy();
    });

    it(`${label} does not present a provider-specific "jutell use <agent>" command inside the main install flow`, () => {
      const text = read(relPath);
      const installBlock = text.match(/```bash\nnpm install -g jutell\njutell\n```/);
      expect(installBlock).toBeTruthy();
      // Nothing about "jutell use" appears before the first advanced/manual-connection section.
      const advancedHeadingIndex = text.search(/## (Install, control & advanced|설치·제어·고급 명령)/);
      expect(advancedHeadingIndex).toBeGreaterThan(-1);
      const beforeAdvanced = text.slice(0, advancedHeadingIndex);
      expect(beforeAdvanced).not.toMatch(/jutell use codex/);
    });
  }
});

describe('README provider-support copy matches providers.ts truth (Release README Gate #4)', () => {
  const betaLabelByLanguage = { en: 'Beta', ko: '베타' } as const;
  const supportedLabelByLanguage = { en: 'Supported', ko: '정식 지원' } as const;

  const activeProviders = AGENT_PROVIDERS.filter((p) => p.status !== 'planned');

  for (const [lang, relPath] of [['en', 'README.md'], ['ko', 'README.ko.md']] as const) {
    it(`${relPath} flags every provider marked 'beta' in providers.ts as beta, and 'supported' providers as not-beta`, () => {
      const text = read(relPath);
      for (const provider of activeProviders) {
        // Find the markdown table row for this provider by its label.
        const rowMatch = text.match(new RegExp(`\\*\\*${provider.label}\\*\\*[^\\n]*`));
        expect(rowMatch, `expected a README table row for ${provider.label} in ${relPath}`).toBeTruthy();
        const row = rowMatch![0];
        if (provider.status === 'beta') {
          expect(row, `${provider.label} is 'beta' in providers.ts but its ${relPath} row doesn't say so`).toContain(betaLabelByLanguage[lang]);
        } else if (provider.status === 'supported') {
          expect(row, `${provider.label} is 'supported' in providers.ts but its ${relPath} row flags it as beta`).not.toContain(betaLabelByLanguage[lang]);
          expect(row).toContain(supportedLabelByLanguage[lang]);
        }
      }
    });
  }
});

describe('README.md / README.ko.md major product truth stays aligned (Release README Gate #5)', () => {
  const en = read('README.md');
  const ko = read('README.ko.md');

  it('both name the same current CLI version (published or release-candidate)', () => {
    expect(en).toContain(`jutell@${version}`);
    expect(ko).toContain(`jutell@${version}`);
  });

  it('both carry the published-vs-unreleased "What\'s new" distinction, not just one language', () => {
    for (const text of [en, ko]) {
      expect(text).toMatch(/## (What's new|최신 소식)/);
      expect(text).toMatch(/not yet published|아직 npm에 공개되지 않음/);
    }
  });

  it('both list the same three connectable agents', () => {
    for (const provider of AGENT_PROVIDERS.filter((p) => p.status !== 'planned')) {
      expect(en).toContain(provider.label);
      expect(ko).toContain(provider.label);
    }
  });

  it('both link to the other language at the top (language switch)', () => {
    expect(en).toMatch(/README\.ko\.md/);
    expect(ko).toMatch(/README\.md/);
  });

  it('neither leads with unconditional legacy beginner-bridge branding in the main onboarding flow', () => {
    // The compat alias must still exist elsewhere (paths.ts, CLI bin, migrate
    // docs) - this only guards the two public README files themselves.
    for (const text of [en, ko]) {
      expect(text).not.toMatch(/beginner-bridge/i);
    }
  });
});

// JUTELL-V1.1.0-RELEASE-PREP-01: the release-candidate audit found two real
// blind spots the checks above never covered - the README npm actually
// displays (packages/cli/README.md, not the repo-root one), and a second,
// earlier "npm install -g jutell / jutell use codex" block inside
// docs/START_HERE.md that the original Release README Gate never reached
// because it only checked the *dashboard-claim* sentence in that file, not
// its install-flow ordering. Both are semantic-anchor checks, not sentence
// pinning, so ordinary copy edits elsewhere in these files won't break them.

describe('packages/cli/README.md - the README npm actually displays (Release README Gate #6)', () => {
  const npmReadme = read(path.join('packages', 'cli', 'README.md'));

  it('names the current CLI version', () => {
    expect(npmReadme).toContain(`jutell-${version}.tgz`);
  });

  it('shows "npm install -g jutell" followed by bare "jutell" as the install flow', () => {
    expect(npmReadme).toMatch(/```bash\nnpm install -g jutell\njutell\n```/);
  });

  it('does not present a provider-specific "jutell use <agent>" command outside the main install block without manual/repair framing nearby', () => {
    // The main install block (already asserted above) is the only place a
    // command is allowed to stand alone as "the" install step. Any mention
    // of "jutell use codex" elsewhere in the doc must be framed, in the same
    // sentence or the one right after/before it, as the manual/repair path -
    // proximity, not strict word order, since "run X - this is the manual
    // path" is just as valid prose as "for manual repair, run X".
    const proximityWindow = 200;
    const firstUseCommandIndex = npmReadme.indexOf('jutell use codex');
    expect(firstUseCommandIndex, 'expected the doc to mention jutell use codex as the manual path').toBeGreaterThan(-1);
    const nearby = npmReadme.slice(Math.max(0, firstUseCommandIndex - proximityWindow), firstUseCommandIndex + proximityWindow);
    expect(nearby, 'expected "manual"/"repair" framing within 200 chars of the jutell use codex mention').toMatch(/manual|repair/i);
  });

  it('points Korean readers to the full Korean README', () => {
    expect(npmReadme).toMatch(/README\.ko\.md/);
  });
});

describe('docs/START_HERE.md normal install path cannot silently regress to a provider-specific default (Release README Gate #7)', () => {
  const startHere = read(path.join('docs', 'START_HERE.md'));

  it('shows bare `jutell` (not `jutell use codex`) as the last line of its normal install block', () => {
    const installBlock = startHere.match(/```powershell\nnpm install -g jutell\ncd <프로젝트 폴더>\n(jutell(?: use codex)?)\n```/);
    expect(installBlock, 'expected to find the normal install code block').toBeTruthy();
    expect(installBlock![1]).toBe('jutell');
  });

  it('mentions `jutell use codex` only with manual/recovery framing nearby (proximity, not strict word order)', () => {
    const proximityWindow = 200;
    const firstUseCommandIndex = startHere.indexOf('jutell use codex');
    expect(firstUseCommandIndex, 'expected the doc to mention jutell use codex as the manual/recovery path').toBeGreaterThan(-1);
    const nearby = startHere.slice(Math.max(0, firstUseCommandIndex - proximityWindow), firstUseCommandIndex + proximityWindow);
    expect(nearby, 'expected 수동/복구 framing within 200 chars of the jutell use codex mention').toMatch(/수동|복구/);
  });

  it('lists all three connectable agents, not just Codex/OpenCode', () => {
    for (const provider of AGENT_PROVIDERS.filter((p) => p.status !== 'planned')) {
      expect(startHere).toContain(provider.label);
    }
  });
});
