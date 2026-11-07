import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const servicesRouter = Router();

// Active services by name, for any authenticated user (F-02 §2.1).
servicesRouter.get('/', requireAuth, async (_req, res, next) => {
  try {
    const services = await prisma.service.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, durationMin: true },
    });
    res.json({ services });
  } catch (err) {
    next(err);
  }
});
