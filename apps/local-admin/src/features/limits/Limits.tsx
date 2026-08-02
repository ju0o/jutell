import type { Config } from '../../types/config';
import { LIMIT_RANGES } from '../../lib/catalog';
import { PageHeader } from '../../components/PageHeader';

export function Limits({ limits, onChange, errors }: { limits: Config['limits']; onChange: (key: keyof Config['limits'], value: number) => void; errors: Partial<Record<keyof Config['limits'], string>> }) {
  return <section>
    <PageHeader eyebrow="Limits" title="보고서 길이 제한" description="선택 정보가 지나치게 길어지지 않도록 저장할 범위를 정합니다." />
    <div className="limit-list">{Object.entries(LIMIT_RANGES).map(([key, range]) => { const typedKey = key as keyof Config['limits']; return <label className="limit-row" key={key}><span><strong>{range.label}</strong><small><code>{key}</code> · 허용 {range.min}~{range.max}</small></span><input type="number" min={range.min} max={range.max} value={limits[typedKey]} onChange={(event) => onChange(typedKey, Number(event.target.value))} aria-label={range.label} />{errors[typedKey] && <em>{errors[typedKey]}</em>}</label>; })}</div>
  </section>;
}
