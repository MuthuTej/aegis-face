import { useCallback, useEffect, useRef } from 'react';
import { useUIStore } from '@/store/uiStore';

interface RawMetrics {
  frameProcessingMs?: number;
  modelInferenceMs?: number;
  ramUsageMb?: number;
  modelSizeKb?: number;
  faceDetectionConf?: number;
  livenessConf?: number;
  embeddingConf?: number;
  totalPipelineMs?: number;
}

export function useDebugMetrics() {
  const updateDebugMetrics = useUIStore((s) => s.updateDebugMetrics);
  const fpsCounterRef = useRef({ frames: 0, lastReset: Date.now() });
  const fpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fpsIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - fpsCounterRef.current.lastReset) / 1000;
      const fps = fpsCounterRef.current.frames / Math.max(elapsed, 0.001);

      updateDebugMetrics({ currentFps: Math.round(fps) });

      fpsCounterRef.current.frames = 0;
      fpsCounterRef.current.lastReset = now;
    }, 1000);

    return () => {
      if (fpsIntervalRef.current) clearInterval(fpsIntervalRef.current);
    };
  }, [updateDebugMetrics]);

  const recordFrame = useCallback(() => {
    fpsCounterRef.current.frames++;
  }, []);

  const recordMetrics = useCallback((raw: RawMetrics) => {
    updateDebugMetrics({
      frameProcessingMs: raw.frameProcessingMs,
      modelInferenceMs: raw.modelInferenceMs,
      ramUsageMb: raw.ramUsageMb,
      modelSizeKb: raw.modelSizeKb,
      totalPipelineMs: raw.totalPipelineMs,
      confidenceBreakdown: {
        faceDetection: raw.faceDetectionConf ?? 0,
        livenessCheck: raw.livenessConf ?? 0,
        embeddingMatch: raw.embeddingConf ?? 0,
      },
    });
  }, [updateDebugMetrics]);

  return { recordFrame, recordMetrics };
}
