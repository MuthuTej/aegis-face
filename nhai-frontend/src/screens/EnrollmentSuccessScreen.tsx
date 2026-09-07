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
import { Canvas, Circle, Paint, Blur, RadialGradient, vec } from '@shopify/react-native-skia';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { OnboardingStackParamList } from '@/types';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { useHaptics } from '@/hooks/useHaptics';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';
import { COLORS, BORDER_RADIUS } from '@/lib/constants';
import { truncateId } from '@/utils/formatters';

interface Props {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'EnrollmentSuccess'>;
  route: RouteProp<OnboardingStackParamList, 'EnrollmentSuccess'>;
}

export function EnrollmentSuccessScreen({ navigation, route }: Props) {
  const haptics = useHaptics();
  const voice = useVoiceGuidance();
  const { enrollmentId } = route.params;

  const ringScale    = useSharedValue(0.5);
  const checkScale   = useSharedValue(0);
  const checkOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    haptics.success();
    voice.speak('enrollSuccess');
    ringScale.value    = withSpring(1, { damping: 12, stiffness: 150 });
    checkScale.value   = withDelay(300, withSpring(1, { damping: 14, stiffness: 200 }));
    checkOpacity.value = withDelay(300, withTiming(1, { duration: 300 }));
    contentOpacity.value = withDelay(700, withTiming(1, { duration: 500 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ringStyle    = useAnimatedStyle(() => ({ transform: [{ scale: ringScale.value }] }));
  const checkStyle   = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }], opacity: checkOpacity.value }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center' }}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28, paddingHorizontal: 24 }}>

        {/* Animated ring */}
        <Animated.View style={[{ alignItems: 'center', justifyContent: 'center' }, ringStyle]}>
          <Canvas style={{ width: 170, height: 170 }}>
            <Circle cx={85} cy={85} r={78}>
              <RadialGradient c={vec(85, 85)} r={85} colors={[`${COLORS.success}22`, 'transparent']} />
            </Circle>
            <Circle cx={85} cy={85} r={70} style="stroke" strokeWidth={2.5}>
              <Paint color={COLORS.success} />
            </Circle>
            <Circle cx={85} cy={85} r={70} style="stroke" strokeWidth={8}>
              <Paint color={COLORS.success} opacity={0.18}><Blur blur={6} /></Paint>
            </Circle>
            <Circle cx={85} cy={85} r={56} color={COLORS.successBg} />
          </Canvas>
          <Animated.View style={[{ position: 'absolute' }, checkStyle]}>
            <Text style={{ fontSize: 60, lineHeight: 68, color: COLORS.success }}>✓</Text>
          </Animated.View>
        </Animated.View>

        {/* Content */}
        <Animated.View style={[{ alignItems: 'center', gap: 10 }, contentStyle]}>
          <Text style={{ color: COLORS.text, fontSize: 28, fontWeight: '900' }}>Enrolled!</Text>
          <Text style={{ color: COLORS.textSub, fontSize: 14, textAlign: 'center', lineHeight: 21 }}>
            Aegis has securely learned your face.{'\n'}You can now authenticate instantly.
          </Text>

          {/* Enrollment ID badge */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: COLORS.successBg,
            borderRadius: BORDER_RADIUS.full,
            paddingHorizontal: 16, paddingVertical: 8,
            borderWidth: 1, borderColor: COLORS.successBorder,
            marginTop: 4,
          }}>
            <Text style={{ color: COLORS.textMuted, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Enrollment ID
            </Text>
            <Text style={{ color: COLORS.success, fontSize: 13, fontWeight: '700', fontFamily: 'Courier', letterSpacing: 1 }}>
              #{truncateId(enrollmentId)}
            </Text>
          </View>

          {/* Capability badges */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            {[
              { label: '4 Angles', color: COLORS.primary, bg: COLORS.primaryLight },
              { label: 'AES-256',  color: COLORS.success,  bg: COLORS.successBg },
              { label: 'On-Device', color: COLORS.purple,  bg: COLORS.purpleBg },
            ].map(({ label, color, bg }) => (
              <View key={label} style={{
                backgroundColor: bg,
                borderRadius: BORDER_RADIUS.full,
                paddingHorizontal: 12, paddingVertical: 5,
                borderWidth: 1, borderColor: `${color}30`,
              }}>
                <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <PremiumButton
          label="Open Aegis"
          onPress={() => navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Main' }] })}
          size="lg"
          fullWidth
        />

      </SafeAreaView>
    </View>
  );
}
