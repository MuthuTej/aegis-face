/**
 * backendSync — Sends verification attendance records to the NHAI backend.
 *
 * API: POST /api/v1/sync/attendance
 * Auth: X-Device-Id + X-Api-Key headers (device credentials)
 *
 * Records are queued locally (AsyncStorage) and flushed when online.
 * Idempotent: re-sending the same clientUuid is treated as a duplicate, not an error.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'aegis:sync_queue_v1';

export interface AttendanceRecord {
  clientUuid: string;
  employeeId: string;
  capturedAt: string;
  latitude?: number;
  longitude?: number;
  livenessPassed: boolean;
  livenessMethod?: 'blink' | 'smile' | 'turn' | 'multi';
  matchScore?: number;
}

export interface SyncConfig {
  endpoint: string;   // e.g. http://192.168.1.100:4000
  deviceId: string;
  apiKey: string;
}

// ─── Queue management ─────────────────────────────────────────────────────────

async function loadQueue(): Promise<AttendanceRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as AttendanceRecord[]) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: AttendanceRecord[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueueAttendance(record: AttendanceRecord): Promise<void> {
  const queue = await loadQueue();
  // Avoid duplicates
  if (!queue.find((r) => r.clientUuid === record.clientUuid)) {
    queue.push(record);
    await saveQueue(queue);
  }
  console.log(`[BackendSync] Queued record ${record.clientUuid}, queue size: ${queue.length}`);
}

export async function getPendingCount(): Promise<number> {
  const queue = await loadQueue();
  return queue.length;
}

// ─── Sync ────────────────────────────────────────────────────────────────────

export async function syncToBackend(config: SyncConfig): Promise<{ synced: number; failed: number }> {
  const queue = await loadQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  // Connectivity check — ngrok-skip-browser-warning bypasses ngrok's splash page
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const ping = await fetch(`${config.endpoint.replace(/\/$/, '')}/api/v1/health`, {
      method: 'GET',
      headers: { 'ngrok-skip-browser-warning': '1' },
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t));
    if (!ping.ok) throw new Error(`status ${ping.status}`);
    console.log('[BackendSync] Online — proceeding with sync');
  } catch (e) {
    console.log('[BackendSync] Offline or unreachable:', e);
    return { synced: 0, failed: 0 };
  }

  const url = `${config.endpoint.replace(/\/$/, '')}/api/v1/sync/attendance`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': config.deviceId,
        'x-api-key': config.apiKey,
        'ngrok-skip-browser-warning': '1',
      },
      body: JSON.stringify({ records: queue }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[BackendSync] HTTP ${res.status}: ${body}`);
      return { synced: 0, failed: queue.length };
    }

    const data = await res.json() as { purgeable?: string[]; accepted?: string[]; rejected?: { clientUuid: string }[] };
    const purgeable = data.purgeable ?? [];

    // Remove synced records from queue
    const remaining = queue.filter((r) => !purgeable.includes(r.clientUuid));
    await saveQueue(remaining);

    const synced = purgeable.length;
    const failed = (data.rejected ?? []).length;
    console.log(`[BackendSync] Synced ${synced} records, ${remaining.length} still pending, ${failed} rejected`);
    return { synced, failed };
  } catch (e) {
    console.error('[BackendSync] Sync failed:', e);
    return { synced: 0, failed: queue.length };
  }
}
