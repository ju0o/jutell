import type { Config } from '../../types/config';
import { FEATURE_CATALOG } from '../../lib/catalog';
import { PageHeader } from '../../components/PageHeader';
import { Toggle } from '../../components/Toggle';

export function FeatureSettings({ config, onChange }: { config: Config; onChange: (id: keyof Config['features'], value: boolean) => void }) {
  return <section>
    <PageHeader eyebrow="Features" title="보고서 기능 켜고 끄기" description="변경은 저장 전까지 임시로 유지됩니다. 안전상 반드시 보고해야 하는 내용은 꺼도 생략되지 않습니다." />
    <div className="feature-list">{FEATURE_CATALOG.map((feature) => <article className="feature-card" key={feature.id}>
      <div className="feature-card-top"><div><code>{feature.id}</code><h3>{feature.label}</h3></div><Toggle checked={config.features[feature.id]} onChange={(value) => onChange(feature.id, value)} label={config.features[feature.id] ? 'ON' : 'OFF'} /></div>
      <p>{feature.description}</p>
      <dl><div><dt>꺼지면 생략</dt><dd>{feature.omitted}</dd></div><div><dt>꺼져도 보고</dt><dd>{feature.forced}</dd></div></dl>
    </article>)}</div>
  </section>;
}
