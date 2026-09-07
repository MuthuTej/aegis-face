/**
 * verificationPipeline — End-to-end verification orchestration
 *
 * Orchestrates the complete pipeline:
 *   1. Quality gate
 *   2. Embedding generation (MobileFaceNet)
 *   3. Cosine similarity matching
 *   4. Verification log persistence
 *
 * Liveness detection is handled externally by useLivenessEngine (React hook)
 * and passed in as a result. This keeps the pipeline testable and hook-free.
 *
 * Target total time: < 1000 ms on mid-range device with TFLite INT8 model.
 */

import type { DetectedFace, EnrolledFace, FaceMatchResult, FaceEmbedding } from '@/types';
import { generateEmbedding } from '../faceRecognition/embeddingService';
import { verifyUser, verifyAgainstAll, VERIFICATION_THRESHOLD } from '../verification/verificationService';
import { saveVerificationLog } from '@storage/faceStorage';
import type { VerificationLog } from '@storage/faceStorage';
import { QUALITY } from '@/lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PipelineInput {
  /** Raw RGBA frame buffer from camera (empty Uint8Array in demo mode) */
  frameBuffer: Uint8Array;
  /** Detected face from face detector */
  face: DetectedFace;
  frameWidth: number;
  frameHeight: number;
  /** ID of user to verify against. Omit for primary user. */
  userId?: string;
  /** In-memory enrolled faces (from enrollmentStore). Used if userId is not stored. */
  enrolledFaces?: EnrolledFace[];
  /** Whether liveness passed (from useLivenessEngine) */
  livenessPassed: boolean;
  matchThreshold?: number;
}

export interface PipelineResult {
  success: boolean;
  confidence: number;
  liveness: boolean;
  /** Null if quality gate or liveness failed */
  matchResult: FaceMatchResult | null;
  /** Generated embedding (for debugging) */
  embedding: FaceEmbedding | null;
  detectionMs: number;
  embeddingMs: number;
  verificationMs: number;
  totalMs: number;
  failReason?: 'quality_gate' | 'liveness_failed' | 'no_match' | 'no_enrollment';
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Run the full verification pipeline.
 * Call this after liveness challenges complete.
 */
export async function runVerificationPipeline(input: PipelineInput): Promise<PipelineResult> {
  const pipelineStart = Date.now();
  const threshold = input.matchThreshold ?? VERIFICATION_THRESHOLD;

  // ── 1. Quality gate ──────────────────────────────────────────────────────
  const t0 = Date.now();
  if (input.face.quality.overall < QUALITY.MIN_VERIFICATION) {
    return buildFailResult(
      'quality_gate',
      pipelineStart,
      Date.now() - t0,
      input.livenessPassed
    );
  }
  const detectionMs = Date.now() - t0;

  // ── 2. Liveness gate ─────────────────────────────────────────────────────
  if (!input.livenessPassed) {
    return buildFailResult('liveness_failed', pipelineStart, detectionMs, false);
  }

  // ── 3. Embedding generation ──────────────────────────────────────────────
  const tEmbed = Date.now();
  const embedding = generateEmbedding(
    input.frameBuffer,
    input.face,
    input.frameWidth,
    input.frameHeight
  );
  const embeddingMs = Date.now() - tEmbed;

  // ── 4. Matching ──────────────────────────────────────────────────────────
  const tVerify = Date.now();
  let matchResult: FaceMatchResult;

  if (input.enrolledFaces && input.enrolledFaces.length > 0) {
    // Use in-memory Zustand store faces (preferred in Expo Go demo mode)
    matchResult = await verifyAgainstAll(embedding, input.enrolledFaces, threshold);
  } else {
    // Use MMKV / AsyncStorage stored embedding
    matchResult = await verifyUser(embedding, input.userId, threshold);
  }
  const verificationMs = Date.now() - tVerify;

  const totalMs = Date.now() - pipelineStart;
  const success = matchResult.matched;

  // ── 5. Persist log ───────────────────────────────────────────────────────
  const log: VerificationLog = {
    id: `ver_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    confidence: matchResult.similarity,
    livenessPassed: input.livenessPassed,
    success,
    latencyMs: totalMs,
    userId: input.userId,
    synced: false,
  };
  await saveVerificationLog(log);

  if (!success) {
    return {
      success: false,
      confidence: matchResult.similarity,
      liveness: true,
      matchResult,
      embedding,
      detectionMs,
      embeddingMs,
      verificationMs,
      totalMs,
      failReason: matchResult.similarity === 0 ? 'no_enrollment' : 'no_match',
    };
  }

  return {
    success: true,
    confidence: matchResult.similarity,
    liveness: true,
    matchResult,
    embedding,
    detectionMs,
    embeddingMs,
    verificationMs,
    totalMs,
  };
}

// ─── Private Helpers ─────────────────────────────────────────────────────────

function buildFailResult(
  reason: PipelineResult['failReason'],
  pipelineStart: number,
  detectionMs: number,
  liveness: boolean
): PipelineResult {
  return {
    success: false,
    confidence: 0,
    liveness,
    matchResult: null,
    embedding: null,
    detectionMs,
    embeddingMs: 0,
    verificationMs: 0,
    totalMs: Date.now() - pipelineStart,
    failReason: reason,
  };
}
