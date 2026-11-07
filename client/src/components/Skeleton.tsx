// Loading placeholder: grey blocks inside a region marked aria-busy="true" (system-sds §3.2).
// `rows` sets how many blocks to draw; never leave the page blank while loading.
export function Skeleton({ rows = 3, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div className="skeleton" role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton-row" />)}
    </div>
  );
}
