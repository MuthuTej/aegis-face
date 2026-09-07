/**
 * startup.ts — Auto-seeds admin user and device on first run.
 * Safe to run on every start (idempotent).
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDb, runInTransaction } from './db';
import { config } from './config';

export function seedIfEmpty() {
  const db = getDb();

  // Create admin user if none exists
  const userCount = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
  if (userCount === 0) {
    const hash = bcrypt.hashSync('Admin@1234', 10);
    db.prepare('INSERT INTO users (employee_id, name, password_hash, role) VALUES (?, ?, ?, ?)').run(
      'admin', 'NHAI Admin', hash, 'admin'
    );
    console.log('[Startup] Created admin user (employeeId: admin, password: Admin@1234)');
  }

  // Create device if none exists
  const deviceCount = (db.prepare('SELECT COUNT(*) AS c FROM devices').get() as { c: number }).c;
  if (deviceCount === 0) {
    const apiKey = 'aegis-hackathon-key-nhai2025';
    const hash = bcrypt.hashSync(apiKey, 10);
    db.prepare('INSERT INTO devices (device_id, name, api_key_hash) VALUES (?, ?, ?)').run(
      'aegis-nhai-001', 'NHAI Aegis Mobile', hash
    );
    console.log('[Startup] Created device: aegis-nhai-001, API key: aegis-hackathon-key-nhai2025');
  }
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_PASSWORD = 'Demo@1234';
const DEMO_DEVICE_ID = 'aegis-nhai-001';

const DEMO_EMPLOYEES = [
  { employeeId: 'EMP001', name: 'Ravi Kumar',   lat: 17.3850, lng: 78.4867 },
  { employeeId: 'EMP002', name: 'Priya Sharma', lat: 17.4123, lng: 78.5012 },
  { employeeId: 'EMP003', name: 'Anand Verma',  lat: 17.3612, lng: 78.4744 },
  { employeeId: 'EMP004', name: 'Meena Iyer',   lat: 17.4401, lng: 78.5289 },
  { employeeId: 'EMP005', name: 'Suresh Reddy', lat: 17.3298, lng: 78.4531 },
];

const DEMO_DAYS = 5;
const LIVENESS_METHODS = ['blink', 'turn', 'smile', 'multi'] as const;

/**
 * Recreates a small set of demo employees and their recent attendance history.
 *
 * On ephemeral hosting the SQLite file is wiped on every restart and deploy,
 * which would otherwise leave the app with nothing but the admin account and
 * empty dashboard/history screens. This makes a wipe cheap: the demo set
 * reappears automatically on the next boot.
 *
 * Idempotent — safe to run on every start. Gated behind SEED_DEMO_DATA so it
 * never pollutes a deployment backed by a persistent disk.
 *
 * Deliberately does NOT seed the `enrollments` table: a fabricated face
 * embedding would mark an employee as enrolled while never matching their
 * real face, which is worse than showing them as un-enrolled.
 */
export function seedDemoData(): void {
  if (!config.seedDemoData) return;

  const db = getDb();

  const insertUser = db.prepare(
    `INSERT INTO users (employee_id, name, password_hash, role)
     VALUES (?, ?, ?, 'field')
     ON CONFLICT(employee_id) DO NOTHING`
  );
  const insertAttendance = db.prepare(
    `INSERT INTO attendance
       (client_uuid, employee_id, device_id, captured_at, latitude, longitude,
        liveness_passed, liveness_method, match_score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(client_uuid) DO NOTHING`
  );

  // bcrypt is the expensive part, so only hash when at least one is missing.
  const existing = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM users WHERE employee_id IN (${DEMO_EMPLOYEES.map(() => '?').join(',')})`
      )
      .get(...DEMO_EMPLOYEES.map((e) => e.employeeId)) as { c: number }
  ).c;

  runInTransaction(() => {
    if (existing < DEMO_EMPLOYEES.length) {
      const hash = bcrypt.hashSync(DEMO_PASSWORD, config.bcryptRounds);
      for (const emp of DEMO_EMPLOYEES) {
        insertUser.run(emp.employeeId, emp.name, hash);
      }
    }

    // One check-in per employee per day for the last DEMO_DAYS days, at ~09:15.
    // client_uuid is deterministic so re-running never duplicates rows.
    for (const [i, emp] of DEMO_EMPLOYEES.entries()) {
      for (let day = 0; day < DEMO_DAYS; day++) {
        // Stagger absences so the data doesn't look uniform.
        if ((i + day) % 7 === 3) continue;

        const capturedAt = new Date();
        capturedAt.setDate(capturedAt.getDate() - day);
        capturedAt.setHours(9, 15 + ((i * 7 + day * 3) % 30), 0, 0);

        // One failed liveness check in the set, so the stats aren't all-green.
        // Must avoid i + day === 3, which the absence rule above skips.
        const livenessPassed = i === 3 && day === 1 ? 0 : 1;

        insertAttendance.run(
          `demo-${emp.employeeId}-${day}`,
          emp.employeeId,
          DEMO_DEVICE_ID,
          capturedAt.toISOString(),
          emp.lat + (day * 0.0004),
          emp.lng - (day * 0.0003),
          livenessPassed,
          LIVENESS_METHODS[(i + day) % LIVENESS_METHODS.length],
          livenessPassed ? Number((0.82 + ((i + day) % 5) * 0.03).toFixed(2)) : 0.61,
        );
      }
    }
  });

  console.log(
    `[Startup] Demo data ready: ${DEMO_EMPLOYEES.length} employees ` +
      `(password: ${DEMO_PASSWORD}), ~${DEMO_DAYS} days of attendance`
  );
}
