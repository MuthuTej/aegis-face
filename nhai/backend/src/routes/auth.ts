import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '../db';
import { config } from '../config';
import { signToken, verifyToken } from '../auth/jwt';
import { requireAuth } from '../auth/middleware';
import type { UserRow } from '../types';
import fs from 'fs';
import path from 'path';

const router = Router();

const registerSchema = z.object({
  employeeId: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  password: z.string().min(8).max(128).optional(),
  role: z.enum(['admin', 'operator', 'field']).optional(),
  profileImage: z.string().optional(), // base64 string
});

const loginSchema = z.object({
  employeeId: z.string().min(1),
  password: z.string().min(1),
});

/**
 * Register a user. Bootstrap rule: if the users table is empty, the first
 * registration is allowed without a token and is forced to 'admin'. After
 * that, only an admin JWT may create users.
 */
router.post('/register', (req, res) => {
  const db = getDb();
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation', details: parsed.error.flatten() });
    return;
  }

  const userCount = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
  let role = parsed.data.role ?? 'field';

  if (userCount === 0) {
    role = 'admin'; // bootstrap the very first account as admin
  } else {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      res.status(401).json({ error: 'missing_token' });
      return;
    }
    try {
      const payload = verifyToken(header.slice(7));
      if (payload.role !== 'admin') {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
    } catch {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }
  }

  const passwordHash = parsed.data.password
    ? bcrypt.hashSync(parsed.data.password, config.bcryptRounds)
    : null;

  let profileImageUrl: string | null = null;
  if (parsed.data.profileImage) {
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      // Remove data URI prefix if present
      const base64Data = parsed.data.profileImage.replace(/^data:image\/\w+;base64,/, '');
      const filename = `${parsed.data.employeeId}_${Date.now()}.jpg`;
      const filepath = path.join(uploadsDir, filename);
      fs.writeFileSync(filepath, base64Data, 'base64');
      profileImageUrl = `/uploads/${filename}`;
    } catch (err) {
      console.error('Failed to save profile image', err);
    }
  }

  try {
    const info = db
      .prepare('INSERT INTO users (employee_id, name, password_hash, role, profile_image) VALUES (?, ?, ?, ?, ?)')
      .run(parsed.data.employeeId, parsed.data.name, passwordHash, role, profileImageUrl);
    res.status(201).json({
      id: info.lastInsertRowid,
      employeeId: parsed.data.employeeId,
      name: parsed.data.name,
      role,
      profileImage: profileImageUrl,
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'employee_exists' });
      return;
    }
    throw e;
  }
});

router.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation', details: parsed.error.flatten() });
    return;
  }
  const db = getDb();
  const user = db
    .prepare('SELECT * FROM users WHERE employee_id = ? AND active = 1')
    .get(parsed.data.employeeId) as UserRow | undefined;

  if (!user || !user.password_hash || !bcrypt.compareSync(parsed.data.password, user.password_hash)) {
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }

  const token = signToken({ sub: user.employee_id, role: user.role, name: user.name });
  res.json({
    token,
    user: { employeeId: user.employee_id, name: user.name, role: user.role, profileImage: user.profile_image },
  });
});

router.get('/users', requireAuth(['admin']), (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, employee_id, name, role, active, created_at, profile_image FROM users ORDER BY name ASC').all();
  res.json(users);
});

router.get('/me', requireAuth(), (req, res) => {
  res.json({ user: req.user });
});

export default router;
