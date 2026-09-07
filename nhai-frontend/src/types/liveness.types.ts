// ─────────────────────────────────────────────────────────────────────────────
// Liveness detection types
// ─────────────────────────────────────────────────────────────────────────────

export type ChallengeType = 'blink' | 'smile' | 'head_left' | 'head_right' | 'head_up' | 'head_down';

export interface LivenessChallenge {
  id: string;
  type: ChallengeType;
  instruction: string;
  instructionHindi: string;
  /** Seconds allowed to complete */
  timeout: number;
  /** Threshold for completion (type-specific) */
  threshold: number;
  icon: string;
}

export type ChallengeStatus = 'pending' | 'active' | 'passed' | 'failed' | 'timeout';

export interface ChallengeState {
  challenge: LivenessChallenge;
  status: ChallengeStatus;
  startedAt?: number;
  completedAt?: number;
  /** Current metric value (EAR for blink, MAR for smile, angle for head) */
  currentValue: number;
  attempts: number;
}

export interface LivenessSession {
  sessionId: string;
  challenges: ChallengeState[];
  currentChallengeIndex: number;
  overallPassed: boolean;
  startedAt: number;
  completedAt?: number;
  totalLatencyMs: number;
  /** Anti-spoofing depth score if available */
  depthScore?: number;
  /** IR-based liveness score if available */
  irScore?: number;
}

// Eye Aspect Ratio — used for blink detection
export interface EARMetrics {
  leftEAR: number;
  rightEAR: number;
  averageEAR: number;
  /** True if currently blinking */
  isBlinking: boolean;
  blinkCount: number;
}

// Mouth Aspect Ratio — used for smile detection
export interface MARMetrics {
  mar: number;
  /** True if smiling */
  isSmiling: boolean;
}

export interface HeadMovementMetrics {
  yaw: number;
  pitch: number;
  roll: number;
  /** Velocity of movement deg/frame */
  yawVelocity: number;
  pitchVelocity: number;
}

export interface LivenessFrameResult {
  ear: EARMetrics;
  mar: MARMetrics;
  headMovement: HeadMovementMetrics;
  /** IMU-correlated spoofing score 0–1 (higher = more likely real) */
  imuCorrelation: number;
  timestamp: number;
}

export const CHALLENGE_DEFINITIONS: Record<ChallengeType, Omit<LivenessChallenge, 'id'>> = {
  blink: {
    type: 'blink',
    instruction: 'Blink naturally',
    instructionHindi: 'स्वाभाविक रूप से पलक झपकाएं',
    timeout: 5,
    threshold: 0.20, // EAR below this = blink
    icon: '👁️',
  },
  smile: {
    type: 'smile',
    instruction: 'Show a natural smile',
    instructionHindi: 'स्वाभाविक मुस्कान दिखाएं',
    timeout: 5,
    threshold: 0.55, // MAR above this = smile
    icon: '😊',
  },
  head_left: {
    type: 'head_left',
    instruction: 'Turn head slightly left',
    instructionHindi: 'सिर थोड़ा बाएं मोड़ें',
    timeout: 5,
    threshold: -20, // yaw < -20 = turned left
    icon: '←',
  },
  head_right: {
    type: 'head_right',
    instruction: 'Turn head slightly right',
    instructionHindi: 'सिर थोड़ा दाएं मोड़ें',
    timeout: 5,
    threshold: 20, // yaw > 20 = turned right
    icon: '→',
  },
  head_up: {
    type: 'head_up',
    instruction: 'Tilt head slightly up',
    instructionHindi: 'सिर थोड़ा ऊपर झुकाएं',
    timeout: 5,
    threshold: 15, // pitch > 15 = up
    icon: '↑',
  },
  head_down: {
    type: 'head_down',
    instruction: 'Tilt head slightly down',
    instructionHindi: 'सिर थोड़ा नीचे झुकाएं',
    timeout: 5,
    threshold: -15, // pitch < -15 = down
    icon: '↓',
  },
};
