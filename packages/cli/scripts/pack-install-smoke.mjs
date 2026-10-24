#!/usr/bin/env node
// Packs the CLI as npm would publish it, installs the tarball into a fresh temp project,
// and checks that `jutell --help` and `jutell doctor` run. Nothing is published.
// HOME/USERPROFILE/CODEX_HOME point into the temp folder so real settings are never touched.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cliDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = mkdtempSync(path.join(os.tmpdir(), 'jutell-pack-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const shell = process.platform === 'win32';
const started = Date.now();
try {
  // Build first so the tarball holds the current src, never a stale dist (pack uses --ignore-scripts).
  execFileSync(npm, ['run', '-s', 'build'], { cwd: cliDir, stdio: 'inherit', shell });
  const packOut = execFileSync(npm, ['pack', '--ignore-scripts', '--silent', '--pack-destination', root], { cwd: cliDir, encoding: 'utf8', shell });
  const tarball = path.join(root, packOut.trim().split(/\r?\n/).pop());
  const project = path.join(root, 'proj');
  const home = path.join(root, 'home');
  mkdirSync(project); mkdirSync(home);
  writeFileSync(path.join(project, 'package.json'), '{"name":"pack-smoke","version":"1.0.0","private":true}\n');
  execFileSync(npm, ['install', '--save-dev', '--no-audit', '--no-fund', '--prefer-offline', tarball], { cwd: project, stdio: 'ignore', shell });
  const env = { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: path.join(home, '.codex'), BEGINNER_BRIDGE_HOME: home, CLAUDE_CONFIG_DIR: home, NO_COLOR: '1' };
  const bin = path.join(project, 'node_modules', 'jutell', 'dist', 'index.js');
  const help = spawnSync(process.execPath, [bin, '--help'], { cwd: project, env, encoding: 'utf8' });
  if (help.status !== 0 || !help.stdout.includes('jutell uninstall --yes')) throw new Error(`jutell --help failed (exit ${help.status})\n${help.stdout}${help.stderr}`);
  const doctor = spawnSync(process.execPath, [bin, 'doctor', '--no-funding'], { cwd: project, env, encoding: 'utf8' });
  // doctor exits 1 when a check is an error (nothing is connected yet here); it must still print its report.
  if (![0, 1].includes(doctor.status ?? -1) || !doctor.stdout.includes('JuTell 점검 결과') || !doctor.stdout.includes('npm exec --offline --no -- jutell receipt')) {
    throw new Error(`jutell doctor failed (exit ${doctor.status})\n${doctor.stdout}${doctor.stderr}`);
  }
  console.log(`pack-install smoke OK (${((Date.now() - started) / 1000).toFixed(1)} s)`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
