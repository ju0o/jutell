import type { Config } from '../../types/config';
import { FEATURE_CATALOG } from '../../lib/catalog';
import { PageHeader } from '../../components/PageHeader';
import { Toggle } from '../../components/Toggle';

export function FeatureSettings({ config, onChange }: { config: Config; onChange: (id: keyof Config['features'], value: boolean) => void }) {
  return <section>
    <PageHeader eyebrow="Features" title="보고서에 넣을 내용 고르기" description="한글 이름을 먼저 보고, 필요한 기능만 켜거나 끌 수 있습니다. 변경은 저장 전까지 임시로 유지됩니다." />
    <div className="safe-info"><strong>안전 안내</strong><span>어떤 기능을 꺼도 작업 실패, 중요한 미확인 사항, 범위 밖 변경, 데이터 손실과 보안 위험은 계속 표시됩니다.</span></div>
    <div className="feature-list">{FEATURE_CATALOG.map((feature) => <article className="feature-card" key={feature.id}>
      <div className="feature-card-top"><div><div className="feature-title-row"><h3>{feature.label}</h3><span className="meta-badge">{feature.badge}</span></div><code className="feature-id">{feature.id}</code></div><Toggle checked={config.features[feature.id]} onChange={(value) => onChange(feature.id, value)} label={config.features[feature.id] ? 'ON' : 'OFF'} /></div>
      <p>{feature.description}</p>
      <div className="feature-meta"><span>추천: {feature.recommendedFor}</span><span>보고 길이 영향: {feature.impact}</span></div>
      <details><summary>자세히 보기</summary><dl><div><dt>실제 보고 예시</dt><dd>{feature.example}</dd></div><div><dt>끄면 사라짐</dt><dd>{feature.omitted}</dd></div><div><dt>꺼도 계속 표시</dt><dd>{feature.forced}</dd></div><div><dt>추천 설정</dt><dd>{feature.recommended ? '처음에는 켜두는 것을 권장합니다.' : '필요할 때만 켜는 선택 기능입니다.'}</dd></div></dl></details>
    </article>)}</div>
  </section>;
}
