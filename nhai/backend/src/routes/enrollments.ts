import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db';
import { config } from '../config';
import { requireAuth } from '../auth/middleware';
import type { EnrollmentRow } from '../types';

const router = Router();

// We store the embedding produced by the on-device AI model. We never compute
// it here — we validate its shape and persist it as JSON.
const embeddingSchema = z
  .array(z.number().finite())
  .min(config.embedding.minLength)
  .max(config.embedding.maxLength);

const upsertSchema = z.object({
  embedding: embeddingSchema,
  modelVersion: z.string().min(1).max(64),
});

function serialize(row: EnrollmentRow) {
  return {
    employeeId: row.employee_id,
    embedding: JSON.parse(row.embedding) as number[],
    modelVersion: row.model_version,
    updatedAt: row.updated_at,
  };
}

/** Create or replace an employee's enrollment template. */
router.put('/:employeeId', requireAuth(['admin', 'operator']), (req, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation', details: parsed.error.flatten() });
    return;
  }
  const db = getDb();
  db.prepare(
    `INSERT INTO enrollments (employee_id, embedding, model_version, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(employee_id) DO UPDATE SET
       embedding = excluded.embedding,
       model_version = excluded.model_version,
       updated_at = datetime('now')`,
  ).run(req.params.employeeId, JSON.stringify(parsed.data.embedding), parsed.data.modelVersion);

  res.status(200).json({ employeeId: req.params.employeeId, modelVersion: parsed.data.modelVersion });
});

router.get('/:employeeId', requireAuth(['admin', 'operator']), (req, res) => {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM enrollments WHERE employee_id = ?')
    .get(req.params.employeeId) as EnrollmentRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'enrollment_not_found' });
    return;
  }
  res.json(serialize(row));
});

router.delete('/:employeeId', requireAuth(['admin', 'operator']), (req, res) => {
  const db = getDb();
  const info = db.prepare('DELETE FROM enrollments WHERE employee_id = ?').run(req.params.employeeId);
  if (info.changes === 0) {
    res.status(404).json({ error: 'enrollment_not_found' });
    return;
  }
  res.json({ employeeId: req.params.employeeId, deleted: true });
});

router.get('/', requireAuth(['admin', 'operator']), (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare('SELECT employee_id, model_version, updated_at FROM enrollments ORDER BY updated_at DESC')
    .all() as Pick<EnrollmentRow, 'employee_id' | 'model_version' | 'updated_at'>[];
  res.json({
    enrollments: rows.map((r) => ({
      employeeId: r.employee_id,
      modelVersion: r.model_version,
      updatedAt: r.updated_at,
    })),
  });
});

export default router;
