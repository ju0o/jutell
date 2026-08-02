import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

const config = { version: 1 as const, profile: 'balanced' as const, features: { changeSummary: true, userVisibleChanges: true, internalChanges: true, mainFiles: true, glossary: true, validationResults: true, riskAssessment: true, userActions: true }, limits: { maxMainFiles: 5, maxGlossaryTerms: 3, compactReportMaxSentences: 12 } };
const feedback = { feedback: [] };
const history = { history: [] };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/config')) return new Response(JSON.stringify({ config, fallback: false, metadata: { configVersion: 1, skillVersion: 'not-recorded' }, lastChangedAt: null }), { status: 200 });
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
    expect(screen.getByText('balanced')).toBeInTheDocument();
    expect(screen.getByText(/외부 전송 없음/)).toBeInTheDocument();
  });

  it('shows the unsaved feature change and save preview', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Features' }));
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getByText('저장되지 않은 변경이 있습니다.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '저장 전에 확인' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('변경 내용 미리 보기');
  });

  it('compares a Profile choice before save', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Profiles' }));
    fireEvent.click(screen.getByRole('button', { name: /가장 짧은 보고서/ }));
    expect(screen.getByText('저장되지 않은 변경이 있습니다.')).toBeInTheDocument();
  });

  it('shows an error outside the allowed limits', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Limits' }));
    fireEvent.change(screen.getByLabelText('주요 파일 최대 개수'), { target: { value: '11' } });
    expect(screen.getByText('1~10 사이여야 합니다.')).toBeInTheDocument();
  });

  it('shows privacy deletion controls and the beta journal form', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Privacy' }));
    expect(screen.getByText('설정 기록 삭제')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Beta Journal' }));
    expect(screen.getByText('새 피드백 기록')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('익명 프로젝트 별칭')).toBeInTheDocument());
  });
});
