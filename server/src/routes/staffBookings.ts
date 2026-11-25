import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { getForStaff } from '../services/bookingService.js';

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
