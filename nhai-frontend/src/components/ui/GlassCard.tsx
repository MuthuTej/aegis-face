import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { COLORS, BORDER_RADIUS } from '@/lib/constants';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glowColor?: string;
  elevated?: boolean;
  noPadding?: boolean;
}

export function GlassCard({
  children,
  style,
  noPadding = false,
}: GlassCardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: COLORS.surface,
          borderRadius: BORDER_RADIUS.lg,
          borderWidth: 1,
          borderColor: COLORS.border,
          padding: noPadding ? 0 : 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
