/**
 * faceDetector — BlazeFace TFLite inference
 *
 * Loads blazeface_short_range.tflite (128×128 input, ~640 KB).
 * In EAS Build (react-native-fast-tflite linked): runs real inference.
 * In Expo Go: model load returns null; callers fall back to the existing stub.
 *
 * Model output format (BlazeFace short-range):
 *   Output 0: [1, 896, 16] — regression deltas (cx, cy, w, h, 6×landmark pairs)
 *   Output 1: [1, 896, 1]  — raw classification logits
 */

import type { DetectedFace, BoundingBox, FaceLandmarks } from '@/types';
import {
  deriveLandmarksFromBbox,
  estimateHeadPoseFromLandmarks,
  computeFaceQuality,
  decodeBlazeFaceOutput,
  nonMaxSuppression,
} from './landmarkUtils';
import { nearestNeighborResize } from '../camera/cameraProcessor';

// ─── TFLite Optional Import ───────────────────────────────────────────────────

interface TFLiteModel {
  runSync(inputs: ArrayBuffer[]): ArrayBuffer[];
}

type LoadTFLiteModel = (asset: number | string, delegate?: string) => Promise<TFLiteModel>;

let loadTensorflowModel: LoadTFLiteModel | null = null;
try {
  const tflite = require('react-native-fast-tflite') as { loadTensorflowModel: LoadTFLiteModel };
  loadTensorflowModel = tflite.loadTensorflowModel;
} catch {
  // Not available in Expo Go
}

// ─── Model State ─────────────────────────────────────────────────────────────

let faceDetectorModel: TFLiteModel | null = null;
let modelLoadStatus: 'idle' | 'loading' | 'loaded' | 'error' = 'idle';

