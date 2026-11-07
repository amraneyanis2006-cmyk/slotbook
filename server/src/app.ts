import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler } from 'express';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import { sessionOptions } from './config/session.js';
import { AppError } from './errors.js';
import { healthRouter } from './routes/health.js';

export function createApp() {
  const app = express();
  const PgStore = pgSession(session);

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(session({
    ...sessionOptions(process.env.NODE_ENV),
    store: new PgStore({ conString: process.env.DATABASE_URL, createTableIfMissing: false }),
  }));

  app.use('/api/health', healthRouter);

  app.use('/api', (_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Not found.')));

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.code, message: err.message, ...(err.fields && { fields: err.fields }) });
      return;
    }
    if (err?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'The request body is not valid JSON.' });
      return;
    }
    const requestId = randomUUID();
    console.error(`[${requestId}]`, err);
    res.set('X-Request-Id', requestId)
      .status(500)
      .json({ error: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' });
  };
  app.use(onError);

  return app;
}
