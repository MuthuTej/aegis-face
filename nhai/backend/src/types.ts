import type { JwtPayload } from './auth/jwt';

export type Role = 'admin' | 'operator' | 'field';

export interface UserRow {
  id: number;
  employee_id: string;
  name: string;
  profile_image: string | null;
  password_hash: string | null;
  role: Role;
  active: number;
  created_at: string;
}

export interface DeviceRow {
  id: number;
  device_id: string;
  name: string;
  api_key_hash: string;
  active: number;
  created_at: string;
  last_seen_at: string | null;
}

export interface EnrollmentRow {
  id: number;
  employee_id: string;
  embedding: string;
  model_version: string;
  updated_at: string;
}

export interface AttendanceRow {
  id: number;
  client_uuid: string;
  employee_id: string;
  device_id: string;
  captured_at: string;
  latitude: number | null;
  longitude: number | null;
  liveness_passed: number;
  liveness_method: string | null;
  match_score: number | null;
  received_at: string;
}

// Augment Express's Request so handlers can read the authenticated principal.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
      device?: { device_id: string; name: string };
    }
  }
}
