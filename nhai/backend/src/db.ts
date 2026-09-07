import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { config } from './config';

let db: DatabaseSync | undefined;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id   TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  profile_image TEXT,
  password_hash TEXT,
  role          TEXT NOT NULL DEFAULT 'field' CHECK (role IN ('admin','operator','field')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS devices (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id     TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  api_key_hash  TEXT NOT NULL,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at  TEXT
);

CREATE TABLE IF NOT EXISTS enrollments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id   TEXT NOT NULL UNIQUE,
  embedding     TEXT NOT NULL,
  model_version TEXT NOT NULL,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attendance (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  client_uuid     TEXT NOT NULL UNIQUE,
  employee_id     TEXT NOT NULL,
  device_id       TEXT NOT NULL,
  captured_at     TEXT NOT NULL,
  latitude        REAL,
  longitude       REAL,
  liveness_passed INTEGER NOT NULL DEFAULT 0,
  liveness_method TEXT,
  match_score     REAL,
  received_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purge_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id    TEXT NOT NULL,
  client_uuid  TEXT NOT NULL,
  confirmed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_received ON attendance(received_at);
CREATE INDEX IF NOT EXISTS idx_enrollments_updated ON enrollments(updated_at);
`;

export function getDb(): DatabaseSync {
  if (!db) {
    if (config.dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
    }
    db = new DatabaseSync(config.dbPath);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec(SCHEMA);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = undefined;
  }
}

/**
 * node:sqlite has no `db.transaction()` helper (unlike better-sqlite3), so we
 * wrap a unit of work in BEGIN/COMMIT with ROLLBACK on failure.
 */
export function runInTransaction<T>(fn: () => T): T {
  const d = getDb();
  d.exec('BEGIN');
  try {
    const result = fn();
    d.exec('COMMIT');
    return result;
  } catch (e) {
    d.exec('ROLLBACK');
    throw e;
  }
}
