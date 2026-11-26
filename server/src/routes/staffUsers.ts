import { Router } from 'express';
import { AppError } from '../errors.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { deactivateCustomer, listCustomers, reactivateCustomer } from '../services/accountService.js';

export const staffUsersRouter = Router();
staffUsersRouter.use(requireAuth, requireRole('STAFF'));

// F-17 §3: `:id` must be a customer; staff ids and unknown ids answer 404 (F-17 §1 step 4).
const userId = (raw: string) => {
  const id = /^\d{1,9}$/.test(raw) ? Number(raw) : 0;
  if (id < 1) throw new AppError(404, 'NOT_FOUND', 'Account not found.');
  return id;
};

staffUsersRouter.get('/', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
    res.json({ users: await listCustomers(q || undefined) });
  } catch (err) {
    next(err);
  }
});

staffUsersRouter.post('/:id/deactivate', async (req, res, next) => {
  try {
    res.json(await deactivateCustomer(req.user!.id, userId(req.params.id)));
  } catch (err) {
    next(err);
  }
});

staffUsersRouter.post('/:id/reactivate', async (req, res, next) => {
  try {
    res.json(await reactivateCustomer(userId(req.params.id)));
  } catch (err) {
    next(err);
  }
});
