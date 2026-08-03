import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { CliIo, CliOptions, InstallScope, Profile } from '../types.js';

export function createIo(): CliIo {
  return {
    write: (message) => console.log(message),
    error: (message) => console.error(message),
    ask: async (message, defaultYes = false) => {
      const rl = readline.createInterface({ input, output });
      try {
        const answer = await rl.question(`${message} ${defaultYes ? '(Y/n)' : '(y/N)'} `);
        return defaultYes ? !/^n(o)?$/i.test(answer.trim()) : /^y(es)?$/i.test(answer.trim());
      } finally { rl.close(); }
    },
  };
}

export function parseOptions(args: string[]): { command: string; options: CliOptions; defaultInvocation: boolean; extraArgs: string[] } {
  let command = 'dashboard';
  let defaultInvocation = true;
  let index = 0;
  const extraArgs: string[] = [];
  if (args[0] && !args[0].startsWith('-')) { command = args[0]; defaultInvocation = false; index = 1; }
  const options: CliOptions = { scope: 'project', yes: false, activateMcp: false, oneCommand: false, statusOnly: false, json: false, verbose: false, openBrowser: true, fix: false, skillOnly: false, mcpOnly: false, disableSkill: false, disableMcp: false, disableAll: false, keepData: false, removeData: false };
  for (; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--project') options.scope = 'project';
    else if (arg === '--global') options.scope = 'global';
    else if (arg === '--yes' || arg === '-y') options.yes = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--status-only') options.statusOnly = true;
    else if (arg === '--verbose') options.verbose = true;
    else if (arg === '--no-open') options.openBrowser = false;
    else if (arg === '--fix') options.fix = true;
    else if (arg === '--skill-only') options.skillOnly = true;
    else if (arg === '--mcp-only') options.mcpOnly = true;
    else if (arg === '--skill') options.disableSkill = true;
    else if (arg === '--mcp') options.disableMcp = true;
    else if (arg === '--all') options.disableAll = true;
    else if (arg === '--keep-data') options.keepData = true;
    else if (arg === '--remove-data') options.removeData = true;
    else if (arg === '--profile') {
      const value = args[index + 1];
      if (!value) throw new Error('--profile 뒤에 Profile 이름이 필요합니다.');
      options.profile = value as Profile;
      index += 1;
    } else if (arg === '--help' || arg === '-h') command = 'help';
    else if (arg.startsWith('-')) throw new Error(`알 수 없는 옵션입니다: ${arg}`);
    else extraArgs.push(arg);
  }
  if (options.skillOnly && options.mcpOnly) throw new Error('--skill-only와 --mcp-only를 동시에 사용할 수 없습니다.');
  if (options.keepData && options.removeData) throw new Error('--keep-data와 --remove-data를 동시에 사용할 수 없습니다.');
  if (options.disableAll) { options.disableSkill = true; options.disableMcp = true; }
  return { command, options, defaultInvocation, extraArgs };
}

export function scopeLabel(scope: InstallScope) { return scope === 'global' ? '사용자 전역' : '현재 프로젝트'; }

export function printHelp(io: CliIo) {
  io.write(`JuTell CLI 0.2.0

가장 많이 사용하는 명령

  jutell          JuTell을 준비하고 관리자 화면을 엽니다.
  jutell use opencode   OpenCode 연결을 준비합니다 (권장).
  jutell use codex      Codex 연결을 준비합니다 (권장).
  jutell on       JuTell 연결을 켭니다.
  jutell off      JuTell 연결을 끕니다.
  jutell status   현재 연결 상태를 확인합니다.
  jutell doctor   문제가 있는지 점검합니다.

사용법:
  jutell [--no-open|--status-only]
  jutell dashboard [--no-open]
  jutell use <agent>
  jutell on
  jutell off

use·connect는 Agent를 대신 실행하거나 소유하지 않습니다.
Agent는 사용자가 선택한 도구로 그대로 실행되며,
JuTell은 Skill·MCP·지침·설정을 연결합니다.

고급 명령:
  jutell setup [--project|--global] [--profile balanced] [--yes]
  jutell status [--project|--global] [--json]
  jutell enable [--skill-only|--mcp-only]
  jutell disable [--skill|--mcp|--all]
  jutell doctor [--fix] [--json]
  jutell uninstall [--keep-data|--remove-data] [--yes]
  jutell --version

AI Agent Provider 명령:
  jutell provider          연결 상태를 간단히 봅니다.
  jutell provider list
  jutell provider status [--json]
  jutell provider setup opencode [--yes]
  jutell provider enable opencode
  jutell provider disable opencode
  jutell connect <agent>      연결만 추가합니다.
  jutell disconnect <agent>   해당 연결만 끕니다.
  jutell switch <agent>       기본 Agent로 전환합니다.

이전 별칭: beginner-bridge

실제 npm 배포 전에는 로컬 패키지 검증만 지원합니다. 업데이트는 다음 명령을 사용하세요.
  npm update -g jutell`);
}
