/**
 * challengeEngine — Randomized challenge-based liveness
 *
 * Randomly selects 2 challenges from the active pool and runs a state machine
 * through them. Wraps the existing useLivenessEngine logic as a pure service
 * that can be called from a pipeline (no React hooks required).
 *
 * For the UI-driven flow (SentinelScreen), useLivenessEngine continues to be
 * the primary driver. This service provides the pure-logic counterpart for
 * testing and headless integration.
 */

import type { DetectedFace, LivenessSession, ChallengeState, ChallengeType } from '@/types';
import { CHALLENGE_DEFINITIONS, ChallengeStatus } from '@/types/liveness.types';
import { LIVENESS } from '@/lib/constants';
import { BlinkDetector } from './blinkDetector';
import { HeadPoseDetector } from './headPoseDetector';
import { buildFrameResult } from '@/lib/ml/livenessDetector';

// ─── Challenge Pool ───────────────────────────────────────────────────────────

const CHALLENGE_POOL: ChallengeType[] = ['blink', 'head_left', 'head_right'];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChallengeSessionResult {
  passed: boolean;
  completedChallenges: ChallengeType[];
  failedChallenge?: ChallengeType;
  totalDurationMs: number;
}

export interface FrameProcessResult {
  challengeCompleted: boolean;
  sessionComplete: boolean;
  sessionPassed: boolean;
  currentChallengeType: ChallengeType | null;
  currentChallengeIndex: number;
}

// ─── ChallengeEngine Class ────────────────────────────────────────────────────

export class ChallengeEngine {
  private session: LivenessSession | null = null;
  private blinkDetector = new BlinkDetector();
  private headPoseDetector = new HeadPoseDetector();
  private previousPose: { yaw: number; pitch: number; roll: number } | null = null;
  private sessionStartMs = 0;

  /** Create a new randomized session with 2 challenges. */
  createSession(): LivenessSession {
    const shuffled = [...CHALLENGE_POOL].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, LIVENESS.CHALLENGE_COUNT);

    const challenges: ChallengeState[] = selected.map((type, idx) => ({
      challenge: { id: `ch_${idx}`, ...CHALLENGE_DEFINITIONS[type] },
      status: 'pending' as ChallengeStatus,
      currentValue: 0,
      attempts: 0,
    }));

    this.session = {
      sessionId: `eng_${Date.now()}`,
      challenges,
      currentChallengeIndex: 0,
      overallPassed: false,
      startedAt: Date.now(),
      totalLatencyMs: 0,
    };

    // Activate first challenge
    this.activateCurrent();
    this.sessionStartMs = Date.now();
    this.blinkDetector.reset();
    this.headPoseDetector.reset();

