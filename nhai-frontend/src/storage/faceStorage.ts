/**
 * faceStorage — Persistent biometric data store
 *
 * Uses react-native-mmkv when available (synchronous, 10× faster than AsyncStorage).
 * Falls back to AsyncStorage automatically in Expo Go / environments without native build.
 *
 * All writes are fire-and-forget in MMKV mode (sync). The async interface is kept
 * consistent so callers don't need to know which backend is active.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── MMKV Optional Import ─────────────────────────────────────────────────────

interface MMKVStorage {
  set(key: string, value: string): void;
  getString(key: string): string | undefined;
  delete(key: string): void;
  getAllKeys(): string[];
}

let mmkv: MMKVStorage | null = null;

// Lazy init — called on first storage access so Expo Go never triggers the require
let _mmkvInitialized = false;

function getMMKV(): MMKVStorage | null {
  if (_mmkvInitialized) return mmkv;
  _mmkvInitialized = true;
  try {
    // Only available in EAS Build with react-native-mmkv linked natively
    const { MMKV } = require('react-native-mmkv') as { MMKV: new (config: { id: string }) => MMKVStorage };
    mmkv = new MMKV({ id: 'aegis-biometric' });
  } catch {
    mmkv = null; // Expo Go — AsyncStorage fallback
  }
  return mmkv;
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const KEYS = {
  EMBEDDING_PREFIX: 'aegis:emb:',
  LOGS_KEY: 'aegis:verif_logs',
} as const;

// ─── Data Schemas ─────────────────────────────────────────────────────────────

export interface StoredEmbedding {
  userId: string;
  embedding: number[];
  createdAt: number;
  modelVersion: string;
}

export interface VerificationLog {
  id: string;
  timestamp: number;
  confidence: number;
  livenessPassed: boolean;
  success: boolean;
  latencyMs: number;
  userId?: string;
  synced: boolean;
}

// ─── Low-level adapter ────────────────────────────────────────────────────────

async function storageGet(key: string): Promise<string | null> {
  const store = getMMKV();
  if (store) return store.getString(key) ?? null;
  return AsyncStorage.getItem(key);
}

async function storageSet(key: string, value: string): Promise<void> {
  const store = getMMKV();
  if (store) {
    store.set(key, value);
  } else {
    await AsyncStorage.setItem(key, value);
  }
}

async function storageDelete(key: string): Promise<void> {
  const store = getMMKV();
  if (store) {
    store.delete(key);
  } else {
    await AsyncStorage.removeItem(key);
  }
}

async function storageGetAllKeys(): Promise<string[]> {
  const store = getMMKV();
  if (store) return store.getAllKeys();
  return (await AsyncStorage.getAllKeys()) as string[];
}

// ─── Embedding Operations ─────────────────────────────────────────────────────

export async function saveEmbedding(record: StoredEmbedding): Promise<void> {
  const key = KEYS.EMBEDDING_PREFIX + record.userId;
  await storageSet(key, JSON.stringify(record));
}

export async function getEmbedding(userId: string): Promise<StoredEmbedding | null> {
  const raw = await storageGet(KEYS.EMBEDDING_PREFIX + userId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredEmbedding;
  } catch {
    return null;
  }
}

export async function deleteEmbedding(userId: string): Promise<void> {
  await storageDelete(KEYS.EMBEDDING_PREFIX + userId);
}

export async function getAllEnrolledUserIds(): Promise<string[]> {
  const allKeys = await storageGetAllKeys();
  return allKeys
    .filter((k) => k.startsWith(KEYS.EMBEDDING_PREFIX))
    .map((k) => k.replace(KEYS.EMBEDDING_PREFIX, ''));
}

// ─── Verification Log Operations ──────────────────────────────────────────────

export async function saveVerificationLog(log: VerificationLog): Promise<void> {
  const existing = await getVerificationLogs();
  const updated = [log, ...existing].slice(0, 200); // cap at 200 records
  await storageSet(KEYS.LOGS_KEY, JSON.stringify(updated));
}

export async function getVerificationLogs(): Promise<VerificationLog[]> {
  const raw = await storageGet(KEYS.LOGS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as VerificationLog[];
  } catch {
    return [];
  }
}

export async function getUnsyncedLogs(): Promise<VerificationLog[]> {
  const all = await getVerificationLogs();
  return all.filter((l) => !l.synced);
}

export async function markLogsSynced(ids: string[]): Promise<void> {
  const all = await getVerificationLogs();
  const idSet = new Set(ids);
  const updated = all.map((l) => (idSet.has(l.id) ? { ...l, synced: true } : l));
  await storageSet(KEYS.LOGS_KEY, JSON.stringify(updated));
}

export async function clearVerificationLogs(): Promise<void> {
  await storageDelete(KEYS.LOGS_KEY);
}

// ─── Purge All Biometric Data ─────────────────────────────────────────────────

export async function purgeAllBiometricData(): Promise<void> {
  const userIds = await getAllEnrolledUserIds();
  await Promise.all(userIds.map(deleteEmbedding));
  await clearVerificationLogs();
}

// ─── Storage Info ─────────────────────────────────────────────────────────────

export function getStorageBackend(): 'mmkv' | 'asyncstorage' {
  return getMMKV() ? 'mmkv' : 'asyncstorage';
}
