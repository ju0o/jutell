import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { Notice } from '../../components/Notice';
import { api, sendJson } from '../../lib/api';
import type { Config, Profile } from '../../types/config';

type ToolCounter = { calls: number; responseCharacters: number; lastCalledAt: string | null };
type TemplateCopyCounter = { count: number; byTaskType: Record<string, number>; byProfile: Record<string, number>; lastCopiedAt: string | null };
type UsageCounters = { schemaVersion: 1; enabled: boolean; updatedAt: string | null; totalToolCalls: number; tools: Record<string, ToolCounter>; templateCopies?: Record<string, TemplateCopyCounter> };
type CountersState = { exists: boolean; corrupt: boolean; counters: UsageCounters | null };
type Experiment = {
  id: string;
  title: string;
  status: 'in_progress' | 'completed';
  profile: Profile;
  features: string[];
  environment: { provider: 'codex' | 'opencode' | 'other'; mcpEnabled: boolean; skillEnabled: boolean };
  measurement?: { toolCalls: number; responseCharacters: number; estimatedTokens: number; durationMs: number };
  evaluation?: { understanding: number; readability: number; accuracy: number; overall: number };
  issues: string[];
  decision: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};
type ExperimentSummary = { total: number; completed: number; inProgress: number; averageUnderstanding: number | null; averageReadability: number | null; averageAccuracy: number | null; averageResponseCharacters: number | null; averageToolCalls: number | null; mostUsedProfile: string | null; mostDisabledFeatures: string[]; topIssues: Array<{ text: string; count: number }> };
type UsageData = { summary: ExperimentSummary | null; experiments: Experiment[] };

const profileLabels: Record<Profile, string> = { minimal: '최소 보고', balanced: '균형 보고', learning: '학습 보고', detailed: '상세 보고' };
const featureLabels: Record<string, string> = { changeSummary: '변경 요약', userVisibleChanges: '사용자에게 보이는 변화', internalChanges: '내부 변경', mainFiles: '주요 파일', explainedDiff: '설명형 변경 요약', glossary: '개발 용어 설명', validationResults: '검증 결과', riskAssessment: '위험 평가', userActions: '사용자 작업', nextActionSuggestions: '다음 행동 제안', requestClarificationGuide: '요청 명확화 안내', manualEditGuidance: '직접 수정 안내', requestBuilder: '요청 만들기' };

