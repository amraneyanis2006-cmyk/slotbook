import { useEffect, useRef } from 'react';

// Short success message announced politely (role="status"); disappears after `ms` by calling onDone.
// Render it only while there is a message: {toast && <Toast message={toast} onDone={() => setToast(null)} />}
export function Toast({ message, onDone, ms = 4000 }: { message: string; onDone: () => void; ms?: number }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const timer = setTimeout(() => done.current(), ms);
    return () => clearTimeout(timer);
  }, [message, ms]);
  return <div className="toast" role="status">{message}</div>;
}
