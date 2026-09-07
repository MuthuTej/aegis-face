import React, { useEffect } from 'react';
import { Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { useUIStore } from '@/store/uiStore';
import { COLORS, BORDER_RADIUS } from '@/lib/constants';

export function OfflineIndicator() {
  const isOnline = useUIStore((s) => s.isOnline);

  const translateY = useSharedValue(-48);
  const opacity = useSharedValue(0);
  const dotOpacity = useSharedValue(1);

  useEffect(() => {
    if (!isOnline) {
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 300 });
      dotOpacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 600 }),
          withTiming(1.0, { duration: 600 })
        ),
        -1,
        true
      );
    } else {
      translateY.value = withSpring(-48);
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [isOnline, translateY, opacity, dotOpacity]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOpacity.value }));

  if (isOnline) return null;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 52,
          alignSelf: 'center',
          zIndex: 100,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          backgroundColor: COLORS.warningBg,
          borderRadius: BORDER_RADIUS.full,
          paddingHorizontal: 14,
          paddingVertical: 7,
          borderWidth: 1,
          borderColor: COLORS.warningBorder,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 4,
        },
        containerStyle,
      ]}
    >
      <Animated.View
        style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.warning }, dotStyle]}
      />
      <Text style={{ color: COLORS.warning, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
        Offline Mode
      </Text>
    </Animated.View>
  );
}
