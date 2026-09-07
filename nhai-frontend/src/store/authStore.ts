import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setGlobalToken } from '@/services/api/adminApi';

const ADMIN_ID   = 'admin';
const ADMIN_PASS = 'Admin@1234';

interface AuthState {
  token:        string | null;
  employeeId:   string | null;
  employeeName: string | null;
  site:         string | null;
  role:         string | null;

  login:    (endpoint: string, employeeId: string, password: string) => Promise<void>;
  register: (endpoint: string, employeeId: string, name: string, site: string, password: string) => Promise<void>;
  logout:   () => void;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function apiPost(url: string, body: object, token?: string): Promise<Response> {
  const ctrl  = new AbortController();
  // 35 s — long enough for a Railway cold start (server wakes in 10–60 s)
  const timer = setTimeout(() => ctrl.abort(), 35_000);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      throw new Error('Connection timed out — server may be starting up. Try again in a moment.');
    }
    if (e instanceof TypeError) {
      throw new Error('No network connection. Check your internet and the server URL in Settings.');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function extractError(res: Response, fallback: string): Promise<string> {
  const text = await res.text().catch(() => '');
  try {
    const j = JSON.parse(text) as { message?: string; error?: string };
    return j.message ?? j.error ?? fallback;
  } catch {
    return text || fallback;
  }
}

// ─── store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token:        null,
      employeeId:   null,
      employeeName: null,
      site:         null,
      role:         null,

      // ── Sign In ──────────────────────────────────────────────────────────
      login: async (endpoint, employeeId, password) => {
        const base = endpoint.replace(/\/$/, '');
        const res  = await apiPost(`${base}/api/v1/auth/login`, { employeeId, password });

        if (!res.ok) {
          throw new Error(await extractError(res, `Login failed (${res.status})`));
        }

        const json = (await res.json()) as {
          token?: string;
          user?:  { employeeId?: string; name?: string; role?: string };
        };
        if (!json.token) throw new Error('Server did not return a token.');

        const role = json.user?.role ?? null;
        // Only push token into adminApi when the user is admin.
        // Field users would get 403 on admin-only endpoints; let adminApi
        // fall back to its own admin auto-login instead.
        if (role === 'admin') setGlobalToken(json.token);

        set({
          token:        json.token,
          employeeId:   json.user?.employeeId ?? employeeId,
          employeeName: json.user?.name ?? null,
          role,
          site:         null,
        });
      },

      // ── Sign Up ──────────────────────────────────────────────────────────
      register: async (endpoint, employeeId, name, site, password) => {
        const base = endpoint.replace(/\/$/, '');

        // 1. Obtain admin token to authorise registration
        const adminRes = await apiPost(`${base}/api/v1/auth/login`, {
          employeeId: ADMIN_ID,
          password:   ADMIN_PASS,
        });
        if (!adminRes.ok) {
          throw new Error('Cannot reach server. Check your connection and server URL in Settings.');
        }
        const { token: adminToken } = (await adminRes.json()) as { token?: string };
        if (!adminToken) throw new Error('Admin authentication failed.');

        // 2. Register the new employee
        const regRes = await apiPost(
          `${base}/api/v1/auth/register`,
          { employeeId, name, password, site },
          adminToken,
        );
        if (!regRes.ok) {
          const msg = await extractError(regRes, `Registration failed (${regRes.status})`);
          if (regRes.status === 409) throw new Error('Employee ID already exists. Choose a different ID.');
          throw new Error(msg);
        }

        // 3. Auto-login as the newly created user
        const loginRes = await apiPost(`${base}/api/v1/auth/login`, { employeeId, password });
        if (!loginRes.ok) {
          // Account created but login failed — still treat as success; user will hit Sign In
          throw new Error('Account created! Please sign in with your new credentials.');
        }

        const json = (await loginRes.json()) as {
          token?: string;
          user?:  { employeeId?: string; name?: string; role?: string };
        };
        if (!json.token) throw new Error('Account created! Please sign in with your new credentials.');

        const newRole = json.user?.role ?? 'field';
        if (newRole === 'admin') setGlobalToken(json.token);

        set({
          token:        json.token,
          employeeId:   json.user?.employeeId ?? employeeId,
          employeeName: json.user?.name ?? name,
          role:         newRole,
          site,
        });
      },

      // ── Sign Out ─────────────────────────────────────────────────────────
      logout: () => {
        setGlobalToken(null);
        set({ token: null, employeeId: null, employeeName: null, site: null, role: null });
      },
    }),
    {
      name:    'aegis-auth',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        // Only admin tokens work on admin-only endpoints.
        // Field-user tokens would cause 403; let adminApi auto-login instead.
        if (state?.token && state.role === 'admin') setGlobalToken(state.token);
      },
    }
  )
);
