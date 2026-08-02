import type { Config, FeatureId, Profile } from '../../types/config';
import { FEATURE_CATALOG, PROFILE_CATALOG } from '../../lib/catalog';
import { PageHeader } from '../../components/PageHeader';

const reportLength = (sentences: number) => sentences <= 8 ? '짧음' : sentences <= 12 ? '보통' : '자세함';
const featureLabel = (id: FeatureId) => FEATURE_CATALOG.find((item) => item.id === id)?.label ?? id;

export function Profiles({ config, onChange }: { config: Config; onChange: (profile: Profile) => void }) {
  return <section>
    <PageHeader eyebrow="Profiles" title="보고서 스타일 선택" description="Profile은 추천 설정 묶음입니다. 언제든 개별 기능을 다시 켜거나 끌 수 있습니다." />
    <div className="profile-grid">{Object.entries(PROFILE_CATALOG).map(([key, profile]) => { const name = key as Profile; const enabled = Object.entries(profile.features).filter(([, value]) => value).map(([id]) => featureLabel(id as FeatureId)); const disabled = Object.entries(profile.features).filter(([, value]) => !value).map(([id]) => featureLabel(id as FeatureId)); const changes = [...enabled.filter((label) => config.features[FEATURE_CATALOG.find((item) => item.label === label)?.id ?? 'changeSummary'] !== true), ...disabled.filter((label) => config.features[FEATURE_CATALOG.find((item) => item.label === label)?.id ?? 'changeSummary'] !== false)]; return <button className={`profile-card ${config.profile === name ? 'selected' : ''}`} key={name} onClick={() => onChange(name)}><div className="profile-card-heading"><span className="profile-name">{profile.label}</span><code>{name}</code></div><h3>{profile.description}</h3><p className="recommended-for">추천: {profile.recommendedFor}</p><div className="profile-stats"><span>보고 길이 <strong>{reportLength(profile.limits.compactReportMaxSentences)}</strong></span><span>활성 기능 <strong>{enabled.length}개</strong></span></div><details onClick={(event) => event.stopPropagation()}><summary>포함 내용 보기</summary><small>켜짐: {enabled.join(', ') || '없음'}</small><small>꺼짐: {disabled.join(', ') || '없음'}</small><small>Limits: 주요 파일 {profile.limits.maxMainFiles}개 · 용어 {profile.limits.maxGlossaryTerms}개 · 최대 {profile.limits.compactReportMaxSentences}문장</small></details><p className="profile-difference">{config.profile === name ? '현재 선택됨' : changes.length > 0 ? `현재 설정과 ${changes.length}개 항목이 달라집니다.` : '현재 설정과 같습니다.'}</p></button>; })}</div>
    <div className="callout"><strong>Profile은 안전한 템플릿 적용입니다.</strong> 선택 후 저장 전 미리보기에서 바뀌는 기능과 보고 길이를 확인하고, 저장한 뒤에도 개별 기능을 다시 수정할 수 있습니다.</div>
  </section>;
}
