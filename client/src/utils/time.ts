// Display and input helpers in Asia/Bangkok (UTC+7, no DST), per system-sds §3.2.
const TZ = 'Asia/Bangkok';
const part = (date: Date, options: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...options }).formatToParts(date).map((p) => [p.type, p.value]));

/** "Mon 10 Nov 2026" */
export const formatDay = (iso: string | Date) => {
  const p = part(new Date(iso), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
};

/** "09:30" */
export const formatTime = (iso: string | Date) => {
  const p = part(new Date(iso), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${p.hour}:${p.minute}`;
};

/** Today's Bangkok date as YYYY-MM-DD. */
export const todayBangkok = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

/** "HH:mm" + minutes → "HH:mm" (same day). */
export const addMinutes = (time: string, minutes: number) => {
  const total = Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
