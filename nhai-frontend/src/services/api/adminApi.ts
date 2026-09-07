/**
 * adminApi — Fetches attendance & device records from the NHAI backend.
 *
 * Auth flow:
 *   - After login the authStore calls setGlobalToken(jwt) so all calls use the user token.
 *   - On 401 the module falls back to admin re-login and retries once.
 *
 * Timeouts: 20 s for auth, 40 s for data (Railway cold-start can take 30–60 s).
 */

const ADMIN_ID   = 'admin';
const ADMIN_PASS = 'Admin@1234';

export interface BackendAttendanceRecord {
  clientUuid:    string;
  employeeId:    string;
  deviceId?:     string;
  capturedAt:    string;
  receivedAt?:   string;
  latitude?:     number;
  longitude?:    number;
  livenessPassed: boolean;
  livenessMethod?: string;
  matchScore?:   number;
}

export interface BackendDevice {
  device_id:    string;
  name?:        string;
  active?:      number | boolean;
  created_at?:  string;
  last_seen_at?: string;
}

// ─── Token cache ──────────────────────────────────────────────────────────────

let _token:        string | null = null;
let _tokenPromise: Promise<string> | null = null;

/**
 * Called by authStore after login or on store rehydration so that all
 * subsequent API calls use the user's JWT without triggering admin auto-login.
 */
export function setGlobalToken(token: string | null): void {
  _token        = token;
  _tokenPromise = null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, clear: () => clearTimeout(timer) };
}

async function parseError(res: Response, fallback: string): Promise<string> {
  const text = await res.text().catch(() => '');
  try {
    const j = JSON.parse(text) as { message?: string; error?: string };
    return j.message ?? j.error ?? fallback;
  } catch {
    return text || fallback;
  }
}

// ─── Admin auto-login (fallback) ──────────────────────────────────────────────

async function adminLogin(base: string): Promise<string> {
  const { signal, clear } = withTimeout(20_000);
  try {
    const res = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: ADMIN_ID, password: ADMIN_PASS }),
      signal,
    });
    if (!res.ok) throw new Error(await parseError(res, `Admin login failed (${res.status})`));
    const json = (await res.json()) as { token?: string };
    if (!json.token) throw new Error('No token in admin login response');
    return json.token;
  } finally {
    clear();
  }
}

function acquireToken(base: string, forceRefresh = false): Promise<string> {
  if (!forceRefresh && _token) return Promise.resolve(_token);
  if (!_tokenPromise) {
    _tokenPromise = adminLogin(base)
      .then((t) => { _token = t; _tokenPromise = null; return t; })
      .catch((e) => { _tokenPromise = null; throw e; });
  }
  return _tokenPromise;
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function apiFetch(base: string, path: string, retried = false): Promise<unknown> {
  const token = await acquireToken(base, retried);
  const { signal, clear } = withTimeout(40_000);   // 40 s — enough for cold start

  try {
    const res = await fetch(`${base}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });

    // 401 = token expired/invalid, 403 = field user token (no admin role)
    // Both cases: clear the token and retry with admin auto-login.
    if ((res.status === 401 || res.status === 403) && !retried) {
      _token = null;
      return apiFetch(base, path, true);
    }

    if (!res.ok) {
      const msg = await parseError(res, `HTTP ${res.status}`);
      throw new Error(msg);
    }

    return res.json();
  } catch (e) {
    // Give callers a clearer picture
    if ((e as Error)?.name === 'AbortError') {
      throw new Error('Request timed out — server may be starting up. Please retry in a moment.');
    }
    if (e instanceof TypeError && (e.message.includes('Network') || e.message.includes('network'))) {
      throw new Error('No network connection. Check your internet and try again.');
    }
    throw e;
  } finally {
    clear();
  }
}

function toArray<T>(data: unknown, ...keys: string[]): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    for (const k of keys) {
      const v = (data as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v as T[];
    }
  }
  return [];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchAttendance(
  endpoint: string,
  successOnly?: boolean,
): Promise<BackendAttendanceRecord[]> {
  const base = endpoint.replace(/\/$/, '');
  const path = `/api/v1/attendance${successOnly ? '?success=true' : ''}`;
  const data = await apiFetch(base, path);
  return toArray<BackendAttendanceRecord>(data, 'records', 'attendance', 'data');
}

export async function fetchDevices(endpoint: string): Promise<BackendDevice[]> {
  const base = endpoint.replace(/\/$/, '');
  const data = await apiFetch(base, '/api/v1/devices');
  return toArray<BackendDevice>(data, 'devices', 'data');
}

export async function pingBackend(endpoint: string): Promise<{ ok: boolean; ms: number }> {
  const base  = endpoint.replace(/\/$/, '');
  const start = Date.now();
  const { signal, clear } = withTimeout(40_000);
  try {
    const res = await fetch(`${base}/api/v1/health`, { signal });
    return { ok: res.ok, ms: Date.now() - start };
  } catch {
    return { ok: false, ms: Date.now() - start };
  } finally {
    clear();
  }
}