    return this.session;
  }

  /**
   * Feed a camera frame's DetectedFace into the engine.
   * Returns the updated state after processing.
   */
  processFrame(face: DetectedFace): FrameProcessResult {
    if (!this.session) {
      return { challengeCompleted: false, sessionComplete: false, sessionPassed: false, currentChallengeType: null, currentChallengeIndex: 0 };
    }

    const idx = this.session.currentChallengeIndex;
    const challengeState = this.session.challenges[idx];

    if (!challengeState || challengeState.status !== 'active') {
      return { challengeCompleted: false, sessionComplete: false, sessionPassed: false, currentChallengeType: null, currentChallengeIndex: idx };
    }

    const { challenge } = challengeState;
    if (!face.landmarks || !face.headPose) {
      return { challengeCompleted: false, sessionComplete: false, sessionPassed: false, currentChallengeType: challenge.type, currentChallengeIndex: idx };
    }

    // Build frame metrics (reuses existing livenessDetector utility)
    const frameResult = buildFrameResult(
      face.landmarks,
      face.headPose,
      this.previousPose,
      0.97
    );
    this.previousPose = face.headPose;

    // Route to appropriate detector
    let passed = false;
    switch (challenge.type) {
      case 'blink': {
        const result = this.blinkDetector.addFrame(face.landmarks);
        passed = result.blinkDetected;
        break;
      }
      case 'head_left': {
        const result = this.headPoseDetector.addPose(face.headPose);
        passed = result.turnedLeft;
        break;
      }
      case 'head_right': {
        const result = this.headPoseDetector.addPose(face.headPose);
        passed = result.turnedRight;
        break;
      }
      default:
        // smile / head_up / head_down — use generic frame result
        passed = evaluateGenericChallenge(challenge.type, frameResult.ear.averageEAR, frameResult.mar.mar, frameResult.headMovement.yaw, frameResult.headMovement.pitch);
    }

    if (passed) {
      return this.markChallengeComplete(idx);
    }

    return {
      challengeCompleted: false,
      sessionComplete: false,
      sessionPassed: false,
      currentChallengeType: challenge.type,
      currentChallengeIndex: idx,
    };
  }

  getSession(): LivenessSession | null {
    return this.session;
  }

  getChallengeResult(): ChallengeSessionResult | null {
    if (!this.session) return null;
    const completed = this.session.challenges
      .filter((c) => c.status === 'passed')
      .map((c) => c.challenge.type);
    const failed = this.session.challenges.find((c) => c.status === 'failed' || c.status === 'timeout');
    return {
      passed: this.session.overallPassed,
      completedChallenges: completed,
      failedChallenge: failed?.challenge.type,
      totalDurationMs: Date.now() - this.sessionStartMs,
    };
  }

  reset(): void {
    this.session = null;
    this.blinkDetector.reset();
    this.headPoseDetector.reset();
    this.previousPose = null;
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private activateCurrent(): void {
    if (!this.session) return;
    const state = this.session.challenges[this.session.currentChallengeIndex];
    if (!state) return;
    this.session.challenges[this.session.currentChallengeIndex] = {
      ...state,
      status: 'active',
      startedAt: Date.now(),
    };

    // Reset detectors for fresh challenge
    const type = state.challenge.type;
    if (type === 'blink') this.blinkDetector.resetForChallenge();
    if (type === 'head_left' || type === 'head_right') this.headPoseDetector.resetForChallenge();
  }

  private markChallengeComplete(idx: number): FrameProcessResult {
    if (!this.session) return { challengeCompleted: true, sessionComplete: false, sessionPassed: false, currentChallengeType: null, currentChallengeIndex: idx };

    const state = this.session.challenges[idx];
    if (state) {
      this.session.challenges[idx] = { ...state, status: 'passed', completedAt: Date.now() };
    }

    const nextIdx = idx + 1;

    if (nextIdx >= this.session.challenges.length) {
      // All done
      this.session = {
        ...this.session,
        currentChallengeIndex: nextIdx,
        overallPassed: true,
        completedAt: Date.now(),
        totalLatencyMs: Date.now() - this.session.startedAt,
      };
      return { challengeCompleted: true, sessionComplete: true, sessionPassed: true, currentChallengeType: null, currentChallengeIndex: nextIdx };
    }

    // Advance to next
    this.session = { ...this.session, currentChallengeIndex: nextIdx };
    this.activateCurrent();

    const nextChallenge = this.session.challenges[nextIdx];
    return {
      challengeCompleted: true,
      sessionComplete: false,
      sessionPassed: false,
      currentChallengeType: nextChallenge?.challenge.type ?? null,
      currentChallengeIndex: nextIdx,
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function evaluateGenericChallenge(
  type: ChallengeType,
  _ear: number,
  mar: number,
  _yaw: number,
  pitch: number
): boolean {
  const def = CHALLENGE_DEFINITIONS[type];
  switch (type) {
    case 'smile': return mar > def.threshold;
    case 'head_up': return pitch > def.threshold;
    case 'head_down': return pitch < def.threshold;
    default: return false;
  }
}

// Singleton for use in the pipeline
export const challengeEngine = new ChallengeEngine();
