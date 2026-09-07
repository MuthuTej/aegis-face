/**
 * blinkDetector — Multi-frame EAR-based blink detection
 *
 * Detects a genuine blink by tracking the open→closed→open eye transition
 * across a rolling buffer of frames. Single-frame threshold is not sufficient
 * (would flag rapid head movement as blink), so we require a minimum
 * of BLINK_DEBOUNCE_FRAMES consecutive closed frames.
 *
 * EAR (Eye Aspect Ratio) formula — Soukupová & Čech 2016:
 *   EAR = (|p2-p6| + |p3-p5|) / (2 × |p1-p4|)
 * With 5-point landmarks we use an approximation via the existing computeEAR.
 */

import type { FaceLandmarks } from '@/types';
import { computeEAR } from '@/lib/ml/livenessDetector';
import { LIVENESS } from '@/lib/constants';

// ─── Constants ────────────────────────────────────────────────────────────────

const BUFFER_SIZE = 10;
const OPEN_EAR_MIN = 0.25 as const; // EAR above this = eye open (used in resetForChallenge)

// ─── BlinkDetector Class ──────────────────────────────────────────────────────

export interface BlinkResult {
  blinkDetected: boolean;
  currentEAR: number;
  isCurrentlyBlinking: boolean;
  blinkCount: number;
}

export class BlinkDetector {
  private earBuffer: number[] = [];
  private blinkCount = 0;
  private framesClosedCount = 0;
  private wasOpen = true;

  /** Feed a new frame's face landmarks. Returns blink detection result. */
  addFrame(landmarks: FaceLandmarks): BlinkResult {
    const earMetrics = computeEAR(landmarks);
    const ear = earMetrics.averageEAR;

    this.earBuffer.push(ear);
    if (this.earBuffer.length > BUFFER_SIZE) {
      this.earBuffer.shift();
    }

    const isCurrentlyClosed = ear < LIVENESS.EAR_THRESHOLD;
    let blinkDetected = false;

    if (isCurrentlyClosed) {
      this.framesClosedCount++;
    } else {
      // Transition: closed → open
      if (
        !this.wasOpen &&
        this.framesClosedCount >= LIVENESS.BLINK_DEBOUNCE_FRAMES
      ) {
        this.blinkCount++;
        blinkDetected = true;
      }
      this.framesClosedCount = 0;
    }

    this.wasOpen = !isCurrentlyClosed;

    return {
      blinkDetected,
      currentEAR: ear,
      isCurrentlyBlinking: isCurrentlyClosed,
      blinkCount: this.blinkCount,
    };
  }

  /** Check if a blink has been detected since last reset (used for challenge completion). */
  hasBlinkOccurred(): boolean {
    return this.blinkCount > 0;
  }

  /** Returns smoothed EAR over the rolling buffer. */
  getSmoothedEAR(): number {
    if (this.earBuffer.length === 0) return 0.30;
    return this.earBuffer.reduce((s, v) => s + v, 0) / this.earBuffer.length;
  }

  reset(): void {
    this.earBuffer = [];
    this.blinkCount = 0;
    this.framesClosedCount = 0;
    this.wasOpen = true;
  }

  /** Called at challenge start — resets blink count but keeps EAR baseline. */
  resetForChallenge(): void {
    this.blinkCount = 0;
    this.framesClosedCount = 0;
    const latestEAR = this.earBuffer[this.earBuffer.length - 1] ?? 0.30;
    this.wasOpen = latestEAR > OPEN_EAR_MIN;
  }
}

// Singleton for use in the pipeline
export const blinkDetector = new BlinkDetector();
