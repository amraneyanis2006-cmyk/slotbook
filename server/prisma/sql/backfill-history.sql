INSERT INTO "BookingStatusChange" ("bookingId", "fromStatus", "toStatus", "actorId", "reason", "createdAt")
SELECT b."id", NULL, 'BOOKED'::"BookingStatus", b."customerId", NULL, b."createdAt"
FROM "Booking" b
WHERE NOT EXISTS (SELECT 1 FROM "BookingStatusChange" h WHERE h."bookingId" = b."id")
UNION ALL
SELECT b."id", 'BOOKED'::"BookingStatus", b."status",
       CASE WHEN b."status" = 'CANCELLED' THEN COALESCE(b."cancelledById", b."customerId") ELSE s."staffId" END,
       'Recorded before history (Sprint 1)',
       GREATEST(b."createdAt", CASE WHEN b."status" = 'CANCELLED' THEN COALESCE(b."cancelledAt", b."createdAt") ELSE s."endAt" END)
FROM "Booking" b
JOIN "Slot" s ON s."id" = b."slotId"
WHERE b."status" <> 'BOOKED'
  AND NOT EXISTS (SELECT 1 FROM "BookingStatusChange" h WHERE h."bookingId" = b."id");
