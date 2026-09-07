import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VerificationResult, VerificationStatus } from '@/types';

const MAX_HISTORY = 100;

interface VerificationState {
  // Persistent history
  history: VerificationResult[];

  // Live pipeline state (ephemeral)
  currentStatus: VerificationStatus;
  lastResult: VerificationResult | null;
  currentConfidence: number;
  currentFaceDetected: boolean;
  pipelineStartTime: number | null;

  // Actions
  setStatus: (status: VerificationStatus) => void;
  setConfidence: (confidence: number) => void;
  setFaceDetected: (detected: boolean) => void;
  startPipeline: () => void;
  recordResult: (result: VerificationResult) => void;
  markSynced: (id: string) => void;
  clearHistory: () => void;
  getUnsyncedResults: () => VerificationResult[];
}

export const useVerificationStore = create<VerificationState>()(
  persist(
    (set, get) => ({
      history: [],
      currentStatus: 'idle',
      lastResult: null,
      currentConfidence: 0,
      currentFaceDetected: false,
      pipelineStartTime: null,

      setStatus: (status) => set({ currentStatus: status }),
      setConfidence: (confidence) => set({ currentConfidence: confidence }),
      setFaceDetected: (detected) => set({ currentFaceDetected: detected }),

      startPipeline: () =>
        set({
          currentStatus: 'scanning',
          currentConfidence: 0,
          currentFaceDetected: false,
          pipelineStartTime: Date.now(),
        }),

      recordResult: (result) =>
        set((state) => ({
          history: [result, ...state.history].slice(0, MAX_HISTORY),
          lastResult: result,
          currentStatus: 'idle',
          pipelineStartTime: null,
        })),

      markSynced: (id) =>
        set((state) => ({
          history: state.history.map((r) =>
            r.id === id ? { ...r, synced: true } : r
          ),
        })),

      clearHistory: () => set({ history: [], lastResult: null }),

      getUnsyncedResults: () => get().history.filter((r) => !r.synced),
    }),
    {
      name: 'aegis-verifications',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        history: state.history,
        lastResult: state.lastResult,
      }),
    }
  )
);
