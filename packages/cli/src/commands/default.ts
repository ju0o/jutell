import { dashboardCommand } from './dashboard.js';
import { enableCommand, setupCommand } from './lifecycle.js';
import { getStatus, statusCommand } from './status.js';
import type { CliIo, CliOptions, ScopePaths, StatusResult } from '../types.js';

const profileLabels: Record<StatusResult['profile'], string> = {
  minimal: '최소 보고',
  balanced: '균형 보고',
  learning: '학습 보고',
  detailed: '상세 보고',
};

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

export async function defaultCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  let status = await getStatus(paths);
  if (!status.configExists) {
    io.write(firstRunMessage);
    if (!options.yes && !(await io.ask('이 프로젝트에 연결할까요?', true))) {
      io.write('JuTell을 연결하지 않았습니다.');
      return { cancelled: true };
    }
    await setupCommand(paths, { ...options, yes: true, oneCommand: true, activateMcp: true }, io);
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
