-- F-17 (BR-19): count a customer's NO_SHOW outcomes of the last 30 days.
CREATE INDEX "BookingStatusChange_toStatus_createdAt_idx" ON "BookingStatusChange"("toStatus", "createdAt");
