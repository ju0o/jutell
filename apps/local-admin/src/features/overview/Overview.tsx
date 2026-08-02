import type { ConfigResponse } from '../../types/config';
import { PageHeader } from '../../components/PageHeader';
import { Notice } from '../../components/Notice';

export function Overview({ data }: { data: ConfigResponse }) {
  const active = Object.values(data.config.features).filter(Boolean).length;
  return <section>
    <PageHeader eyebrow="Overview" title="현재 설정을 한눈에 보기" description="이 화면은 현재 로컬 설정과 저장 상태만 보여줍니다." />
    {data.warning && <Notice tone="error">{data.warning} 안전한 기본 설정을 사용 중입니다.</Notice>}
    <div className="stat-grid">
      <div className="stat-card"><span>현재 Profile</span><strong>{data.config.profile}</strong></div>
      <div className="stat-card"><span>활성 Feature</span><strong>{active}개</strong></div>
      <div className="stat-card"><span>비활성 Feature</span><strong>{8 - active}개</strong></div>
      <div className="stat-card"><span>설정 버전</span><strong>{data.config.version}</strong></div>
    </div>
    <div className="panel overview-details">
      <div><span>주요 파일 수</span><strong>{data.config.limits.maxMainFiles}개</strong></div>
      <div><span>용어 설명 수</span><strong>{data.config.limits.maxGlossaryTerms}개</strong></div>
      <div><span>짧은 보고서 문장 수</span><strong>{data.config.limits.compactReportMaxSentences}문장</strong></div>
      <div><span>Skill 버전</span><strong>{data.metadata.skillVersion ?? '기록되지 않음'}</strong></div>
      <div><span>마지막 설정 변경</span><strong>{data.lastChangedAt ? new Date(data.lastChangedAt).toLocaleString('ko-KR') : '아직 없음'}</strong></div>
      <div><span>저장 위치</span><strong><code>.beginner-bridge.json</code></strong></div>
    </div>
    <Notice>외부 전송 없음 · 중앙 서버 없음 · 이 화면은 현재 컴퓨터에서만 동작합니다.</Notice>
  </section>;
}
