import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { AppError } from '../errors.js';
import { cancelSlot, createSlot, editSlot, listUpcoming, setSlotOpen } from '../services/slotService.js';
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

// F-07 §3: `:id` that is not a positive integer gets the same 404 as a slot that is not the caller's (BR-09).
const slotId = (raw: string) => {
  const id = /^\d{1,9}$/.test(raw) ? Number(raw) : 0;
  if (id < 1) throw new AppError(404, 'NOT_FOUND', 'Slot not found.');
  return id;
};
const editSchema = z.object({
  date: z.string({ required_error: 'Choose a date.', invalid_type_error: 'Choose a date.' }),
  startTime: z.string({ required_error: 'Choose a start time.', invalid_type_error: 'Choose a start time.' }),
});
const REASON = 'Enter a reason of 3 to 200 characters.';
const cancelSchema = z.object({
  reason: z.string({ required_error: REASON, invalid_type_error: REASON }).trim().min(3, REASON).max(200, REASON),
});

staffSlotsRouter.patch('/:id', async (req, res, next) => {
  try {
    const id = slotId(req.params.id);
    res.json({ slot: await editSlot(req.user!.id, id, parse(editSchema, req.body)) });
  } catch (err) {
    next(err);
  }
});

for (const [action, open] of [['close', false], ['reopen', true]] as const) {
  staffSlotsRouter.post(`/:id/${action}`, async (req, res, next) => {
    try {
      res.json({ slot: await setSlotOpen(req.user!.id, slotId(req.params.id), open) });
    } catch (err) {
      next(err);
    }
  });
}

staffSlotsRouter.post('/:id/cancel', async (req, res, next) => {
  try {
    const id = slotId(req.params.id);
    res.json(await cancelSlot(req.user!.id, id, parse(cancelSchema, req.body).reason));
  } catch (err) {
    next(err);
  }
});

