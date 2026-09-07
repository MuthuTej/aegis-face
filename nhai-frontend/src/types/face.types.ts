// ─────────────────────────────────────────────────────────────────────────────
// Face detection & embedding types
// ─────────────────────────────────────────────────────────────────────────────

export interface BoundingBox {
  x: number;       // normalized 0-1
  y: number;
  width: number;
  height: number;
}

export interface FaceLandmarks {
  leftEye: Point2D;
  rightEye: Point2D;
  nose: Point2D;
  leftMouth: Point2D;
  rightMouth: Point2D;
  leftEar?: Point2D;
  rightEar?: Point2D;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D extends Point2D {
  z: number;
}

export interface FaceQualityMetrics {
  /** Overall quality score 0–100 */
  overall: number;
  /** Image sharpness / blur score 0–100 */
  sharpness: number;
  /** Lighting uniformity 0–100 */
  lighting: number;
  /** Head pose alignment 0–100 */
  pose: number;
  /** Eye open confidence 0–100 (average of both eyes) */
  eyeOpen: number;
  /** Occlusion (glasses, mask, hat) score: 0=blocked, 100=clear */
  occlusion: number;
  /** Face size relative to frame 0–100 */
  faceSize: number;
  /** Brightness estimate 0–255 */
  brightness: number;
}

export interface HeadPose {
  /** Yaw in degrees: left(-) / right(+) */
  yaw: number;
  /** Pitch in degrees: down(-) / up(+) */
  pitch: number;
  /** Roll in degrees */
  roll: number;
}

export interface DetectedFace {
  boundingBox: BoundingBox;
  landmarks?: FaceLandmarks;
  headPose?: HeadPose;
  quality: FaceQualityMetrics;
  /** Confidence score of the detection 0–1 */
  confidence: number;
  /** Timestamp of detection */
  timestamp: number;
}

export interface FaceEmbedding {
  /** Float32Array of 128 or 512 dimensions depending on model */
  vector: number[];
  /** Model that produced this embedding */
  modelVersion: string;
  /** Euclidean norm — pre-normalized */
  norm: number;
  createdAt: number;
}

export interface EnrolledFace {
  id: string;
  label: string;
  /** Array of embeddings from multi-angle enrollment */
  embeddings: FaceEmbedding[];
  enrollmentAngles: CaptureAngle[];
  enrolledAt: number;
  /** Encrypted representation stored on device */
  encryptedPayload?: string;
}

export type CaptureAngle = 'front' | 'left_30' | 'right_30' | 'up_tilt';

export interface CaptureAngledResult {
  angle: CaptureAngle;
  embedding: FaceEmbedding;
  quality: FaceQualityMetrics;
  capturedAt: number;
  frameUri?: string;
}

export interface FaceMatchResult {
  matched: boolean;
  /** Cosine similarity 0–1 */
  similarity: number;
  /** Euclidean distance (lower = more similar) */
  distance: number;
  /** Threshold used for this match */
  threshold: number;
  /** Best-matching enrolled face ID */
  matchedId?: string;
  latencyMs: number;
}
