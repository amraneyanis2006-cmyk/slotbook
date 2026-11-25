import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { AppError } from '../errors.js';
import { validateSearch } from '../rules/searchRules.js';
import { listAvailable, searchSlots } from '../services/bookingService.js';
import { isoDateField, parse } from '../utils/validate.js';

export const slotsRouter = Router();
slotsRouter.use(requireAuth, requireRole('CUSTOMER'));

const SERVICE_MESSAGE = 'Choose a valid service.';
const availableQuery = z.object({
  date: isoDateField,
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

// F-12 §3: bookable slots over a date range (≤ 14 days), by service and staff.
slotsRouter.get('/search', async (req, res, next) => {
  try {
    const query = validateSearch(req.query as Record<string, unknown>);
    if ('fields' in query) throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', query.fields);
    res.json(await searchSlots(query));
  } catch (err) {
    next(err);
  }
});
