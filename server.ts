import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRouter } from './server/routes/auth.ts';
import { adminRouter } from './server/routes/admin.ts';
import { electionsRouter } from './server/routes/elections.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Security headers & JSON parser
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // CORS & basic security headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // REST API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/elections', electionsRouter);

  // Healthcheck endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'HEALTHY',
      service: 'Election Management System API',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  // Global API error handler
  app.use('/api', (err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled API Error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
    });
  });

  if (!isProd) {
    // Vite middleware for dev mode
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Election Server] Listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Election Server] Fatal bootstrap error:', err);
  process.exit(1);
});
