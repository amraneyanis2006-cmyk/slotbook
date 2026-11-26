# Durability check (final release)

Target https://slotbook-mivepbjoza-as.a.run.app. Script `scripts/durability-check.mjs`; times UTC.

## before — 2026-11-26T06:23:13.042Z
Version `cdaf24f`, revision `slotbook-00013-8s5`.
Anan published slot 81 (2026-12-16, Academic advising); cust.nina@slotbook.test booked it: **BK-2026-000035**.
```json
{
  "reference": "BK-2026-000035",
  "status": "BOOKED",
  "note": "Durability marker 2026-11-26T06:23:13.042Z",
  "startAt": "2026-12-16T09:45:00.000Z",
  "staff": "Anan Wong",
  "service": "Academic advising",
  "history": [
    "BOOKED by Nina Park at 2026-11-26T06:23:14.132Z"
  ]
}
```

## after: restart: same image, deploy run 45767850166 — 2026-11-26T06:24:19.073Z
Version `cdaf24f`, revision `slotbook-00014-fl5` (before: `slotbook-00013-8s5`).
GET /api/bookings/BK-2026-000035 → 200; identical to the first read: **YES**; slot 81 in Anan's slots with this booking (GET /api/staff/slots → 200): **YES**.

## after: redeploy: full pipeline, deploy run 45767974071 — 2026-11-26T06:28:57.440Z
Version `cdaf24f`, revision `slotbook-00015-kdj` (before: `slotbook-00013-8s5`).
GET /api/bookings/BK-2026-000035 → 200; identical to the first read: **YES**; slot 81 in Anan's slots with this booking (GET /api/staff/slots → 200): **YES**.

## cleanup — 2026-11-26T06:29:03.503Z
Booking BK-2026-000035 cancelled by the customer → 200; slot 81 cancelled by Anan → 200.

