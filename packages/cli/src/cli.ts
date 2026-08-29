import { resolveScope } from './config/paths.js';
import { readVersionInfo } from './config/managed.js';
import { parseOptions, createIo, printHelp } from './output/format.js';
import { setupCommand, enableCommand, disableCommand, uninstallCommand } from './commands/lifecycle.js';
import { statusCommand, doctorCommand } from './commands/status.js';
import { dashboardCommand } from './commands/dashboard.js';
import { defaultCommand } from './commands/default.js';
import { onCommand, offCommand } from './commands/lifecycle.js';
import { providerCommand } from './commands/provider.js';
import { useCommand, connectCommand, disconnectCommand, switchCommand } from './commands/use.js';
import { sessionCommand } from './commands/session/index.js';
import { upgradeCommand } from './commands/upgrade.js';
import { migrateCommand } from './commands/migrate.js';
import type { CliIo } from './types.js';

function safeError(message: string, verbose: boolean) {
  if (verbose) return message;
  if (/ENOENT|EACCES|EPERM|spawn EINVAL/i.test(message)) return '필요한 파일이나 실행 권한을 확인하지 못했습니다. `jutell doctor`를 실행해 주세요.';
  return message.replace(/[A-Za-z]:[\\/][^\r\n'" ]+/g, '[경로]');
}

export async function run(argv: string[] = process.argv.slice(2), io: CliIo = createIo(), legacyAlias = false) {
  if (legacyAlias) io.write('`beginner-bridge`는 이전 명령입니다. 앞으로는 `jutell` 사용을 권장합니다.');
  if (argv.includes('--version')) { io.write((await readVersionInfo()).cli); return 0; }
  try {
    const { command, options, defaultInvocation, extraArgs } = parseOptions(argv);
    if (command === 'help') { printHelp(io); return 0; }
    const paths = resolveScope(options.scope);
    if (options.statusOnly) await statusCommand(paths, options, io);
    else if (defaultInvocation) await defaultCommand(paths, options, io);
    else if (command === 'setup') await setupCommand(paths, options, io);
    else if (command === 'dashboard') await dashboardCommand(paths, options, io);
    else if (command === 'on') await onCommand(paths, options, io);
    else if (command === 'off') await offCommand(paths, options, io);
    else if (command === 'status') await statusCommand(paths, options, io);
    else if (command === 'enable') await enableCommand(paths, options, io);
    else if (command === 'disable') await disableCommand(paths, options, io);
    else if (command === 'doctor') await doctorCommand(paths, options, io);
    else if (command === 'uninstall') await uninstallCommand(paths, options, io);
    else if (command === 'provider') await providerCommand(paths, options, io, extraArgs);
    else if (command === 'use') await useCommand(paths, options, io, [command, ...extraArgs]);
    else if (command === 'connect') await connectCommand(paths, options, io, [command, ...extraArgs]);
    else if (command === 'disconnect') await disconnectCommand(paths, options, io, [command, ...extraArgs]);
    else if (command === 'switch') await switchCommand(paths, options, io, [command, ...extraArgs]);
    else if (command === 'upgrade') await upgradeCommand(paths, options, io);
    else if (command === 'migrate') await migrateCommand(paths, options, io);
    else if (command === 'session') await sessionCommand(paths, options, io, extraArgs);
    else throw new Error(`알 수 없는 명령입니다: ${command}`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : '작업을 처리하지 못했습니다.';
    io.error(`오류: ${safeError(message, argv.includes('--verbose'))}`);
    return 1;
  }
}
