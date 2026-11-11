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
app.listen(port, () => console.log(`SlotBook on http://localhost:${port}`));
