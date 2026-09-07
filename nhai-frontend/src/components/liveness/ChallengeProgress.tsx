import React from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { ChallengeState } from '@/types';
import { COLORS, BORDER_RADIUS } from '@/lib/constants';

interface ChallengeProgressProps {
  challenges: ChallengeState[];
  currentIndex: number;
}

export function ChallengeProgress({ challenges, currentIndex }: ChallengeProgressProps) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
      {challenges.map((c, i) => (
        <ProgressDot
          key={c.challenge.id}
          status={c.status}
          isActive={i === currentIndex}
        />
      ))}
    </View>
  );
}

function ProgressDot({
  status,
  isActive,
}: {
  status: ChallengeState['status'];
  isActive: boolean;
}) {
  const scale = useSharedValue(isActive ? 1.4 : 1);

  React.useEffect(() => {
    scale.value = withSpring(isActive ? 1.4 : 1, { damping: 18, stiffness: 200 });
  }, [isActive, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const dotColor =
    status === 'passed'
      ? COLORS.success
      : status === 'failed' || status === 'timeout'
      ? COLORS.danger
      : isActive
      ? COLORS.amberAegis
      : 'rgba(255,255,255,0.25)';

  return (
    <Animated.View
      style={[
        {
          width: isActive ? 10 : 8,
          height: isActive ? 10 : 8,
          borderRadius: BORDER_RADIUS.full,
          backgroundColor: dotColor,
        },
        style,
      ]}
    />
  );
}
