import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const staffMembersRouter = Router();

// F-12 §3: active staff names for the search filter (names only, no e-mail), any authenticated user.
staffMembersRouter.get('/', requireAuth, async (_req, res, next) => {
  try {
    const staff = await prisma.user.findMany({
      where: { role: 'STAFF', isActive: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true },
    });
    res.json({ staff });
  } catch (err) {
    next(err);
  }
});
