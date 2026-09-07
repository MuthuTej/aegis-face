import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';
import { COLORS, BORDER_RADIUS } from '@/lib/constants';
import { formatConfidence } from '@/utils/formatters';

interface ConfidenceMeterProps {
  confidence: number; // 0–1
  label?: string;
  showValue?: boolean;
  height?: number;
}

export function ConfidenceMeter({
  confidence,
  label = 'Confidence',
  showValue = true,
  height = 6,
}: ConfidenceMeterProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(confidence, { damping: 20, stiffness: 120 });
  }, [confidence, progress]);

  const barStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      progress.value,
      [0, 0.60, 0.85],
      [COLORS.danger, COLORS.amberAegis, COLORS.success]
    );
    return {
      width: `${progress.value * 100}%`,
      backgroundColor: color,
    };
  });

  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [0, 0.60, 0.85],
      [COLORS.danger, COLORS.amberAegis, COLORS.success]
    ),
  }));

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '500', letterSpacing: 0.8, textTransform: 'uppercase' }}>
          {label}
        </Text>
        {showValue && (
          <Animated.Text style={[{ fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }, textStyle]}>
            {formatConfidence(confidence)}
          </Animated.Text>
        )}
      </View>

      <View
        style={{
          height,
          backgroundColor: 'rgba(255,255,255,0.10)',
          borderRadius: BORDER_RADIUS.full,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            {
              height: '100%',
              borderRadius: BORDER_RADIUS.full,
              shadowRadius: 6,
              shadowOpacity: 0.6,
            },
            barStyle,
          ]}
        />
      </View>
    </View>
  );
}
