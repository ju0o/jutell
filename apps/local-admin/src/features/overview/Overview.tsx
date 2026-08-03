import type { ConfigResponse, McpStatus, Readiness } from '../../types/config';
import { PageHeader } from '../../components/PageHeader';
import { Notice } from '../../components/Notice';
import { PROFILE_CATALOG, FEATURE_CATALOG } from '../../lib/catalog';
import { AGENT_PROVIDER_CATALOG } from '../../lib/providers';

const prompt = `이 프로젝트의 AGENTS.md,
.agents/skills/beginner-bridge/SKILL.md,
.jutell.json을 먼저 읽고 작업해주세요.

작업 완료 후 현재 활성화된 JuTell 기능만 사용해 보고해주세요.
설정으로 꺼진 항목은 생략하되,
실패, 중요한 미확인 사항, 범위 밖 변경과 안전 문제는 숨기지 마세요.`;

function displaySkillVersion(value?: string) {
  return !value || value === 'not-recorded' ? '개발 버전' : value;
}

function Check({ ok, hint, children }: { ok: boolean; hint?: string; children: React.ReactNode }) {
  return <li className={ok ? 'check-ok' : 'check-missing'} title={hint}><span aria-hidden="true">{ok ? '✓' : '!'}</span>{children}</li>;
}

