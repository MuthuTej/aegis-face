import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDb } from '../db';
import { config } from '../config';

/**
 * Dev/demo seed: creates an admin account and a demo field device.
 * Run with: npm run seed
 */
const db = getDb();

const adminId = 'ADMIN001';
const adminPassword = 'admin1234';
const existingAdmin = db.prepare('SELECT 1 FROM users WHERE employee_id = ?').get(adminId);
if (!existingAdmin) {
  db.prepare('INSERT INTO users (employee_id, name, password_hash, role) VALUES (?, ?, ?, ?)').run(
    adminId,
    'System Admin',
    bcrypt.hashSync(adminPassword, config.bcryptRounds),
    'admin',
  );
  console.log(`Created admin -> employeeId: ${adminId}  password: ${adminPassword}`);
} else {
  console.log(`Admin ${adminId} already exists`);
}

const deviceId = 'FIELD-DEVICE-01';
const apiKey = crypto.randomBytes(24).toString('hex');
db.prepare(
  `INSERT INTO devices (device_id, name, api_key_hash)
   VALUES (?, ?, ?)
   ON CONFLICT(device_id) DO UPDATE SET api_key_hash = excluded.api_key_hash, active = 1`,
).run(deviceId, 'Demo Field Device', bcrypt.hashSync(apiKey, config.bcryptRounds));
console.log(`Device -> deviceId: ${deviceId}  apiKey: ${apiKey}`);
console.log('Seed complete.');
process.exit(0);
