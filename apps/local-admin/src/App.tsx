import { useEffect, useMemo, useState } from 'react';
import { api, sendJson } from './lib/api';
import { PROFILE_CATALOG, LIMIT_RANGES } from './lib/catalog';
import type { Config, ConfigResponse, Feedback, FeedbackInput, Profile } from './types/config';
import { Notice } from './components/Notice';
import { Overview } from './features/overview/Overview';
import { FeatureSettings } from './features/feature-settings/FeatureSettings';
import { Profiles } from './features/profiles/Profiles';
import { Limits } from './features/limits/Limits';
import { BetaJournal } from './features/beta-journal/BetaJournal';
import { Privacy } from './features/privacy/Privacy';

type Tab = 'overview' | 'features' | 'profiles' | 'limits' | 'journal' | 'privacy';
const tabs: Array<{ id: Tab; label: string }> = [{ id: 'overview', label: '개요' }, { id: 'features', label: 'Features' }, { id: 'profiles', label: 'Profiles' }, { id: 'limits', label: 'Limits' }, { id: 'journal', label: 'Beta Journal' }, { id: 'privacy', label: 'Privacy' }];

function cloneConfig(config: Config): Config { return { version: 1, profile: config.profile, features: { ...config.features }, limits: { ...config.limits } }; }

