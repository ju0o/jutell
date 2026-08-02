import { PageHeader } from '../../components/PageHeader';
import { Notice } from '../../components/Notice';

export function Privacy({ onDeleteHistory, onDeleteFeedback }: { onDeleteHistory: () => void; onDeleteFeedback: () => void }) {
  return <section>
    <PageHeader eyebrow="Privacy" title="로컬 기록과 개인정보" description="현재 관리자 페이지가 어디에 저장하고 무엇을 저장하지 않는지 확인하세요." />
    <Notice>현재 외부 전송 없음 · 중앙 서버 없음 · 원격 Telemetry는 구현되지 않았습니다.</Notice>
    <div className="privacy-grid">
      <article className="panel"><h3>저장되는 로컬 파일</h3><ul><li><code>.beginner-bridge.json</code> — Profile, Feature, limits</li><li><code>.beginner-bridge-local/settings-history.json</code> — 변경 시각과 변경 필드</li><li><code>.beginner-bridge-local/beta-feedback.json</code> — 사용자가 직접 작성한 피드백</li><li><code>.beginner-bridge-local/metadata.json</code> — 제한된 버전 정보</li></ul></article>
      <article className="panel"><h3>저장하지 않는 내용</h3><ul><li>Prompt와 AI 답변 원문</li><li>코드, Git diff, 경로, 프로젝트 이름</li><li>Repository URL, API Key, 비밀번호, Token, Cookie</li><li>환경변수, PC 사용자명, 원문 오류 로그</li></ul></article>
    </div>
    <div className="danger-zone panel"><h3>로컬 기록 삭제</h3><p>삭제는 되돌릴 수 없습니다. 설정 파일 자체는 삭제하지 않습니다.</p><div className="button-row"><button className="danger" onClick={onDeleteHistory}>설정 기록 삭제</button><button className="danger" onClick={onDeleteFeedback}>피드백 전체 삭제</button></div></div>
  </section>;
}
