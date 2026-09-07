import { Router } from 'express';
import type { SQLInputValue } from 'node:sqlite';
import { z } from 'zod';
import { getDb } from '../db';
import { requireAuth } from '../auth/middleware';
import type { AttendanceRow } from '../types';

const router = Router();

const querySchema = z.object({
  employeeId: z.string().optional(),
  deviceId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

function serialize(row: AttendanceRow & { employeeName?: string; profileImage?: string }) {
  return {
    clientUuid: row.client_uuid,
    employeeId: row.employee_id,
    employeeName: row.employeeName,
    profileImage: row.profileImage,
    deviceId: row.device_id,
    capturedAt: row.captured_at,
    latitude: row.latitude,
    longitude: row.longitude,
    livenessPassed: row.liveness_passed === 1,
    livenessMethod: row.liveness_method,
    matchScore: row.match_score,
    receivedAt: row.received_at,
  };
}

/** Reporting: list attendance records with optional filters. */
router.get('/', requireAuth(), (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation', details: parsed.error.flatten() });
    return;
  }
  const { employeeId, deviceId, from, to, limit } = parsed.data;

  const clauses: string[] = [];
  const params: SQLInputValue[] = [];
  
  if (req.user?.role === 'field') {
    clauses.push('a.employee_id = ?');
    params.push(req.user.sub);
  } else if (employeeId) {
    clauses.push('a.employee_id = ?');
    params.push(employeeId);
  }
  if (deviceId) {
    clauses.push('a.device_id = ?');
    params.push(deviceId);
  }
  if (from) {
    clauses.push('a.captured_at >= ?');
    params.push(from);
  }
  if (to) {
    clauses.push('a.captured_at <= ?');
    params.push(to);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  params.push(limit ?? 100);

  const db = getDb();
  const rows = db
    .prepare(`
      SELECT a.*, u.name AS employeeName, u.profile_image AS profileImage
      FROM attendance a 
      JOIN users u ON a.employee_id = u.employee_id 
      ${where} 
      ORDER BY a.captured_at DESC 
      LIMIT ?
    `)
    .all(...params) as unknown as (AttendanceRow & { employeeName?: string; profileImage?: string })[];

  res.json({ count: rows.length, records: rows.map(serialize) });
});

/** Summary stats for a quick dashboard view. */
router.get('/stats', requireAuth(), (req, res) => {
  const db = getDb();
  let where = '';
  const params: SQLInputValue[] = [];
  if (req.user?.role === 'field') {
    where = 'WHERE employee_id = ?';
    params.push(req.user.sub);
  }

  const total = (db.prepare(`SELECT COUNT(*) AS c FROM attendance ${where}`).get(...params) as { c: number }).c;
  
  const livenessWhere = where ? `${where} AND liveness_passed = 1` : 'WHERE liveness_passed = 1';
  const liveness = (
    db.prepare(`SELECT COUNT(*) AS c FROM attendance ${livenessWhere}`).get(...params) as { c: number }
  ).c;
  
  const employees = (
    db.prepare(`SELECT COUNT(DISTINCT employee_id) AS c FROM attendance ${where}`).get(...params) as { c: number }
  ).c;
  res.json({
    totalRecords: total,
    livenessPassed: liveness,
    distinctEmployees: employees,
  });
});

export default router;
