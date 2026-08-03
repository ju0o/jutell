import { readCodexRegistration } from '../config/managed.js';
import { AGENT_PROVIDERS, findProvider } from '../installer/providers.js';
import { opencodeDetected, readOpenCodeRegistration, registerOpenCodeMcp, setOpenCodeEnabled } from '../installer/opencode.js';
import { codexDetected } from '../process/system.js';
import { packageRoot } from '../config/paths.js';
import type { CliIo, CliOptions, ScopePaths } from '../types.js';

function providerLabel(id: string) {
  const provider = findProvider(id);
  return provider ? `${provider.label} (${provider.status === 'supported' ? '현재 지원' : provider.status === 'beta' ? '베타' : '확장 준비'})` : id;
}

function openCodeScopeLabel(paths: ScopePaths) {
  return paths.scope === 'global' ? '사용자 OpenCode 설정' : '현재 프로젝트/opencode.json';
}

async function listCommand(io: CliIo) {
  io.write('JuTell AI Agent Provider 목록');
  for (const provider of AGENT_PROVIDERS) {
    const state = provider.status === 'supported' ? '현재 지원' : provider.status === 'beta' ? '베타' : '확장 준비';
    io.write(`${provider.label.padEnd(10)} ${state}`);
  }
}

async function statusCommand(paths: ScopePaths, io: CliIo) {
  const codex = await readCodexRegistration(paths, packageRoot(), false);
  const opencode = await readOpenCodeRegistration(paths, packageRoot(), false);
  io.write(`JuTell AI Agent Provider 상태

${providerLabel('codex')}
  감지: ${codexDetected() ? '예' : '직접 확인 필요'}
  설정 파일: 현재 Provider 설정 (.codex/config.toml)
  MCP 등록: ${codex.registered ? '등록됨' : codex.conflict ? '충돌 확인 필요' : '등록되지 않음'}

${providerLabel('opencode')}
  감지: ${opencodeDetected() ? '예' : '직접 확인 필요'}
  설정 파일: ${openCodeScopeLabel(paths)}
  MCP 등록: ${opencode.registered ? '등록됨' : opencode.conflict ? '충돌 확인 필요' : '등록되지 않음'}
  활성화: ${opencode.registered ? (opencode.enabled ? '예' : '아니오') : '등록되지 않음'}`);
}

function requireTarget(args: string[]) {
  const target = args[1];
  if (!target) throw new Error('설정할 Provider 이름이 필요합니다. 예: jutell provider setup opencode');
  if (target === 'codex') throw new Error('Codex는 기존 jutell setup / on / off 명령을 사용하세요.');
  if (target !== 'opencode') throw new Error('아직 지원하는 Provider는 opencode뿐입니다.');
}

export async function providerCommand(paths: ScopePaths, options: CliOptions, io: CliIo, args: string[]) {
  const sub = args[0];
  if (sub === 'list') return listCommand(io);
  if (sub === 'status') return statusCommand(paths, io);
  if (sub === 'setup') {
    requireTarget(args);
    const current = await readOpenCodeRegistration(paths, packageRoot(), false);
    if (current.conflict) throw new Error('OpenCode 설정에 같은 이름의 관리되지 않는 MCP 항목이 있어 자동 변경하지 않았습니다.');
    io.write(`JuTell OpenCode 연결 설정 미리보기\n\n설정 파일: ${openCodeScopeLabel(paths)}\n상태: ${current.registered ? '이미 등록됨 (최신 설정으로 갱신)' : '새로 등록'}\n활성화: 기본 OFF (jutell provider enable opencode 로 켭니다)\n\n${current.preview}`);
    if (!options.yes && !(await io.ask('위 변경을 진행할까요?'))) return { cancelled: true };
    await registerOpenCodeMcp(paths, packageRoot(), false);
    io.write('OpenCode 연결 설정을 등록했습니다. 기존 설정은 보존했고 JuTell 관리 블록만 추가했습니다.');
    return { cancelled: false };
  }
  if (sub === 'enable') {
    requireTarget(args);
    await registerOpenCodeMcp(paths, packageRoot(), true);
    io.write('OpenCode JuTell MCP를 활성화했습니다. 새 OpenCode 세션부터 사용할 수 있습니다.');
    return { cancelled: false };
  }
  if (sub === 'disable') {
    requireTarget(args);
    const current = await readOpenCodeRegistration(paths, packageRoot(), false);
    if (!current.registered) {
      io.write('등록된 OpenCode JuTell 관리 블록이 없습니다. 먼저 jutell provider setup opencode 를 실행하세요.');
      return { cancelled: false };
    }
    await setOpenCodeEnabled(paths, packageRoot(), false);
    io.write('OpenCode JuTell MCP를 비활성화했습니다. 설정 항목은 유지됩니다.');
    return { cancelled: false };
  }
  throw new Error('provider 하위 명령: list, status, setup, enable, disable');
}
