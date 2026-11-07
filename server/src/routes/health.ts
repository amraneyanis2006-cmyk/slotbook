import { Router } from 'express';
import { prisma } from '../db.js';

export const healthRouter = Router();

// Public probe; the only response outside the { error, message } shape (system-sds §4).
healthRouter.get('/', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'up' });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'down' });
  }
});
