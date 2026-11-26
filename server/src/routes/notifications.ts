import { Router } from 'express';
import { AppError } from '../errors.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { listNotifications, markAllRead, markRead } from '../services/notificationService.js';

// F-16 §3: customers only (Staff → 403).
export const notificationsRouter = Router();
notificationsRouter.use(requireAuth, requireRole('CUSTOMER'));

notificationsRouter.get('/', async (req, res, next) => {
  try {
    res.json(await listNotifications(req.user!.id));
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post('/read-all', async (req, res, next) => {
  try {
    res.json(await markAllRead(req.user!.id));
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post('/:id/read', async (req, res, next) => {
  try {
    const id = /^\d{1,9}$/.test(req.params.id) ? Number(req.params.id) : 0;
    if (id < 1) throw new AppError(404, 'NOT_FOUND', 'Notification not found.');
    res.json(await markRead(req.user!.id, id));
  } catch (err) {
    next(err);
  }
});
