import React from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { FaceQualityMetrics } from '@/types';
import { COLORS, BORDER_RADIUS } from '@/lib/constants';
import { qualityToColor } from '@/utils/colors';

interface QualityHUDProps {
  quality: FaceQualityMetrics | null;
  visible: boolean;
}

interface MetricBarProps {
  label: string;
  value: number;
}

function MetricBar({ label, value }: MetricBarProps) {
  const barWidth = useSharedValue(0);

  React.useEffect(() => {
    barWidth.value = withSpring(value, { damping: 20, stiffness: 150 });
  }, [value, barWidth]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value}%`,
    backgroundColor: qualityToColor(barWidth.value),
  }));

  return (
    <View style={{ gap: 3 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: '500', letterSpacing: 0.6, textTransform: 'uppercase' }}>
          {label}
        </Text>
        <Text style={{ color: qualityToColor(value), fontSize: 9, fontWeight: '700' }}>
          {value}
        </Text>
      </View>
      <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 2, overflow: 'hidden' }}>
        <Animated.View style={[{ height: '100%', borderRadius: 2 }, barStyle]} />
      </View>
    </View>
  );
}

export function QualityHUD({ quality, visible }: QualityHUDProps) {
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    opacity.value = withSpring(visible && quality ? 1 : 0);
  }, [visible, quality, opacity]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!quality) return null;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          bottom: 120,
          left: 16,
          right: 16,
          backgroundColor: 'rgba(5, 12, 26, 0.82)',
          borderRadius: BORDER_RADIUS.md,
          borderWidth: 1,
          borderColor: 'rgba(0,229,255,0.15)',
          padding: 12,
          gap: 8,
        },
        containerStyle,
      ]}
    >
      <Text style={{ color: COLORS.cyanAegis, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>
        Quality Score
      </Text>
      <MetricBar label="Sharp" value={quality.sharpness} />
      <MetricBar label="Light" value={quality.lighting} />
      <MetricBar label="Pose" value={quality.pose} />
      <MetricBar label="Eyes" value={quality.eyeOpen} />
    </Animated.View>
  );
}
