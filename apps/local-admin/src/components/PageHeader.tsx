export function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-header"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>;
}
