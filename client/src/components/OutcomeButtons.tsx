import { useState } from 'react';
import { http } from '../api/http';
import { ConfirmDialog } from './ConfirmDialog';

const LABEL = { COMPLETED: 'Completed', NO_SHOW: 'No-show' } as const;
type Outcome = keyof typeof LABEL;

/**
 * F-09 §4: Completed / No-show buttons with a confirmation dialog. Calls onDone() after a success and
 * onError(message) after a refusal (the caller shows the toast or callout and reloads).
 */
export function OutcomeButtons({ reference, customer, onDone, onError }: {
  reference: string; customer: string; onDone: () => void; onError: (message: string) => void;
}) {
  const [confirming, setConfirming] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);

  async function record(outcome: Outcome) {
    setBusy(true);
    const res = await http(`/staff/bookings/${encodeURIComponent(reference)}/outcome`, { method: 'POST', body: { outcome } });
    setBusy(false);
    setConfirming(null);
    if (res.ok) onDone();
    else onError(res.message);
  }
  const close = () => { if (!busy) setConfirming(null); };

  return (
    <div className="row-actions">
      {(Object.keys(LABEL) as Outcome[]).map((o) => (
        <button key={o} type="button" className="secondary" aria-label={`${LABEL[o]} ${reference}`} onClick={() => setConfirming(o)}>
          {LABEL[o]}
        </button>
      ))}
      {confirming && (
        <ConfirmDialog title={`Record ${LABEL[confirming]}?`} onCancel={close}>
          <p>Record {customer} as {LABEL[confirming]} for {reference}? This cannot be changed.</p>
          <div className="dialog-actions">
            <button type="button" onClick={() => record(confirming)} disabled={busy}>Yes, record {LABEL[confirming]}</button>
            <button type="button" className="secondary" onClick={close} disabled={busy}>Go back</button>
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
