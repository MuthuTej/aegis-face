/**
 * useAegisCamera — Expo Go compatible camera hook
 *
 * Uses expo-camera for the live preview. Because Expo Go does not support
 * Vision Camera frame processors, face detection is simulated with a
 * realistic state machine that mimics real-world detection behaviour.
 *
 * To connect real ML inference, build a custom Expo dev client and replace
 * the simulation in startDetectionLoop() with Vision Camera + TFLite calls.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useCameraPermissions } from 'expo-camera';
import { useSharedValue } from 'react-native-reanimated';
import type { DetectedFace } from '@/types';
import { useDebugMetrics } from './useDebugMetrics';
import { useUIStore } from '@/store/uiStore';
import { CAMERA } from '@/lib/constants';

interface AegisCameraState {
  detectedFace: DetectedFace | null;
  faceVisible: boolean;
  isProcessing: boolean;
}

// Realistic face quality that varies naturally
function generateFaceQuality(frameIndex: number) {
  const noise = () => Math.sin(frameIndex * 0.3 + Math.random() * 0.4) * 5;
  const sharpness = Math.min(100, Math.max(55, 78 + noise()));
  const lighting = Math.min(100, Math.max(60, 84 + noise()));
  const pose = Math.min(100, Math.max(70, 88 + noise()));
  const eyeOpen = Math.min(100, Math.max(65, 86 + noise()));
  const overall = Math.round((sharpness + lighting + pose + eyeOpen) / 4);
  return { overall, sharpness: Math.round(sharpness), lighting: Math.round(lighting), pose: Math.round(pose), eyeOpen: Math.round(eyeOpen), occlusion: 95, faceSize: 72, brightness: 138 + Math.round(noise()) };
}

// Bounding box that gently drifts to simulate natural micro-movement
function generateBoundingBox(frameIndex: number) {
  const drift = Math.sin(frameIndex * 0.08) * 0.012;
  return {
    x: 0.22 + drift,
    y: 0.18 + drift * 0.5,
    width: 0.54,
    height: 0.58,
  };
}

function buildSimulatedFace(frameIndex: number): DetectedFace {
  return {
    boundingBox: generateBoundingBox(frameIndex),
    landmarks: {
      leftEye: { x: 0.37, y: 0.37 },
      rightEye: { x: 0.63, y: 0.37 },
      nose: { x: 0.50, y: 0.50 },
      leftMouth: { x: 0.40, y: 0.64 },
      rightMouth: { x: 0.60, y: 0.64 },
    },
    headPose: { yaw: Math.sin(frameIndex * 0.05) * 3, pitch: 0, roll: 0 },
    quality: generateFaceQuality(frameIndex),
    confidence: Math.min(0.99, 0.88 + Math.sin(frameIndex * 0.1) * 0.08),
    timestamp: Date.now(),
  };
}

export function useAegisCamera() {
  const [permission, requestPermission] = useCameraPermissions();
  const { recordFrame, recordMetrics } = useDebugMetrics();
  const updateDebugMetrics = useUIStore((s) => s.updateDebugMetrics);

  const [cameraState, setCameraState] = useState<AegisCameraState>({
    detectedFace: null,
    faceVisible: false,
    isProcessing: false,
  });

  const frameIndexRef = useRef(0);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Delay before "face appears" — simulates real-world scan time
  const warmupRef = useRef(true);
  const warmupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shared values for animated components — updated every frame
  const faceConfidence = useSharedValue(0);
  const faceBoundingBox = useSharedValue({ x: 0, y: 0, width: 0, height: 0 });

  const stopDetectionLoop = useCallback(() => {
    if (loopRef.current) {
      clearInterval(loopRef.current);
      loopRef.current = null;
    }
    if (warmupTimerRef.current) {
      clearTimeout(warmupTimerRef.current);
      warmupTimerRef.current = null;
    }
  }, []);

  const startDetectionLoop = useCallback(() => {
    stopDetectionLoop();
    warmupRef.current = true;
    frameIndexRef.current = 0;

    // Simulate the ~1.2s warmup before first detection
    warmupTimerRef.current = setTimeout(() => {
      warmupRef.current = false;
    }, 1200);

    const intervalMs = Math.round(1000 / CAMERA.TARGET_FPS);

    loopRef.current = setInterval(() => {
      const start = Date.now();
      frameIndexRef.current++;

      if (warmupRef.current) {
        setCameraState({ detectedFace: null, faceVisible: false, isProcessing: true });
        return;
      }

      // PLUG-IN: Replace this block with real Vision Camera frame processing.
      // When using a custom dev client with react-native-vision-camera v4,
      // call detectFace(frameBuffer, width, height) here instead.
      const face = buildSimulatedFace(frameIndexRef.current);
      const elapsed = Date.now() - start;

      faceConfidence.value = face.confidence;
      faceBoundingBox.value = face.boundingBox;

      recordFrame();
      recordMetrics({ frameProcessingMs: elapsed, modelInferenceMs: elapsed });

      setCameraState({ detectedFace: face, faceVisible: true, isProcessing: false });

      updateDebugMetrics({
        confidenceBreakdown: {
          faceDetection: face.confidence,
          livenessCheck: 0,
          embeddingMatch: 0,
        },
      });
    }, intervalMs);
  }, [stopDetectionLoop, faceConfidence, faceBoundingBox, recordFrame, recordMetrics, updateDebugMetrics]);

  // Start loop when permission is granted
  useEffect(() => {
    if (permission?.granted) {
      startDetectionLoop();
    }
    return stopDetectionLoop;
  }, [permission?.granted, startDetectionLoop, stopDetectionLoop]);

  return {
    // expo-camera does not need a specific device object — pass facing="front" directly
    device: permission?.granted ? true : null,
    frameProcessor: undefined, // no-op in Expo Go; plug in when using custom dev client
    hasPermission: permission?.granted ?? false,
    requestPermission,
    isReady: permission?.granted ?? false,
    // JS-thread face state
    detectedFace: cameraState.detectedFace,
    faceVisible: cameraState.faceVisible,
    isProcessing: cameraState.isProcessing,
    // Shared values for animated overlays
    faceConfidence,
    faceBoundingBox,
  };
}
