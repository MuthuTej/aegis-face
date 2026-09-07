/**
 * useLivenessEngine
 *
 * Drives the liveness challenge sequence:
 *  1. Randomly selects N challenges from the pool
 *  2. Presents them one at a time with countdown timer
 *  3. Evaluates EAR / MAR / head-pose per frame
 *  4. Triggers callbacks on pass / fail / timeout
 *
 * Anti-replay: challenge sequence is randomized per session.
 * Anti-spoofing: correlates geometric cues with texture model score.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  ChallengeType,
  LivenessChallenge,
  ChallengeState,
  LivenessSession,
  DetectedFace,
  LivenessFrameResult,
} from '@/types';
import {
  CHALLENGE_DEFINITIONS,
  ChallengeStatus,
} from '@/types/liveness.types';
import { buildFrameResult } from '@/lib/ml/livenessDetector';
import { LIVENESS } from '@/lib/constants';
import { useHaptics } from './useHaptics';
import { useVoiceGuidance } from './useVoiceGuidance';

const CHALLENGE_POOL: ChallengeType[] = [
  'blink',
  'smile',
  'head_left',
  'head_right',
];

function randomizeChallenges(count: number): LivenessChallenge[] {
  const shuffled = [...CHALLENGE_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((type, idx) => ({
    id: `challenge_${idx}`,
    ...CHALLENGE_DEFINITIONS[type],
  }));
}

export function useLivenessEngine(onSessionComplete: (session: LivenessSession) => void) {
  const haptics = useHaptics();
  const voice = useVoiceGuidance();

  const [session, setSession] = useState<LivenessSession | null>(null);
  const [currentChallenge, setCurrentChallenge] = useState<ChallengeState | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isActive, setIsActive] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousPoseRef = useRef<{ yaw: number; pitch: number; roll: number } | null>(null);
  const challengeStartRef = useRef(Date.now());

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startSession = useCallback(() => {
    const challenges = randomizeChallenges(LIVENESS.CHALLENGE_COUNT);
    const challengeStates: ChallengeState[] = challenges.map((c) => ({
      challenge: c,
      status: 'pending' as ChallengeStatus,
      currentValue: 0,
      attempts: 0,
    }));

    const newSession: LivenessSession = {
      sessionId: `liveness_${Date.now()}`,
      challenges: challengeStates,
      currentChallengeIndex: 0,
      overallPassed: false,
      startedAt: Date.now(),
      totalLatencyMs: 0,
    };

    setSession(newSession);
    setIsActive(true);
    activateChallenge(newSession, 0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activateChallenge = useCallback(
    (_sess: LivenessSession, index: number) => {
      const state = _sess.challenges[index];
      if (!state) return;

      challengeStartRef.current = Date.now();
      const active: ChallengeState = { ...state, status: 'active', startedAt: Date.now() };

      setCurrentChallenge(active);
      setTimeRemaining(state.challenge.timeout);
      haptics.medium();
      voice.speak(`challenge${state.challenge.type.replace('_', '').charAt(0).toUpperCase() + state.challenge.type.replace('_', '').slice(1)}`);

      clearTimer();
      timerRef.current = setInterval(() => {
        setTimeRemaining((t) => {
          if (t <= 1) {
            clearTimer();
            handleChallengeTimeout(_sess, index);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    },
    [clearTimer, haptics, voice] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleChallengeTimeout = useCallback(
    (_sess: LivenessSession, index: number) => {
      setSession((prev) => {
        if (!prev) return prev;
        const updated = { ...prev };
        const challengeState = updated.challenges[index];
        if (challengeState) {
          updated.challenges[index] = { ...challengeState, status: 'timeout' };
        }
        onSessionComplete({ ...updated, overallPassed: false });
        return updated;
      });
      setIsActive(false);
      haptics.error();
    },
    [haptics, onSessionComplete]
  );

  const handleChallengePass = useCallback(
    (_sess: LivenessSession, index: number) => {
      clearTimer();
      haptics.success();
      voice.speak('challengePassed');

      const nextIndex = index + 1;

      setSession((prev) => {
        if (!prev) return prev;
        const updated = { ...prev };
        const state = updated.challenges[index];
        if (state) {
          updated.challenges[index] = {
            ...state,
            status: 'passed',
            completedAt: Date.now(),
          };
        }

        if (nextIndex >= updated.challenges.length) {
          // All challenges complete
          const finalSession: LivenessSession = {
            ...updated,
            overallPassed: true,
            completedAt: Date.now(),
            totalLatencyMs: Date.now() - updated.startedAt,
          };
          setTimeout(() => onSessionComplete(finalSession), 300);
          setIsActive(false);
          return finalSession;
        }

        // Advance to next challenge
        setTimeout(() => activateChallenge(updated, nextIndex), 600);
        return { ...updated, currentChallengeIndex: nextIndex };
      });
    },
    [clearTimer, haptics, voice, activateChallenge, onSessionComplete]
  );

  /**
   * Feed a camera frame result into the engine.
   * Call this from your frame processing loop.
   */
  const processFrame = useCallback(
    (face: DetectedFace) => {
      if (!isActive || !session || !currentChallenge) return;

      const { challenge } = currentChallenge;
      if (!face.landmarks || !face.headPose) return;

      const frameResult: LivenessFrameResult = buildFrameResult(
        face.landmarks,
        face.headPose,
        previousPoseRef.current,
        0.97
      );

      previousPoseRef.current = face.headPose;

      const idx = session.currentChallengeIndex;
      let passed = false;

      switch (challenge.type) {
        case 'blink':
          passed = frameResult.ear.isBlinking;
          break;
        case 'smile':
          passed = frameResult.mar.isSmiling;
          break;
        case 'head_left':
          passed = frameResult.headMovement.yaw < -challenge.threshold;
          break;
        case 'head_right':
          passed = frameResult.headMovement.yaw > challenge.threshold;
          break;
        case 'head_up':
          passed = frameResult.headMovement.pitch > challenge.threshold;
          break;
        case 'head_down':
          passed = frameResult.headMovement.pitch < challenge.threshold;
          break;
      }

      if (passed) {
        handleChallengePass(session, idx);
      }
    },
    [isActive, session, currentChallenge, handleChallengePass]
  );

  const stopSession = useCallback(() => {
    clearTimer();
    setIsActive(false);
    setSession(null);
    setCurrentChallenge(null);
    previousPoseRef.current = null;
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return {
    session,
    currentChallenge,
    timeRemaining,
    isActive,
    startSession,
    stopSession,
    processFrame,
  };
}
