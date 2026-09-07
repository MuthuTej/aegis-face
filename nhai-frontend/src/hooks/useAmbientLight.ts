import { useEffect, useState, useCallback } from 'react';
import * as Brightness from 'expo-brightness';
import { AppState, AppStateStatus } from 'react-native';
import type { AppTheme } from '@/types';
import { useSettingsStore } from '@/store/settingsStore';
import { useUIStore } from '@/store/uiStore';

const SOLAR_THRESHOLD = 0.85;
const NOCTURNE_THRESHOLD = 0.25;

export function useAmbientLight() {
  const autoBrightness = useSettingsStore((s) => s.autoBrightness);
  const setTheme = useUIStore((s) => s.setTheme);
  const [brightness, setBrightness] = useState<number>(0.5);
  const [theme, setLocalTheme] = useState<AppTheme>('default');

  const checkBrightness = useCallback(async () => {
    if (!autoBrightness) return;
    try {
      const { status } = await Brightness.requestPermissionsAsync();
      if (status !== 'granted') return;

      const systemBrightness = await Brightness.getSystemBrightnessAsync();
      setBrightness(systemBrightness);

      let newTheme: AppTheme = 'default';
      if (systemBrightness >= SOLAR_THRESHOLD) newTheme = 'solar';
      else if (systemBrightness <= NOCTURNE_THRESHOLD) newTheme = 'nocturne';

      if (newTheme !== theme) {
        setLocalTheme(newTheme);
        setTheme(newTheme);
      }
    } catch {
      // Brightness API not available on this device — no-op
    }
  }, [autoBrightness, theme, setTheme]);

  useEffect(() => {
    void checkBrightness();

    const subscription = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'active') void checkBrightness();
      }
    );

    return () => subscription.remove();
  }, [checkBrightness]);

  return { brightness, theme };
}
