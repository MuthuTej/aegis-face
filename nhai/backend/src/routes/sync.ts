import { Router } from 'express';
import { z } from 'zod';
import { getDb, runInTransaction } from '../db';
import { config } from '../config';
import { requireDevice } from '../auth/middleware';
import type { EnrollmentRow } from '../types';

const router = Router();

/**
 * Device pulls enrollment templates updated since a timestamp, so it can match
 * faces fully offline. `?since=` is an ISO/SQLite datetime; omit it for a full
 * download.
 */
router.get('/enrollments', requireDevice, (req, res) => {
  const since = typeof req.query.since === 'string' ? req.query.since : null;
  const db = getDb();
  const rows = (
    since
      ? db.prepare('SELECT * FROM enrollments WHERE updated_at > ? ORDER BY updated_at ASC').all(since)
      : db.prepare('SELECT * FROM enrollments ORDER BY updated_at ASC').all()
  ) as unknown as EnrollmentRow[];

  res.json({
    serverTime: new Date().toISOString(),
    count: rows.length,
    enrollments: rows.map((r) => ({
      employeeId: r.employee_id,
      embedding: JSON.parse(r.embedding) as number[],
      modelVersion: r.model_version,
      updatedAt: r.updated_at,
    })),
  });
});

const recordSchema = z.object({
  clientUuid: z.string().min(8).max(64),
  employeeId: z.string().min(1).max(64),
  capturedAt: z.string().min(1),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  livenessPassed: z.boolean(),
  livenessMethod: z.enum(['blink', 'smile', 'turn', 'multi']).optional(),
  matchScore: z.number().min(0).max(1).optional(),
});

const syncSchema = z.object({
  records: z.array(recordSchema).min(1).max(config.sync.maxBatchSize),
});

/**
 * Offline-first attendance sync. The device sends a batch of records, each with
 * a client-generated `clientUuid`. Insertion is idempotent: re-sending a record
 * is reported as a duplicate, not an error. The response tells the device which
 * UUIDs are durably stored (`purgeable`) so it can safely delete its local copy.
 */
router.post('/attendance', requireDevice, (req, res) => {
  const parsed = syncSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation', details: parsed.error.flatten() });
    return;
  }
  const db = getDb();
  const deviceId = req.device!.device_id;

  const accepted: string[] = [];
  const duplicates: string[] = [];
  const rejected: { clientUuid: string; reason: string }[] = [];

  const exists = db.prepare('SELECT 1 FROM attendance WHERE client_uuid = ?');
  const insert = db.prepare(
    `INSERT INTO attendance
       (client_uuid, employee_id, device_id, captured_at, latitude, longitude, liveness_passed, liveness_method, match_score)
     VALUES
       (@clientUuid, @employeeId, @deviceId, @capturedAt, @latitude, @longitude, @livenessPassed, @livenessMethod, @matchScore)`,
  );

  runInTransaction(() => {
    for (const r of parsed.data.records) {
      if (exists.get(r.clientUuid)) {
        duplicates.push(r.clientUuid);
        continue;
      }
      try {
        insert.run({
          clientUuid: r.clientUuid,
          employeeId: r.employeeId,
          deviceId,
          capturedAt: r.capturedAt,
          latitude: r.latitude ?? null,
          longitude: r.longitude ?? null,
          livenessPassed: r.livenessPassed ? 1 : 0,
          livenessMethod: r.livenessMethod ?? null,
          matchScore: r.matchScore ?? null,
        });
        accepted.push(r.clientUuid);
      } catch (e) {
        if (e instanceof Error && e.message.includes('UNIQUE')) {
          duplicates.push(r.clientUuid);
        } else {
          rejected.push({ clientUuid: r.clientUuid, reason: 'insert_failed' });
        }
      }
    }
  });

  // Anything accepted or already present is safe for the device to purge.
  const purgeable = [...accepted, ...duplicates];
  res.json({
    serverTime: new Date().toISOString(),
    accepted,
    duplicates,
    rejected,
    purgeable,
  });
});

const purgeSchema = z.object({
  clientUuids: z.array(z.string().min(8).max(64)).min(1).max(config.sync.maxBatchSize),
});

/**
 * Optional audit hook: the device confirms it has deleted local copies. We log
 * the purge for the offline-to-online reliability trail.
 */
router.post('/purge-confirm', requireDevice, (req, res) => {
  const parsed = purgeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation', details: parsed.error.flatten() });
    return;
  }
  const db = getDb();
  const deviceId = req.device!.device_id;
  const stmt = db.prepare('INSERT INTO purge_log (device_id, client_uuid) VALUES (?, ?)');
  runInTransaction(() => {
    for (const id of parsed.data.clientUuids) stmt.run(deviceId, id);
  });
  res.json({ purged: parsed.data.clientUuids.length });
});

export default router;
