import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { getSchedule } from '../services/slotService.js';
import { isoDateField, parse } from '../utils/validate.js';

export const staffScheduleRouter = Router();
staffScheduleRouter.use(requireAuth, requireRole('STAFF'));

const scheduleQuery = z.object({ date: isoDateField });

// F-06 §2: the session staff member's own slots of one Bangkok day (BR-08, BR-09).
staffScheduleRouter.get('/', async (req, res, next) => {
  try {
    res.json(await getSchedule(req.user!.id, parse(scheduleQuery, req.query).date));
  } catch (err) {
    next(err);
  }
});
