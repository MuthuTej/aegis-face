/**
 * Offline Sync Queue
 *
 * Stores pending verification results in AsyncStorage and syncs them
 * to NHAI Datalake 3.0 when connectivity is restored.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VerificationResult } from '@/types';

const QUEUE_KEY = '@aegis/sync_queue';
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 2000;

export interface SyncQueueItem {
  id: string;
  result: VerificationResult;
  enqueuedAt: number;
  retryCount: number;
  nextRetryAt: number;
  hmacSignature?: string;
}

// ─── Queue Management ─────────────────────────────────────────────────────────

export async function enqueue(result: VerificationResult): Promise<void> {
  const queue = await getQueue();
  const item: SyncQueueItem = {
    id: result.id,
    result,
    enqueuedAt: Date.now(),
    retryCount: 0,
    nextRetryAt: Date.now(),
  };
  queue.push(item);
  await saveQueue(queue);
}

export async function dequeue(id: string): Promise<void> {
  const queue = (await getQueue()).filter((item) => item.id !== id);
  await saveQueue(queue);
}

export async function getQueue(): Promise<SyncQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as SyncQueueItem[]) : [];
  } catch {
    return [];
  }
}

export async function getPendingItems(): Promise<SyncQueueItem[]> {
  const now = Date.now();
  return (await getQueue()).filter((item) => item.nextRetryAt <= now);
}

export async function markRetry(id: string): Promise<void> {
  const queue = (await getQueue()).map((item) => {
    if (item.id !== id) return item;
    const retryCount = item.retryCount + 1;
    return { ...item, retryCount, nextRetryAt: Date.now() + BASE_BACKOFF_MS * 2 ** retryCount };
  });
  await saveQueue(queue);
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

// ─── Sync Executor ────────────────────────────────────────────────────────────

export async function syncPendingItems(
  endpoint: string,
  onProgress?: (synced: number, total: number) => void
): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingItems();
  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      await sendVerificationResult(endpoint, item);
      await dequeue(item.id);
      synced++;
      onProgress?.(synced, pending.length);
    } catch (err) {
      console.warn('[SyncQueue] Failed to sync item:', item.id, err);
      if (item.retryCount >= MAX_RETRIES) {
        await dequeue(item.id);
      } else {
        await markRetry(item.id);
      }
      failed++;
    }
  }

  return { synced, failed };
}

// ─── Private ─────────────────────────────────────────────────────────────────

async function saveQueue(queue: SyncQueueItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

async function sendVerificationResult(
  _endpoint: string,
  item: SyncQueueItem
): Promise<void> {
  // PLUG-IN: replace with authenticated AWS API call
  await new Promise<void>((resolve) => setTimeout(resolve, 200));
  console.log(`[SyncQueue] Stub-synced item ${item.id}`);
}
