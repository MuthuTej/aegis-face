/**
 * mobileFaceNet — MobileFaceNet INT8 TFLite inference
 *
 * Model: mobilefacenet_int8.tflite (~4.2 MB)
 * Input:  [1, 112, 112, 3] float32, normalized to [-1, 1]
 * Output: [1, 128] float32 — raw (pre-normalized) 128-d face embedding
 *
 * INT8 quantization: 4× smaller, ~30% faster than FP32 on mobile NPU/DSP.
 * Expected LFW accuracy: ~99.5% (MobileFaceNet reference).
 */

// ─── TFLite Optional Import ───────────────────────────────────────────────────

interface TFLiteModel {
  runSync(inputs: ArrayBuffer[]): ArrayBuffer[];
}

type LoadTFLiteModel = (asset: number | string, delegate?: string) => Promise<TFLiteModel>;

let loadTensorflowModel: LoadTFLiteModel | null = null;
try {
  const tflite = require('react-native-fast-tflite') as { loadTensorflowModel: LoadTFLiteModel };
  loadTensorflowModel = tflite.loadTensorflowModel;
} catch {
  // Not available in Expo Go
}

// ─── Model State ─────────────────────────────────────────────────────────────

let embeddingModel: TFLiteModel | null = null;
let modelStatus: 'idle' | 'loading' | 'loaded' | 'error' = 'idle';

export const MODEL_VERSION = 'mobilefacenet_int8_v1';
export const EMBEDDING_DIM = 128;
export const INPUT_SIZE = 112;

export function getMobileFaceNetStatus() {
  return modelStatus;
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

/**
 * Load MobileFaceNet model into memory.
 * Call once at app startup. Idempotent.
 *
 * Uses GPU delegate when available for ~2× speedup on devices with OpenGL ES 3.1+.
 */
export async function initMobileFaceNet(): Promise<boolean> {
  if (modelStatus === 'loaded') return true;
  if (modelStatus === 'loading') return false;
  if (!loadTensorflowModel) {
    console.log('[MobileFaceNet] react-native-fast-tflite not available — using stub');
    return false;
  }

  modelStatus = 'loading';
  try {
    // Try GPU delegate first, fall back to CPU
    try {
      embeddingModel = await loadTensorflowModel(
        require('@assets/models/mobilefacenet.tflite') as number,
        'gpu'
      );
    } catch {
      embeddingModel = await loadTensorflowModel(
        require('@assets/models/mobilefacenet.tflite') as number
      );
    }
    modelStatus = 'loaded';
    console.log('[MobileFaceNet] Model loaded (GPU or CPU)');
    return true;
  } catch (err) {
    modelStatus = 'error';
    console.error('[MobileFaceNet] Load failed:', err);
    return false;
  }
}

export function disposeMobileFaceNet(): void {
  embeddingModel = null;
  modelStatus = 'idle';
}

// ─── Inference ────────────────────────────────────────────────────────────────

/**
 * Run MobileFaceNet on a pre-processed 112×112 face crop.
 *
 * @param faceInput — Float32Array of length 112×112×3, values in [-1,1]
 * @returns Float32Array(128) raw embedding (call l2Normalize before comparing)
 */
export function runEmbedding(faceInput: Float32Array): Float32Array | null {
  if (!embeddingModel) return null;

  try {
    // runSync takes TypedArray[], returns TypedArray[]
    const outputs = embeddingModel.runSync([faceInput] as never) as never as (Float32Array | Int8Array)[];
    const out0 = outputs[0];
    const raw = out0 instanceof Float32Array ? out0 : new Float32Array(out0 ? out0.buffer as ArrayBuffer : new ArrayBuffer(0));

    // Model may return [1, 128] — take the first 128 elements
    return raw.length >= EMBEDDING_DIM
      ? raw.slice(0, EMBEDDING_DIM)
      : null;
  } catch (err) {
    console.error('[MobileFaceNet] Inference error:', err);
    return null;
  }
}

export function isModelLoaded(): boolean {
  return modelStatus === 'loaded' && embeddingModel !== null;
}
