import type { ReactNode } from 'react';

// Empty list: one sentence plus the next action (e.g. a link), per system-sds §3.2.
// Pass the exact contract sentence as `message`.
export function EmptyState({ message, children }: { message: string; children?: ReactNode }) {
  return <div className="empty"><p>{message}</p>{children}</div>;
}