export function Overview({ data, readiness, mcpStatus, showGuide, onDismissGuide, onShowGuide, onCopyPrompt }: { data: ConfigResponse; readiness: Readiness; mcpStatus: McpStatus; showGuide: boolean; onDismissGuide: () => void; onShowGuide: () => void; onCopyPrompt: () => void }) {
  const active = Object.values(data.config.features).filter(Boolean).length;
  const ready = readiness.config.exists && readiness.config.valid && readiness.skill.exists && readiness.agents.exists && readiness.safetyRules.exists;
  const preparationLabel = { not_registered: '설정 미등록', registered: '등록됨', enabled: '활성화됨', error: '오류' }[mcpStatus.preparation];
  const activeProviders = mcpStatus.providers.filter((provider) => provider.enabled && provider.status !== 'planned').map((provider) => provider.label).join(', ') || '없음';
  const plannedProviders = AGENT_PROVIDER_CATALOG.filter((provider) => provider.status === 'planned').map((provider) => provider.label).join(', ');
  return <section>
    <PageHeader eyebrow="개요" title="현재 설정을 한눈에 보기" description="이 화면은 현재 로컬 설정과 저장 상태만 보여줍니다." />
    <div className="overview-actions"><button className="secondary" onClick={onShowGuide}>처음 사용 안내 다시 보기</button></div>
    {showGuide && <div className="first-use-guide panel"><div><p className="eyebrow">처음 사용 안내</p><h3>3단계로 시작하세요</h3></div><ol><li><strong>원하는 Profile 선택</strong><span>보고서의 기본 스타일을 고릅니다.</span></li><li><strong>필요 없는 Feature 끄기</strong><span>끄기 전 무엇이 줄어드는지 확인합니다.</span></li><li><strong>저장 후 시작 프롬프트 전달</strong><span>사용 중인 AI Agent가 이 설정을 읽도록 안내합니다.</span></li></ol><button className="text-button" onClick={onDismissGuide}>안내 닫기</button></div>}
    {data.warning && <Notice tone="error">{data.warning} 안전한 기본 설정을 사용 중입니다.</Notice>}
    <div className="stat-grid">
      <div className="stat-card"><span>현재 Profile</span><strong>{PROFILE_CATALOG[data.config.profile].label}</strong><small>{PROFILE_CATALOG[data.config.profile].description}</small></div>
      <div className="stat-card"><span>활성 Feature</span><strong>{active}개</strong><small>보고서에 들어가는 항목 수입니다.</small></div>
      <div className="stat-card"><span>비활성 Feature</span><strong>{FEATURE_CATALOG.length - active}개</strong><small>꺼도 안전 항목은 계속 표시됩니다.</small></div>
      <div className="stat-card"><span>설정 저장 방식</span><strong>이 컴퓨터에만</strong><small>중앙 서버로 보내지 않습니다.</small></div>
    </div>
    <div className="panel overview-details">
      <div><span>주요 파일 수</span><strong>{data.config.limits.maxMainFiles}개</strong></div>
      <div><span>용어 설명 수</span><strong>{data.config.limits.maxGlossaryTerms}개</strong></div>
      <div><span>짧은 보고서 문장 수</span><strong>{data.config.limits.compactReportMaxSentences}문장</strong></div>
      <div><span>Skill 버전</span><strong>{displaySkillVersion(data.metadata.skillVersion)}</strong></div>
      <div><span>마지막 설정 변경</span><strong>{data.lastChangedAt ? new Date(data.lastChangedAt).toLocaleString('ko-KR') : '아직 없음'}</strong><small>{!data.lastChangedAt && '아직 관리자 화면에서 저장한 설정이 없습니다.'}</small></div>
      <div><span>저장 위치</span><strong><code>.jutell.json</code></strong></div>
    </div>
    <div className="panel readiness-panel"><div className="section-heading"><div><p className="eyebrow">AI Agent 적용 상태</p><h3>{ready ? '이 저장소에서는 JuTell 적용 준비가 되어 있습니다.' : '적용에 필요한 파일을 확인하세요.'}</h3></div><span className={`status-pill ${ready ? 'success' : 'warning'}`}>{ready ? '준비됨' : '추가 확인 필요'}</span></div><p className="muted">Provider 설정 등록과 실제 도구 호출은 서로 다른 상태입니다. 실제 호출을 확인하지 않았다고 설치 실패로 판단하지 않습니다.</p><div className="provider-summary"><strong>현재 연결 Provider: {activeProviders}</strong><span>연결은 설정·Skill·MCP·지침을 연결하는 것이며 Agent를 대신 실행하지 않습니다. 다른 Agent도 같은 구조로 연결할 수 있도록 화면을 분리해 두었습니다.</span><small>확장 준비: {plannedProviders || '없음'}</small></div><ul className="check-list"><Check ok={readiness.config.exists && readiness.config.valid}>설정 파일: {readiness.config.exists && readiness.config.valid ? '정상' : '확인 필요'} · 활성 Feature {readiness.config.activeFeatures}개</Check><Check ok={readiness.skill.exists} hint="AI Agent가 보고 규칙을 읽는 파일입니다.">Skill: {readiness.skill.exists ? '발견' : '확인 필요'}</Check><Check ok={readiness.agents.exists && readiness.agents.jutellBlock} hint="AI Agent가 가장 먼저 읽는 프로젝트 지침 파일입니다.">AGENTS.md JuTell 블록: {readiness.agents.jutellBlock ? '확인됨' : '확인 필요'}</Check><Check ok={readiness.safetyRules.exists} hint="실패와 보안 위험은 반드시 보고하도록 하는 규칙입니다.">안전 강제 보고 규칙: {readiness.safetyRules.exists ? '발견' : '확인 필요'}</Check><Check ok={mcpStatus.preparation === 'enabled'} hint="AI Agent가 로컬 설정을 읽는 선택형 연결 방식입니다.">AI Agent 연결 준비: {preparationLabel}</Check><li className="check-neutral" title="JuTell은 Agent를 대신 실행하지 않습니다. 실제 호출은 사용 중인 Agent에서 직접 확인해야 합니다."><span aria-hidden="true">i</span>실제 도구 호출: 확인하지 않음</li></ul><p className="callout">{mcpStatus.preparation === 'enabled' ? '새 AI Agent 세션부터 사용할 수 있습니다. 실제 도구 호출 여부는 해당 Agent에서 확인할 수 있습니다.' : 'MCP를 사용하지 않아도 Skill 방식은 계속 사용할 수 있습니다.'}</p><div className="prompt-box"><div className="section-heading"><strong>복사해서 시작하기</strong><button className="secondary small" onClick={onCopyPrompt}>시작 프롬프트 복사</button></div><p className="muted">사용 중인 AI Agent(예: Codex)의 새 작업에 이 문구를 붙여넣으면 이 프로젝트 설정을 먼저 읽고 보고합니다.</p><pre>{prompt}</pre></div></div>
    <Notice>외부 전송 없음 · 중앙 서버 없음 · 이 화면은 현재 컴퓨터에서만 동작합니다.</Notice>
  </section>;
}
