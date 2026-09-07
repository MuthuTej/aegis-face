import React from 'react';
import { View, Text, ViewStyle, StyleProp } from 'react-native';
import { COLORS, BORDER_RADIUS } from '@/lib/constants';

interface MetricChipProps {
  label: string;
  value: string;
  color?: string;
  bgColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function MetricChip({
  label,
  value,
  color = COLORS.primary,
  bgColor,
  style,
}: MetricChipProps) {
  const bg = bgColor ?? `${color}14`;
  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: BORDER_RADIUS.md,
          borderWidth: 1,
          borderColor: `${color}30`,
          paddingHorizontal: 12,
          paddingVertical: 10,
          alignItems: 'center',
          gap: 3,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: COLORS.textMuted,
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      <Text style={{ color, fontSize: 14, fontWeight: '800' }}>{value}</Text>
    </View>
  );
}
