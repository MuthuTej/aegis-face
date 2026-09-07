import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '../db';
import { config } from '../config';
import { requireAuth } from '../auth/middleware';
import type { DeviceRow } from '../types';

const router = Router();

const deviceSchema = z.object({
  deviceId: z.string().min(1).max(128),
  name: z.string().min(1).max(128),
});

/**
 * Register a field device and issue an API key. The raw key is returned ONCE
 * and never stored in plaintext — only a bcrypt hash is kept.
 */
router.post('/', requireAuth(['admin']), (req, res) => {
  const parsed = deviceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation', details: parsed.error.flatten() });
    return;
  }
  const apiKey = crypto.randomBytes(24).toString('hex');
  const apiKeyHash = bcrypt.hashSync(apiKey, config.bcryptRounds);
  const db = getDb();
  try {
    db.prepare('INSERT INTO devices (device_id, name, api_key_hash) VALUES (?, ?, ?)').run(
      parsed.data.deviceId,
      parsed.data.name,
      apiKeyHash,
    );
  } catch (e) {
    if (e instanceof Error && e.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'device_exists' });
      return;
    }
    throw e;
  }
  res.status(201).json({
    deviceId: parsed.data.deviceId,
    name: parsed.data.name,
    apiKey, // shown only once
  });
});

router.get('/', requireAuth(['admin', 'operator']), (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare('SELECT device_id, name, active, created_at, last_seen_at FROM devices ORDER BY created_at DESC')
    .all() as Omit<DeviceRow, 'id' | 'api_key_hash'>[];
  res.json({ devices: rows });
});

// Revoke a device (sets inactive — future syncs are rejected).
router.delete('/:deviceId', requireAuth(['admin']), (req, res) => {
  const db = getDb();
  const info = db.prepare('UPDATE devices SET active = 0 WHERE device_id = ?').run(req.params.deviceId);
  if (info.changes === 0) {
    res.status(404).json({ error: 'device_not_found' });
    return;
  }
  res.json({ deviceId: req.params.deviceId, active: false });
});

export default router;
