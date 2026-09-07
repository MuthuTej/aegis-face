/**
 * verificationService — Offline face verification
 *
 * Loads the enrolled embedding from MMKV storage, computes cosine similarity
 * against the live embedding, and returns a match decision.
 *
 * Threshold: 0.80 cosine similarity (stricter than the app default of 0.60
 * to improve security). Configurable via settings.matchThreshold.
 *
 * Reuses compareEmbeddings from the existing lib/ml/faceEmbedding.ts to keep
 * the math implementation in one place.
 */

import type { FaceEmbedding, FaceMatchResult, EnrolledFace } from '@/types';
import { compareEmbeddings } from '@/lib/ml/faceEmbedding';
import { getEmbedding } from '@storage/faceStorage';

// ─── Public Threshold Constant ────────────────────────────────────────────────

export const VERIFICATION_THRESHOLD = 0.80;

// ─── Main API ─────────────────────────────────────────────────────────────────

/**
 * Verify a live embedding against the stored enrollment for a given user.
 *
 * @param liveEmbedding — Embedding generated from the current camera frame
 * @param userId — User ID whose stored embedding to load. If omitted, loads the primary user.
 * @param threshold — Cosine similarity threshold (default: VERIFICATION_THRESHOLD)
 */
export async function verifyUser(
  liveEmbedding: FaceEmbedding,
  userId?: string,
  threshold = VERIFICATION_THRESHOLD
): Promise<FaceMatchResult> {
  const targetUserId = userId ?? 'primary_user';
  const stored = await getEmbedding(targetUserId);

  if (!stored) {
    return {
      matched: false,
      similarity: 0,
      distance: Infinity,
      threshold,
      latencyMs: 0,
    };
  }

  const storedEmbedding: FaceEmbedding = {
    vector: stored.embedding,
    modelVersion: stored.modelVersion,
    norm: Math.sqrt(stored.embedding.reduce((s, v) => s + v * v, 0)),
    createdAt: stored.createdAt,
  };

  const result = compareEmbeddings(liveEmbedding, storedEmbedding, threshold);
  return result;
}

/**
 * Verify against multiple enrolled faces (used when multiple users are enrolled).
 * Returns the best match across all enrolled faces.
 */
export async function verifyAgainstAll(
  liveEmbedding: FaceEmbedding,
  enrolledFaces: EnrolledFace[],
  threshold = VERIFICATION_THRESHOLD
): Promise<FaceMatchResult> {
  const start = Date.now();
  let best: FaceMatchResult = {
    matched: false,
    similarity: 0,
    distance: Infinity,
    threshold,
    latencyMs: 0,
  };

  for (const face of enrolledFaces) {
    for (const ref of face.embeddings) {
      const result = compareEmbeddings(liveEmbedding, ref, threshold);
      if (result.similarity > best.similarity) {
        best = { ...result, matchedId: face.id };
      }
    }
  }

  return { ...best, latencyMs: Date.now() - start };
}

/**
 * Synchronous in-memory verification (no async storage read).
 * Use when the enrolled embedding is already loaded in memory (e.g., from Zustand store).
 */
export function verifySync(
  liveEmbedding: FaceEmbedding,
  storedEmbedding: FaceEmbedding,
  threshold = VERIFICATION_THRESHOLD
): FaceMatchResult {
  return compareEmbeddings(liveEmbedding, storedEmbedding, threshold);
}
