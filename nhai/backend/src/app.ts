import express, { ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import './types'; // load Express Request augmentation
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import devicesRouter from './routes/devices';
import enrollmentsRouter from './routes/enrollments';
import syncRouter from './routes/sync';
import attendanceRouter from './routes/attendance';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/devices', devicesRouter);
  app.use('/api/v1/enrollments', enrollmentsRouter);
  app.use('/api/v1/sync', syncRouter);
  app.use('/api/v1/attendance', attendanceRouter);

  // Serve profile images
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  };
  app.use(errorHandler);

  return app;
}
