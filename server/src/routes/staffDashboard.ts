import { Router } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../errors.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { computeDashboard, validatePeriod, type DashboardSlot } from '../rules/dashboardRules.js';
import { now } from '../utils/clock.js';
import { addDays, bangkokToUtc } from '../utils/time.js';

export const staffDashboardRouter = Router();
staffDashboardRouter.use(requireAuth, requireRole('STAFF'));

// F-15 §1 step 2: the session staff member's non-cancelled slots of the period, with their non-cancelled booking.
staffDashboardRouter.get('/', async (req, res, next) => {
  try {
    const period = validatePeriod(req.query as Record<string, unknown>);
    if ('fields' in period) throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', period.fields);
    const rows = await prisma.slot.findMany({
      where: {
        staffId: req.user!.id, status: { not: 'CANCELLED' },
        startAt: { gte: bangkokToUtc(period.from, '00:00'), lt: bangkokToUtc(addDays(period.to, 1), '00:00') },
      },
      select: {
        status: true, startAt: true, service: { select: { id: true, name: true } },
        bookings: { where: { status: { not: 'CANCELLED' } }, take: 1, select: { status: true } },
      },
    });
    const slots = rows.map(({ bookings, ...s }) => ({ ...s, booking: bookings[0] ?? null }) as DashboardSlot);
    res.json({ ...period, ...computeDashboard(slots, now()) });
  } catch (err) {
    next(err);
  }
});