export default function App() {
  const [tab, setTab] = useState<Tab>('overview');
  const [data, setData] = useState<ConfigResponse>();
  const [draft, setDraft] = useState<Config>();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [history, setHistory] = useState<unknown[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'error' }>();
  const load = async () => { setBusy(true); try { const [config, feedbackData, historyData] = await Promise.all([api<ConfigResponse>('/api/config'), api<{ feedback: Feedback[] }>('/api/feedback'), api<{ history: unknown[] }>('/api/config/history')]); setData(config); setDraft(cloneConfig(config.config)); setFeedback(feedbackData.feedback); setHistory(historyData.history); } catch (caught) { setMessage({ text: caught instanceof Error ? caught.message : '로컬 데이터를 읽지 못했습니다.', tone: 'error' }); } finally { setBusy(false); } };
  useEffect(() => { void load(); }, []);
  const dirty = Boolean(data && draft && JSON.stringify(data.config) !== JSON.stringify(draft));
  const limitErrors = useMemo(() => { const errors: Partial<Record<keyof Config['limits'], string>> = {}; if (!draft) return errors; for (const [key, range] of Object.entries(LIMIT_RANGES)) { const value = draft.limits[key as keyof Config['limits']]; if (!Number.isInteger(value) || value < range.min || value > range.max) errors[key as keyof Config['limits']] = `${range.min}~${range.max} 사이여야 합니다.`; } return errors; }, [draft]);
  const updateDraft = (next: Config) => { setDraft(next); setMessage(undefined); };
  const requestSave = () => { if (Object.keys(limitErrors).length > 0) { setMessage({ text: 'limits 값을 허용 범위 안으로 입력하세요.', tone: 'error' }); return; } setPreviewOpen(true); };
  const save = async () => { if (!draft) return; setPreviewOpen(false); setBusy(true); try { const result = await api<ConfigResponse & { changed: boolean } & { config: Config }>('/api/config', sendJson('PUT', draft)); setData(result); setDraft(cloneConfig(result.config)); const historyData = await api<{ history: unknown[] }>('/api/config/history'); setHistory(historyData.history); setMessage({ text: result.changed ? '설정을 저장했습니다.' : '변경된 설정이 없습니다.', tone: 'success' }); } catch (caught) { setMessage({ text: caught instanceof Error ? caught.message : '설정을 저장하지 못했습니다.', tone: 'error' }); } finally { setBusy(false); } };
  const selectProfile = (profile: Profile) => { const preset = PROFILE_CATALOG[profile]; updateDraft({ version: 1, profile, features: { ...preset.features }, limits: { ...preset.limits } }); };
  const reset = async () => { if (!window.confirm('Profile, Feature, limits를 balanced 기본값으로 복원할까요?')) return; setBusy(true); try { const result = await api<ConfigResponse & { config: Config }>('/api/config/reset', sendJson('POST', { confirm: true })); setData(result); setDraft(cloneConfig(result.config)); const historyData = await api<{ history: unknown[] }>('/api/config/history'); setHistory(historyData.history); setMessage({ text: 'balanced 기본값으로 복원했습니다.', tone: 'success' }); } catch (caught) { setMessage({ text: caught instanceof Error ? caught.message : '기본값 복원에 실패했습니다.', tone: 'error' }); } finally { setBusy(false); } };
  const saveFeedback = async (input: FeedbackInput, id?: string) => { const result = await api<{ feedback: Feedback }>(id ? `/api/feedback/${id}` : '/api/feedback', sendJson(id ? 'PUT' : 'POST', input)); setFeedback((current) => id ? current.map((item) => item.id === id ? result.feedback : item) : [...current, result.feedback]); setMessage({ text: id ? '피드백을 수정했습니다.' : '피드백을 저장했습니다.', tone: 'success' }); };
  const deleteFeedback = async (id: string) => { await api('/api/feedback/' + id, { method: 'DELETE' }); setFeedback((current) => current.filter((item) => item.id !== id)); setMessage({ text: '피드백을 삭제했습니다.', tone: 'success' }); };
  const deleteHistory = async () => { if (!window.confirm('설정 변경 기록을 모두 삭제할까요?')) return; await api('/api/config/history', sendJson('DELETE', { confirm: true })); setHistory([]); setMessage({ text: '설정 기록을 삭제했습니다.', tone: 'success' }); };
  const deleteAllFeedback = async () => { if (!window.confirm('모든 개인 베타 피드백을 삭제할까요?')) return; await api('/api/feedback', sendJson('DELETE', { confirm: true })); setFeedback([]); setMessage({ text: '피드백을 모두 삭제했습니다.', tone: 'success' }); };
  if (busy && !data) return <div className="loading">로컬 설정을 읽는 중입니다…</div>;
  if (!data || !draft) return <div className="loading"><Notice tone="error">로컬 설정을 읽지 못했습니다. 서버가 실행 중인지 확인하세요.</Notice></div>;
  const page = tab === 'overview' ? <Overview data={data} /> : tab === 'features' ? <FeatureSettings config={draft} onChange={(id, value) => updateDraft({ ...draft, features: { ...draft.features, [id]: value } })} /> : tab === 'profiles' ? <Profiles config={draft} onChange={selectProfile} /> : tab === 'limits' ? <Limits limits={draft.limits} errors={limitErrors} onChange={(key, value) => updateDraft({ ...draft, limits: { ...draft.limits, [key]: value } })} /> : tab === 'journal' ? <BetaJournal config={data.config} feedback={feedback} onSave={saveFeedback} onDelete={deleteFeedback} /> : <Privacy onDeleteHistory={() => void deleteHistory()} onDeleteFeedback={() => void deleteAllFeedback()} />;
  return <div className="app-shell"><header className="app-header"><div><p className="eyebrow">CODEX BEGINNER BRIDGE</p><h1>개인 베타 관리자</h1><p>설정과 피드백을 이 컴퓨터에만 관리합니다.</p></div><div className="header-badge">LOCAL ONLY</div></header><nav className="tab-nav" aria-label="관리자 메뉴">{tabs.map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav><main>{message && <Notice tone={message.tone}>{message.text}</Notice>}{page}</main>{dirty && <div className="save-bar"><span>저장되지 않은 변경이 있습니다.</span><div className="button-row"><button className="secondary" onClick={() => setDraft(cloneConfig(data.config))}>변경 취소</button><button className="primary" onClick={requestSave}>저장 전에 확인</button></div></div>}{previewOpen && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="preview-title"><h2 id="preview-title">변경 내용 미리 보기</h2><p>아래 내용을 확인한 뒤 저장하세요.</p><div className="preview-grid"><strong>변경 전 Profile</strong><span>{data.config.profile}</span><strong>변경 후 Profile</strong><span>{draft.profile}</span><strong>켜지는 Feature</strong><span>{Object.keys(draft.features).filter((id) => draft.features[id as keyof Config['features']] && !data.config.features[id as keyof Config['features']]).join(', ') || '없음'}</span><strong>꺼지는 Feature</strong><span>{Object.keys(draft.features).filter((id) => !draft.features[id as keyof Config['features']] && data.config.features[id as keyof Config['features']]).join(', ') || '없음'}</span><strong>변경되는 limits</strong><span>{Object.keys(draft.limits).filter((key) => draft.limits[key as keyof Config['limits']] !== data.config.limits[key as keyof Config['limits']]).map((key) => `${key}: ${data.config.limits[key as keyof Config['limits']]} → ${draft.limits[key as keyof Config['limits']]}`).join(', ') || '없음'}</span><strong>안전 예외</strong><span>작업 실패, 핵심 검증 실패, 중요 미확인, 보안·데이터 손실 위험은 계속 보고됩니다.</span></div><div className="button-row modal-actions"><button className="secondary" onClick={() => setPreviewOpen(false)}>취소</button><button className="primary" onClick={() => void save()}>이 설정 저장</button></div></div></div>}</div>;
}
