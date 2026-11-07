import type { RequestHandler } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../errors.js';
import { toPublicUser } from '../types.js';

/** 401 unless the session belongs to an existing, active user; the user (and role) is reloaded from the DB every request. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const userId = req.session.userId;
    const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
    if (!user?.isActive) {
      if (userId) await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
      return next(new AppError(401, 'UNAUTHENTICATED', 'Please log in.'));
    }
    req.user = toPublicUser(user);
    next();
  } catch (err) {
    next(err);
  }
};
