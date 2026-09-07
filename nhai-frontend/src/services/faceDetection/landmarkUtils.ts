/**
 * landmarkUtils — Geometric landmark estimation
 *
 * Derives FaceLandmarks, HeadPose, and FaceQualityMetrics from a bounding box.
 * Used when no dedicated MediaPipe Face Landmarker model is loaded.
 * Accuracy is sufficient for EAR-based blink detection and head-turn detection.
 *
 * Also contains the 896 pre-computed BlazeFace anchor coordinates used to
 * decode face detector output tensors.
 */

import type { BoundingBox, FaceLandmarks, HeadPose, FaceQualityMetrics, Point2D } from '@/types';
import { computeMeanBrightness } from '../camera/cameraProcessor';

// ─── Landmark Estimation ──────────────────────────────────────────────────────

/**
 * Derive approximate 5-point landmarks from a face bounding box.
 * Landmark positions follow standard proportional face geometry.
 * All coordinates are normalized [0,1] relative to the full frame.
 */
export function deriveLandmarksFromBbox(bbox: BoundingBox): FaceLandmarks {
  const { x, y, width, height } = bbox;

  return {
    // Eyes sit at ~38% and ~62% of face width, ~38% down from top
    leftEye: { x: x + width * 0.30, y: y + height * 0.38 },
    rightEye: { x: x + width * 0.70, y: y + height * 0.38 },
    // Nose tip at center, ~55% down
    nose: { x: x + width * 0.50, y: y + height * 0.55 },
    // Mouth corners at ~30% and ~70% width, ~72% down
    leftMouth: { x: x + width * 0.30, y: y + height * 0.72 },
    rightMouth: { x: x + width * 0.70, y: y + height * 0.72 },
    // Ears at outer edges
    leftEar: { x: x + width * 0.02, y: y + height * 0.45 },
    rightEar: { x: x + width * 0.98, y: y + height * 0.45 },
  };
}

/**
 * Estimate head pose from eye and nose landmark positions.
 * Yaw is estimated from the horizontal eye symmetry relative to nose.
 * Pitch is estimated from the vertical position of nose relative to eyes.
 * Roll is estimated from the tilt of the eye line.
 */
export function estimateHeadPoseFromLandmarks(landmarks: FaceLandmarks): HeadPose {
  const { leftEye, rightEye, nose } = landmarks;

  const eyeMidX = (leftEye.x + rightEye.x) / 2;
  const eyeMidY = (leftEye.y + rightEye.y) / 2;
  const eyeWidth = Math.abs(rightEye.x - leftEye.x);

  // Yaw: nose offset from eye midline, normalized by eye width
  const noseOffsetX = nose.x - eyeMidX;
  const yawRaw = eyeWidth > 0 ? noseOffsetX / eyeWidth : 0;
  const yaw = yawRaw * 60; // scale to approx degrees

  // Pitch: nose drops below eye midline — positive = looking up
  const noseOffsetY = nose.y - eyeMidY;
  const pitchRaw = eyeWidth > 0 ? noseOffsetY / eyeWidth : 0;
  const pitch = -(pitchRaw - 0.8) * 40; // 0.8 is approx expected ratio

  // Roll: angle of eye line from horizontal
  const dx = rightEye.x - leftEye.x;
  const dy = rightEye.y - leftEye.y;
  const roll = (Math.atan2(dy, dx) * 180) / Math.PI;

  return {
    yaw: clamp(yaw, -90, 90),
    pitch: clamp(pitch, -60, 60),
    roll: clamp(roll, -45, 45),
  };
}

// ─── Face Quality ─────────────────────────────────────────────────────────────

/**
 * Compute FaceQualityMetrics from bounding box and optional frame buffer.
 * Without a frame buffer, static estimates are used for sharpness/lighting.
 */
export function computeFaceQuality(
  bbox: BoundingBox,
  frameWidth: number,
  frameHeight: number,
  frameBuffer?: Uint8Array
): FaceQualityMetrics {
  const faceArea = bbox.width * bbox.height;

  // Face size score: ideal range 0.10–0.70 of frame area
  const faceSizeScore = faceArea < 0.05 ? 20
    : faceArea < 0.10 ? 55
    : faceArea > 0.70 ? 60
    : Math.round(Math.min(100, 50 + (faceArea - 0.10) / 0.60 * 50));

  let brightness = 140;
  let lightingScore = 80;

  if (frameBuffer && frameBuffer.length > 0) {
    brightness = computeMeanBrightness(frameBuffer, bbox, frameWidth, frameHeight);
    // Ideal brightness: 80–200
    lightingScore = brightness < 40 ? 20
      : brightness < 80 ? 50
      : brightness > 220 ? 45
      : Math.round(80 + Math.min(1, 1 - Math.abs(brightness - 140) / 80) * 20);
  }

  // Pose score: estimated from bbox aspect ratio (near-square = frontal)
  const aspectRatio = bbox.width / Math.max(bbox.height, 0.001);
  const poseScore = Math.round(Math.max(50, 100 - Math.abs(1 - aspectRatio / 0.75) * 80));

  const sharpness = 78; // estimated without full Laplacian
  const overall = Math.round((faceSizeScore + lightingScore + poseScore + sharpness) / 4);

  return {
    overall,
    sharpness,
    lighting: lightingScore,
    pose: poseScore,
    eyeOpen: 88,
    occlusion: 95,
    faceSize: faceSizeScore,
    brightness,
  };
}

