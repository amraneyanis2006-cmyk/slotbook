import { Router } from 'express';
import { prisma } from '../db.js';

// Mounted only when NODE_ENV=test (API-09): errors whose details must never reach the client.
export const testOnlyRouter = Router();

testOnlyRouter.get('/throw', () => {
  throw new Error('Boom in /srv/slotbook/server/src/secret.ts while running SELECT * FROM "User"');
});

testOnlyRouter.get('/prisma-error', async (_req, _res, next) => {
  try {
    await prisma.$queryRawUnsafe('SELECT * FROM "TableThatDoesNotExist"');
  } catch (err) {
    next(err);
  }
});
