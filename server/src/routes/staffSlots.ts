import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { createSlot, listUpcoming } from '../services/slotService.js';
import { parse } from '../utils/validate.js';

export const staffSlotsRouter = Router();
staffSlotsRouter.use(requireAuth, requireRole('STAFF'));

// Unknown keys (staffId, role, userId…) are stripped: the owner is always the session user (BR-08).
const slotSchema = z.object({
  serviceId: z.number({ required_error: 'Choose an active service.', invalid_type_error: 'Choose an active service.' })
    .int('Choose an active service.').positive('Choose an active service.').max(2_147_483_647, 'Choose an active service.'),
  date: z.string({ required_error: 'Choose a date.', invalid_type_error: 'Choose a date.' }),
  startTime: z.string({ required_error: 'Choose a start time.', invalid_type_error: 'Choose a start time.' }),
});

staffSlotsRouter.post('/', async (req, res, next) => {
  try {
    res.status(201).json({ slot: await createSlot(req.user!.id, parse(slotSchema, req.body)) });
  } catch (err) {
    next(err);
  }
});

staffSlotsRouter.get('/', async (req, res, next) => {
  try {
    res.json({ slots: await listUpcoming(req.user!.id) });
  } catch (err) {
    next(err);
  }
});
