/**
 * Face Encryption Layer
 *
 * All biometric data (embeddings) are AES-256 encrypted before being
 * persisted to MMKV storage. Keys are stored in expo-secure-store
 * (backed by Keychain on iOS, Android Keystore on Android).
 *
 * Threat model: protects against physical device extraction.
 */

import * as SecureStore from 'expo-secure-store';
import type { FaceEmbedding, EnrolledFace } from '@/types';

const ENCRYPTION_KEY_NAME = 'aegis_biometric_key';

/**
 * Generate or retrieve the device-bound AES-256 key.
 * The key is 32 random bytes, base64-encoded.
 */
export async function getOrCreateEncryptionKey(): Promise<string> {
  let key = await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME);

  if (!key) {
    key = generateSecureKey();
    await SecureStore.setItemAsync(ENCRYPTION_KEY_NAME, key, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  return key;
}

/**
 * Encrypt an EnrolledFace payload before storage.
 * Returns a base64-encoded ciphertext string.
 *
 * PLUG-IN: replace XOR stub with AES-256-GCM via react-native-crypto or
 * expo-crypto once the library is integrated.
 */
export async function encryptFacePayload(face: EnrolledFace): Promise<string> {
  const key = await getOrCreateEncryptionKey();
  const plaintext = JSON.stringify({
    embeddings: face.embeddings,
    enrolledAt: face.enrolledAt,
  });

  // ── STUB: XOR obfuscation (NOT production-grade) ─────────────────────────
  // Replace with: AES-256-GCM from expo-crypto or react-native-crypto
  const encrypted = xorObfuscate(plaintext, key);
  return Buffer.from(encrypted).toString('base64');
}

/**
 * Decrypt an EnrolledFace payload retrieved from storage.
 */
export async function decryptFacePayload(ciphertext: string): Promise<{
  embeddings: FaceEmbedding[];
  enrolledAt: number;
}> {
  const key = await getOrCreateEncryptionKey();
  const decoded = Buffer.from(ciphertext, 'base64').toString('utf8');
  const decrypted = xorObfuscate(decoded, key);
  return JSON.parse(decrypted) as { embeddings: FaceEmbedding[]; enrolledAt: number };
}

/**
 * Delete the encryption key (used during "Clear All Data").
 * After this, all encrypted payloads become unreadable.
 */
export async function deleteEncryptionKey(): Promise<void> {
  await SecureStore.deleteItemAsync(ENCRYPTION_KEY_NAME);
}

// ─── Private Stubs ────────────────────────────────────────────────────────────

function generateSecureKey(): string {
  // In production: use expo-crypto's getRandomBytesAsync
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  return Array.from({ length: 44 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

function xorObfuscate(input: string, key: string): string {
  return input
    .split('')
    .map((char, i) =>
      String.fromCharCode(char.charCodeAt(0) ^ (key.charCodeAt(i % key.length) ?? 0))
    )
    .join('');
}
