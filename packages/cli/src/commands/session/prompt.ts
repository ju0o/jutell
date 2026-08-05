import readline from 'node:readline/promises';
import { emitKeypressEvents } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';

// 플래그(--agent 등) 없이 실행했을 때만 대화형으로 값을 묻습니다.
// 비대화형(파이프)에서는 null을 돌려주어 명령 쪽에서 오류를 내게 합니다.
export async function askText(message: string): Promise<string | null> {
  if (!input.isTTY) return null;
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(`${message} `);
    const trimmed = answer.trim();
    return trimmed || null;
  } finally {
    rl.close();
  }
}

export type KeyPressHandler = (key: { name: string; ctrl: boolean; shift: boolean; sequence?: string }) => void;

// 방향키(↑/↓) + Enter, 숫자 직접 입력을 지원하는 목록 선택.
// TTY가 아니면 null을 돌려줘서 호출부가 번호 선택 폴백으로 넘어가게 합니다.
export function arrowList(message: string, choices: string[], defaultIndex = 0): Promise<number | null> {
  if (!input.isTTY) return Promise.resolve(null);
  return new Promise((resolve) => {
    let selected = Math.min(Math.max(defaultIndex, 0), Math.max(choices.length - 1, 0));
    emitKeypressEvents(input);
    let rawMode = false;
    const render = () => {
      output.write(`${message}\n`);
      choices.forEach((choice, index) => {
        output.write(`${index === selected ? '> ' : '  '}${index + 1}. ${choice}\n`);
      });
      output.write('↑/↓ 이동, Enter 확인, 번호 직접 입력, Ctrl+C 종료\n');
    };
    const cleanup = (value: number | null) => {
      if (rawMode && input.setRawMode) { try { input.setRawMode(false); } catch { /* noop */ } }
      input.off('keypress', onKeypress);
      process.stdin.pause();
      resolve(value);
    };
    const onKeypress = (str: string, key: { name: string; ctrl: boolean; shift: boolean; sequence?: string }) => {
      if (key.name === 'up') { selected = (selected - 1 + choices.length) % choices.length; render(); }
      else if (key.name === 'down') { selected = (selected + 1) % choices.length; render(); }
      else if (key.name === 'return') cleanup(selected);
      else if (key.name === 'escape') cleanup(-1);
      else if (key.ctrl && key.name === 'c') cleanup(-1);
      else if (str && /^\d$/.test(str)) {
        const number = Number(str);
        if (number >= 1 && number <= choices.length) cleanup(number - 1);
      }
    };
    input.on('keypress', onKeypress);
    if (input.setRawMode) { try { input.setRawMode(true); rawMode = true; } catch { /* noop */ } }
    render();
  });
}
