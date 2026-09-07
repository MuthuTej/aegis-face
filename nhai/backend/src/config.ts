import path from 'path';

/**
 * Central configuration, sourced from environment variables with safe dev
 * defaults. Read once at import time.
 */
export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  env: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
  dbPath: process.env.DB_PATH || path.join(process.cwd(), 'data', 'datalake.db'),
  // Re-create demo employees + attendance history on boot. Intended for
  // ephemeral hosting (e.g. Render free tier) where the DB is wiped on every
  // restart. Off unless explicitly enabled.
  seedDemoData: process.env.SEED_DEMO_DATA === 'true',
  embedding: {
    // A face embedding is a fixed-length numeric vector. We don't run the AI
    // model here — we only validate and store what the device sends.
    minLength: 64,
    maxLength: 1024,
  },
  sync: {
    maxBatchSize: 500,
  },
};
