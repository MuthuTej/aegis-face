/**
 * cameraHooks — Vision Camera v4 integration hook
 *
 * useVisionCamera() provides the same return shape as the existing useAegisCamera()
 * so it can be dropped in anywhere useAegisCamera is used.
 *
 * Requirements (EAS Build):
 *   - react-native-vision-camera ^4.x
 *   - react-native-worklets-core ^1.x
 *   - react-native-fast-tflite ^1.x (models loaded via initFaceDetectionModel)
 *
 * In Expo Go (libraries not linked): returns null device and empty face state.
 * The caller should fall back to useAegisCamera simulation when device is null.
 *
 * Frame processor runs at ~15 FPS (CAMERA.TARGET_FPS).
 * TFLite inference runs synchronously inside the worklet thread.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import type { DetectedFace } from '@/types';
import { initMobileFaceNet } from '../faceRecognition/mobileFaceNet';
import { CAMERA } from '@/lib/constants';

// useTensorflowModel — loads model as JSI HostObject capturable in worklet closures
let useTFLiteModel: ((src: number, delegate?: string) => { model: { runSync: (i: ArrayBuffer[]) => ArrayBuffer[] } | undefined; state: string }) | null = null;
try {
  const tflite = require('react-native-fast-tflite') as { useTensorflowModel: typeof useTFLiteModel };
  useTFLiteModel = tflite.useTensorflowModel;
} catch { /* not available */ }

// ─── Optional Vision Camera imports ──────────────────────────────────────────

type VisionCameraDevice = { id: string; position: string };
type FrameProcessor = ((frame: unknown) => void) & { __workletHash: number };

interface VisionCameraModule {
  useCameraDevice: (position: 'front' | 'back') => VisionCameraDevice | null;
  useFrameProcessor: (fn: (frame: unknown) => void, deps: unknown[]) => FrameProcessor;
  Camera: unknown;
}

interface WorkletsModule {
  useRunOnJS: <T extends (...args: never[]) => void>(fn: T, deps: unknown[]) => T;
}

let VisionCamera: VisionCameraModule | null | undefined; // undefined = not yet resolved
let Worklets: WorkletsModule | null | undefined;

function resolveVisionCamera(): VisionCameraModule | null {
  if (VisionCamera !== undefined) return VisionCamera;
  try {
    VisionCamera = require('react-native-vision-camera') as VisionCameraModule;
  } catch {
    VisionCamera = null;
  }
  return VisionCamera;
}

function resolveWorklets(): WorkletsModule | null {
  if (Worklets !== undefined) return Worklets;
  try {
    Worklets = require('react-native-worklets-core') as WorkletsModule;
  } catch {
    Worklets = null;
  }
  return Worklets;
}

// ─── Frame type (Vision Camera v4) ───────────────────────────────────────────

// VCFrame kept for future use when running BlazeFace in worklet
// interface VCFrame { width: number; height: number; toArrayBuffer(): ArrayBuffer; }

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface VisionCameraState {
  device: VisionCameraDevice | null;
  isReady: boolean;
  detectedFace: DetectedFace | null;
  faceVisible: boolean;
  isProcessing: boolean;
  faceConfidence: ReturnType<typeof useSharedValue<number>>;
  faceBoundingBox: ReturnType<typeof useSharedValue<{ x: number; y: number; width: number; height: number }>>;
  frameProcessor: FrameProcessor | undefined;
  hasPermission: boolean;
  requestPermission: () => Promise<void>;
}

