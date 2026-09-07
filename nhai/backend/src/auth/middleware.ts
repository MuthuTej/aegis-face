import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { verifyToken } from './jwt';
import { getDb } from '../db';
import type { DeviceRow, Role } from '../types';

/**
 * Gate a route behind a valid JWT. Optionally restrict to a set of roles.
 * Used by admin/operator endpoints (web dashboard, enrollment management).
 */
export function requireAuth(roles?: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      res.status(401).json({ error: 'missing_token' });
      return;
    }
    try {
      const payload = verifyToken(header.slice(7));
      if (roles && !roles.includes(payload.role)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      req.user = payload;
      next();
    } catch {
      res.status(401).json({ error: 'invalid_token' });
    }
  };
}

/**
 * Gate a route behind valid device credentials (X-Device-Id + X-Api-Key).
 * Field devices use this to sync attendance and download enrollment templates.
 */
export function requireDevice(req: Request, res: Response, next: NextFunction): void {
  const deviceId = req.header('x-device-id');
  const apiKey = req.header('x-api-key');
  if (!deviceId || !apiKey) {
    res.status(401).json({ error: 'missing_device_credentials' });
    return;
  }
  const db = getDb();
  const device = db
    .prepare('SELECT * FROM devices WHERE device_id = ? AND active = 1')
    .get(deviceId) as DeviceRow | undefined;

  if (!device || !bcrypt.compareSync(apiKey, device.api_key_hash)) {
    res.status(401).json({ error: 'invalid_device_credentials' });
    return;
  }
  db.prepare("UPDATE devices SET last_seen_at = datetime('now') WHERE device_id = ?").run(deviceId);
  req.device = { device_id: device.device_id, name: device.name };
  next();
}
