export function Notice({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'success' | 'error' }) {
  return <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}
