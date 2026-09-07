/**
 * useFaceVerification
 *
 * Orchestrates the complete verification pipeline:
 *   1. Face detection + quality gate
 *   2. Liveness challenge sequence
 *   3. Embedding generation
 *   4. Embedding comparison against enrolled faces
 *   5. Result recording + offline queue
 *
 * Returns live status, confidence, and final result.
 */

import { useState, useCallback, useRef, startTransition } from 'react';
import * as Device from 'expo-device';
import type {
  VerificationStatus,
  VerificationResult,
  DetectedFace,
  LivenessSession,
} from '@/types';
import { generateEmbedding, matchAgainstEnrolled } from '@/lib/ml/faceEmbedding';
import { useEnrollmentStore } from '@/store/enrollmentStore';
import { useVerificationStore } from '@/store/verificationStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUIStore } from '@/store/uiStore';
import { DEMO } from '@/lib/constants';
import { useHaptics } from './useHaptics';
import { useVoiceGuidance } from './useVoiceGuidance';
import { enqueueAttendance, syncToBackend } from '@/services/sync/backendSync';
import { getCurrentLocation } from '@/services/location/locationService';

function generateId(): string {
  return `ver_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function detectEnvironment(): 'indoor' | 'outdoor' | 'low_light' {
  return 'indoor';
}

async function syncRecord(
  result: import('@/types').VerificationResult,
  opts: {
    syncEnabled: boolean;
    syncEndpoint: string;
    backendDeviceId: string;
    backendApiKey: string;
    employeeId: string;
    matchScore?: number;
    livenessPassed?: boolean;
  }
) {
  if (!opts.syncEnabled || !opts.syncEndpoint) return;
  try {
    const coords = await getCurrentLocation();
    const record = {
      clientUuid: result.id,
      employeeId: opts.employeeId,
      capturedAt: new Date(result.timestamp).toISOString(),
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      livenessPassed: opts.livenessPassed ?? true,
      livenessMethod: 'multi' as const,
      matchScore: opts.matchScore,
    };
    await enqueueAttendance(record);
    console.log(`[Sync] Record queued. GPS: ${coords ? `${coords.latitude.toFixed(4)},${coords.longitude.toFixed(4)}` : 'unavailable'}`);
    // Attempt immediate sync if online
    await syncToBackend({ endpoint: opts.syncEndpoint, deviceId: opts.backendDeviceId, apiKey: opts.backendApiKey });
  } catch (e) {
    console.error('[Sync] Failed to queue/sync:', e);
  }
}

export function useFaceVerification() {
  const haptics = useHaptics();
  const voice = useVoiceGuidance();

  const enrolledFaces = useEnrollmentStore((s) => s.enrolledFaces);
  const setStatus = useVerificationStore((s) => s.setStatus);
  const setConfidence = useVerificationStore((s) => s.setConfidence);
  const recordResult = useVerificationStore((s) => s.recordResult);
  const startPipeline = useVerificationStore((s) => s.startPipeline);
  const matchThreshold = useSettingsStore((s) => s.matchThreshold);
  const demoMode = useSettingsStore((s) => s.demoMode);
  const syncEnabled = useSettingsStore((s) => s.syncEnabled);
  const syncEndpoint = useSettingsStore((s) => s.syncEndpoint);
  const backendDeviceId = useSettingsStore((s) => s.backendDeviceId);
  const backendApiKey = useSettingsStore((s) => s.backendApiKey);
  const employeeId = useSettingsStore((s) => s.employeeId);
  const updateDebugMetrics = useUIStore((s) => s.updateDebugMetrics);

  const [status, setLocalStatus] = useState<VerificationStatus>('idle');
  const [confidence, setLocalConfidence] = useState(0);
  const pipelineStartRef = useRef<number>(0);
  const capturedFaceRef = useRef<DetectedFace | null>(null);
  const currentFrameBufferRef = useRef<Uint8Array>(new Uint8Array(0));

  const updateStatus = useCallback(
    (s: VerificationStatus) => {
      setLocalStatus(s);
      setStatus(s);
    },
    [setStatus]
  );

  const updateConfidence = useCallback(
    (c: number) => {
      setLocalConfidence(c);
      setConfidence(c);
    },
    [setConfidence]
  );

  /**
   * Begin the verification pipeline. Call when face is detected and
   * quality is sufficient.
   */
  const beginVerification = useCallback(
    async (face: DetectedFace) => {
      if (status !== 'idle' && status !== 'scanning') return;

      capturedFaceRef.current = face;
      pipelineStartRef.current = Date.now();

      startTransition(() => {
        startPipeline();
        updateStatus('scanning');
      });
      voice.speak('verifyStart');
    },
    [status, startPipeline, updateStatus, voice]
  );

  /**
   * Called after liveness engine completes its challenge sequence.
   */
  const onLivenessComplete = useCallback(
    async (session: LivenessSession) => {
      // Demo mode: always simulate success regardless of liveness result
      if (demoMode) {
        updateStatus('matching');
        await simulateDemoSuccess(session);
        return;
      }

      if (!session.overallPassed) {
        updateStatus('failed');
        haptics.error();
        voice.speak('verifyFailed');

        const result: VerificationResult = {
          id: generateId(),
          status: 'failed',
          confidence: 0,
          livenessScore: 0,
          latencyMs: Date.now() - pipelineStartRef.current,
          timestamp: Date.now(),
          environment: detectEnvironment(),
          deviceId: Device.modelId ?? 'unknown',
          synced: false,
          errorReason: 'Liveness challenge failed',
        };

        startTransition(() => recordResult(result));
        void syncRecord(result, { syncEnabled, syncEndpoint, backendDeviceId, backendApiKey, employeeId, livenessPassed: false, matchScore: 0 });
        return;
      }

      updateStatus('matching');

      try {
        const face = capturedFaceRef.current;
        if (!face) throw new Error('No captured face');

        const tStart = Date.now();
        // Use real dimensions if set via setFrameBuffer
        const bufMeta = currentFrameBufferRef as unknown as Record<string, unknown>;
        const frameW = (bufMeta.__w as number) ?? 0;
        const frameH = (bufMeta.__h as number) ?? 0;
        let embedding;
        if (currentFrameBufferRef.current.length > 0 && frameW > 0) {
          // Real pixels from camera.takePhoto() — use embedding service directly
          try {
            const embedSvc = require('@/services/faceRecognition/embeddingService') as { generateEmbedding: (b: Uint8Array, f: typeof face, w: number, h: number) => import('@/types/face.types').FaceEmbedding };
            const bytesPerPx = currentFrameBufferRef.current.length / (frameW * frameH);
            const fmt = bytesPerPx >= 3.5 ? 'RGBA' : 'RGB';
            // temporarily set format on ref for embeddingService
            (bufMeta as Record<string, unknown>).__fmt = fmt;
            embedding = embedSvc.generateEmbedding(currentFrameBufferRef.current, face, frameW, frameH);
          } catch {
            embedding = generateEmbedding(currentFrameBufferRef.current, face);
          }
        } else {
          embedding = generateEmbedding(currentFrameBufferRef.current, face);
        }
        const inferenceMs = Date.now() - tStart;

        // Basic liveness check: reject if frame has very low variance (blank wall/uniform scene)
        const buf = currentFrameBufferRef.current;
        if (buf.length > 1000) {
          let sum = 0; let sumSq = 0;
          const step = Math.floor(buf.length / 1000);
          for (let i = 0; i < buf.length; i += step) { sum += buf[i] ?? 0; }
          const mean = sum / (buf.length / step);
          for (let i = 0; i < buf.length; i += step) { const d = (buf[i] ?? 0) - mean; sumSq += d * d; }
          const variance = sumSq / (buf.length / step);
          console.log(`[Verification] Frame variance: ${variance.toFixed(0)} (low = blank scene)`);
          if (variance < 200) {
            updateStatus('failed');
            haptics.error();
            return;
          }
        }
        console.log(`[Verification] Enrolled faces: ${enrolledFaces.length}, embedding norm: ${embedding.norm.toFixed(3)}, buffer: ${currentFrameBufferRef.current.length} bytes`);

        const matchResult = matchAgainstEnrolled(
          embedding,
          enrolledFaces,
          matchThreshold
        );
        console.log(`[Verification] Similarity: ${matchResult.similarity.toFixed(3)}, matched: ${matchResult.matched}, threshold: ${matchThreshold}`);

        const livenessScore = session.challenges.filter(
          (c) => c.status === 'passed'
        ).length / session.challenges.length;

        const totalMs = Date.now() - pipelineStartRef.current;

        updateDebugMetrics({
          modelInferenceMs: inferenceMs,
          totalPipelineMs: totalMs,
          confidenceBreakdown: {
            faceDetection: face.confidence,
            livenessCheck: livenessScore,
            embeddingMatch: matchResult.similarity,
          },
        });

        if (matchResult.matched) {
          updateConfidence(matchResult.similarity);
          updateStatus('success');
          haptics.success();
          voice.speak('verifySuccess');
        } else {
          updateStatus('failed');
          haptics.error();
          voice.speak('verifyFailed');
        }

        const result: VerificationResult = {
          id: generateId(),
          status: matchResult.matched ? 'success' : 'failed',
          confidence: matchResult.similarity,
          livenessScore,
          latencyMs: totalMs,
          timestamp: Date.now(),
          environment: detectEnvironment(),
          deviceId: Device.modelId ?? 'unknown',
          synced: false,
        };

        startTransition(() => recordResult(result));
        void syncRecord(result, {
          syncEnabled, syncEndpoint, backendDeviceId, backendApiKey, employeeId,
          livenessPassed: true,
          matchScore: matchResult.similarity,
        });
      } catch (err) {
        console.error('[FaceVerification] Pipeline error:', err);
        updateStatus('error');
        haptics.error();
      }
    },
    [
      enrolledFaces,
      matchThreshold,
      demoMode,
      haptics,
      voice,
      updateStatus,
      updateConfidence,
      recordResult,
      updateDebugMetrics,
      syncEnabled,
      syncEndpoint,
      backendDeviceId,
      backendApiKey,
      employeeId,
    ]
  );

  const reset = useCallback(() => {
    updateStatus('idle');
    updateConfidence(0);
    capturedFaceRef.current = null;
  }, [updateStatus, updateConfidence]);

  async function simulateDemoSuccess(_session: LivenessSession) {
    await new Promise<void>((r) => setTimeout(r, DEMO.SCAN_DURATION_MS));
    updateConfidence(DEMO.SIMULATED_CONFIDENCE);
    updateStatus('success');
    haptics.success();
    voice.speak('verifySuccess');

    updateDebugMetrics({
      modelInferenceMs: 38,
      totalPipelineMs: DEMO.SIMULATED_LATENCY_MS,
      confidenceBreakdown: {
        faceDetection: 0.98,
        livenessCheck: DEMO.SIMULATED_LIVENESS_SCORE,
        embeddingMatch: DEMO.SIMULATED_CONFIDENCE,
      },
    });

    const result: VerificationResult = {
      id: generateId(),
      status: 'success',
      confidence: DEMO.SIMULATED_CONFIDENCE,
      livenessScore: DEMO.SIMULATED_LIVENESS_SCORE,
      latencyMs: DEMO.SIMULATED_LATENCY_MS,
      timestamp: Date.now(),
      environment: detectEnvironment(),
      deviceId: Device.modelId ?? 'demo-device',
      synced: false,
    };

    startTransition(() => recordResult(result));
  }

  const setFrameBuffer = useCallback((buf: Uint8Array, w: number, h: number) => {
    currentFrameBufferRef.current = buf;
    // Store dims in a way the embedding service can use
    (currentFrameBufferRef as unknown as Record<string, unknown>).__w = w;
    (currentFrameBufferRef as unknown as Record<string, unknown>).__h = h;
  }, []);

  return {
    status,
    confidence,
    beginVerification,
    onLivenessComplete,
    setFrameBuffer,
    reset,
    isVerifying: status === 'scanning' || status === 'liveness' || status === 'matching',
  };
}
