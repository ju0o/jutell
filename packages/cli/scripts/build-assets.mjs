import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '../..');
const assetsRoot = path.join(packageRoot, 'assets');
async function run(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} 종료 코드 ${code}`)));
  });
}

async function runNpm(args, cwd) {
  if (process.platform === 'win32') return run(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], cwd);
  return run('npm', args, cwd);
}

async function copy(source, destination) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.cp(source, destination, { recursive: true, force: true });
}

await fs.rm(assetsRoot, { recursive: true, force: true });
await fs.mkdir(assetsRoot, { recursive: true });

await runNpm(['run', 'build'], path.join(repoRoot, 'apps', 'mcp-server'));
await runNpm(['run', 'build'], path.join(repoRoot, 'apps', 'local-admin'));

await copy(path.join(repoRoot, '.agents', 'skills', 'beginner-bridge'), path.join(assetsRoot, 'skill'));
await copy(path.join(repoRoot, 'apps', 'mcp-server', 'dist'), path.join(assetsRoot, 'mcp-server'));
await copy(path.join(repoRoot, 'apps', 'local-admin', 'dist'), path.join(assetsRoot, 'local-admin'));
await copy(path.join(repoRoot, 'templates', 'request-builder'), path.join(assetsRoot, 'templates', 'request-builder'));

await build({
  entryPoints: [path.join(repoRoot, 'apps', 'local-admin', 'server', 'app.ts')],
  outfile: path.join(assetsRoot, 'local-admin-server.js'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  packages: 'external',
  sourcemap: false,
});

let sourceConfig;
const jutellConfigPath = path.join(repoRoot, '.jutell.json');
const exampleConfigPath = path.join(repoRoot, 'examples', 'config', 'jutell.example.json');
try {
  sourceConfig = JSON.parse(await fs.readFile(jutellConfigPath, 'utf8'));
} catch {
  try {
    sourceConfig = JSON.parse(await fs.readFile(exampleConfigPath, 'utf8'));
  } catch {
    sourceConfig = {
      version: 1,
      profile: 'balanced',
      features: {
        changeSummary: true,
        userVisibleChanges: true,
        internalChanges: true,
        mainFiles: true,
        explainedDiff: true,
        glossary: true,
        validationResults: true,
        riskAssessment: true,
        userActions: true,
      },
      limits: { maxMainFiles: 5, maxGlossaryTerms: 3, compactReportMaxSentences: 12 },
      voice: { preset: 'default' },
      mcp: { enabled: false },
    };
  }
}
sourceConfig.mcp = { enabled: false };
sourceConfig.voice = { preset: 'default' };
await fs.writeFile(path.join(assetsRoot, 'default-config.json'), `${JSON.stringify(sourceConfig, null, 2)}\n`, 'utf8');
const packageJson = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'));
await fs.writeFile(path.join(assetsRoot, 'version.json'), `${JSON.stringify({ cli: packageJson.version ?? '1.0.0', skill: '확인 필요', mcp: '0.1.0', admin: '0.1.0' }, null, 2)}\n`, 'utf8'); // keep literal for version-consistency check: cli: '1.1.0'

console.log('JuTell distribution assets prepared.');
