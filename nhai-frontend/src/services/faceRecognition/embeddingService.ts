/**
 * embeddingService — Face embedding generation and comparison
 *
 * Pipeline: raw frame + bounding box → crop → 112×112 → MobileFaceNet → L2 normalize → FaceEmbedding
 *
 * Falls back to a deterministic stub when MobileFaceNet is not loaded (Expo Go / demo mode).
 * Stub produces a fixed seeded vector — sufficient for UI development but NOT for real matching.
 */

import type { DetectedFace, FaceEmbedding } from '@/types';
import { cropAndResize } from '../camera/cameraProcessor';
import { runEmbedding, isModelLoaded, MODEL_VERSION, EMBEDDING_DIM, INPUT_SIZE } from './mobileFaceNet';

// ─── Main API ─────────────────────────────────────────────────────────────────

/**
 * Generate a 128-d L2-normalized embedding from a detected face.
 *
 * @param frameBuffer — Raw RGBA frame bytes from Vision Camera
 * @param face — Detected face with bounding box (from faceDetector)
 * @param frameWidth — Frame width in pixels
 * @param frameHeight — Frame height in pixels
 */
export function generateEmbedding(
  frameBuffer: Uint8Array,
  face: DetectedFace,
  frameWidth: number,
  frameHeight: number
): FaceEmbedding {
  let rawVector: number[];

  if (isModelLoaded() && frameBuffer.length > 0) {
    // Production path: real TFLite inference
    // Detect format: Skia readPixels returns RGBA (4ch), Vision Camera rgb=3ch
    const bytesPerPixel = frameBuffer.length / (frameWidth * frameHeight);
    const fmt = bytesPerPixel >= 3.5 ? 'RGBA' : 'RGB';
    const cropInput = cropAndResize(
      frameBuffer,
      face.boundingBox,
      frameWidth,
      frameHeight,
      INPUT_SIZE,
      INPUT_SIZE,
      fmt as 'RGBA' | 'RGB'
    );

    const modelOutput = runEmbedding(cropInput);
    rawVector = modelOutput ? Array.from(modelOutput) : stubEmbedding(face);
  } else {
    // Expo Go / demo path: deterministic stub
    rawVector = stubEmbedding(face);
  }

  const normalized = l2Normalize(rawVector);
  return {
    vector: normalized,
    modelVersion: isModelLoaded() ? MODEL_VERSION : 'stub_v1',
    norm: l2Norm(normalized),
    createdAt: Date.now(),
  };
}

/**
 * Average multiple embeddings (from multi-angle enrollment) and re-normalize.
 * This improves recognition robustness by capturing more of the identity space.
 */
export function averageEmbeddings(embeddings: FaceEmbedding[]): FaceEmbedding {
  if (embeddings.length === 0) {
    throw new Error('averageEmbeddings: no embeddings provided');
  }
  if (embeddings.length === 1) return embeddings[0]!;

  const dim = embeddings[0]!.vector.length;
  const sum = new Array<number>(dim).fill(0);

  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      sum[i] = (sum[i] ?? 0) + (emb.vector[i] ?? 0);
    }
  }

  const avg = sum.map((v) => v / embeddings.length);
  const normalized = l2Normalize(avg);

  return {
    vector: normalized,
    modelVersion: embeddings[0]!.modelVersion,
    norm: l2Norm(normalized),
    createdAt: Date.now(),
  };
}

// ─── Math Utilities (exported for reuse) ─────────────────────────────────────

export function l2Normalize(v: number[]): number[] {
  const norm = l2Norm(v);
  if (norm === 0) return v.slice();
  return v.map((x) => x / norm);
}

export function l2Norm(v: number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ─── Stub ─────────────────────────────────────────────────────────────────────

/**
 * Deterministic stub embedding seeded from the face bounding box.
 * Different faces with different bbox positions will produce different stubs,
 * allowing enrollment + verification flow to function in demo mode.
 */
function stubEmbedding(face: DetectedFace): number[] {
  const seed = face.boundingBox.x * 1000 + face.boundingBox.y * 100;
  return Array.from({ length: EMBEDDING_DIM }, (_, i) => {
    return Math.sin(seed + i * 0.7) * Math.cos(i * 0.3 + seed * 0.01);
  });
}
