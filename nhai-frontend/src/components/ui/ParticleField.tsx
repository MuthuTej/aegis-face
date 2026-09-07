/**
 * ParticleField — Skia-powered ambient particle animation
 * Used as a background layer on the Splash and Success screens.
 * ~30 particles, spring-physics drift, GPU-accelerated via Skia.
 */

import React, { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  Canvas,
  Circle,
  Paint,
  Blur,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface Particle {
  id: number;
  x: number;
  y: number;
  radius: number;
  speed: number;
  phase: number;
  color: string;
}

const PARTICLE_COLORS = [
  'rgba(0, 229, 255, 0.35)',
  'rgba(0, 229, 255, 0.20)',
  'rgba(77, 250, 255, 0.25)',
  'rgba(255, 184, 0, 0.15)',
  'rgba(0, 230, 118, 0.12)',
];

export function ParticleField({ count = 28 }: { count?: number }) {
  const { width, height } = useWindowDimensions();

  const tick = useSharedValue(0);

  React.useEffect(() => {
    tick.value = withRepeat(
      withTiming(1, { duration: 8000, easing: Easing.linear }),
      -1
    );
  }, [tick]);

  const particles: Particle[] = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 1.5 + Math.random() * 3,
        speed: 0.3 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
        color: PARTICLE_COLORS[i % PARTICLE_COLORS.length] ?? PARTICLE_COLORS[0]!,
      })),
    [count, width, height]
  );

  return (
    <Canvas style={{ position: 'absolute', top: 0, left: 0, width, height, pointerEvents: 'none', backgroundColor: 'transparent' }}>
      {particles.map((p) => (
        <AnimatedParticle key={p.id} particle={p} tick={tick} height={height} />
      ))}
    </Canvas>
  );
}

function AnimatedParticle({
  particle,
  tick,
  height,
}: {
  particle: Particle;
  tick: ReturnType<typeof useSharedValue<number>>;
  height: number;
}) {
  const cy = useDerivedValue(() => {
    const drift = ((tick.value * particle.speed + particle.phase) % 1) * (height + 20) - 10;
    return drift;
  });

  const opacity = useDerivedValue(() => {
    const t = (tick.value * particle.speed + particle.phase) % 1;
    // Fade in / fade out over lifetime
    const fade = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
    return fade * 0.8;
  });

  return (
    <Circle cx={particle.x} cy={cy} r={particle.radius}>
      <Paint color={particle.color} opacity={opacity}>
        <Blur blur={particle.radius * 0.8} />
      </Paint>
    </Circle>
  );
}
