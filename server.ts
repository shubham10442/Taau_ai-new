import express from 'express';
import path from 'node:path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();
const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'mpa' });
    app.use(vite.middlewares);
  } else {
    const dist = path.resolve(import.meta.dirname, 'dist');
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`Taau Ai static server running on http://localhost:${PORT}`));
}

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
