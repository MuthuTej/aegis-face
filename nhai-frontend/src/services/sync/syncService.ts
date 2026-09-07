/**
 * syncService — Offline-to-online sync + purge orchestration
 *
 * Thin orchestration layer over the existing offlineQueue.ts.
 * Adds:
 *   - VerificationLog bridging (faceStorage ↔ offlineQueue)
 *   - Simulated upload for hackathon demo (no real AWS endpoint needed)
 *   - Purge of local biometric data post-sync
 *
 * Architecture for production:
 *   faceStorage (local logs) → queueRecord → offlineQueue (AWS retry queue)
 *   → syncNow → AWS NHAI Datalake 3.0 endpoint → purgeLocalData
 */

import type { VerificationResult } from '@/types';
import {
  enqueue,
  getQueue,
  syncPendingItems,
  clearQueue,
} from '@/lib/sync/offlineQueue';
import {
  getUnsyncedLogs,
  markLogsSynced,
  clearVerificationLogs,
} from '@storage/faceStorage';
import type { VerificationLog } from '@storage/faceStorage';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SyncStatus {
  pending: number;
  lastSyncAt: number | null;
  isSimulatedSync: boolean;
}

export interface SyncResult {
  synced: number;
  failed: number;
  purged: boolean;
  durationMs: number;
}

// ─── Module State ─────────────────────────────────────────────────────────────

let lastSyncAt: number | null = null;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Queue a verification log for eventual sync.
 * Bridges faceStorage.VerificationLog → offlineQueue.VerificationResult format.
 */
export async function queueRecord(log: VerificationLog): Promise<void> {
  const result: VerificationResult = {
    id: log.id,
    status: log.success ? 'success' : 'failed',
    confidence: log.confidence,
    livenessScore: log.livenessPassed ? 1.0 : 0.0,
    latencyMs: log.latencyMs,
    timestamp: log.timestamp,
    userId: log.userId,
    environment: 'indoor',
    deviceId: 'device',
    synced: false,
  };
  await enqueue(result);
}

/**
 * Sync all pending records.
 *
 * If an AWS endpoint is provided, uses the real syncPendingItems mechanism.
 * If no endpoint (or offline), simulates an upload (logs to console) then
 * marks all records as synced — demonstrating the architecture for the hackathon.
 *
 * @param endpoint — AWS API Gateway URL (optional). Omit to use simulated sync.
 * @param purgeAfterSync — If true, clears local verification logs after successful sync.
 */
export async function syncNow(
  endpoint?: string,
  purgeAfterSync = false
): Promise<SyncResult> {
  const start = Date.now();

  if (endpoint) {
    // Real sync to AWS
    const { synced, failed } = await syncPendingItems(endpoint);
    lastSyncAt = Date.now();

    let purged = false;
    if (purgeAfterSync && synced > 0 && failed === 0) {
      await purgeLocalData();
      purged = true;
    }

    return { synced, failed, purged, durationMs: Date.now() - start };
  }

  // Simulated sync — mark all unsynced faceStorage logs as synced
  const unsyncedLogs = await getUnsyncedLogs();
  const ids = unsyncedLogs.map((l) => l.id);

  if (ids.length === 0) {
    return { synced: 0, failed: 0, purged: false, durationMs: Date.now() - start };
  }

  // Simulate network latency
  await new Promise<void>((resolve) => setTimeout(resolve, 300 + ids.length * 50));

  await markLogsSynced(ids);
  await clearQueue(); // also clear the offline queue

  console.log(`[SyncService] Simulated sync: uploaded ${ids.length} verification record(s)`);
  lastSyncAt = Date.now();

  let purged = false;
  if (purgeAfterSync) {
    await purgeLocalData();
    purged = true;
  }

  return {
    synced: ids.length,
    failed: 0,
    purged,
    durationMs: Date.now() - start,
  };
}

/**
 * Purge all local verification logs and offline queue.
 * Call after a confirmed successful sync to free device storage.
 * Does NOT delete enrolled face embeddings (those are retained).
 */
export async function purgeLocalData(): Promise<void> {
  await clearVerificationLogs();
  await clearQueue();
  console.log('[SyncService] Local verification data purged');
}

/**
 * Get current sync queue status.
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const queue = await getQueue();
  return {
    pending: queue.length,
    lastSyncAt,
    isSimulatedSync: true, // flip to false when real endpoint is configured
  };
}
