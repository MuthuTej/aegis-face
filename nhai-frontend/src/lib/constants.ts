// ─────────────────────────────────────────────────────────────────────────────
// Aegis Design Tokens & Runtime Constants
// ─────────────────────────────────────────────────────────────────────────────

export const COLORS = {
  // ── Light theme (all screens except camera) ───────────────────────────────
  bg: '#F4F6FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF3FF',

  primary: '#1A54D2',
  primaryDark: '#1239A8',
  primaryLight: '#EEF3FF',
  primaryBorder: '#BFCDF8',

  text: '#111827',
  textSub: '#6B7280',
  textMuted: '#9CA3AF',

  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  success: '#059669',
  successBg: '#ECFDF5',
  successBorder: '#6EE7B7',

  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  dangerBorder: '#FECACA',

  warning: '#D97706',
  warningBg: '#FFFBEB',
  warningBorder: '#FDE68A',

  amber: '#D97706',
  amberBg: '#FFFBEB',
  purple: '#7C3AED',
  purpleBg: '#F5F3FF',

  // ── Dark theme (camera / overlay screens) ────────────────────────────────
  navy950: '#050C1A',
  navy900: '#0A1428',
  navy800: '#0D1F3C',
  cyanAegis: '#00E5FF',
  amberAegis: '#FFB800',
  white: '#FFFFFF',
  glassWhite: 'rgba(255,255,255,0.06)',
  glassDark: 'rgba(5,12,26,0.72)',
  borderSubtle: 'rgba(255,255,255,0.10)',
  borderCyan: 'rgba(0,229,255,0.30)',
} as const;

export const FONTS = {
  regular: 'System',
  bold: 'System',
  mono: 'Courier',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

// ─── ML Model Constants ───────────────────────────────────────────────────────

export const ML_MODELS = {
  /** Face detection model — MobileFaceNet or BlazeFace */
  FACE_DETECTOR: 'face_detector.tflite',
  /** Face embedding model — MobileFaceNet 128-d */
  FACE_EMBEDDING: 'face_embedding.tflite',
  /** Liveness / anti-spoofing model */
  LIVENESS: 'liveness_v2.tflite',
  /** Eye landmark model for EAR calculation */
  EYE_LANDMARK: 'eye_landmark.tflite',
} as const;

export const MODEL_INPUT_SIZES = {
  FACE_DETECTOR: { width: 128, height: 128 },
  FACE_EMBEDDING: { width: 112, height: 112 },
  LIVENESS: { width: 224, height: 224 },
} as const;

// ─── Liveness Engine ─────────────────────────────────────────────────────────

export const LIVENESS = {
  /** Minimum frames to observe before accepting blink */
  BLINK_DEBOUNCE_FRAMES: 3,
  /** EAR threshold for closed eye */
  EAR_THRESHOLD: 0.20,
  /** MAR threshold for smile */
  MAR_THRESHOLD: 0.55,
  /** Head yaw degrees for left/right */
  HEAD_YAW_THRESHOLD: 20,
  /** Head pitch degrees for up/down */
  HEAD_PITCH_THRESHOLD: 15,
  /** Number of challenges in a session */
  CHALLENGE_COUNT: 3,
  /** Per-challenge timeout seconds */
  CHALLENGE_TIMEOUT_S: 5,
} as const;

// ─── Quality Thresholds ───────────────────────────────────────────────────────

export const QUALITY = {
  /** Minimum quality to accept a frame for enrollment */
  MIN_ENROLLMENT: 70,
  /** Minimum quality to proceed with verification */
  MIN_VERIFICATION: 55,
  /** Sharpness (Laplacian variance) minimum */
  MIN_SHARPNESS: 50,
  /** Ideal face size in frame (20–70% of frame area) */
  FACE_SIZE_MIN: 0.10,
  FACE_SIZE_MAX: 0.70,
} as const;

// ─── Face Matching ────────────────────────────────────────────────────────────

export const MATCHING = {
  /** Default cosine similarity threshold */
  DEFAULT_THRESHOLD: 0.60,
  /** High-security threshold */
  STRICT_THRESHOLD: 0.72,
  /** Embedding vector dimension */
  EMBEDDING_DIM: 128,
} as const;

// ─── Camera ───────────────────────────────────────────────────────────────────

export const CAMERA = {
  /** Target FPS for frame processor */
  TARGET_FPS: 15,
  /** Enrollment capture FPS */
  ENROLLMENT_FPS: 5,
  /** Preview FPS (UI updates) */
  PREVIEW_FPS: 30,
} as const;

// ─── Haptics ─────────────────────────────────────────────────────────────────

export const HAPTIC_PATTERNS = {
  CHALLENGE_START: 'medium',
  CHALLENGE_PASS: 'heavy',
  VERIFICATION_SUCCESS: 'heavy',
  VERIFICATION_FAIL: 'medium',
  FRAME_ACCEPT: 'light',
} as const;

// ─── Demo Mode Simulation ─────────────────────────────────────────────────────

export const DEMO = {
  SIMULATED_CONFIDENCE: 0.978,
  SIMULATED_LATENCY_MS: 420,
  SIMULATED_LIVENESS_SCORE: 0.99,
  SCAN_DURATION_MS: 2400,
} as const;
