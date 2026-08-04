import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';

export function createApp(): Express {
  const app = express();

  // Don't trust X-Forwarded-* headers unless we know we're behind a reverse proxy.
  app.set('trust proxy', false);

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    })
  );
  // Small body limit: this API only ever receives auth payloads as JSON;
  // log files go through multipart upload, not JSON.
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Central error handler: never leak stack traces or internal error details to clients.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
