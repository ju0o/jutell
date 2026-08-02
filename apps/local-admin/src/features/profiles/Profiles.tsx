import type { Config, Profile } from '../../types/config';
import { PROFILE_CATALOG } from '../../lib/catalog';
import { PageHeader } from '../../components/PageHeader';

export function Profiles({ config, onChange }: { config: Config; onChange: (profile: Profile) => void }) {
  return <section>
    <PageHeader eyebrow="Profiles" title="보고서 스타일 선택" description="Profile을 고르면 저장 전 미리보기에서 Feature와 limits가 어떻게 바뀌는지 확인할 수 있습니다." />
    <div className="profile-grid">{Object.entries(PROFILE_CATALOG).map(([key, profile]) => { const name = key as Profile; return <button className={`profile-card ${config.profile === name ? 'selected' : ''}`} key={name} onClick={() => onChange(name)}><span className="profile-name">{profile.label}</span><h3>{profile.description}</h3><p>주요 파일 {profile.limits.maxMainFiles}개 · 용어 {profile.limits.maxGlossaryTerms}개 · 짧은 보고서 {profile.limits.compactReportMaxSentences}문장</p><small>활성 Feature {Object.values(profile.features).filter(Boolean).length}개</small></button>; })}</div>
    <div className="callout">현재 설정: <strong>{config.profile}</strong> · 명시적으로 저장한 Feature와 limits가 Profile보다 우선한다는 규칙은 유지됩니다.</div>
  </section>;
}