export function getFaceDetectorStatus() {
  return modelLoadStatus;
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

/**
 * Load the BlazeFace model into memory.
 * Call once at app startup — not inside a frame processor.
 * Safe to call multiple times (idempotent).
 */
export async function initFaceDetectionModel(): Promise<boolean> {
  if (modelLoadStatus === 'loaded') return true;
  if (modelLoadStatus === 'loading') return false;
  if (!loadTensorflowModel) {
    console.log('[FaceDetector] react-native-fast-tflite not available — using stub');
    return false;
  }

  modelLoadStatus = 'loading';
  try {
    // Model must be placed at assets/models/face_detector.tflite
    faceDetectorModel = await loadTensorflowModel(
      require('@assets/models/face_detector.tflite') as number
    );
    modelLoadStatus = 'loaded';
    // Store in global so worklets on UI thread can access it
    (global as unknown as Record<string, unknown>).__aegis_face_detector = faceDetectorModel;
    console.log('[FaceDetector] Model loaded successfully');
    return true;
  } catch (err) {
    modelLoadStatus = 'error';
    console.error('[FaceDetector] Model load failed:', err);
    return false;
  }
}

export function disposeFaceDetectionModel(): void {
  faceDetectorModel = null;
  modelLoadStatus = 'idle';
}

// ─── Inference ────────────────────────────────────────────────────────────────

/**
 * Run face detection on a raw RGBA frame buffer.
 * Returns null if no face detected or model not loaded.
 *
 * This function is called from the Vision Camera frame processor (worklet).
 * It is NOT marked 'worklet' here because the model object is managed on the JS thread;
 * the frame processor calls runSync which IS worklet-safe in fast-tflite v1.
 */
let _debugFrameCount = 0;

export function detectFaceFromFrame(
  buffer: Uint8Array,
  width: number,
  height: number
): DetectedFace | null {
  _debugFrameCount++;
  const isDebugFrame = _debugFrameCount % 30 === 1; // log every 30 frames

  if (!faceDetectorModel) {
    if (isDebugFrame) console.log('[FaceDetector] Model not loaded yet');
    return null;
  }

  if (buffer.length === 0) {
    if (isDebugFrame) console.log('[FaceDetector] Empty buffer!');
    return null;
  }

  if (isDebugFrame) {
    console.log(`[FaceDetector] Frame: ${width}x${height}, buffer: ${buffer.length} bytes, format: ${buffer.length === width * height * 3 ? 'RGB' : buffer.length === width * height * 4 ? 'RGBA' : `unknown(${(buffer.length / (width * height)).toFixed(1)}ch)`}`);
  }

  // 1. Resize full frame to 128×128 RGB, normalized to [-1,1]
  const pixelsPerPixel = buffer.length / (width * height);
  const fmt = pixelsPerPixel >= 3.5 ? 'RGBA' : 'RGB';
  const inputData = nearestNeighborResize(buffer, width, height, 128, 128, fmt as 'RGBA' | 'RGB');

  // 2. Run BlazeFace model
  let regressions: Float32Array;
  let scores: Float32Array;
  try {
    // runSync takes TypedArray[], returns TypedArray[]
    const outputs = faceDetectorModel.runSync([inputData] as never) as never as Float32Array[];
    regressions = outputs[0] instanceof Float32Array ? outputs[0] : new Float32Array(outputs[0] as unknown as ArrayBuffer ?? new ArrayBuffer(0));
    scores = outputs[1] instanceof Float32Array ? outputs[1] : new Float32Array(outputs[1] as unknown as ArrayBuffer ?? new ArrayBuffer(0));
    if (isDebugFrame) {
      const maxScore = Math.max(...Array.from(scores.slice(0, 20)));
      console.log(`[FaceDetector] Output shapes: reg=${regressions.length}, scores=${scores.length}, maxScore(first20)=${maxScore.toFixed(3)}`);
    }
  } catch (e) {
    console.log('[FaceDetector] runSync error:', e);
    return null;
  }

  // 3. Decode + NMS
  const rawReg = new Float32Array(896 * 16);
  const rawScores = new Float32Array(896);

  for (let i = 0; i < Math.min(regressions.length, 896 * 16); i++) {
    rawReg[i] = regressions[i] ?? 0;
  }
  for (let i = 0; i < Math.min(scores.length, 896); i++) {
    rawScores[i] = scores[i] ?? 0;
  }

  const candidates = decodeBlazeFaceOutput(rawReg, rawScores, 0.30);
  if (isDebugFrame) console.log(`[FaceDetector] candidates after threshold: ${candidates.length}`);
  const best = nonMaxSuppression(candidates, 0.30, 1);

  if (best.length === 0) {
    if (isDebugFrame) console.log('[FaceDetector] No face detected after NMS');
    return null;
  }

  const detection = best[0];
  if (!detection) return null;

  // 4. Build DetectedFace
  const bbox: BoundingBox = detection.bbox;
  const landmarks = buildLandmarksFromRaw(detection.rawLandmarks, detection.bbox);
  const headPose = estimateHeadPoseFromLandmarks(landmarks);
  const quality = computeFaceQuality(bbox, width, height, buffer);

  return {
    boundingBox: bbox,
    landmarks,
    headPose,
    quality,
    confidence: detection.score,
    timestamp: Date.now(),
  };
}

// ─── Private Helpers ─────────────────────────────────────────────────────────

function buildLandmarksFromRaw(
  rawLandmarks: number[],
  bbox: BoundingBox
): FaceLandmarks {
  // BlazeFace provides: right_eye, left_eye, nose, mouth, right_ear, left_ear
  if (rawLandmarks.length < 12) {
    return deriveLandmarksFromBbox(bbox);
  }

  return {
    rightEye: { x: rawLandmarks[0] ?? 0, y: rawLandmarks[1] ?? 0 },
    leftEye: { x: rawLandmarks[2] ?? 0, y: rawLandmarks[3] ?? 0 },
    nose: { x: rawLandmarks[4] ?? 0, y: rawLandmarks[5] ?? 0 },
    leftMouth: { x: rawLandmarks[6] ?? 0, y: rawLandmarks[7] ?? 0 },
    rightMouth: { x: rawLandmarks[8] ?? 0, y: rawLandmarks[9] ?? 0 },
    rightEar: { x: rawLandmarks[10] ?? 0, y: rawLandmarks[11] ?? 0 },
  };
}
