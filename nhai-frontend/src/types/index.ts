export * from './face.types';
export * from './liveness.types';
export * from './navigation.types';

// ─── Verification types ───────────────────────────────────────────────────────

export type VerificationStatus = 'idle' | 'scanning' | 'liveness' | 'matching' | 'success' | 'failed' | 'error';

export interface VerificationResult {
  id: string;
  status: 'success' | 'failed';
  confidence: number;
  livenessScore: number;
  latencyMs: number;
  timestamp: number;
  userId?: string;
  environment: 'indoor' | 'outdoor' | 'low_light';
  deviceId: string;
  synced: boolean;
  errorReason?: string;
}

export type AppTheme = 'default' | 'solar' | 'nocturne';

export interface AppSettings {
  language: 'en' | 'hi';
  voiceGuidance: boolean;
  hapticFeedback: boolean;
  showDebugPanel: boolean;
  autoBrightness: boolean;
  demoMode: boolean;
  matchThreshold: number;
  maxEnrollmentAngles: number;
  syncEnabled: boolean;
  syncEndpoint: string;
  backendDeviceId: string;
  backendApiKey: string;
  employeeId: string;
}

export interface DebugMetrics {
  modelInferenceMs: number;
  frameProcessingMs: number;
  currentFps: number;
  ramUsageMb: number;
  modelSizeKb: number;
  confidenceBreakdown: {
    faceDetection: number;
    livenessCheck: number;
    embeddingMatch: number;
  };
  totalPipelineMs: number;
}
