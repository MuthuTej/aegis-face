import { create } from 'zustand';
import type { AppTheme, DebugMetrics } from '@/types';

interface UIState {
  theme: AppTheme;
  isOnline: boolean;
  debugPanelVisible: boolean;
  toastMessage: string | null;
  toastType: 'success' | 'error' | 'info' | 'warning';
  debugMetrics: DebugMetrics;

  // Actions
  setTheme: (theme: AppTheme) => void;
  setOnlineStatus: (online: boolean) => void;
  toggleDebugPanel: () => void;
  showToast: (message: string, type?: UIState['toastType']) => void;
  hideToast: () => void;
  updateDebugMetrics: (metrics: Partial<DebugMetrics>) => void;
}

const DEFAULT_DEBUG_METRICS: DebugMetrics = {
  modelInferenceMs: 0,
  frameProcessingMs: 0,
  currentFps: 0,
  ramUsageMb: 0,
  modelSizeKb: 0,
  confidenceBreakdown: {
    faceDetection: 0,
    livenessCheck: 0,
    embeddingMatch: 0,
  },
  totalPipelineMs: 0,
};

export const useUIStore = create<UIState>((set) => ({
  theme: 'default',
  isOnline: false,
  debugPanelVisible: false,
  toastMessage: null,
  toastType: 'info',
  debugMetrics: DEFAULT_DEBUG_METRICS,

  setTheme: (theme) => set({ theme }),

  setOnlineStatus: (isOnline) => set({ isOnline }),

  toggleDebugPanel: () =>
    set((state) => ({ debugPanelVisible: !state.debugPanelVisible })),

  showToast: (message, type = 'info') =>
    set({ toastMessage: message, toastType: type }),

  hideToast: () => set({ toastMessage: null }),

  updateDebugMetrics: (metrics) =>
    set((state) => ({
      debugMetrics: { ...state.debugMetrics, ...metrics },
    })),
}));
