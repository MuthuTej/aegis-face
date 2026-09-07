import { COLORS } from '@/lib/constants';
import type { AppTheme } from '@/types';

export function getThemeColors(theme: AppTheme) {
  const base = {
    background: COLORS.bg,
    surface: COLORS.surface,
    border: COLORS.border,
    primary: COLORS.primary,
    accent: COLORS.amber,
    text: COLORS.text,
    textSecondary: COLORS.textSub,
    textMuted: COLORS.textMuted,
    success: COLORS.success,
    danger: COLORS.danger,
    warning: COLORS.warning,
  };

  switch (theme) {
    case 'solar':
      return { ...base, background: '#FFF8F0', primary: '#E67E22', border: '#F0D9C0' };
    case 'nocturne':
      return { ...base, background: COLORS.navy950, surface: COLORS.navy900, text: COLORS.white, textSecondary: 'rgba(255,255,255,0.65)', border: COLORS.borderSubtle, primary: COLORS.cyanAegis };
    default:
      return base;
  }
}

export function confidenceToColor(confidence: number): string {
  'worklet';
  if (confidence >= 0.85) return COLORS.success;
  if (confidence >= 0.65) return COLORS.warning;
  return COLORS.danger;
}

export function qualityToColor(score: number): string {
  'worklet';
  if (score >= 75) return COLORS.success;
  if (score >= 50) return COLORS.warning;
  return COLORS.danger;
}

export function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(result[1] ?? '0', 16);
  const g = parseInt(result[2] ?? '0', 16);
  const b = parseInt(result[3] ?? '0', 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
