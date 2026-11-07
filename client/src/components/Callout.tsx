import type { ReactNode } from 'react';

// Message box: tone "error" is announced as an alert, "info" as a status. Optional Retry button.
// Use for server messages (409/500) and page-level load errors.
export function Callout({ tone = 'info', children, onRetry }: { tone?: 'info' | 'error'; children: ReactNode; onRetry?: () => void }) {
  return (
    <div className={`callout${tone === 'error' ? ' error' : ''}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
      {onRetry && <button type="button" className="secondary retry" onClick={onRetry}>Retry</button>}
    </div>
  );
}
