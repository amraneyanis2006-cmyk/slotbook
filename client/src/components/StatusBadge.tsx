// Pill showing a slot or booking status with a human label (Open, Booked, Closed, Cancelled, Completed, No-show).
// Pass the API enum value; unknown values are shown as-is.
const LABELS: Record<string, string> = {
  OPEN: 'Open', BOOKED: 'Booked', CLOSED: 'Closed', CANCELLED: 'Cancelled', COMPLETED: 'Completed', NO_SHOW: 'No-show',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge status-${status.toLowerCase()}`}>{LABELS[status] ?? status}</span>;
}
