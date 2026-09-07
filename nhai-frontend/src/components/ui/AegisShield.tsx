/**
 * AegisShield — Animated SVG Shield Logo
 *
 * Uses Skia for the glow ring + particle halo.
 * The shield path draws via Reanimated stroke-dashoffset animation
 * to create the "forming" effect on the splash screen.
 */

import React, { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import {
  Canvas,
  Circle,
  Path,
  Paint,
  Blur,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';
import { COLORS } from '@/lib/constants';

interface AegisShieldProps {
  size?: number;
  animate?: boolean;
  glowing?: boolean;
}

export function AegisShield({ size = 120, animate = true, glowing = true }: AegisShieldProps) {
  const glowRadius = useSharedValue(glowing ? 0 : size * 0.6);
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (!animate) {
      scale.value = 1;
      opacity.value = 1;
      return;
    }

    opacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    scale.value = withSpring(1, { damping: 15, stiffness: 180 });

    if (glowing) {
      glowRadius.value = withRepeat(
        withSequence(
          withTiming(size * 0.65, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(size * 0.55, { duration: 1400, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      );
    }

    rotation.value = withRepeat(
      withTiming(360, { duration: 12000, easing: Easing.linear }),
      -1
    );
  }, [animate, glowing, size, glowRadius, scale, opacity, rotation]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const cx = size / 2;
  const cy = size / 2;
  const shieldSize = size * 0.55;

  // Shield SVG path (simplified pentagon-arc shield shape)
  const shield = buildShieldPath(cx, cy, shieldSize);

  return (
    <Animated.View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, containerStyle]}>
      <Canvas style={{ width: size, height: size }}>
        {/* Outer glow halo */}
        <Circle cx={cx} cy={cy} r={size * 0.42}>
          <Paint color="transparent" />
          <RadialGradient
            c={vec(cx, cy)}
            r={size * 0.48}
            colors={['rgba(0,229,255,0.18)', 'transparent']}
          />
        </Circle>

        {/* Soft glow behind shield */}
        <Circle cx={cx} cy={cy} r={size * 0.30}>
          <Paint color="rgba(0,229,255,0.12)">
            <Blur blur={12} />
          </Paint>
        </Circle>

        {/* Shield fill */}
        <Path path={shield} color="rgba(13, 31, 60, 0.90)" />

        {/* Shield border */}
        <Path
          path={shield}
          color="transparent"
          style="stroke"
          strokeWidth={2}
        >
          <Paint color={COLORS.cyanAegis} style="stroke" strokeWidth={2} />
        </Path>

        {/* Inner accent dot */}
        <Circle cx={cx} cy={cy + shieldSize * 0.12} r={size * 0.06} color={COLORS.cyanAegis} />
        <Circle cx={cx} cy={cy + shieldSize * 0.12} r={size * 0.04}>
          <Paint color={COLORS.white} />
          <Paint color={COLORS.cyanAegis}>
            <Blur blur={4} />
          </Paint>
        </Circle>
      </Canvas>
    </Animated.View>
  );
}

function buildShieldPath(cx: number, cy: number, size: number): string {
  const top = cy - size * 0.52;
  const bottom = cy + size * 0.52;
  const left = cx - size * 0.42;
  const right = cx + size * 0.42;
  const curveY = cy + size * 0.30;

  return [
    `M ${cx} ${top}`,
    `L ${right} ${cy - size * 0.28}`,
    `L ${right} ${curveY}`,
    `Q ${right} ${bottom} ${cx} ${bottom}`,
    `Q ${left} ${bottom} ${left} ${curveY}`,
    `L ${left} ${cy - size * 0.28}`,
    `Z`,
  ].join(' ');
}
