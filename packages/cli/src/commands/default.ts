import { stdin } from 'node:process';
import { dashboardCommand } from './dashboard.js';
import { enableCommand, setupCommand } from './lifecycle.js';
import { getStatus, statusCommand } from './status.js';
import { useCommand } from './use.js';
import { AGENT_PROVIDERS } from '../installer/providers.js';
import type { CliChoice, CliIo, CliOptions, Profile, ScopePaths, StatusResult } from '../types.js';

const profileLabels: Record<StatusResult['profile'], string> = {
  minimal: '최소 보고',
  balanced: '균형 보고',
  learning: '학습 보고',
  detailed: '상세 보고',
};

const profileChoices: CliChoice[] = [
  { value: 'balanced', label: '균형 보고', note: '처음 사용에 적당한 기본값 (권장)' },
  { value: 'minimal', label: '최소 보고', note: '핵심만 짧게' },
  { value: 'learning', label: '학습 보고', note: '개발 용어를 조금 더 설명' },
  { value: 'detailed', label: '상세 보고', note: '복잡한 작업을 자세히' },
];

function needsRepair(status: StatusResult) {
  return !status.configValid || !status.skillInstalled || !status.agentsManaged || status.codexPreparation !== 'enabled';
}

function readyMessage(status: StatusResult) {
  const ready = status.configValid && status.skillInstalled && status.agentsManaged && status.codexPreparation === 'enabled';
  if (!ready) {
    return `JuTell 연결이 일부 준비되지 않았습니다.

설정과 Skill을 확인했지만 AI Agent Provider 연결 준비가 완료되지 않았습니다.
관리자 화면에서 현재 상태를 확인할 수 있습니다.`;
  }
  return `JuTell 준비 완료

✓ 설정 연결됨
✓ Skill 연결됨
✓ AI Agent 연결 준비 완료
✓ 안전 보고 규칙 적용됨

현재 보고 방식: ${profileLabels[status.profile]}
활성 기능: ${status.activeFeatureCount}개

새 AI Agent 세션부터 사용할 수 있습니다.
실제 도구 호출 여부는 해당 Provider에서 확인할 수 있습니다.`;
}

const firstRunMessage = `이 프로젝트에는 아직 JuTell이 연결되지 않았습니다.

JuTell을 연결하면:
- AI 작업을 쉬운 말로 보고받을 수 있습니다.
- 현재 설정에 맞춰 보고 길이와 설명 방식을 조절할 수 있습니다.
- 연결된 AI Agent에서 JuTell MCP를 사용할 수 있습니다.`;

async function firstRunWizard(io: CliIo): Promise<{ agent: string; profile: Profile }> {
  io.write(`Welcome to JuTell! 🎉

AI가 한 일을 쉽게 이해하고, 검증하고, 다음 작업으로 이어가도록 돕습니다.
몇 가지만 고르면 이 프로젝트에 연결을 준비합니다.
`);
  const agentChoices: CliChoice[] = AGENT_PROVIDERS.map((provider) => ({
    value: provider.id,
    label: provider.label,
    note: provider.status === 'planned' ? '준비 중' : provider.description,
  }));
  let agent = 'codex';
  while (true) {
    const picked = await io.choose('① 사용 중인 AI Agent를 선택하세요.', agentChoices, 'codex');
    const provider = AGENT_PROVIDERS.find((item) => item.id === picked);
    if (provider && provider.status !== 'planned') { agent = provider.id; break; }
    io.write(`${provider?.label ?? '선택한 Agent'}는 아직 준비 중입니다. 지금 사용할 수 있는 Agent를 선택하세요.`);
  }
  const profile = (await io.choose('② 보고 방식을 선택하세요. 나중에 언제든 바꿀 수 있습니다.', profileChoices, 'balanced')) as Profile;
  const agentLabel = AGENT_PROVIDERS.find((item) => item.id === agent)?.label ?? agent;
  io.write(`\n③ 선택 완료: ${agentLabel} · ${profileLabels[profile]}\n연결을 준비합니다.\n`);
  return { agent, profile };
}

export async function defaultCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  let status = await getStatus(paths);
  if (!status.configExists) {
    if (options.yes || stdin.isTTY !== true) {
      io.write(firstRunMessage);
      if (!options.yes && !(await io.ask('이 프로젝트에 연결할까요?', true))) {
        io.write('JuTell을 연결하지 않았습니다.');
        return { cancelled: true };
      }
      await setupCommand(paths, { ...options, yes: true, oneCommand: true, activateMcp: true }, io);
    } else {
      const picked = await firstRunWizard(io);
      await useCommand(paths, { ...options, yes: true, profile: picked.profile }, io, ['use', picked.agent]);
    }
  } else if (needsRepair(status)) {
    io.write('JuTell 연결이 일부 준비되지 않았습니다.\nSkill, AGENTS.md, AI Agent Provider 연결 준비를 안전하게 확인할 수 있습니다.');
    if (!options.yes && !(await io.ask('다시 켜고 관리자 화면을 열까요?', true))) {
      io.write('현재 설정을 그대로 두고 관리자 화면을 엽니다.');
    } else {
      await enableCommand(paths, { ...options, yes: true, oneCommand: true }, io);
    }
  }
  status = await getStatus(paths);
  io.write(readyMessage(status));
  return dashboardCommand(paths, options, io);
}
