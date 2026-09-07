/**
 * AegisOrb — The floating guidance orb
 *
 * A glowing sphere that floats at the top of the camera view and
 * moves to guide the user's natural head movement during liveness checks.
 * Physics-based spring animation + Skia radial glow.
 */

import React, { useEffect } from 'react';
import { useWindowDimensions, Text, View } from 'react-native';
import {
  Canvas,
  Circle,
  RadialGradient,
  vec,
  Paint,
} from '@shopify/react-native-skia';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import type { ChallengeType } from '@/types';

interface AegisOrbProps {
  challengeType?: ChallengeType | null;
  isActive?: boolean;
}

const ORB_SIZE = 72;
const ORB_RADIUS = ORB_SIZE / 2;

// Map challenge to target orb position (relative to screen center 0.5, 0.5)
const CHALLENGE_POSITIONS: Record<ChallengeType, { x: number; y: number }> = {
  blink: { x: 0.5, y: 0.22 },
  smile: { x: 0.5, y: 0.22 },
  head_left: { x: 0.25, y: 0.22 },
  head_right: { x: 0.75, y: 0.22 },
  head_up: { x: 0.5, y: 0.14 },
  head_down: { x: 0.5, y: 0.32 },
};

const CHALLENGE_ICONS: Record<ChallengeType, string> = {
  blink: '👁',
  smile: '😊',
  head_left: '←',
  head_right: '→',
  head_up: '↑',
  head_down: '↓',
};

export function AegisOrb({ challengeType, isActive = true }: AegisOrbProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const orbX = useSharedValue(screenWidth / 2 - ORB_RADIUS);
  const orbY = useSharedValue(screenHeight * 0.18 - ORB_RADIUS);
  const orbScale = useSharedValue(1);
  const orbGlow = useSharedValue(0.6);

  // Neutral floating animation
  useEffect(() => {
    orbGlow.value = withRepeat(
      withSequence(
        withTiming(1.0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.5, { duration: 1400, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    orbScale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.96, { duration: 1800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [orbGlow, orbScale]);

  // Move orb to guide head movement
  useEffect(() => {
    const pos = challengeType
      ? CHALLENGE_POSITIONS[challengeType]
      : { x: 0.5, y: 0.22 };

    orbX.value = withSpring(screenWidth * pos.x - ORB_RADIUS, {
      damping: 14,
      stiffness: 120,
      mass: 1.2,
    });
    orbY.value = withSpring(screenHeight * pos.y - ORB_RADIUS, {
      damping: 14,
      stiffness: 120,
      mass: 1.2,
    });
  }, [challengeType, screenWidth, screenHeight, orbX, orbY]);

  const containerStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: orbX.value,
    top: orbY.value,
    transform: [{ scale: orbScale.value }],
    opacity: isActive ? 1 : 0.4,
  }));

  const icon = challengeType ? CHALLENGE_ICONS[challengeType] : null;

  return (
    <Animated.View style={[containerStyle, { width: ORB_SIZE, height: ORB_SIZE }]}>
      <Canvas style={{ width: ORB_SIZE, height: ORB_SIZE, backgroundColor: 'transparent' }}>
        {/* Outer glow halo */}
        <Circle cx={ORB_RADIUS} cy={ORB_RADIUS} r={ORB_RADIUS * 1.4}>
          <Paint color="transparent" opacity={orbGlow} />
          <RadialGradient
            c={vec(ORB_RADIUS, ORB_RADIUS)}
            r={ORB_RADIUS * 1.4}
            colors={['rgba(0,229,255,0.25)', 'transparent']}
          />
        </Circle>

        {/* Core sphere */}
        <Circle cx={ORB_RADIUS} cy={ORB_RADIUS} r={ORB_RADIUS * 0.72}>
          <RadialGradient
            c={vec(ORB_RADIUS * 0.72, ORB_RADIUS * 0.65)}
            r={ORB_RADIUS * 0.72}
            colors={['rgba(100, 240, 255, 0.95)', 'rgba(0, 180, 210, 0.85)', 'rgba(0, 60, 80, 0.90)']}
          />
        </Circle>

        {/* Specular highlight */}
        <Circle cx={ORB_RADIUS * 0.78} cy={ORB_RADIUS * 0.72} r={ORB_RADIUS * 0.18}>
          <Paint color="rgba(255,255,255,0.55)" />
        </Circle>
      </Canvas>

      {/* Challenge icon overlay */}
      {icon && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 22, lineHeight: 26 }}>{icon}</Text>
        </View>
      )}
    </Animated.View>
  );
}
