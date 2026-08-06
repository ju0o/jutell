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
    choose: async (message, choices, defaultValue) => {
      const rl = readline.createInterface({ input, output });
      try {
        const list = choices.map((choice, index) => `  ${index + 1}. ${choice.label}${choice.note ? ` — ${choice.note}` : ''}`).join('\n');
        output.write(`${message}\n${list}\n`);
        const defaultLabel = defaultValue ? choices.find((choice) => choice.value === defaultValue)?.label : undefined;
        while (true) {
          const answer = await rl.question(`선택 (번호 입력${defaultLabel ? `, Enter: ${defaultLabel}` : ''}) > `);
          const trimmed = answer.trim();
          if (!trimmed) {
            if (defaultLabel) return defaultValue;
            output.write('보기 중 하나의 번호를 입력하세요.\n');
            continue;
          }
          const number = Number(trimmed);
          if (Number.isInteger(number) && number >= 1 && number <= choices.length) return choices[number - 1].value;
          output.write('보기 중 하나의 번호를 입력하세요.\n');
        }
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
    else if (arg === '--workspace') {
      const value = args[index + 1];
      if (!value) throw new Error('--workspace 뒤에 Workspace 경로가 필요합니다.');
      options.workspacePath = value;
      index += 1;
    } else if (arg === '--yes' || arg === '-y') options.yes = true;
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
    } else if (arg === '--page') {
      const value = args[index + 1];
      if (!value || !/^\d+$/.test(value)) throw new Error('--page 뒤에 Page 번호가 필요합니다.');
      options.page = Number(value);
      index += 1;
    } else if (arg === '--agent') {
      const value = args[index + 1];
      if (!value) throw new Error('--agent 뒤에 Agent 이름이 필요합니다.');
      options.agent = value;
      index += 1;
    } else if (arg === '--role') {
      const value = args[index + 1];
      if (!value) throw new Error('--role 뒤에 역할이 필요합니다.');
      options.role = value;
      index += 1;
    } else if (arg === '--title') {
      const value = args[index + 1];
      if (!value) throw new Error('--title 뒤에 Page 제목이 필요합니다.');
      options.title = value;
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

가장 많이 사용하는 명령 7가지

  jutell                처음 시작: 설치·연결·관리자 화면을 준비합니다.
  jutell on             연결을 켭니다.
  jutell off            연결을 끕니다.
  jutell status         현재 연결 상태를 확인합니다.
  jutell doctor         문제가 있는지 점검합니다.
  jutell use codex      Codex에 연결합니다 (권장).
  jutell use opencode   OpenCode에 연결합니다 (베타).

처음 실행할 때는 jutell 만 입력하면 됩니다.
사용 중인 AI Agent와 보고 방식을 묻는 안내에 따라 고르면 연결이 준비됩니다.
설정은 언제든 관리자 화면 또는 jutell use 명령으로 바꿀 수 있습니다.

use·connect는 Agent를 대신 실행하거나 소유하지 않습니다.
Agent는 사용자가 선택한 도구로 그대로 실행되며,
JuTell은 Skill·MCP·지침·설정을 연결합니다.

고급 명령 (보통 사용할 필요가 없습니다)

  jutell dashboard      관리자 화면만 엽니다.
  jutell setup          설치를 다시 진행합니다.
  jutell enable         연결을 켭니다 (on과 같음).
  jutell disable        연결을 끕니다 (off와 같음).
  jutell uninstall      설치를 제거합니다.
  jutell provider       Agent 연결 상태를 자세히 봅니다.
  jutell connect        연결만 추가합니다.
  jutell disconnect     해당 연결만 끕니다.
  jutell switch         기본 Agent를 전환합니다.

Workspace (선택, 운영자·고급 사용자용)

  jutell workspace init          새 Workspace를 만듭니다.
  jutell workspace status        Workspace 상태를 확인합니다.
  jutell workspace doctor        Workspace 설정과 구조를 점검합니다.
  jutell workspace doctor --fix  없는 폴더만 안전하게 만들어줍니다.
  jutell workspace <명령> --workspace <경로>
                                 지정한 위치의 Workspace를 대상으로 합니다.

하루 작업 기록 (Session = 하루, Page = Agent·역할별 파일, Work = Page 안 작업)

  jutell session           오늘 Session 상태를 봅니다.
  jutell session new       오늘 Session 폴더를 만듭니다.
  jutell session page      Agent·역할별 Page 파일을 만듭니다.
  jutell session work      현재 Page에 다음 번호 작업을 추가합니다.
  jutell session move      작업할 Page를 이동합니다.
  jutell session finish    SESSION_SUMMARY.md로 하루를 마감합니다.
  jutell session storage   Session 저장 위치 상태를 확인합니다 (운영자용).
  jutell session storage set <절대 경로>
                           Session 저장 위치를 운영자 지정으로 바꿉니다.
  jutell session storage reset
                           운영자 지정을 제거하고 기본 저장 위치로 돌아갑니다.

이전 별칭: beginner-bridge

실제 npm 배포 전에는 로컬 패키지 검증만 지원합니다. 업데이트는 다음 명령을 사용하세요.
  npm update -g jutell`);
}
