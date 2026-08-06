import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { CliIo, CliOptions } from '../../types.js';
import { resolveWorkspace } from '../../workspace/resolver.js';
import { formatWorkspaceIssues } from '../../workspace/validation.js';
import { initWorkspaceCommand } from './init.js';
import { workspaceStatusCommand } from './status.js';
import { workspaceDoctorCommand } from './doctor.js';

export async function workspaceCommand(options: CliOptions, io: CliIo, extraArgs: string[]) {
  const sub = extraArgs[0] ?? '';
  if (sub === 'init') return initWorkspaceCommand(options, io, extraArgs.slice(1));
  if (sub === 'status') return workspaceStatusCommand(options, io);
  if (sub === 'doctor') return workspaceDoctorCommand(options, io);
  if (sub === '') {
    io.write('Workspace 명령: init, status, doctor\n`jutell workspace doctor`로 시작하면 현재 상태를 점검할 수 있습니다.');
    return 0;
  }
  throw new Error(`알 수 없는 workspace 하위 명령입니다: ${sub}\n가능한 명령: init, status, doctor`);
}