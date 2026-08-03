import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

const config = { version: 1 as const, profile: 'balanced' as const, features: { changeSummary: true, userVisibleChanges: true, internalChanges: true, mainFiles: true, glossary: true, validationResults: true, riskAssessment: true, userActions: true }, limits: { maxMainFiles: 5, maxGlossaryTerms: 3, compactReportMaxSentences: 12 }, mcp: { enabled: false, autoStart: false } };
const feedback = { feedback: [] };
const history = { history: [] };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/config')) return new Response(JSON.stringify({ config, fallback: false, metadata: { configVersion: 1, skillVersion: 'not-recorded' }, lastChangedAt: null }), { status: 200 });
    if (url.endsWith('/api/readiness')) return new Response(JSON.stringify({ config: { exists: true, valid: true, profile: 'balanced', activeFeatures: 8 }, skill: { exists: true }, agents: { exists: true, jutellBlock: true }, safetyRules: { exists: true }, sessionApplied: 'manual_check_required' }), { status: 200 });
    if (url.endsWith('/api/mcp/status')) return new Response(JSON.stringify({ settings: { enabled: false, autoStart: false }, server: { state: 'stopped' }, preparation: 'not_registered', codex: { registered: false, path: '.codex/config.toml', conflict: false, enabled: false }, providers: [
      { id: 'codex', label: 'Codex', status: 'supported', detected: true, registered: false, conflict: false, enabled: false, lastCheckedAt: null },
      { id: 'opencode', label: 'OpenCode', status: 'beta', detected: true, registered: false, conflict: false, enabled: false, lastCheckedAt: null },
      { id: 'claude-code', label: 'Claude Code', status: 'planned', detected: false, registered: false, conflict: false, enabled: false, lastCheckedAt: null },
      { id: 'cline', label: 'Cline', status: 'planned', detected: false, registered: false, conflict: false, enabled: false, lastCheckedAt: null },
    ], connection: { state: 'not_checked', lastCheckedAt: null }, skillFallback: { available: true, message: 'Skill 방식 사용 가능' } }), { status: 200 });
    if (url.endsWith('/api/feedback')) return new Response(JSON.stringify(feedback), { status: 200 });
    if (url.endsWith('/api/config/history')) return new Response(JSON.stringify(history), { status: 200 });
    if (options?.method === 'POST' && url.includes('/api/feedback')) return new Response(JSON.stringify({ feedback: { ...JSON.parse(String(options.body)), id: '12345678-1234-1234-1234-123456789012', createdAt: '', updatedAt: '' } }), { status: 201 });
    return new Response(JSON.stringify({ ...config, changed: true }), { status: 200 });
  }));
  vi.stubGlobal('confirm', vi.fn(() => true));
});

describe('local admin screens', () => {
  it('shows the current Profile and local-only state', async () => {
    render(<App />);
    expect(await screen.findByText('현재 설정을 한눈에 보기')).toBeInTheDocument();
    expect(screen.getByText('균형 보고')).toBeInTheDocument();
    expect(screen.getByText(/외부 전송 없음/)).toBeInTheDocument();
    expect(screen.getByText('개발 버전')).toBeInTheDocument();
    expect(screen.getByText(/실제 도구 호출: 확인하지 않음/)).toBeInTheDocument();
  });

  it('shows the unsaved feature change and save preview', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Features' }));
    expect(screen.getByText('프로그램 내부 변화')).toBeInTheDocument();
    expect(screen.getAllByText('보고 길이 영향: 조금 줄어듦').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getByText('저장되지 않은 변경이 있습니다.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '저장 전에 확인' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('개별 기능 변경 미리보기');
  });

  it('compares a Profile choice before save', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Profiles' }));
    expect(screen.getByText('최소 보고')).toBeInTheDocument();
    expect(screen.getByText(/처음 사용하는 사용자에게 권장/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /최소 보고/ }));
    expect(screen.getByText('저장되지 않은 변경이 있습니다.')).toBeInTheDocument();
  });

  it('shows an error outside the allowed limits', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Limits' }));
    expect(screen.getByText(/숫자를 직접 이해할 필요는 없습니다/)).toBeInTheDocument();
    expect(screen.getAllByText('추천').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('고급 설정'));
    fireEvent.change(screen.getByLabelText('주요 파일 설명 수'), { target: { value: '11' } });
    expect(screen.getByText('1~10 사이여야 합니다.')).toBeInTheDocument();
  });

  it('shows privacy deletion controls and the beta journal form', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Privacy' }));
    expect(screen.getByText('설정 기록 삭제')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Beta Journal' }));
    expect(screen.getByText('새 피드백 기록')).toBeInTheDocument();
    expect(screen.getAllByRole('option', { name: '개선 중' }).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByLabelText('익명 프로젝트 별칭')).toBeInTheDocument());
  });

  it('separates MCP server status from actual provider connection status', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'AI Agent 연결' }));
    expect(screen.getByText('중지됨')).toBeInTheDocument();
    expect(screen.getByText('확인하지 않음')).toBeInTheDocument();
    expect(screen.getByText(/Skill 방식은 항상 유지됩니다/)).toBeInTheDocument();
    expect(screen.getByText(/자동 실행은 항상 OFF/)).toBeInTheDocument();
    expect(screen.getByText(/Codex 지원 · OpenCode 베타/)).toBeInTheDocument();
  });

  it('shows provider cards with connect buttons for supported agents only', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'AI Agent 연결' }));
    await waitFor(() => expect(screen.getAllByText('연결하기').length).toBe(2));
    expect(screen.getByText(/Claude Code/)).toBeInTheDocument();
    expect(screen.getAllByText(/연결 준비 중입니다/).length).toBe(2);
    fireEvent.click(screen.getAllByText('연결하기')[0]);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/mcp/connect'), expect.any(Object)));
  });
});
