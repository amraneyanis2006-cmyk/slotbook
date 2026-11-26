// Durability check (Final delivery, Part D): data written through the public API must still be there, unchanged,
// after the service restarts (new Cloud Run revision of the same image) and after a redeploy.
//
//   node scripts/durability-check.mjs before            # Anan publishes a marker slot, a customer books it
//   node scripts/durability-check.mjs after <label>     # reads both back and compares them (run after each event)
//   node scripts/durability-check.mjs cleanup           # customer cancels the booking, Anan cancels the slot
//
// SLOTBOOK_URL (default: the Cloud Run URL). The demo password is read at run time from SLOTBOOK_PW_FILE
// (default ~/.slotbook_pw, chmod 600) and is never printed or written. Output: artifacts/final/durability.md (log)
// and artifacts/final/durability-state.json (ids and the first read, no secret).
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const BASE = (process.env.SLOTBOOK_URL ?? 'https://slotbook-mivepbjoza-as.a.run.app').replace(/\/$/, '');
const PASSWORD = readFileSync(process.env.SLOTBOOK_PW_FILE ?? `${homedir()}/.slotbook_pw`, 'utf8').trim();
const DIR = fileURLToPath(new URL('../artifacts/final/', import.meta.url));
const STATE = `${DIR}durability-state.json`;
const LOG = `${DIR}durability.md`;
const STAFF = 'staff.anan@slotbook.test';
const CUSTOMERS = ['cust.nina@slotbook.test', 'cust.ken@slotbook.test', 'cust.ploy@slotbook.test'];
mkdirSync(DIR, { recursive: true });

async function session(email) {
  const res = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
  if (res.status !== 200) throw new Error(`login ${email} → ${res.status}`);
  await res.json(); // read the whole answer first: the session is stored before the response ends
  const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const call = async (method, path, body) => {
    const r = await fetch(`${BASE}${path}`, { method, headers: { cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  return { call, logout: () => call('POST', '/api/auth/logout', {}) };
}
const version = async () => (await fetch(`${BASE}/api/version`)).json();
const bangkokDate = (days) => new Date(Date.now() + 7 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);
const log = (lines) => appendFileSync(LOG, `${lines.join('\n')}\n\n`);
const view = ({ booking: b, history }) => ({ reference: b.reference, status: b.status, note: b.note, startAt: b.slot?.startAt,
  staff: b.slot?.staff?.name, service: b.slot?.service?.name, history: (history ?? []).map((h) => `${h.to} by ${h.actor.name} at ${h.at}`) });

const phase = process.argv[2];
const v = await version();
const now = new Date().toISOString();
if (!existsSync(LOG)) writeFileSync(LOG, `# Durability check (final release)\n\nTarget ${BASE}. Script \`scripts/durability-check.mjs\`; times UTC.\n\n`);

if (phase === 'before') {
  const staff = await session(STAFF);
  const service = (await staff.call('GET', '/api/services')).body.services.find((s) => s.name === 'Academic advising');
  const date = bangkokDate(20);
  let slot;
  for (const t of ['16:45', '16:30', '16:15', '16:00', '15:45', '15:30']) {
    const r = await staff.call('POST', '/api/staff/slots', { serviceId: service.id, date, startTime: t });
    if (r.status === 201) { slot = r.body.slot; break; }
  }
  if (!slot) throw new Error('no free marker time for Anan on ' + date);
  let booking; let customer;
  for (const email of CUSTOMERS) {
    const c = await session(email);
    const r = await c.call('POST', '/api/bookings', { slotId: slot.id, note: `Durability marker ${now}` });
    if (r.status === 201) { booking = r.body.booking; customer = email; break; }
    await c.logout();
  }
  if (!booking) throw new Error('no seeded customer could book the marker slot');
  const c = await session(customer);
  const first = view((await c.call('GET', `/api/bookings/${booking.reference}`)).body);
  writeFileSync(STATE, JSON.stringify({ created: now, version: v, slotId: slot.id, customer, first }, null, 2));
  log([`## before — ${now}`, `Version \`${v.commit.slice(0, 7)}\`, revision \`${v.revision}\`.`,
    `Anan published slot ${slot.id} (${date}, Academic advising); ${customer} booked it: **${booking.reference}**.`,
    '```json', JSON.stringify(first, null, 2), '```']);
  console.log(`before: slot ${slot.id}, booking ${booking.reference}, revision ${v.revision}`);
} else if (phase === 'after') {
  const label = process.argv[3] ?? 'after';
  const st = JSON.parse(readFileSync(STATE, 'utf8'));
  const c = await session(st.customer);
  const read = await c.call('GET', `/api/bookings/${st.first.reference}`);
  const now2 = read.status === 200 ? view(read.body) : null;
  const staff = await session(STAFF);
  const list = await staff.call('GET', '/api/staff/slots');
  const mine = (list.body?.slots ?? []).find((x) => x.id === st.slotId);
  const slotSeen = Boolean(mine && mine.booking?.reference === st.first.reference);
  const same = JSON.stringify(now2) === JSON.stringify(st.first);
  log([`## after: ${label} — ${now}`, `Version \`${v.commit.slice(0, 7)}\`, revision \`${v.revision}\` (before: \`${st.version.revision}\`).`,
    `GET /api/bookings/${st.first.reference} → ${read.status}; identical to the first read: **${same ? 'YES' : 'NO'}**; slot ${st.slotId} in Anan's slots with this booking (GET /api/staff/slots → ${list.status}): **${slotSeen ? 'YES' : 'NO'}**.`,
    ...(same ? [] : ['```json', JSON.stringify(now2, null, 2), '```'])]);
  console.log(`${label}: revision ${v.revision}, booking ${read.status}, identical ${same}, slot listed ${slotSeen}`);
  if (!same || !slotSeen) process.exit(1);
} else if (phase === 'cleanup') {
  const st = JSON.parse(readFileSync(STATE, 'utf8'));
  const c = await session(st.customer);
  const a = await c.call('POST', `/api/bookings/${st.first.reference}/cancel`, {});
  const staff = await session(STAFF);
  const b = await staff.call('POST', `/api/staff/slots/${st.slotId}/cancel`, { reason: 'Durability check finished' });
  log([`## cleanup — ${now}`, `Booking ${st.first.reference} cancelled by the customer → ${a.status}; slot ${st.slotId} cancelled by Anan → ${b.status}.`]);
  console.log(`cleanup: booking ${a.status}, slot ${b.status}`);
} else {
  console.error('usage: node scripts/durability-check.mjs before | after <label> | cleanup');
  process.exit(2);
}
