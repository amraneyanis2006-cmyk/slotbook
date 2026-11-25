-- F-10 Booking history (BR-17, D-07): append-only table, its trigger and the backfill of existing bookings.

-- CreateTable
CREATE TABLE "BookingStatusChange" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "fromStatus" "BookingStatus",
    "toStatus" "BookingStatus" NOT NULL,
    "actorId" INTEGER NOT NULL,
    "reason" VARCHAR(200),
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BookingStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingStatusChange_bookingId_createdAt_idx" ON "BookingStatusChange"("bookingId", "createdAt");

-- AddForeignKey
ALTER TABLE "BookingStatusChange" ADD CONSTRAINT "BookingStatusChange_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingStatusChange" ADD CONSTRAINT "BookingStatusChange_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only (F-10 §1 step 4): refuse any direct UPDATE or DELETE. pg_trigger_depth() > 1 only for the
-- cascade from deleting the booking itself, which the application never does (test helpers only).
CREATE FUNCTION booking_history_append_only() RETURNS trigger AS $$
BEGIN
  IF pg_trigger_depth() > 1 AND TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'BookingStatusChange is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_history_append_only
BEFORE UPDATE OR DELETE ON "BookingStatusChange"
FOR EACH ROW EXECUTE FUNCTION booking_history_append_only();

-- Backfill (F-10 §1 step 5); same SQL as prisma/sql/backfill-history.sql, which the seed runs (DB-06 checks they match).
-- backfill:start
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
-- backfill:end
