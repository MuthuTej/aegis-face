/**
 * headPoseDetector — Smoothed head turn detection
 *
 * Tracks yaw and pitch over a rolling window to detect intentional head turns.
 * Smoothing prevents false positives from brief involuntary movements.
 *
 * Thresholds (from LIVENESS constants):
 *   Turn left:  yaw < -HEAD_YAW_THRESHOLD (-20°)
 *   Turn right: yaw > +HEAD_YAW_THRESHOLD (+20°)
 */

import type { HeadPose } from '@/types';
import { computeHeadMovement } from '@/lib/ml/livenessDetector';
import { LIVENESS } from '@/lib/constants';

// ─── Constants ────────────────────────────────────────────────────────────────

const HISTORY_SIZE = 5;
const MIN_FRAMES_AT_TARGET = 3; // frames yaw must stay past threshold

// ─── HeadPoseDetector Class ───────────────────────────────────────────────────

export interface HeadTurnResult {
  turnedLeft: boolean;
  turnedRight: boolean;
  currentYaw: number;
  currentPitch: number;
  smoothedYaw: number;
}

export class HeadPoseDetector {
  private poseHistory: HeadPose[] = [];
  private framesLeftCount = 0;
  private framesRightCount = 0;
  private turnLeftDetected = false;
  private turnRightDetected = false;
  private previousPose: HeadPose | null = null;

  /** Feed a new HeadPose reading. Returns head turn detection result. */
  addPose(headPose: HeadPose): HeadTurnResult {
    // Track movement velocity via existing utility
    computeHeadMovement(headPose, this.previousPose);
    this.previousPose = headPose;

    this.poseHistory.push(headPose);
    if (this.poseHistory.length > HISTORY_SIZE) {
      this.poseHistory.shift();
    }

    const smoothedYaw = this.getSmoothedYaw();
    void this.getSmoothedPitch();

    // Count consecutive frames past threshold
    if (smoothedYaw < -LIVENESS.HEAD_YAW_THRESHOLD) {
      this.framesLeftCount++;
      this.framesRightCount = 0;
    } else if (smoothedYaw > LIVENESS.HEAD_YAW_THRESHOLD) {
      this.framesRightCount++;
      this.framesLeftCount = 0;
    } else {
      this.framesLeftCount = 0;
      this.framesRightCount = 0;
    }

    // Latch on when threshold is held long enough
    let turnedLeft = false;
    let turnedRight = false;

    if (this.framesLeftCount >= MIN_FRAMES_AT_TARGET && !this.turnLeftDetected) {
      this.turnLeftDetected = true;
      turnedLeft = true;
    }

    if (this.framesRightCount >= MIN_FRAMES_AT_TARGET && !this.turnRightDetected) {
      this.turnRightDetected = true;
      turnedRight = true;
    }

    return {
      turnedLeft,
      turnedRight,
      currentYaw: headPose.yaw,
      currentPitch: headPose.pitch,
      smoothedYaw,
    };
  }

  hasTurnedLeft(): boolean {
    return this.turnLeftDetected;
  }

  hasTurnedRight(): boolean {
    return this.turnRightDetected;
  }

  getSmoothedYaw(): number {
    if (this.poseHistory.length === 0) return 0;
    return this.poseHistory.reduce((s, p) => s + p.yaw, 0) / this.poseHistory.length;
  }

  getSmoothedPitch(): number {
    if (this.poseHistory.length === 0) return 0;
    return this.poseHistory.reduce((s, p) => s + p.pitch, 0) / this.poseHistory.length;
  }

  reset(): void {
    this.poseHistory = [];
    this.framesLeftCount = 0;
    this.framesRightCount = 0;
    this.turnLeftDetected = false;
    this.turnRightDetected = false;
    this.previousPose = null;
  }

  /** Reset detection state for a new challenge, keeping pose history. */
  resetForChallenge(): void {
    this.framesLeftCount = 0;
    this.framesRightCount = 0;
    this.turnLeftDetected = false;
    this.turnRightDetected = false;
  }
}

// Singleton for use in the pipeline
export const headPoseDetector = new HeadPoseDetector();
