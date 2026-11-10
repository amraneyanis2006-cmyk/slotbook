import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { book, cancel, getMine, listMine } from '../services/bookingService.js';
import { parse } from '../utils/validate.js';

export const bookingsRouter = Router();
bookingsRouter.use(requireAuth, requireRole('CUSTOMER'));

const SLOT_MESSAGE = 'Choose a slot to book.';
// Unknown keys (customerId, userId, role…) are stripped: the owner is always the session user (BR-08).
const bookingSchema = z.object({
  slotId: z.number({ required_error: SLOT_MESSAGE, invalid_type_error: SLOT_MESSAGE })
    .int(SLOT_MESSAGE).positive(SLOT_MESSAGE).max(2_147_483_647, SLOT_MESSAGE),
  note: z.string({ invalid_type_error: 'The note must be text.' }).trim()
    .max(300, 'The note can be at most 300 characters.').nullish(),
});

bookingsRouter.post('/', async (req, res, next) => {
  try {
    const { slotId, note } = parse(bookingSchema, req.body);
    res.status(201).json({ booking: await book(req.user!.id, slotId, note || null) });
  } catch (err) {
    next(err);
  }
});

// Declared before /:reference so "mine" is never read as a reference.
bookingsRouter.get('/mine', async (req, res, next) => {
  try {
    res.json(await listMine(req.user!.id));
  } catch (err) {
    next(err);
  }
});

bookingsRouter.get('/:reference', async (req, res, next) => {
  try {
    res.json({ booking: await getMine(req.user!.id, req.params.reference) });
  } catch (err) {
    next(err);
  }
});

bookingsRouter.post('/:reference/cancel', async (req, res, next) => {
  try {
    res.json({ booking: await cancel(req.user!.id, req.params.reference) });
  } catch (err) {
    next(err);
  }
});
