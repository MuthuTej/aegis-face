import React, { useEffect } from 'react';
import { View, Text, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Canvas, Circle, RadialGradient, vec, Paint, Blur } from '@shopify/react-native-skia';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { MainStackParamList } from '@/types';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { useHaptics } from '@/hooks/useHaptics';
import { COLORS, BORDER_RADIUS } from '@/lib/constants';
import { formatConfidence, formatLatency, formatTimestamp } from '@/utils/formatters';

interface Props {
  navigation: NativeStackNavigationProp<MainStackParamList, 'VerificationResult'>;
  route: RouteProp<MainStackParamList, 'VerificationResult'>;
}

export function VerificationResultScreen({ navigation, route }: Props) {
  const { success, confidence, latencyMs, livenessScore, environment, timestamp } = route.params;
  const haptics = useHaptics();

  const iconScale    = useSharedValue(0.4);
  const iconOpacity  = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const contentY     = useSharedValue(20);

  useEffect(() => {
    iconScale.value    = withSpring(1, { damping: 12, stiffness: 180 });
    iconOpacity.value  = withTiming(1, { duration: 300 });
    contentOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));
    contentY.value     = withDelay(400, withSpring(0, { damping: 18, stiffness: 200 }));
    if (success) haptics.success(); else haptics.error();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const iconStyle    = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }], opacity: iconOpacity.value }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value, transform: [{ translateY: contentY.value }] }));

  const accent  = success ? COLORS.success : COLORS.danger;
  const accentBg = success ? COLORS.successBg : COLORS.dangerBg;
  const title   = success ? 'Identity Verified' : 'Verification Failed';
  const subtitle = success
    ? 'Authentication successful. Access granted.'
    : 'Could not verify identity. Please try again.';

  const metrics = [
    { label: 'Confidence', value: formatConfidence(confidence), color: COLORS.primary },
    { label: 'Latency',    value: formatLatency(latencyMs),     color: COLORS.amber },
    { label: 'Liveness',   value: formatConfidence(livenessScore), color: COLORS.success },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center' }}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      <SafeAreaView style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>

        {/* Animated icon */}
        <Animated.View style={[{ marginBottom: 28 }, iconStyle]}>
          <Canvas style={{ width: 150, height: 150 }}>
            <Circle cx={75} cy={75} r={68}>
              <RadialGradient c={vec(75, 75)} r={72} colors={[`${accent}18`, 'transparent']} />
            </Circle>
            <Circle cx={75} cy={75} r={60} style="stroke" strokeWidth={2}>
              <Paint color={accent} />
            </Circle>
            <Circle cx={75} cy={75} r={60} style="stroke" strokeWidth={8}>
              <Paint color={accent} opacity={0.15}><Blur blur={5} /></Paint>
            </Circle>
            <Circle cx={75} cy={75} r={46} color={`${accent}10`} />
          </Canvas>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 52, color: accent, lineHeight: 60 }}>{success ? '✓' : '✗'}</Text>
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View style={[{ alignItems: 'center', gap: 8, marginBottom: 28, width: '100%' }, contentStyle]}>
          <Text style={{ color: COLORS.text, fontSize: 26, fontWeight: '900', textAlign: 'center' }}>{title}</Text>
          <Text style={{ color: COLORS.textSub, fontSize: 14, textAlign: 'center', lineHeight: 21 }}>{subtitle}</Text>

          {/* Metrics card */}
          {success && (
            <View style={{
              width: '100%',
              backgroundColor: COLORS.surface,
              borderRadius: BORDER_RADIUS.md,
              borderWidth: 1, borderColor: COLORS.border,
              padding: 16, marginTop: 8,
              shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
            }}>
              <Text style={{ color: COLORS.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>
                Verification Metrics
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {metrics.map(({ label, value, color }) => (
                  <View key={label} style={{
                    flex: 1, backgroundColor: accentBg,
                    borderRadius: BORDER_RADIUS.sm,
                    padding: 10, alignItems: 'center', gap: 3,
                  }}>
                    <Text style={{ color, fontSize: 15, fontWeight: '800' }}>{value}</Text>
                    <Text style={{ color: COLORS.textMuted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</Text>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.borderLight }}>
                <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>{formatTimestamp(timestamp)}</Text>
                <Text style={{ color: COLORS.textMuted, fontSize: 11, textTransform: 'capitalize' }}>{environment}</Text>
              </View>
            </View>
          )}
        </Animated.View>

        {/* Actions */}
        <Animated.View style={[{ width: '100%', gap: 12 }, contentStyle]}>
          {!success && (
            <PremiumButton label="Try Again" onPress={() => navigation.goBack()} size="lg" fullWidth />
          )}
          <PremiumButton
            label={success ? 'Done' : 'Go Home'}
            onPress={() => {
              navigation.reset({ index: 0, routes: [{ name: 'MainTabs', params: { screen: 'Home' } as never }] });
            }}
            variant={success ? 'primary' : 'secondary'}
            size={success ? 'lg' : 'md'}
            fullWidth
          />
        </Animated.View>

      </SafeAreaView>
    </View>
  );
}
