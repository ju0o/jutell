import { useEffect, useMemo, useState } from 'react';
import { api, sendJson } from './lib/api';
import { FEATURE_CATALOG, LIMIT_RANGES, PROFILE_CATALOG } from './lib/catalog';
import type { Config, ConfigResponse, Feedback, FeedbackInput, McpStatus, Profile, Readiness } from './types/config';
import { Notice } from './components/Notice';
import { Overview } from './features/overview/Overview';
import { FeatureSettings } from './features/feature-settings/FeatureSettings';
import { Profiles } from './features/profiles/Profiles';
import { Limits } from './features/limits/Limits';
import { BetaJournal } from './features/beta-journal/BetaJournal';
import { Privacy } from './features/privacy/Privacy';
import { McpConnection } from './features/mcp-connection/McpConnection';

type Tab = 'overview' | 'features' | 'profiles' | 'limits' | 'journal' | 'mcp' | 'privacy';
type PreviewKind = 'feature' | 'profile' | 'limits';
const tabs: Array<{ id: Tab; label: string }> = [{ id: 'overview', label: '개요' }, { id: 'features', label: 'Features' }, { id: 'profiles', label: 'Profiles' }, { id: 'limits', label: 'Limits' }, { id: 'journal', label: 'Beta Journal' }, { id: 'mcp', label: 'MCP 연결' }, { id: 'privacy', label: 'Privacy' }];
const startPrompt = `이 프로젝트의 AGENTS.md,
.agents/skills/beginner-bridge/SKILL.md,
.jutell.json을 먼저 읽고 작업해주세요.

작업 완료 후 현재 활성화된 JuTell 기능만 사용해 보고해주세요.
설정으로 꺼진 항목은 생략하되,
실패, 중요한 미확인 사항, 범위 밖 변경과 안전 문제는 숨기지 마세요.`;

function cloneConfig(config: Config): Config { return { version: 1, profile: config.profile, features: { ...config.features }, limits: { ...config.limits }, mcp: { enabled: config.mcp?.enabled ?? false, autoStart: config.mcp?.autoStart ?? false }, ...(config.voice ? { voice: { ...config.voice } } : {}) }; }
function featureLabel(id: string) { return FEATURE_CATALOG.find((item) => item.id === id)?.label ?? id; }
function profileLabel(profile: Profile) { return PROFILE_CATALOG[profile].label; }

