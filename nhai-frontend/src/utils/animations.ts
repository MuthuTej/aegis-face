import { withSpring, withTiming, withRepeat, withSequence, Easing } from 'react-native-reanimated';

export const SPRING_SNAPPY = { damping: 18, stiffness: 250, mass: 0.8 };
export const SPRING_BOUNCY = { damping: 12, stiffness: 200, mass: 1 };
export const SPRING_GENTLE = { damping: 25, stiffness: 150, mass: 1.2 };

export const TIMING_FAST = { duration: 150, easing: Easing.out(Easing.cubic) };
export const TIMING_NORMAL = { duration: 300, easing: Easing.inOut(Easing.cubic) };
export const TIMING_SLOW = { duration: 600, easing: Easing.inOut(Easing.cubic) };

export function pulseAnimation(min: number, max: number, durationMs = 1200) {
  return withRepeat(
    withSequence(
      withTiming(max, { duration: durationMs / 2, easing: Easing.inOut(Easing.sin) }),
      withTiming(min, { duration: durationMs / 2, easing: Easing.inOut(Easing.sin) })
    ),
    -1,
    true
  );
}

export function breatheAnimation(durationMs = 2400) {
  return pulseAnimation(0.85, 1.0, durationMs);
}

export function glowAnimation(minOpacity: number, maxOpacity: number, durationMs = 1800) {
  return withRepeat(
    withSequence(
      withTiming(maxOpacity, { duration: durationMs / 2, easing: Easing.inOut(Easing.sin) }),
      withTiming(minOpacity, { duration: durationMs / 2, easing: Easing.inOut(Easing.sin) })
    ),
    -1,
    true
  );
}

export function springEnter(value: number) {
  return withSpring(value, SPRING_SNAPPY);
}

export function fadeIn(durationMs = 300) {
  return withTiming(1, { duration: durationMs, easing: Easing.out(Easing.cubic) });
}

export function fadeOut(durationMs = 200) {
  return withTiming(0, { duration: durationMs, easing: Easing.in(Easing.cubic) });
}

export function rotateAnimation(durationMs = 2000) {
  return withRepeat(
    withTiming(360, { duration: durationMs, easing: Easing.linear }),
    -1
  );
}
