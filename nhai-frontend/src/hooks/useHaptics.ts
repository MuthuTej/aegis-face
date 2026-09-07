import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore';

export function useHaptics() {
  const hapticFeedback = useSettingsStore((s) => s.hapticFeedback);

  const light = useCallback(() => {
    if (!hapticFeedback) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => null);
  }, [hapticFeedback]);

  const medium = useCallback(() => {
    if (!hapticFeedback) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => null);
  }, [hapticFeedback]);

  const heavy = useCallback(() => {
    if (!hapticFeedback) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => null);
  }, [hapticFeedback]);

  const success = useCallback(() => {
    if (!hapticFeedback) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => null);
  }, [hapticFeedback]);

  const error = useCallback(() => {
    if (!hapticFeedback) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => null);
  }, [hapticFeedback]);

  const warning = useCallback(() => {
    if (!hapticFeedback) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => null);
  }, [hapticFeedback]);

  const selection = useCallback(() => {
    if (!hapticFeedback) return;
    Haptics.selectionAsync().catch(() => null);
  }, [hapticFeedback]);

  return { light, medium, heavy, success, error, warning, selection };
}