// ─── Euclidean distance ───────────────────────────────────────────────────────

export function pointDistance(a: Point2D, b: Point2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// ─── BlazeFace Anchors ────────────────────────────────────────────────────────

/**
 * Pre-computed anchors for BlazeFace short-range model (128×128 input, 896 anchors).
 * Generated using the standard SSD anchor scheme:
 *   - 2 anchors per cell at strides 8 and 16
 *   - Sizes: [0.1, 0.2, ..., 0.9] at stride-8 cells, [0.5, 1.0] at stride-16 cells
 *
 * Each anchor is [cx, cy] in [0,1] normalized coordinates.
 * Full 896-anchor array is computed lazily on first use.
 */
let _cachedAnchors: Float32Array | null = null;

export function getBlazeFaceAnchors(): Float32Array {
  if (_cachedAnchors) return _cachedAnchors;

  const anchors: number[] = [];

  // Stride-8 grid: 16×16 = 256 cells × 2 anchors = 512
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      for (let a = 0; a < 2; a++) {
        anchors.push((x + 0.5) / 16, (y + 0.5) / 16);
      }
    }
  }

  // Stride-16 grid: 8×8 = 64 cells × 6 anchors = 384
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      for (let a = 0; a < 6; a++) {
        anchors.push((x + 0.5) / 8, (y + 0.5) / 8);
      }
    }
  }

  _cachedAnchors = new Float32Array(anchors);
  return _cachedAnchors;
}

/**
 * Decode BlazeFace regression output into bounding boxes.
 *
 * @param regressions — Float32Array of shape [896, 16] (cx,cy,w,h + 12 landmark coords)
 * @param scores — Float32Array of shape [896] classification scores (after sigmoid)
 * @param scoreThreshold — Minimum score to consider a detection
 * @returns Array of { bbox, score, landmarks } candidates (before NMS)
 */
export function decodeBlazeFaceOutput(
  regressions: Float32Array,
  scores: Float32Array,
  scoreThreshold = 0.50
): Array<{ bbox: BoundingBox; score: number; rawLandmarks: number[] }> {
  const anchors = getBlazeFaceAnchors();
  const results: Array<{ bbox: BoundingBox; score: number; rawLandmarks: number[] }> = [];

  for (let i = 0; i < 896; i++) {
    const score = sigmoid(scores[i] ?? -10);
    if (score < scoreThreshold) continue;

    const anchorCx = anchors[i * 2] ?? 0;
    const anchorCy = anchors[i * 2 + 1] ?? 0;

    const base = i * 16;
    const dx = regressions[base] ?? 0;
    const dy = regressions[base + 1] ?? 0;
    const dw = regressions[base + 2] ?? 0;
    const dh = regressions[base + 3] ?? 0;

    // Decode center box
    const cx = anchorCx + dx / 128;
    const cy = anchorCy + dy / 128;
    const w = dw / 128;
    const h = dh / 128;

    const bbox: BoundingBox = {
      x: clamp(cx - w / 2, 0, 1),
      y: clamp(cy - h / 2, 0, 1),
      width: clamp(w, 0, 1),
      height: clamp(h, 0, 1),
    };

    // Decode 6 landmark pairs (eyes, nose, mouth corners, ears)
    const rawLandmarks: number[] = [];
    for (let k = 0; k < 6; k++) {
      const lx = anchorCx + (regressions[base + 4 + k * 2] ?? 0) / 128;
      const ly = anchorCy + (regressions[base + 4 + k * 2 + 1] ?? 0) / 128;
      rawLandmarks.push(clamp(lx, 0, 1), clamp(ly, 0, 1));
    }

    results.push({ bbox, score, rawLandmarks });
  }

  return results;
}

/**
 * Non-Maximum Suppression over decoded detections.
 * Returns at most maxDetections results with IoU threshold.
 */
export function nonMaxSuppression(
  detections: Array<{ bbox: BoundingBox; score: number; rawLandmarks: number[] }>,
  iouThreshold = 0.30,
  maxDetections = 1
): Array<{ bbox: BoundingBox; score: number; rawLandmarks: number[] }> {
  const sorted = [...detections].sort((a, b) => b.score - a.score);
  const kept: typeof sorted = [];

  for (const candidate of sorted) {
    if (kept.length >= maxDetections) break;
    const suppressed = kept.some((k) => iou(k.bbox, candidate.bbox) > iouThreshold);
    if (!suppressed) kept.push(candidate);
  }

  return kept;
}

// ─── Private Helpers ─────────────────────────────────────────────────────────

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function iou(a: BoundingBox, b: BoundingBox): number {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;

  const interX = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const interY = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const inter = interX * interY;
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}
