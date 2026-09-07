/**
 * cameraProcessor — Frame preprocessing utilities
 *
 * Pure TypeScript — no React Native imports, no worklet directives.
 * Functions run on the JS thread. When called from inside a Vision Camera
 * frame processor (EAS Build only), mark them 'worklet' at the call site
 * rather than here, to keep this file Expo Go compatible.
 *
 * Pipeline for each camera frame:
 *   rawFrame → nearestNeighborResize → normalizePixels → Float32Array → TFLite
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type PixelFormat = 'RGBA' | 'RGB' | 'YUV_420';

export interface FrameRegion {
  x: number;       // normalized 0-1
  y: number;
  width: number;
  height: number;
}

export interface ProcessedFrame {
  data: Float32Array;
  width: number;
  height: number;
  channels: number;
}

// ─── Frame Resize ─────────────────────────────────────────────────────────────

/**
 * Resize a full RGBA frame buffer to a smaller square using nearest-neighbor sampling.
 * Returns a Float32Array of RGB values normalized to [-1, 1].
 *
 * Nearest-neighbor is O(output) — ~0.4ms for 128×128 on mid-range devices.
 */
export function nearestNeighborResize(
  buffer: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  format: PixelFormat = 'RGBA'
): Float32Array {
  const stride = format === 'RGBA' ? 4 : 3;
  const output = new Float32Array(dstW * dstH * 3);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  let outIdx = 0;
  for (let dy = 0; dy < dstH; dy++) {
    const sy = Math.min(Math.floor(dy * yRatio), srcH - 1);
    for (let dx = 0; dx < dstW; dx++) {
      const sx = Math.min(Math.floor(dx * xRatio), srcW - 1);
      const srcIdx = (sy * srcW + sx) * stride;

      // Normalize [0,255] → [-1,1]
      output[outIdx++] = ((buffer[srcIdx] ?? 0) / 127.5) - 1.0;
      output[outIdx++] = ((buffer[srcIdx + 1] ?? 0) / 127.5) - 1.0;
      output[outIdx++] = ((buffer[srcIdx + 2] ?? 0) / 127.5) - 1.0;
    }
  }
  return output;
}

/**
 * Crop a face region from a frame and resize to the target square.
 * bbox coordinates are normalized [0,1].
 *
 * Used to prepare the 112×112 input for MobileFaceNet.
 */
export function cropAndResize(
  buffer: Uint8Array,
  bbox: FrameRegion,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  format: PixelFormat = 'RGBA'
): Float32Array {
  const stride = format === 'RGBA' ? 4 : 3;

  // Convert normalized bbox to pixel coords with 20% padding
  const pad = 0.10;
  const x0 = Math.max(0, Math.floor((bbox.x - pad * bbox.width) * srcW));
  const y0 = Math.max(0, Math.floor((bbox.y - pad * bbox.height) * srcH));
  const x1 = Math.min(srcW - 1, Math.floor((bbox.x + bbox.width + pad * bbox.width) * srcW));
  const y1 = Math.min(srcH - 1, Math.floor((bbox.y + bbox.height + pad * bbox.height) * srcH));

  const cropW = x1 - x0;
  const cropH = y1 - y0;

  if (cropW <= 0 || cropH <= 0) return new Float32Array(dstW * dstH * 3);

  const xRatio = cropW / dstW;
  const yRatio = cropH / dstH;

  const output = new Float32Array(dstW * dstH * 3);
  let outIdx = 0;

  for (let dy = 0; dy < dstH; dy++) {
    const sy = y0 + Math.min(Math.floor(dy * yRatio), cropH - 1);
    for (let dx = 0; dx < dstW; dx++) {
      const sx = x0 + Math.min(Math.floor(dx * xRatio), cropW - 1);
      const srcIdx = (sy * srcW + sx) * stride;

      output[outIdx++] = ((buffer[srcIdx] ?? 0) / 127.5) - 1.0;
      output[outIdx++] = ((buffer[srcIdx + 1] ?? 0) / 127.5) - 1.0;
      output[outIdx++] = ((buffer[srcIdx + 2] ?? 0) / 127.5) - 1.0;
    }
  }
  return output;
}

/**
 * Normalize a Float32Array of pixel values from [0,255] to [-1,1].
 * Use when the buffer is already extracted as RGB (not RGBA).
 */
export function normalizePixels(pixels: Float32Array): Float32Array {
  const out = new Float32Array(pixels.length);
  for (let i = 0; i < pixels.length; i++) {
    out[i] = ((pixels[i] ?? 0) / 127.5) - 1.0;
  }
  return out;
}

/**
 * Extract a subregion from a larger RGBA buffer.
 * Returns raw RGBA bytes (not normalized) for the cropped area.
 */
export function extractRegion(
  buffer: Uint8Array,
  region: FrameRegion,
  srcW: number,
  srcH: number
): { data: Uint8Array; width: number; height: number } {
  const x0 = Math.max(0, Math.floor(region.x * srcW));
  const y0 = Math.max(0, Math.floor(region.y * srcH));
  const w = Math.min(srcW - x0, Math.ceil(region.width * srcW));
  const h = Math.min(srcH - y0, Math.ceil(region.height * srcH));

  const result = new Uint8Array(w * h * 4);
  for (let row = 0; row < h; row++) {
    const srcRow = (y0 + row) * srcW + x0;
    for (let col = 0; col < w; col++) {
      const si = (srcRow + col) * 4;
      const di = (row * w + col) * 4;
      result[di] = buffer[si] ?? 0;
      result[di + 1] = buffer[si + 1] ?? 0;
      result[di + 2] = buffer[si + 2] ?? 0;
      result[di + 3] = buffer[si + 3] ?? 0;
    }
  }
  return { data: result, width: w, height: h };
}

/**
 * Compute the mean brightness of a region (used for quality assessment).
 * Returns 0–255.
 */
export function computeMeanBrightness(
  buffer: Uint8Array,
  region: FrameRegion,
  srcW: number,
  srcH: number
): number {
  const x0 = Math.max(0, Math.floor(region.x * srcW));
  const y0 = Math.max(0, Math.floor(region.y * srcH));
  const x1 = Math.min(srcW - 1, Math.floor((region.x + region.width) * srcW));
  const y1 = Math.min(srcH - 1, Math.floor((region.y + region.height) * srcH));

  let sum = 0;
  let count = 0;
  for (let y = y0; y <= y1; y += 4) {
    for (let x = x0; x <= x1; x += 4) {
      const i = (y * srcW + x) * 4;
      const r = buffer[i] ?? 0;
      const g = buffer[i + 1] ?? 0;
      const b = buffer[i + 2] ?? 0;
      sum += 0.299 * r + 0.587 * g + 0.114 * b;
      count++;
    }
  }
  return count > 0 ? sum / count : 128;
}
