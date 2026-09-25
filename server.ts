import 'dotenv/config';
import http from 'http';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createExpressApp } from './server/app.ts';
import { socketService } from './server/services/socketService.ts';

async function startServer() {
  const app = createExpressApp();
  const httpServer = http.createServer(app);
  const PORT = 3000;

  // Initialize secure real-time Socket.IO subsystem
  socketService.init(httpServer);

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ DRINKIT Quick-Commerce Platform online on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start DrinkIt server:', err);
  process.exit(1);
});