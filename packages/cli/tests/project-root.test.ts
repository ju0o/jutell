import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveProjectRoot } from '../src/config/paths.js';

describe('project root for project-local npm installs', () => {
  it('uses npm local prefix for this installed CLI when the caller CWD changed', () => {
    const projectRoot = path.resolve('/tmp/JuTell Project with spaces');
    const installedPackageRoot = path.join(projectRoot, 'node_modules', 'jutell');

    expect(resolveProjectRoot('/tmp/caller-cwd', installedPackageRoot, projectRoot)).toBe(projectRoot);
  });

  it('keeps the caller CWD for global installs and unrelated npm prefixes', () => {
    const callerRoot = path.resolve('/tmp/caller-cwd');
    const projectRoot = path.resolve('/tmp/JuTell Project with spaces');

    expect(resolveProjectRoot(callerRoot, '/opt/node_modules/jutell', projectRoot)).toBe(callerRoot);
    expect(resolveProjectRoot(callerRoot, path.join(projectRoot, 'packages', 'cli'), projectRoot)).toBe(callerRoot);
  });

  it('uses the caller CWD when npm did not provide a local prefix', () => {
    expect(resolveProjectRoot('/tmp/caller-cwd', '/opt/node_modules/jutell', undefined)).toBe(path.resolve('/tmp/caller-cwd'));
  });
});
