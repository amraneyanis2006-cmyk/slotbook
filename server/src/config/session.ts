import type { SessionOptions } from 'express-session';

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

/** express-session options (system-sds §6); the store is added by app.ts. Fails fast on a missing/weak secret. */
export const sessionOptions = (env: string | undefined, secret = process.env.SESSION_SECRET ?? ''): SessionOptions => {
  if (!secret) throw new Error('SESSION_SECRET is not set (see .env.example).');
  if (env === 'production' && secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters in production.');
  return {
    name: 'sid',
    secret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { httpOnly: true, sameSite: 'lax', secure: env === 'production', maxAge: EIGHT_HOURS_MS },
  };
};
