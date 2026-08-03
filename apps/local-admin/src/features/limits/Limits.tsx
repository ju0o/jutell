import { useState } from 'react';
import type { Config } from '../../types/config';
import { LIMIT_RANGES } from '../../lib/catalog';
import { PageHeader } from '../../components/PageHeader';

type LimitKey = keyof Config['limits'];
const choices: Record<LimitKey, Array<{ label: string; value: number; difference: string; recommended?: boolean }>> = {
  maxMainFiles: [{ label: '최소', value: 2, difference: '핵심 파일만 설명', }, { label: '보통', value: 5, difference: '대부분의 작업에 적당함', recommended: true }, { label: '많이', value: 8, difference: '더 많은 파일을 설명' }],
  maxGlossaryTerms: [{ label: '사용 안 함', value: 0, difference: '용어 설명 생략' }, { label: '조금', value: 1, difference: '가장 중요한 용어 1개' }, { label: '보통', value: 3, difference: '필요한 용어 몇 개', recommended: true }, { label: '많이', value: 5, difference: '더 많은 용어 설명' }],
  compactReportMaxSentences: [{ label: '매우 짧게', value: 6, difference: '핵심만 빠르게 확인' }, { label: '짧게', value: 8, difference: '단순 작업에 적합' }, { label: '보통', value: 12, difference: '처음 사용하기에 적당함', recommended: true }, { label: '자세히', value: 18, difference: '더 많은 설명 포함' }],
};
const descriptions: Record<LimitKey, string> = {
  maxMainFiles: 'AI Agent가 변경한 파일 중 중요한 파일을 몇 개까지 설명할지 정합니다.',
  maxGlossaryTerms: '어려운 개발 용어를 한 보고서에서 몇 개까지 쉽게 설명할지 정합니다.',
  compactReportMaxSentences: '작은 작업을 보고할 때 보고서가 어느 정도 길어질 수 있는지 정합니다.',
};
const labels: Record<LimitKey, string> = { maxMainFiles: '주요 파일 설명 수', maxGlossaryTerms: '용어 설명 수', compactReportMaxSentences: '짧은 보고서 길이' };

export function Limits({ limits, onChange, errors }: { limits: Config['limits']; onChange: (key: LimitKey, value: number) => void; errors: Partial<Record<LimitKey, string>> }) {
  const [advanced, setAdvanced] = useState(false);
  return <section>
    <PageHeader eyebrow="Limits" title="보고서 길이를 쉽게 선택하기" description="숫자를 직접 이해할 필요는 없습니다. 원하는 보고 스타일을 선택하면 적절한 값이 자동 적용됩니다." />
    <div className="limit-list">{(Object.keys(choices) as LimitKey[]).map((key) => <fieldset className="limit-choice" key={key}><legend>{labels[key]}</legend><p>{descriptions[key]}</p><div className="choice-grid">{choices[key].map((choice) => <label className={`choice-card ${limits[key] === choice.value ? 'selected' : ''}`} key={choice.value}><input type="radio" name={key} checked={limits[key] === choice.value} onChange={() => onChange(key, choice.value)} /><span><strong>{choice.label}</strong>{choice.recommended && <em>추천</em>}<small>{choice.value}개{key === 'compactReportMaxSentences' ? '문장' : ''} · {choice.difference}</small></span></label>)}</div>{errors[key] && <p className="field-error">{errors[key]}</p>}</fieldset>)}</div>
    <details className="advanced-settings" open={advanced} onToggle={(event) => setAdvanced((event.currentTarget as HTMLDetailsElement).open)}><summary>고급 설정</summary><p>일반 사용자는 변경하지 않아도 됩니다. 필요한 경우에만 숫자를 직접 입력하세요.</p><div className="advanced-grid">{(Object.keys(LIMIT_RANGES) as LimitKey[]).map((key) => <label key={key}>{labels[key]}<input type="number" min={LIMIT_RANGES[key].min} max={LIMIT_RANGES[key].max} value={limits[key]} onChange={(event) => onChange(key, Number(event.target.value))} aria-label={labels[key]} /><small>허용 범위 {LIMIT_RANGES[key].min}~{LIMIT_RANGES[key].max}</small></label>)}</div></details>
  </section>;
}
