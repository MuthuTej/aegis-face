import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppSettings } from '@/types';

const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  voiceGuidance: true,
  hapticFeedback: true,
  showDebugPanel: false,
  autoBrightness: true,
  demoMode: false,
  matchThreshold: 0.72,
  maxEnrollmentAngles: 4,
  syncEnabled: true,
  syncEndpoint: 'https://nhai-backend-production-ff8b.up.railway.app',
  backendDeviceId: 'aegis-nhai-001',
  backendApiKey: 'aegis-hackathon-key-nhai2025',
  employeeId: 'EMP001',
};

interface SettingsState extends AppSettings {
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      updateSetting: (key, value) => set({ [key]: value }),
      resetSettings: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: 'aegis-settings',
      storage: createJSONStorage(() => AsyncStorage),
      // Always use latest defaults for critical values
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Always use latest defaults for critical sync/auth fields
        state.matchThreshold = DEFAULT_SETTINGS.matchThreshold;
        state.syncEnabled = DEFAULT_SETTINGS.syncEnabled;
        state.syncEndpoint = DEFAULT_SETTINGS.syncEndpoint;
        state.backendDeviceId = DEFAULT_SETTINGS.backendDeviceId;
        state.backendApiKey = DEFAULT_SETTINGS.backendApiKey;
      },
    }
  )
);
