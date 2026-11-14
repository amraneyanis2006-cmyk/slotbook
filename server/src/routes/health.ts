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

export const readyRouter = Router();

// Readiness probe for the post-deploy smoke test (NFR-12): 503 while PostgreSQL is unreachable.
readyRouter.get('/', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'not_ready' });
  }
});

export const versionRouter = Router();

// Which release is running (Lab 5 R-08): release.sh sets APP_COMMIT, Cloud Run sets K_REVISION.
versionRouter.get('/', (_req, res) => {
  res.json({ commit: process.env.APP_COMMIT || 'local', revision: process.env.K_REVISION || null });
});
