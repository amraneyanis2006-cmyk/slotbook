import { createApp } from './app.js';

// ponytail: API only. Serving the built SPA from Express comes with the Docker image (F-13, Sprint 2).
const port = Number(process.env.PORT ?? 3000);
createApp().listen(port, () => console.log(`SlotBook API on http://localhost:${port}`));
