import type { SessionOptions } from 'express-session';

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

/** express-session options (system-sds §6); the store is added by app.ts. */
export const sessionOptions = (env: string | undefined, secret = process.env.SESSION_SECRET ?? ''): SessionOptions => ({
  name: 'sid',
  secret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { httpOnly: true, sameSite: 'lax', secure: env === 'production', maxAge: EIGHT_HOURS_MS },
});
