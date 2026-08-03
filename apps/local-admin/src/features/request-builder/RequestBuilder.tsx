import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { Notice } from '../../components/Notice';
import { api, sendJson } from '../../lib/api';
import type { Config } from '../../types/config';

type TemplateItem = { name: string; description: string; content: string };

export function RequestBuilder({ config, onMessage }: { config: Config; onMessage: (text: string, tone: 'success' | 'error') => void }) {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [source, setSource] = useState<'project' | 'assets' | 'unavailable'>('unavailable');
  const [open, setOpen] = useState<string | null>(null);
  const enabled = config.features.requestBuilder === true;

  useEffect(() => {
    void (async () => {
      try {
        const result = await api<{ templates: TemplateItem[]; source: 'project' | 'assets' | 'unavailable' }>('/api/request-templates');
        setTemplates(result.templates);
        setSource(result.source);
      } catch { setSource('unavailable'); }
    })();
  }, []);

  const copyTemplate = async (name: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      onMessage(`${name} 템플릿을 복사했습니다. 사용 중인 AI Agent에 붙여넣으세요.`, 'success');
      const taskType = (name.replace('.md', '').split('_')[0] ?? 'etc').toLowerCase();
      await api('/api/usage-experiments/template-copy', sendJson('POST', { template: name, taskType })).catch(() => undefined);
    } catch {
      onMessage('자동 복사는 지원되지 않습니다. 템플릿 내용을 직접 복사하세요.', 'error');
    }
  };

  return <section>
    <PageHeader eyebrow="요청 만들기" title="막연한 요구를 AI Agent 요청문으로 바꾸기" description="빈칸을 채우고 최종 요청문을 복사해 사용 중인 AI Agent에 붙여넣으면 됩니다. 자동 전송이나 수집은 없습니다." />
    {!enabled && <Notice>요청 만들기 기능이 꺼져 있습니다. '보고서 내용' 탭에서 요청 만들기를 켜면 템플릿을 사용할 수 있습니다.</Notice>}
    {enabled && source === 'unavailable' && <Notice tone="error">템플릿 폴더를 찾지 못했습니다. 템플릿이 프로젝트의 <code>templates/request-builder/</code>에 있는지 확인하세요.</Notice>}
    <div className="privacy-grid">
      <article className="panel"><h3>템플릿 선택</h3><p className="muted">하고 싶은 일과 가장 가까운 템플릿을 고르세요. 모르는 항목은 비워 두면 됩니다.</p><ul className="template-list">{(enabled ? templates : []).map((item) => <li key={item.name}><button className="template-row" onClick={() => setOpen(open === item.name ? null : item.name)}><strong>{item.name.replace('.md', '')}</strong><span>{item.description}</span></button>{open === item.name && <div className="template-content"><pre>{item.content}</pre><div className="button-row"><button className="primary small" onClick={() => void copyTemplate(item.name, item.content)}>복사하기</button><button className="secondary small" onClick={() => setOpen(null)}>닫기</button></div></div>}</li>)}</ul></article>
      <article className="panel"><h3>사용 방법</h3><ol className="template-steps"><li><strong>템플릿 고르기</strong><span>하고 싶은 일에 가장 가까운 템플릿을 선택합니다.</span></li><li><strong>빈칸 채우기</strong><span>선택지에 체크하고 쉬운 말로 적습니다. 모르는 항목은 비워 둡니다.</span></li><li><strong>최종 요청문 복사</strong><span>맨 아래의 요청문을 복사해 사용 중인 AI Agent에 붙여넣습니다.</span></li></ol><p className="muted">공통 선택지: 잘 모르겠음 · 정확히 무엇이 문제인지 모르겠음 · 현재 상태 유지 · 요청하지 않음 · AI가 먼저 확인 후 제안</p><p className="muted">{source === 'project' ? '템플릿 출처: 이 프로젝트의 templates/request-builder/' : source === 'assets' ? '템플릿 출처: JuTell 패키지에 포함된 자산' : '템플릿 출처: 없음'}</p></article>
    </div>
    <div className="panel"><h3>V2 예정</h3><p>현재는 템플릿 보기와 복사만 제공합니다. 화면에서 직접 선택·작성하는 기능과 민감정보 경고는 V2에서 추가될 예정입니다. 자동 전송은 V2 설계 대상이 아닙니다.</p><p className="muted">로컬 사용량 측정이 기본 꺼짐 상태로 추가되었습니다. 켜면 템플릿 복사 횟수만 이 컴퓨터에 기록됩니다. 자세한 내용은 docs/USAGE_EFFICIENCY_EXPERIMENTS.md를 참조하세요.</p></div>
  </section>;
}