export default function App() {
  const [tab, setTab] = useState<Tab>('overview');
  const [data, setData] = useState<ConfigResponse>();
  const [readiness, setReadiness] = useState<Readiness>();
  const [mcpStatus, setMcpStatus] = useState<McpStatus>();
  const [draft, setDraft] = useState<Config>();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [previewKind, setPreviewKind] = useState<PreviewKind>('limits');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(() => localStorage.getItem('bb-admin-guide-dismissed') !== 'true');
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'error' }>();
  const loadMcpStatus = async () => { setMcpStatus(await api<McpStatus>('/api/mcp/status')); };
  const load = async () => { setBusy(true); try { const [config, readinessData, feedbackData, mcpData] = await Promise.all([api<ConfigResponse>('/api/config'), api<Readiness>('/api/readiness'), api<{ feedback: Feedback[] }>('/api/feedback'), api<McpStatus>('/api/mcp/status')]); setData(config); setReadiness(readinessData); setDraft(cloneConfig(config.config)); setFeedback(feedbackData.feedback); setMcpStatus(mcpData); } catch (caught) { setMessage({ text: caught instanceof Error ? caught.message : '로컬 데이터를 읽지 못했습니다.', tone: 'error' }); } finally { setBusy(false); } };
  useEffect(() => { void load(); }, []);
  const dirty = Boolean(data && draft && JSON.stringify(data.config) !== JSON.stringify(draft));
  const limitErrors = useMemo(() => { const errors: Partial<Record<keyof Config['limits'], string>> = {}; if (!draft) return errors; for (const [key, range] of Object.entries(LIMIT_RANGES)) { const value = draft.limits[key as keyof Config['limits']]; if (!Number.isInteger(value) || value < range.min || value > range.max) errors[key as keyof Config['limits']] = `${range.min}~${range.max} 사이여야 합니다.`; } return errors; }, [draft]);
  const updateDraft = (next: Config, kind: PreviewKind) => { setDraft(next); setPreviewKind(kind); setMessage(undefined); };
  const requestSave = () => { if (Object.keys(limitErrors).length > 0) { setMessage({ text: 'limits 값을 허용 범위 안으로 입력하세요.', tone: 'error' }); return; } setPreviewOpen(true); };
  const save = async () => { if (!draft) return; setPreviewOpen(false); setBusy(true); try { const result = await api<ConfigResponse & { changed: boolean }>('/api/config', sendJson('PUT', draft)); setData(result); setDraft(cloneConfig(result.config)); setMessage({ text: result.changed ? '설정을 저장했습니다.' : '변경된 설정이 없습니다.', tone: 'success' }); } catch (caught) { setMessage({ text: caught instanceof Error ? caught.message : '설정을 저장하지 못했습니다.', tone: 'error' }); } finally { setBusy(false); } };
  const updateMcpSetting = async (enabled: boolean) => { if (!data) return; setBusy(true); try { const result = await api<ConfigResponse & { changed: boolean }>('/api/config', sendJson('PUT', { ...data.config, mcp: { ...data.config.mcp, enabled } })); if (!enabled) await api('/api/mcp/stop', sendJson('POST', {})); setData(result); setDraft(cloneConfig(result.config)); await loadMcpStatus(); setMessage({ text: enabled ? 'MCP 사용을 켰습니다. 서버 시작과 연결 설정은 별도로 확인하세요.' : 'MCP 사용을 껐고 실행 중인 MCP 서버를 중지했습니다. Skill 방식은 계속 사용할 수 있습니다.', tone: 'success' }); } catch (caught) { setMessage({ text: caught instanceof Error ? caught.message : 'MCP 설정을 바꾸지 못했습니다.', tone: 'error' }); } finally { setBusy(false); } };
  const mcpAction = async (action: 'preview' | 'register' | 'remove' | 'start' | 'stop' | 'check') => { const route = { preview: '/api/mcp/preview', register: '/api/mcp/register', remove: '/api/mcp/remove', start: '/api/mcp/start', stop: '/api/mcp/stop', check: '/api/mcp/check' }[action]; const result = await api<Record<string, unknown>>(route, sendJson('POST', action === 'register' || action === 'remove' ? { confirm: true } : {})); await loadMcpStatus(); setMessage({ text: action === 'check' ? '실제 연결은 Codex 세션에서 직접 확인해야 합니다.' : action === 'register' ? 'Codex 연결 설정을 등록했습니다. 새 세션 또는 재시작이 필요할 수 있습니다.' : action === 'remove' ? 'JuTell 연결 설정을 제거했습니다. Skill 방식은 유지됩니다.' : action === 'start' ? 'MCP 서버 상태를 확인했습니다.' : action === 'stop' ? 'MCP 서버를 중지했습니다.' : '연결 설정 미리보기를 준비했습니다.', tone: 'success' }); return result; };
  const selectProfile = (profile: Profile) => { const preset = PROFILE_CATALOG[profile]; updateDraft({ version: 1, profile, features: { ...preset.features }, limits: { ...preset.limits }, mcp: { ...draft!.mcp }, ...(draft?.voice ? { voice: { ...draft.voice } } : {}) }, 'profile'); };
  const reset = async () => { if (!window.confirm('Profile, Feature, limits를 balanced 기본값으로 복원할까요?')) return; setBusy(true); try { const result = await api<ConfigResponse & { config: Config }>('/api/config/reset', sendJson('POST', { confirm: true })); setData(result); setDraft(cloneConfig(result.config)); setMessage({ text: 'balanced 기본값으로 복원했습니다.', tone: 'success' }); } catch (caught) { setMessage({ text: caught instanceof Error ? caught.message : '기본값 복원에 실패했습니다.', tone: 'error' }); } finally { setBusy(false); } };
  const saveFeedback = async (input: FeedbackInput, id?: string) => { const result = await api<{ feedback: Feedback }>(id ? `/api/feedback/${id}` : '/api/feedback', sendJson(id ? 'PUT' : 'POST', input)); setFeedback((current) => id ? current.map((item) => item.id === id ? result.feedback : item) : [...current, result.feedback]); setMessage({ text: id ? '피드백을 수정했습니다.' : '피드백을 저장했습니다.', tone: 'success' }); };
  const deleteFeedback = async (id: string) => { await api('/api/feedback/' + id, { method: 'DELETE' }); setFeedback((current) => current.filter((item) => item.id !== id)); setMessage({ text: '피드백을 삭제했습니다.', tone: 'success' }); };
  const deleteHistory = async () => { if (!window.confirm('설정 변경 기록을 모두 삭제할까요?')) return; await api('/api/config/history', sendJson('DELETE', { confirm: true })); setMessage({ text: '설정 기록을 삭제했습니다.', tone: 'success' }); };
  const deleteAllFeedback = async () => { if (!window.confirm('모든 개인 베타 피드백을 삭제할까요?')) return; await api('/api/feedback', sendJson('DELETE', { confirm: true })); setFeedback([]); setMessage({ text: '피드백을 모두 삭제했습니다.', tone: 'success' }); };
  const copyPrompt = async () => { try { await navigator.clipboard.writeText(startPrompt); setMessage({ text: '시작 프롬프트를 복사했습니다.', tone: 'success' }); } catch { setMessage({ text: '자동 복사는 지원되지 않습니다. 화면의 프롬프트를 직접 복사하세요.', tone: 'error' }); } };
  const dismissGuide = () => { localStorage.setItem('bb-admin-guide-dismissed', 'true'); setShowGuide(false); };
  if (busy && !data) return <div className="loading">로컬 설정을 읽는 중입니다…</div>;
  if (!data || !draft || !readiness || !mcpStatus) return <div className="loading"><Notice tone="error">로컬 설정을 읽지 못했습니다. 서버가 실행 중인지 확인하세요.</Notice></div>;
  const page = tab === 'overview' ? <Overview data={data} readiness={readiness} showGuide={showGuide} onDismissGuide={dismissGuide} onShowGuide={() => setShowGuide(true)} onCopyPrompt={() => void copyPrompt()} /> : tab === 'features' ? <FeatureSettings config={draft} onChange={(id, value) => updateDraft({ ...draft, features: { ...draft.features, [id]: value } }, 'feature')} /> : tab === 'profiles' ? <Profiles config={draft} onChange={selectProfile} /> : tab === 'limits' ? <Limits limits={draft.limits} errors={limitErrors} onChange={(key, value) => updateDraft({ ...draft, limits: { ...draft.limits, [key]: value } }, 'limits')} /> : tab === 'journal' ? <BetaJournal config={data.config} feedback={feedback} onSave={saveFeedback} onDelete={deleteFeedback} /> : tab === 'mcp' ? <McpConnection config={draft} status={mcpStatus} onToggle={updateMcpSetting} onAction={mcpAction} /> : <Privacy onDeleteHistory={() => void deleteHistory()} onDeleteFeedback={() => void deleteAllFeedback()} />;
  const changedOn = Object.keys(draft.features).filter((id) => draft.features[id as keyof Config['features']] && !data.config.features[id as keyof Config['features']]).map(featureLabel);
  const changedOff = Object.keys(draft.features).filter((id) => !draft.features[id as keyof Config['features']] && data.config.features[id as keyof Config['features']]).map(featureLabel);
  const changedLimits = Object.keys(draft.limits).filter((key) => draft.limits[key as keyof Config['limits']] !== data.config.limits[key as keyof Config['limits']]).map((key) => `${key}: ${data.config.limits[key as keyof Config['limits']]} → ${draft.limits[key as keyof Config['limits']]}`);
  return <div className="app-shell"><header className="app-header"><div><p className="eyebrow">JUTELL BY JU0</p><h1>개인 베타 관리자</h1><p>AI가 한 일을 이해하고, 검증하고, 다음 작업까지 이어가도록 돕습니다.</p><p className="muted">설정과 피드백은 이 컴퓨터에만 관리합니다.</p></div><div className="header-badge">LOCAL ONLY</div></header><nav className="tab-nav" aria-label="관리자 메뉴">{tabs.map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav><main>{message && <Notice tone={message.tone}>{message.text}</Notice>}{page}</main>{dirty && <div className="save-bar"><span>저장되지 않은 변경이 있습니다.</span><div className="button-row"><button className="secondary" onClick={() => setDraft(cloneConfig(data.config))}>변경 취소</button><button className="primary" onClick={requestSave}>저장 전에 확인</button></div></div>}{previewOpen && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="preview-title"><h2 id="preview-title">{previewKind === 'feature' ? '개별 기능 변경 미리보기' : previewKind === 'profile' ? '추천 설정 적용 미리보기' : '설정 변경 미리보기'}</h2>{previewKind === 'profile' && <div className="preview-context"><strong>{profileLabel(draft.profile)}</strong><span>{PROFILE_CATALOG[draft.profile].description}</span><small>Profile은 추천 설정 묶음이며 저장 후에도 개별 수정할 수 있습니다.</small></div>}<div className="preview-grid">{previewKind === 'feature' && <><strong>직접 켠 기능</strong><span>{changedOn.join(', ') || '없음'}</span><strong>직접 끈 기능</strong><span>{changedOff.join(', ') || '없음'}</span><strong>변화 없는 기능</strong><span>{FEATURE_CATALOG.filter((feature) => !changedOn.includes(feature.label) && !changedOff.includes(feature.label)).map((feature) => feature.label).join(', ')}</span></>}{previewKind === 'profile' && <><strong>선택한 Profile</strong><span>{profileLabel(draft.profile)}</span><strong>새로 켜지는 기능</strong><span>{changedOn.join(', ') || '없음'}</span><strong>새로 꺼지는 기능</strong><span>{changedOff.join(', ') || '없음'}</span></>}{previewKind === 'limits' && <><strong>바뀌는 보고 길이</strong><span>{changedLimits.join(', ') || '없음'}</span></>}{previewKind !== 'feature' && previewKind !== 'profile' && <><strong>변경 전 Profile</strong><span>{profileLabel(data.config.profile)}</span><strong>변경 후 Profile</strong><span>{profileLabel(draft.profile)}</span></>}<strong>안전상 계속 보고</strong><span>작업 실패, 핵심 검증 실패, 중요 미확인, 보안·데이터 손실 위험은 계속 표시됩니다.</span></div><div className="button-row modal-actions"><button className="secondary" onClick={() => setPreviewOpen(false)}>취소</button><button className="primary" onClick={() => void save()}>이 설정 저장</button></div></div></div>}</div>;
}
