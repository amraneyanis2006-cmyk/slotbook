import type { Role } from '@prisma/client';
import type { RequestHandler } from 'express';
import { AppError } from '../errors.js';

/** 403 FORBIDDEN when the authenticated user's role is not allowed. Use after requireAuth. */
export const requireRole = (...roles: Role[]): RequestHandler => (req, _res, next) =>
  next(req.user && roles.includes(req.user.role) ? undefined : new AppError(403, 'FORBIDDEN', 'You do not have access to this operation.'));
