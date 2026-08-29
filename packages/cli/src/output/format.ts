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
  const options: CliOptions = { scope: 'project', yes: false, activateMcp: false, oneCommand: false, statusOnly: false, json: false, verbose: false, openBrowser: true, fix: false, skillOnly: false, mcpOnly: false, disableSkill: false, disableMcp: false, disableAll: false, keepData: false, removeData: false, clean: false } as CliOptions;
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
    else if (arg === '--clean' || arg === '--remove-legacy') (options as Record<string, unknown>).clean = true;
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
  io.write(`JuTell CLI 0.3.0

시작할 때는 jutell만 입력하면 됩니다.
처음 연결하면 안내에 따라 AI Agent와 보고 방식을 고르고
연결을 준비한 뒤 관리자 화면을 엽니다.

자주 쓰는 명령

  jutell                처음 시작: 설치·연결·관리자 화면을 준비합니다.
  jutell use codex      Codex에 연결합니다 (권장).
  jutell use opencode   OpenCode에 연결합니다.
  jutell use claude     Claude Code에 연결합니다 (베타).
  jutell status         현재 연결 상태를 확인합니다.
  jutell doctor         문제가 있는지 점검합니다.
  jutell on             연결을 켭니다.
  jutell off            연결을 끕니다.

연결 후 새 대화를 열면 JuTell이 자동으로 적용됩니다.
JuTell은 AI Agent를 대신 실행하지 않고 연결과 보고만 도와줍니다.

고급 명령 (보통 사용할 필요가 없습니다)

  jutell dashboard      관리자 화면만 엽니다.
  jutell setup          설치를 다시 진행합니다.
  jutell enable         연결을 켭니다 (on과 같음).
  jutell disable        연결을 끕니다 (off와 같음).
  jutell provider       Agent 연결 상태를 자세히 봅니다.
  jutell connect        연결만 추가합니다.
  jutell disconnect     해당 연결만 끕니다.
  jutell switch         기본 Agent를 전환합니다.
  jutell uninstall      설치를 제거합니다.
  jutell upgrade        설치된 Skill/설정/MCP를 최신으로 새로고침합니다.
  jutell migrate        레거시 beginner_bridge → jutell 로 안전하게 옮깁니다.
  jutell migrate --clean 레거시 정리를 수행합니다 (canonical 확인 후).

하루 작업 기록

  jutell session        오늘 기록 상태를 봅니다.
  jutell session help   하루 기록의 하위 명령을 보여줍니다.

이전 별칭: beginner-bridge

실제 배포 전에는 로컬 패키지 검증만 지원합니다. 업데이트는 다음 명령을 사용하세요.
  npm update -g jutell`);
}
