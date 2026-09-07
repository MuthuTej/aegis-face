import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import type { ChallengeState } from '@/types';
import { COLORS, BORDER_RADIUS } from '@/lib/constants';
import { useSettingsStore } from '@/store/settingsStore';

interface ChallengeCardProps {
  challengeState: ChallengeState;
  timeRemaining: number;
}

export function ChallengeCard({ challengeState, timeRemaining }: ChallengeCardProps) {
  const language = useSettingsStore((s) => s.language);
  const { challenge, status } = challengeState;

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);
  const iconScale = useSharedValue(1);

  useEffect(() => {
    opacity.value = withSpring(1, { damping: 18, stiffness: 200 });
    scale.value = withSpring(1, { damping: 15, stiffness: 180 });

    // Icon pulse on active
    if (status === 'active') {
      iconScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 600, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.0, { duration: 600, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      );
    }

    if (status === 'passed') {
      scale.value = withSequence(
        withSpring(1.06, { damping: 12 }),
        withSpring(1.0, { damping: 18 })
      );
    }
  }, [status, opacity, scale, iconScale]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const borderColor =
    status === 'passed'
      ? COLORS.success
      : status === 'failed' || status === 'timeout'
      ? COLORS.danger
      : status === 'active'
      ? COLORS.amberAegis
      : 'rgba(255,255,255,0.15)';

  const text = language === 'hi' ? challenge.instructionHindi : challenge.instruction;

  return (
    <Animated.View
      style={[
        {
          backgroundColor: 'rgba(5, 12, 26, 0.90)',
          borderRadius: BORDER_RADIUS.lg,
          borderWidth: 1.5,
          borderColor,
          padding: 20,
          alignItems: 'center',
          gap: 12,
          marginHorizontal: 24,
        },
        cardStyle,
      ]}
    >
      {/* Icon */}
      <Animated.Text style={[{ fontSize: 44, lineHeight: 52 }, iconStyle]}>
        {challenge.icon}
      </Animated.Text>

      {/* Instruction */}
      <Text style={{
        color: COLORS.white,
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: 0.3,
      }}>
        {text}
      </Text>

      {/* Countdown */}
      {status === 'active' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 13 }}>Time:</Text>
          <Text style={{
            color: timeRemaining <= 2 ? COLORS.danger : COLORS.amberAegis,
            fontSize: 15,
            fontWeight: '700',
            letterSpacing: 1,
          }}>
            {timeRemaining}s
          </Text>
        </View>
      )}

      {status === 'passed' && (
        <Text style={{ color: COLORS.success, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>
          ✓ Complete
        </Text>
      )}
    </Animated.View>
  );
}
