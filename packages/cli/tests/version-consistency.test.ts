import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const version = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8')).version as string;

describe('JuTell version consistency (J01-VERSION-003)', () => {
  it('keeps the Skill frontmatter version in sync with the CLI package version', () => {
    const skill = readFileSync(path.join(repoRoot, '.agents', 'skills', 'beginner-bridge', 'SKILL.md'), 'utf8');
    expect(skill).toContain(`jutellSkillVersion: "${version}"`);
  });

  it('keeps the CLI banner and MCP doctor clientInfo on the package version', () => {
    const banner = readFileSync(path.join(packageRoot, 'src', 'output', 'format.ts'), 'utf8');
    expect(banner).toContain(`JuTell CLI ${version}`);
    const probe = readFileSync(path.join(packageRoot, 'src', 'process', 'mcpProbe.ts'), 'utf8');
    expect(probe).toContain(`version: '${version}'`);
  });

  it('keeps generated assets and docs install instructions on the package version', () => {
    const assets = readFileSync(path.join(packageRoot, 'scripts', 'build-assets.mjs'), 'utf8');
    expect(assets).toContain(`cli: '${version}'`);
    for (const doc of ['README.md', 'README.ko.md', path.join('docs', 'CLI_INSTALLATION.md'), path.join('docs', 'START_HERE.md'), path.join('packages', 'cli', 'README.md')]) {
      expect(readFileSync(path.join(repoRoot, doc), 'utf8')).toContain(`jutell-${version}.tgz`);
    }
  });

  it('keeps the MCP server-reported version on the same track', () => {
    const server = readFileSync(path.join(repoRoot, 'apps', 'mcp-server', 'src', 'index.ts'), 'utf8');
    expect(server).toContain(`version: '${version}'`);
  });
});
