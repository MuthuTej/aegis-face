/**
 * useCamera — unified camera hook with runtime capability detection.
 * Always calls useVisionCamera(); that hook internally falls back to
 * simulation when Vision Camera is not available.
 */

import { useVisionCamera } from '../services/camera/cameraHooks';

export const HAS_VISION_CAMERA = true; // Always try Vision Camera in native build

export function useCamera() {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useVisionCamera();
}
