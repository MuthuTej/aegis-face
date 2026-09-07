import { Router } from 'express';
import { getDb } from '../db';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'datalake-backend',
    time: new Date().toISOString(),
  });
});

// Readiness probe — verifies the database is reachable.
router.get('/ready', (_req, res) => {
  try {
    getDb().prepare('SELECT 1').get();
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not_ready' });
  }
});

export default router;
