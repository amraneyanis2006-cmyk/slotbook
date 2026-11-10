import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { listAvailable } from '../services/bookingService.js';
import { isIsoDate } from '../utils/time.js';
import { parse } from '../utils/validate.js';

export const slotsRouter = Router();
slotsRouter.use(requireAuth, requireRole('CUSTOMER'));

const DATE_MESSAGE = 'Enter a valid date (YYYY-MM-DD).';
const SERVICE_MESSAGE = 'Choose a valid service.';
const availableQuery = z.object({
  date: z.string({ required_error: DATE_MESSAGE, invalid_type_error: DATE_MESSAGE }).refine(isIsoDate, DATE_MESSAGE),
  serviceId: z.coerce.number({ invalid_type_error: SERVICE_MESSAGE })
    .int(SERVICE_MESSAGE).positive(SERVICE_MESSAGE).max(2_147_483_647, SERVICE_MESSAGE).optional(),
});

// F-04 §3: bookable slots of one Bangkok day, optionally of one service.
slotsRouter.get('/available', async (req, res, next) => {
  try {
    const { date, serviceId } = parse(availableQuery, req.query);
    res.json({ slots: await listAvailable(date, serviceId) });
  } catch (err) {
    next(err);
  }
});