export function UsageExperiments({ config, onMessage, onConfigSaved }: { config: Config; onMessage: (text: string, tone: 'success' | 'error') => void; onConfigSaved: (config: Config) => void }) {
  const [counters, setCounters] = useState<CountersState>({ exists: false, corrupt: false, counters: null });
  const [usage, setUsage] = useState<UsageData>({ summary: null, experiments: [] });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<Record<string, string>>({});

  const loadCounters = useCallback(async () => { try { setCounters(await api<CountersState>('/api/usage-counters')); } catch { setCounters({ exists: false, corrupt: false, counters: null }); } }, []);
  const loadExperiments = useCallback(async () => { try { setUsage(await api<UsageData>('/api/usage-experiments')); } catch { setUsage({ summary: null, experiments: [] }); } }, []);
  useEffect(() => { void loadCounters(); void loadExperiments(); }, [loadCounters, loadExperiments]);

  const toggleCounters = async (enabled: boolean) => {
    try {
      const result = await api<{ config: Config }>('/api/usage-settings', sendJson('PATCH', { localCountersEnabled: enabled }));
      onConfigSaved(result.config);
      onMessage(enabled ? '로컬 사용량 카운터를 켰습니다. AI Agent 도구 호출 횟수만 이 컴퓨터에 기록됩니다.' : '로컬 사용량 카운터를 껐습니다. 새 기록이 중단됩니다.', 'success');
    } catch (caught) { onMessage(caught instanceof Error ? caught.message : '설정을 바꾸지 못했습니다.', 'error'); }
  };

  const deleteCounters = async () => {
    if (!window.confirm('로컬 사용량 카운터(도구 호출·템플릿 복사 횟수)를 모두 삭제할까요?')) return;
    try { await api('/api/usage-counters', sendJson('DELETE', { confirm: true })); await loadCounters(); onMessage('로컬 사용량 카운터를 삭제했습니다.', 'success'); } catch (caught) { onMessage(caught instanceof Error ? caught.message : '삭제하지 못했습니다.', 'error'); }
  };

  const createExperiment = async () => {
    try {
      const activeFeatures = Object.keys(config.features).filter((id) => config.features[id as keyof Config['features']]);
      const payload = {
        title: createForm.title?.trim() || '제목 없는 실험',
        status: createForm.status === 'completed' ? 'completed' : 'in_progress',
        profile: createForm.profile as Profile || config.profile,
        features: activeFeatures,
        environment: { provider: createForm.provider === 'opencode' ? 'opencode' : createForm.provider === 'other' ? 'other' : 'codex', mcpEnabled: config.mcp.enabled, skillEnabled: true },
        issues: [],
        decision: '',
        notes: '',
      };
      await api('/api/usage-experiments', sendJson('POST', payload));
      setCreateOpen(false);
      setCreateForm({});
      await loadExperiments();
      onMessage('실험 기록을 만들었습니다. 평가와 메모는 실험 카드에서 수정할 수 있습니다.', 'success');
    } catch (caught) { onMessage(caught instanceof Error ? caught.message : '실험 기록을 만들지 못했습니다.', 'error'); }
  };

  const openEdit = (experiment: Experiment) => {
    setEditId(experiment.id);
    setEditForm({
      understanding: String(experiment.evaluation?.understanding ?? 3),
      readability: String(experiment.evaluation?.readability ?? 3),
      accuracy: String(experiment.evaluation?.accuracy ?? 3),
      overall: String(experiment.evaluation?.overall ?? 3),
      toolCalls: String(experiment.measurement?.toolCalls ?? ''),
      responseCharacters: String(experiment.measurement?.responseCharacters ?? ''),
      decision: experiment.decision,
      notes: experiment.notes,
      issues: experiment.issues.join('\n'),
    });
  };

  const saveEdit = async (experiment: Experiment) => {
    try {
      const evaluation = { understanding: Number(editForm.understanding), readability: Number(editForm.readability), accuracy: Number(editForm.accuracy), overall: Number(editForm.overall) };
      const issues = editForm.issues.split('\n').map((item) => item.trim()).filter(Boolean);
      const payload: Record<string, unknown> = { status: experiment.status === 'completed' ? 'in_progress' : 'completed', evaluation, issues, decision: editForm.decision?.trim() ?? '', notes: editForm.notes?.trim() ?? '' };
      if (editForm.toolCalls !== '') payload.measurement = { toolCalls: Number(editForm.toolCalls) || 0, responseCharacters: Number(editForm.responseCharacters) || 0, estimatedTokens: 0, durationMs: 0 };
      await api(`/api/usage-experiments/${experiment.id}`, sendJson('PATCH', payload));
      setEditId(null);
      await loadExperiments();
      onMessage('실험 기록을 수정했습니다.', 'success');
    } catch (caught) { onMessage(caught instanceof Error ? caught.message : '실험 기록을 수정하지 못했습니다.', 'error'); }
  };

  const deleteAllExperiments = async () => {
    if (!window.confirm('실험 기록을 모두 삭제할까요? 복구할 수 없습니다.')) return;
    try { await api('/api/usage-experiments', sendJson('DELETE', { confirm: true })); setUsage({ summary: null, experiments: [] }); onMessage('실험 기록을 모두 삭제했습니다.', 'success'); } catch (caught) { onMessage(caught instanceof Error ? caught.message : '삭제하지 못했습니다.', 'error'); }
  };

  const enabled = config.usageMeasurement?.localCountersEnabled === true;
  const summary = usage.summary;

  return <section>
    <PageHeader eyebrow="사용량 측정" title="JuTell이 얼마나 쓰였는지 로컬에서만 확인하기" description="AI Agent 도구 호출 횟수와 템플릿 복사 횟수를 이 컴퓨터에만 기록합니다. 기본 꺼짐이며, Prompt·답변 원문·코드·경로·프로젝트 이름은 저장하지 않고 외부로 보내지 않습니다." />
    <div className="panel">
      <h3>기록 설정</h3>
      <div className="setting-row">
        <div><strong>로컬 사용량 카운터</strong><p className="muted">켜면 AI Agent가 JuTell 도구를 호출할 때마다 횟수와 응답 길이를 <code>.jutell-local/usage-counters.json</code>에 기록합니다. 끄면 새 기록이 생기지 않고 기존 기록은 유지됩니다.</p></div>
        <button className={enabled ? 'primary small' : 'secondary small'} onClick={() => void toggleCounters(!enabled)}>{enabled ? '끄기' : '켜기'}</button>
      </div>
      {!enabled && <Notice>기록이 꺼져 있어도 실험 기록은 직접 만들 수 있습니다. 실험은 운영자가 명시적으로 만드는 경우에만 저장됩니다.</Notice>}
    </div>
    <div className="privacy-grid">
      <article className="panel"><h3>런타임 카운터</h3>{counters.corrupt && <Notice tone="error">usage-counters.json 형식을 확인할 수 없습니다. 내용을 보존한 채 기록을 중단했습니다.</Notice>}<p className="muted">파일 없음·꺼짐 상태에서는 도구 호출이 기록되지 않습니다.</p><div className="stat-grid">{counters.counters ? <><div className="stat-card"><span>전체 도구 호출</span><strong>{counters.counters.totalToolCalls}회</strong></div><div className="stat-card"><span>마지막 기록</span><strong>{counters.counters.updatedAt ? new Date(counters.counters.updatedAt).toLocaleString() : '없음'}</strong></div></> : <div className="stat-card"><span>저장된 카운터</span><strong>{counters.exists ? '확인 필요' : '없음'}</strong></div>}</div>{counters.counters && Object.keys(counters.counters.tools).length > 0 && <table className="data-table"><thead><tr><th>도구</th><th>호출</th><th>응답 문자</th></tr></thead><tbody>{Object.entries(counters.counters.tools).map(([name, tool]) => <tr key={name}><td>{name}</td><td>{tool.calls}</td><td>{tool.responseCharacters}</td></tr>)}</tbody></table>}{counters.counters?.templateCopies && Object.keys(counters.counters.templateCopies).length > 0 && <><h4>템플릿 복사</h4><table className="data-table"><thead><tr><th>템플릿</th><th>횟수</th></tr></thead><tbody>{Object.entries(counters.counters.templateCopies).map(([name, item]) => <tr key={name}><td>{name}</td><td>{item.count}</td></tr>)}</tbody></table></>}<div className="button-row"><button className="secondary small" onClick={() => void deleteCounters()}>카운터 전체 삭제</button></div><p className="muted">삭제는 카운터 파일만 제거하며 베타 기록, 설정 기록, 실험 기록은 유지됩니다.</p></article>
      <article className="panel"><h3>실험 기록</h3><p className="muted">운영자가 직접 만든 비교 실험 결과입니다. 이해도·가독성·정확도, 도구 호출 수, 문제 메모만 저장합니다.</p>{summary && summary.total > 0 && <div className="stat-grid"><div className="stat-card"><span>전체/진행중</span><strong>{summary.total}개 / {summary.inProgress}개</strong></div><div className="stat-card"><span>평균 이해도</span><strong>{summary.averageUnderstanding ?? '-'} / 5</strong></div><div className="stat-card"><span>평균 가독성</span><strong>{summary.averageReadability ?? '-'} / 5</strong></div><div className="stat-card"><span>평균 정확도</span><strong>{summary.averageAccuracy ?? '-'} / 5</strong></div><div className="stat-card"><span>평균 응답 길이</span><strong>{summary.averageResponseCharacters ?? '-'}자</strong></div><div className="stat-card"><span>가장 많은 Profile</span><strong>{summary.mostUsedProfile ? profileLabels[summary.mostUsedProfile as Profile] ?? summary.mostUsedProfile : '-'}</strong></div></div>}{summary && summary.mostDisabledFeatures.length > 0 && <p className="muted">자주 꺼진 Feature: {summary.mostDisabledFeatures.map((id) => featureLabels[id] ?? id).join(', ')}</p>}{summary && summary.topIssues.length > 0 && <p className="muted">자주 보고된 문제: {summary.topIssues.map((item) => `${item.text}(${item.count})`).join(', ')}</p>}<div className="button-row"><button className="primary small" onClick={() => setCreateOpen(!createOpen)}>{createOpen ? '닫기' : '새 실험 기록'}</button>{summary && summary.total > 0 && <button className="secondary small" onClick={() => void deleteAllExperiments()}>전체 삭제</button>}</div>{createOpen && <div className="template-content"><h4>새 실험 기록</h4><label className="field-label">실험 이름<input className="text-input" value={createForm.title ?? ''} onChange={(event) => setCreateForm({ ...createForm, title: event.target.value })} placeholder="예: 보고서 길이 비교" /></label><label className="field-label">Profile<select className="text-input" value={createForm.profile ?? config.profile} onChange={(event) => setCreateForm({ ...createForm, profile: event.target.value })}>{Object.entries(profileLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label className="field-label">Provider<select className="text-input" value={createForm.provider ?? 'codex'} onChange={(event) => setCreateForm({ ...createForm, provider: event.target.value })}><option value="codex">Codex</option><option value="opencode">OpenCode</option><option value="other">기타</option></select></label><div className="button-row"><button className="primary small" onClick={() => void createExperiment()}>만들기</button></div><p className="muted">활성 Feature 목록은 현재 설정에서 가져옵니다. 평가와 메모는 만든 뒤 수정할 수 있습니다.</p></div>}{usage.experiments.length > 0 && <ul className="template-list">{usage.experiments.map((experiment) => <li key={experiment.id}><div className="template-row"><strong>{experiment.id} · {experiment.title}</strong><span>{experiment.status === 'completed' ? '완료' : '진행 중'} · {profileLabels[experiment.profile]} · {experiment.environment.provider}{experiment.evaluation ? ` · 이해도 ${experiment.evaluation.understanding}/5` : ''}</span></div>{editId === experiment.id ? <div className="template-content"><h4>{experiment.id} 수정</h4><div className="stat-grid"><label className="field-label">이해도<input className="text-input" type="number" min={1} max={5} value={editForm.understanding ?? ''} onChange={(event) => setEditForm({ ...editForm, understanding: event.target.value })} /></label><label className="field-label">가독성<input className="text-input" type="number" min={1} max={5} value={editForm.readability ?? ''} onChange={(event) => setEditForm({ ...editForm, readability: event.target.value })} /></label><label className="field-label">정확도<input className="text-input" type="number" min={1} max={5} value={editForm.accuracy ?? ''} onChange={(event) => setEditForm({ ...editForm, accuracy: event.target.value })} /></label><label className="field-label">종합<input className="text-input" type="number" min={1} max={5} value={editForm.overall ?? ''} onChange={(event) => setEditForm({ ...editForm, overall: event.target.value })} /></label></div><label className="field-label">도구 호출 수(선택)<input className="text-input" type="number" min={0} value={editForm.toolCalls ?? ''} onChange={(event) => setEditForm({ ...editForm, toolCalls: event.target.value })} /></label><label className="field-label">응답 문자 수(선택)<input className="text-input" type="number" min={0} value={editForm.responseCharacters ?? ''} onChange={(event) => setEditForm({ ...editForm, responseCharacters: event.target.value })} /></label><label className="field-label">발견한 문제(한 줄에 하나)<textarea className="text-input" rows={3} value={editForm.issues ?? ''} onChange={(event) => setEditForm({ ...editForm, issues: event.target.value })} /></label><label className="field-label">최종 결정<textarea className="text-input" rows={2} value={editForm.decision ?? ''} onChange={(event) => setEditForm({ ...editForm, decision: event.target.value })} /></label><label className="field-label">운영자 메모<textarea className="text-input" rows={2} value={editForm.notes ?? ''} onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} /></label><div className="button-row"><button className="primary small" onClick={() => void saveEdit(experiment)}>저장</button><button className="secondary small" onClick={() => setEditId(null)}>취소</button></div></div> : <div className="button-row"><button className="secondary small" onClick={() => openEdit(experiment)}>평가·메모 수정</button></div>}</li>)}</ul>}</article>
    </div>
  </section>;
}
