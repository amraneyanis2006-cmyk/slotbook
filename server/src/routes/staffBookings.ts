import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { getForStaff, recordOutcome } from '../services/bookingService.js';
import { parse } from '../utils/validate.js';

export const staffBookingsRouter = Router();
staffBookingsRouter.use(requireAuth, requireRole('STAFF'));

// F-10 §3: a booking on one of the session staff member's slots, with its history (BR-08, BR-09).
staffBookingsRouter.get('/:reference', async (req, res, next) => {
  try {
    res.json(await getForStaff(req.user!.id, req.params.reference));
  } catch (err) {
    next(err);
  }
});

const OUTCOME = 'Choose Completed or No-show.';
const outcomeSchema = z.object({ outcome: z.enum(['COMPLETED', 'NO_SHOW'], { errorMap: () => ({ message: OUTCOME }) }) });

// F-09 §3: record COMPLETED / NO_SHOW for a booking on one of the caller's slots (BR-15, BR-13).
staffBookingsRouter.post('/:reference/outcome', async (req, res, next) => {
  try {
    const { outcome } = parse(outcomeSchema, req.body);
    res.json(await recordOutcome(req.user!.id, req.params.reference, outcome));
  } catch (err) {
    next(err);
  }
});
