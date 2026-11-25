# Post-deployment checks — Sprint 2 release, https://slotbook-mivepbjoza-as.a.run.app, main ce25d4f, revision slotbook-00011-xjg (2026-11-25)
| ID | Time (UTC) | Account | Action | Expected | Actual | Result |
|---|---|---|---|---|---|---|
| PD-S2-01 | 16:13:38 | none | GET /api/version, /api/ready | commit ce25d4f; 200 | {"commit":"ce25d4f807ee353cc64248c47180545f36c2bca2","revision":"slotbook-00011-xjg"}; 200 | PASS |
| setup | 16:13:40 | staff.anan | POST /api/staff/slots Academic advising 2026-11-28 | 3 × 201 | slots 78, 79, 80 | — |
| PD-S2-02 | 16:13:40 | cust.ploy | GET /api/bookings/BK-2026-000032 (cancelled in Lab 7, before F-10) | history backfilled: Booked, then Cancelled with the marker reason | ["BOOKED","CANCELLED (Recorded before history (Sprint 1))"] | PASS |
| PD-S2-03 | 16:13:40 | cust.ploy | GET /api/slots/search (7 days, Anan, Academic advising); GET /api/staff-members | the 3 new slots listed; names only | 200, 3 slots incl. 3/3; staff [{"id":1,"name":"Anan Wong"},{"id":2,"name":"Mali Srisuk"}] | PASS |
| PD-S2-04 | 16:13:43 | cust.ploy | book slot 78 (BK-2026-000033); POST /reschedule to slot 79 | 201 new reference; old CANCELLED "Rescheduled to …"; slot freed | 201 BK-2026-000034; old CANCELLED "Rescheduled to BK-2026-000034"; slot 78 listed again: true | PASS |
| PD-S2-05 | 16:13:43 | staff.anan | POST /api/staff/bookings/BK-2026-000034/outcome NO_SHOW (future booking) | 409 OUTCOME_TOO_EARLY, unchanged | 409 {"error":"OUTCOME_TOO_EARLY","message":"An outcome can be recorded only after the booking starts."} | PASS |
| PD-S2-06 | 16:13:43 | staff.anan / cust.ploy | close slot 80, search, reopen | CLOSED and hidden, then OPEN | CLOSED, hidden true, OPEN | PASS |
| PD-S2-07 | 16:13:45 | staff.anan (UI) / cust.ploy | cancel slot 79 with reason (booked BK-2026-000034) | booking CANCELLED; history by Anan with the reason | CANCELLED; {"at":"2026-11-25T16:13:45.742Z","from":"BOOKED","to":"CANCELLED","actor":{"name":"Anan Wong","role":"STAFF"},"reason":"Post-deployment check"} | PASS |
| PD-S2-08 | 16:13:46 | staff.anan / cust.ploy | GET /api/staff/services; POST invalid; customer GET | 200 list; 422; 403 | 200 (4 services); 422 {"name":"Enter a name of 3 to 60 characters.","durationMin":"Choose a duration from 15 to 120 minutes in 15-minute steps."}; 403 | PASS |
| PD-S2-09 | 16:13:47 | staff.anan | GET /api/staff/dashboard (last 30 days) | 200 with figures | 200 {"slots":{"total":37,"booked":6,"open":30,"closed":1},"outcomes":{"completed":1,"noShow":0,"pending":5},"noShowRate":0} | PASS |
| PD-S2-10 | 16:13:50 | cust.ploy | 30 × GET /api/slots/search (14 days) from Bangkok to Cloud Run | p95 recorded (< 500 ms server-side target) | median 84 ms, p95 95 ms, max 98 ms (includes the network) | — |
| cleanup | 16:13:51 | staff.anan | cancel slots 78, 80 | — | done | — |

Run by `.pd/pd.spec.ts` (Playwright, not part of the repository suites) on Yanis's computer against the live URL,
25/11/2026 23:13 Bangkok; the demo password was read from a local file created by Yanis and deleted after the run.
Screenshots: `post-deploy/pd-01` … `pd-07`. Test data left in the demo database: slot 79 and bookings
BK-2026-000033 / BK-2026-000034 CANCELLED (checked by PD-S2-04 and PD-S2-07); the cleanup cancellation of slots 78
and 80 was sent but its answer was not checked by the script.
