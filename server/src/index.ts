import { createApp } from './app.js';

let app;
try {
  app = createApp();
} catch (err) {
  // Configuration errors (e.g. a missing or short SESSION_SECRET) stop the process before it listens.
  console.error(`Refusing to start: ${(err as Error).message}`);
  process.exit(1);
}
const port = Number(process.env.PORT ?? 3000);
const server = app.listen(port, () => console.log(`SlotBook listening on port ${port}`));

// Cloud Run and `docker stop` send SIGTERM. As PID 1 in a container, node has no default action for it,
// so close the server (finish in-flight requests) and exit, instead of being killed after the grace period.
process.on('SIGTERM', () => server.close(() => process.exit(0)));
