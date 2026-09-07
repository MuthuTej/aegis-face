/**
 * Face Embedding — MobileFaceNet TFLite integration
 *
 * Generates a 128-dimensional L2-normalised face embedding vector.
 * Plug-in point: replace stub with real react-native-fast-tflite inference.
 *
 * Model: MobileFaceNet (112×112 input, 128-d output)
 * Expected accuracy: ~99.5% on LFW benchmark
 */

import type { DetectedFace, FaceEmbedding, FaceMatchResult } from '@/types';
import { MATCHING, ML_MODELS } from '../constants';

// Lazy service cache — loaded on first call, NOT at module import time
// (avoids crashing Expo Go when react-native-fast-tflite isn't linked)
type EmbedFn = (buf: Uint8Array, face: DetectedFace, w: number, h: number) => FaceEmbedding;
type InitFn = () => Promise<boolean>;

let _embedFn: EmbedFn | null | undefined;   // undefined = not yet resolved
let _initFn: InitFn | null | undefined;

function resolveServices(): { embedFn: EmbedFn | null; initFn: InitFn | null } {
  if (_embedFn !== undefined) return { embedFn: _embedFn, initFn: _initFn ?? null };
  try {
    const embSvc = require('@/services/faceRecognition/embeddingService') as { generateEmbedding: EmbedFn };
    const fnetSvc = require('@/services/faceRecognition/mobileFaceNet') as { initMobileFaceNet: InitFn };
    _embedFn = embSvc.generateEmbedding;
    _initFn = fnetSvc.initMobileFaceNet;
  } catch {
    _embedFn = null;
    _initFn = null;
  }
  return { embedFn: _embedFn, initFn: _initFn ?? null };
}

export async function initEmbeddingModel(): Promise<void> {
  const { initFn } = resolveServices();
  if (initFn) {
    const loaded = await initFn();
    console.log('[FaceEmbedding] Model ' + (loaded ? 'loaded' : 'using stub') + ':', ML_MODELS.FACE_EMBEDDING);
    return;
  }
  console.log('[FaceEmbedding] Using stub (EAS Build required for real model)');
}

export function disposeEmbeddingModel(): void {
  // Disposal handled by mobileFaceNet service
}

/**
 * Generate a 128-d L2-normalized embedding from a detected face.
 * Delegates to embeddingService (MobileFaceNet TFLite) when available.
 * Falls back to deterministic stub in Expo Go / demo mode.
 */
export function generateEmbedding(
  frameBuffer: Uint8Array,
  face: DetectedFace,
  modelVersion = 'mobilefacenet_v1'
): FaceEmbedding {
  const { embedFn } = resolveServices();
  if (embedFn) {
    return embedFn(frameBuffer, face, 0, 0);
  }
  const vector = generateStubEmbedding();
  return { vector, modelVersion, norm: l2Norm(vector), createdAt: Date.now() };
}

/**
 * Compare two embeddings using cosine similarity.
 * Returns a FaceMatchResult with similarity, distance, and match decision.
 */
export function compareEmbeddings(
  query: FaceEmbedding,
  reference: FaceEmbedding,
  threshold: number = MATCHING.DEFAULT_THRESHOLD
): FaceMatchResult {
  const start = Date.now();

  const similarity = cosineSimilarity(query.vector, reference.vector);
  const distance = euclideanDistance(query.vector, reference.vector);
  const matched = similarity >= threshold;

  return {
    matched,
    similarity,
    distance,
    threshold,
    latencyMs: Date.now() - start,
  };
}

/**
 * Compare a query embedding against a list of enrolled embeddings.
 * Returns the best match result.
 */
export function matchAgainstEnrolled(
  query: FaceEmbedding,
  enrolled: { id: string; embeddings: FaceEmbedding[] }[],
  threshold: number = MATCHING.DEFAULT_THRESHOLD
): FaceMatchResult {
  let best: FaceMatchResult = {
    matched: false,
    similarity: 0,
    distance: Infinity,
    threshold,
    latencyMs: 0,
  };

  const start = Date.now();

  for (const face of enrolled) {
    for (const ref of face.embeddings) {
      const result = compareEmbeddings(query, ref, threshold);
      if (result.similarity > best.similarity) {
        best = { ...result, matchedId: face.id };
      }
    }
  }

  return { ...best, latencyMs: Date.now() - start };
}

// ─── Math Utilities ───────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    normA += (a[i] ?? 0) ** 2;
    normB += (b[i] ?? 0) ** 2;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, val, i) => sum + (val - (b[i] ?? 0)) ** 2, 0));
}

function l2Norm(v: number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

function generateStubEmbedding(): number[] {
  // Seeded pseudo-random for reproducibility in dev
  const seed = 42;
  return Array.from({ length: MATCHING.EMBEDDING_DIM }, (_, i) => {
    const val = Math.sin(seed + i) * 0.5;
    return val;
  });
}
