import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prisma } from '@prisma/client';
import express, { type ErrorRequestHandler } from 'express';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import { sessionOptions } from './config/session.js';
import { AppError } from './errors.js';
import { BOOKING_RULE_MESSAGES } from './rules/bookingRules.js';
import { authRouter } from './routes/auth.js';
import { bookingsRouter } from './routes/bookings.js';
import { healthRouter, readyRouter, versionRouter } from './routes/health.js';
import { servicesRouter } from './routes/services.js';
import { slotsRouter } from './routes/slots.js';
import { staffScheduleRouter } from './routes/staffSchedule.js';
import { staffSlotsRouter } from './routes/staffSlots.js';
import { testOnlyRouter } from './routes/testOnly.js';

// One session store (one pg pool) per process, shared by every app instance.
const PgStore = pgSession(session);
let store: InstanceType<typeof PgStore> | undefined;

export function createApp() {
  const app = express();
  store ??= new PgStore({ conString: process.env.DATABASE_URL, createTableIfMissing: false });

  const production = process.env.NODE_ENV === 'production';
  app.disable('x-powered-by');
  // Cloud Run terminates TLS one hop in front of us; needed for req.secure, hence the Secure cookie.
  if (production) app.set('trust proxy', 1);
  // One container in production: the API also serves the built SPA. Assets skip the session store.
  const clientDist = path.resolve(process.env.CLIENT_DIST ?? fileURLToPath(new URL('../../client/dist', import.meta.url)));
  if (production) app.use(express.static(clientDist, { index: false }));
  app.use(express.json({ limit: '100kb' }));
  app.use(session({
    ...sessionOptions(process.env.NODE_ENV),
    store,
  }));

  app.use('/api/health', healthRouter);
  app.use('/api/ready', readyRouter);
  app.use('/api/version', versionRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/services', servicesRouter);
  app.use('/api/staff/slots', staffSlotsRouter);
  app.use('/api/staff/schedule', staffScheduleRouter);
  app.use('/api/slots', slotsRouter);
  app.use('/api/bookings', bookingsRouter);
  if (process.env.NODE_ENV === 'test') app.use('/api/__test__', testOnlyRouter);

  app.use('/api', (_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Not found.')));

  // Client-side routes of the SPA (after the /api 404, so unknown API routes stay JSON).
  if (production) app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));

  app.use(errorHandler);

  return app;
}

/** Maps AppError to its status/code/message/fields; everything else is 500 INTERNAL_ERROR (details only in the log). */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.code, message: err.message, ...(err.fields && { fields: err.fields }) });
    return;
  }
  if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'The request body is not valid JSON or is too large.' });
    return;
  }
  // Race on the partial unique index booking_one_active_per_slot (BR-01, NFR-04): F-04 §1 step 4.8.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
      && /slotId|booking_one_active_per_slot/.test(String(err.meta?.target))) {
    res.status(409).json({ error: 'SLOT_ALREADY_BOOKED', message: BOOKING_RULE_MESSAGES.SLOT_ALREADY_BOOKED });
    return;
  }
  const requestId = randomUUID();
  console.error(`[${requestId}]`, err);
  res.set('X-Request-Id', requestId)
    .status(500)
    .json({ error: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' });
};