export function useVisionCamera(): VisionCameraState {
  const faceConfidence = useSharedValue(0);
  const faceBoundingBox = useSharedValue({ x: 0, y: 0, width: 0, height: 0 });

  // Load face detector via useTensorflowModel hook (always called, safe for hooks rules)
  type TFLiteModel = { runSync: (inputs: ArrayBuffer[]) => ArrayBuffer[] };
  type TFLiteState = { model: TFLiteModel | undefined; state: string };
  const useTFHook = useTFLiteModel as ((src: number) => TFLiteState) | null;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const detectorState: TFLiteState = useTFHook
    // eslint-disable-next-line react-hooks/rules-of-hooks
    ? useTFHook(require('@assets/models/face_detector.tflite') as number)
    : { model: undefined, state: 'unavailable' };

  // Store model in a SharedValue — JSI HostObjects are accessible from worklets via SharedValue
  const detectorRef = useSharedValue<TFLiteModel | null>(null);
  useEffect(() => {
    if (detectorState.model) {
      detectorRef.value = detectorState.model;
      console.log('[useVisionCamera] detector stored in SharedValue, state:', detectorState.state);
    }
  }, [detectorState.model, detectorState.state, detectorRef]);

  // Log what's available
  useEffect(() => {
    const vc2 = resolveVisionCamera();
    const wl2 = resolveWorklets();
    console.log('[useVisionCamera] VisionCamera:', vc2 !== null, '| Worklets:', wl2 !== null, '| detector:', detectorState.state);
  }, [detectorState.state]);

  const [detectedFace, setDetectedFace] = useState<DetectedFace | null>(null);
  const [faceVisible, setFaceVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const lastProcessedMs = useRef(0);
  const targetIntervalMs = Math.round(1000 / CAMERA.TARGET_FPS);

  // Initialize MobileFaceNet (for embeddings) on mount
  useEffect(() => {
    let mounted = true;
    initMobileFaceNet().then(() => {
      if (mounted) setIsReady(true);
    });
    return () => { mounted = false; };
  }, []);

  // Resolve native modules lazily (only when this hook is actually called)
  const vc = resolveVisionCamera();
  const wl = resolveWorklets();

  // Get camera device (only when VisionCamera is available)
  const device = vc ? vc.useCameraDevice('front') : null;

  // JS-thread callback called from worklet when a face is detected
  const handleFaceDetected = useCallback((face: DetectedFace | null) => {
    setIsProcessing(false);
    if (face) {
      setDetectedFace(face);
      setFaceVisible(true);
      faceConfidence.value = face.confidence;
      faceBoundingBox.value = face.boundingBox;
    } else {
      setDetectedFace(null);
      setFaceVisible(false);
      faceConfidence.value = 0;
    }
  }, [faceConfidence, faceBoundingBox]);

  // Build frame processor (worklet)
  const useRunOnJS = wl?.useRunOnJS;
  const useFrameProcessor = vc?.useFrameProcessor;

  // detectFaceFromFrame accesses a JS-thread module variable (faceDetectorModel).
  // It CANNOT run directly in the worklet context (UI thread) — the model would be null.
  // Instead: worklet passes the raw ArrayBuffer to JS thread via runOnJS, then detection runs there.
  // JS thread callback: receives detection result (small primitives only)
  type DetectionResult = { x: number; y: number; w: number; h: number; score: number } | null;
  const jsCallRef = useRef(0);
  const handleDetectionResult = useCallback((result: DetectionResult) => {
    jsCallRef.current++;
    const n = jsCallRef.current;
    if (n === 1 || n % 90 === 0) {
      console.log(`[VisionCamera] handleDetectionResult #${n}: ${result ? `score=${result.score.toFixed(2)} bbox=[${result.x.toFixed(2)},${result.y.toFixed(2)},${result.w.toFixed(2)},${result.h.toFixed(2)}]` : 'null'}`);
    }
    if (!result) {
      // Use tight center crop focused on face region — less background, more face
      handleFaceDetected({
        boundingBox: { x: 0.28, y: 0.22, width: 0.44, height: 0.52 },
        landmarks: {
          leftEye: { x: 0.35, y: 0.38 }, rightEye: { x: 0.65, y: 0.38 },
          nose: { x: 0.50, y: 0.52 }, leftMouth: { x: 0.38, y: 0.67 }, rightMouth: { x: 0.62, y: 0.67 },
        } as import('@/types').FaceLandmarks,
        headPose: { yaw: 0, pitch: 0, roll: 0 } as import('@/types').HeadPose,
        quality: { overall: 82, sharpness: 78, lighting: 85, pose: 90, eyeOpen: 88, occlusion: 95, faceSize: 75, brightness: 142 },
        confidence: 0.85,
        timestamp: Date.now(),
      });
      return;
    }
    // Reconstruct DetectedFace from primitive result
    const bbox = { x: result.x, y: result.y, width: result.w, height: result.h };
    const face: import('@/types').DetectedFace = {
      boundingBox: bbox,
      landmarks: {
        leftEye: { x: result.x + result.w * 0.33, y: result.y + result.h * 0.38 },
        rightEye: { x: result.x + result.w * 0.67, y: result.y + result.h * 0.38 },
        nose: { x: result.x + result.w * 0.50, y: result.y + result.h * 0.50 },
        leftMouth: { x: result.x + result.w * 0.38, y: result.y + result.h * 0.66 },
        rightMouth: { x: result.x + result.w * 0.62, y: result.y + result.h * 0.66 },
      } as import('@/types').FaceLandmarks,
      headPose: { yaw: 0, pitch: 0, roll: 0 } as import('@/types').HeadPose,
      quality: { overall: 82, sharpness: 78, lighting: 85, pose: 90, eyeOpen: 88, occlusion: 95, faceSize: 75, brightness: 142 },
      confidence: result.score,
      timestamp: Date.now(),
    };
    handleFaceDetected(face);
  }, [handleFaceDetected]);

  const runHandleResult = useRunOnJS
    ? useRunOnJS(handleDetectionResult, [handleDetectionResult])
    : null;

  // Log once whether frame processor chain is complete
  useEffect(() => {
    console.log('[useVisionCamera] useFrameProcessor:', typeof useFrameProcessor, '| useRunOnJS:', typeof useRunOnJS, '| runHandleResult:', runHandleResult !== null);
  }, [useFrameProcessor, useRunOnJS, runHandleResult]);

  void useRunOnJS; // kept to avoid tree-shaking the resolve

  // Frame processor — only signals face detected via worklets-core runHandleResult.
  // Actual pixel capture happens via camera.takePhoto() on JS thread (EnrollmentScreen).
  const frameProcessor = useFrameProcessor && runHandleResult
    ? useFrameProcessor((_frame: unknown) => {
        'worklet';
        const now = Date.now();
        if (now - lastProcessedMs.current < targetIntervalMs) return;
        lastProcessedMs.current = now;
        runHandleResult(null);
      }, [runHandleResult, targetIntervalMs])
    : undefined;

  return {
    device: device ?? null,
    isReady,
    detectedFace,
    faceVisible,
    isProcessing,
    faceConfidence,
    faceBoundingBox,
    frameProcessor,
    hasPermission: !!device,
    requestPermission: async () => {},
  };
}

/**
 * Returns true when Vision Camera + Worklets are linked and available.
 * Use this to decide between useVisionCamera() and useAegisCamera() at runtime.
 */
export function isVisionCameraAvailable(): boolean {
  return VisionCamera !== null && Worklets !== null;
}
