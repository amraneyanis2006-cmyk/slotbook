import bcrypt from 'bcrypt';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { AppError } from '../errors.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { toPublicUser } from '../types.js';
import { parse } from '../utils/validate.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string({ required_error: 'Enter your e-mail address.' }).trim().toLowerCase()
    .max(254, 'The e-mail address is too long.').email('Enter a valid e-mail address.'),
  password: z.string({ required_error: 'Enter your password.' })
    .min(1, 'Enter your password.').max(128, 'The password is too long.'),
});

// Compared against when the e-mail is unknown, so every failure takes about the same time.
const DUMMY_HASH = bcrypt.hashSync('slotbook-timing-dummy', 12);

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = parse(loginSchema, req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    const matches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !user.isActive || !matches) throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');

    await new Promise<void>((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
    req.session.userId = user.id;
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', requireAuth, (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('sid', { path: '/' }).status(204).end();
  });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
