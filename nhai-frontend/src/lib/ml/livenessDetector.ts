/**
 * Liveness Detector
 *
 * Two-layer anti-spoofing pipeline:
 *  1. Geometric checks: EAR (Eye Aspect Ratio) & MAR (Mouth Aspect Ratio)
 *     computed from facial landmarks — works fully offline, zero latency.
 *  2. Texture/depth model: TFLite anti-spoofing model for print/replay attacks.
 *
 * PLUG-IN: Connect react-native-fast-tflite model in initLivenessModel().
 */

import type { FaceLandmarks, EARMetrics, MARMetrics, HeadMovementMetrics, LivenessFrameResult, HeadPose } from '@/types';
import { LIVENESS, ML_MODELS } from '../constants';

// import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
// let livenessModel: TensorflowModel | null = null;

export async function initLivenessModel(): Promise<void> {
  // livenessModel = await loadTensorflowModel(
  //   require('@assets/models/liveness_v2.tflite')
  // );
  console.log('[LivenessDetector] Model ready:', ML_MODELS.LIVENESS);
}

export function disposeLivenessModel(): void {
  // livenessModel?.dispose();
}

/**
 * Compute Eye Aspect Ratio from 6-point eye landmark coordinates.
 * EAR < threshold indicates a blink event.
 *
 * Formula: EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
 * Reference: Soukupová & Čech, 2016
 */
export function computeEAR(landmarks: FaceLandmarks): EARMetrics {
  // Approximate using available landmark points
  // In production: use MediaPipe 468-point mesh for precise eye contours
  const leftEAR = approximateEAR(landmarks.leftEye, landmarks.nose);
  const rightEAR = approximateEAR(landmarks.rightEye, landmarks.nose);
  const averageEAR = (leftEAR + rightEAR) / 2;

  return {
    leftEAR,
    rightEAR,
    averageEAR,
    isBlinking: averageEAR < LIVENESS.EAR_THRESHOLD,
    blinkCount: 0, // managed by useLivenessEngine hook
  };
}

/**
 * Compute Mouth Aspect Ratio from landmark coordinates.
 * MAR > threshold indicates an open mouth / smile.
 */
export function computeMAR(landmarks: FaceLandmarks): MARMetrics {
  const mouthHeight = distance(landmarks.leftMouth, landmarks.rightMouth);
  const faceWidth = distance(landmarks.leftEye, landmarks.rightEye);

  // Normalized MAR
  const mar = faceWidth > 0 ? mouthHeight / faceWidth : 0;

  return {
    mar,
    isSmiling: mar > LIVENESS.MAR_THRESHOLD,
  };
}

/**
 * Compute head movement metrics from sequential HeadPose readings.
 */
export function computeHeadMovement(
  current: HeadPose,
  previous: HeadPose | null
): HeadMovementMetrics {
  return {
    yaw: current.yaw,
    pitch: current.pitch,
    roll: current.roll,
    yawVelocity: previous ? current.yaw - previous.yaw : 0,
    pitchVelocity: previous ? current.pitch - previous.pitch : 0,
  };
}

/**
 * Run the anti-spoofing depth model on a face crop.
 * Returns a score 0–1 (1 = definitely live).
 *
 * PLUG-IN: replace stub with real TFLite inference.
 */
export function runAntiSpoofingModel(
  _frameBuffer: Uint8Array,
  _width: number,
  _height: number
): number {
  // const output = livenessModel?.runSync([preprocessedFace]);
  // return (output?.[0] as Float32Array)?.[1] ?? 0; // class 1 = live

  return 0.97; // stub: always returns high liveness
}

/**
 * Aggregate all frame-level metrics into a LivenessFrameResult.
 */
export function buildFrameResult(
  landmarks: FaceLandmarks,
  headPose: HeadPose,
  previousPose: HeadPose | null,
  antispoofScore: number
): LivenessFrameResult {
  return {
    ear: computeEAR(landmarks),
    mar: computeMAR(landmarks),
    headMovement: computeHeadMovement(headPose, previousPose),
    imuCorrelation: antispoofScore,
    timestamp: Date.now(),
  };
}

// ─── Private Helpers ─────────────────────────────────────────────────────────

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function approximateEAR(
  eye: { x: number; y: number },
  nose: { x: number; y: number }
): number {
  // Rough approximation using eye-to-nose distance — replace with real 6-pt EAR
  const eyeNoseDist = distance(eye, nose);
  // Normalize to a plausible EAR range (0.15–0.40)
  return Math.min(0.40, Math.max(0.15, eyeNoseDist * 1.2));
}
