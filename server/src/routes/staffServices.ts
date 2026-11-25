import { Router } from 'express';
import { AppError } from '../errors.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { createService, listServices, updateService } from '../services/serviceCatalogue.js';

export const staffServicesRouter = Router();
staffServicesRouter.use(requireAuth, requireRole('STAFF'));

const body = (raw: unknown) => (raw && typeof raw === 'object' ? raw as Record<string, unknown> : {});

// F-11 §3: the shared catalogue (A-06), any active Staff member.
staffServicesRouter.get('/', async (_req, res, next) => {
  try {
    res.json({ services: await listServices() });
  } catch (err) {
    next(err);
  }
});

staffServicesRouter.post('/', async (req, res, next) => {
  try {
    res.status(201).json({ service: await createService(body(req.body)) });
  } catch (err) {
    next(err);
  }
});

staffServicesRouter.patch('/:id', async (req, res, next) => {
  try {
    const id = /^\d{1,9}$/.test(req.params.id) ? Number(req.params.id) : NaN;
    if (!Number.isSafeInteger(id) || id < 1) throw new AppError(404, 'NOT_FOUND', 'Service not found.');
    res.json({ service: await updateService(id, body(req.body)) });
  } catch (err) {
    next(err);
  }
});
