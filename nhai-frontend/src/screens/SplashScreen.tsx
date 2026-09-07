import React, { useEffect } from 'react';
import { View, Text, StatusBar } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue,
  withTiming, withDelay, withSpring, runOnJS,
} from 'react-native-reanimated';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types';
import { useEnrollmentStore } from '@/store/enrollmentStore';
import { useAuthStore } from '@/store/authStore';
import { COLORS, BORDER_RADIUS } from '@/lib/constants';

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Splash'>;
}

export function SplashScreen({ navigation }: Props) {
  const isEnrolled      = useEnrollmentStore((s) => s.isEnrolled);
  const isAuthenticated = useAuthStore((s) => s.token !== null);

  const logoScale    = useSharedValue(0.7);
  const logoOpacity  = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleY       = useSharedValue(16);
  const badgeOpacity = useSharedValue(0);

  const navigate = (enrolled: boolean, authenticated: boolean) => {
    if (!authenticated) {
      navigation.replace('Auth');
    } else if (enrolled) {
      navigation.replace('Main');
    } else {
      navigation.replace('Onboarding');
    }
  };

  useEffect(() => {
    logoScale.value   = withSpring(1, { damping: 16, stiffness: 160 });
    logoOpacity.value = withTiming(1, { duration: 500 });
    titleOpacity.value = withDelay(500, withTiming(1, { duration: 500 }));
    titleY.value       = withDelay(500, withSpring(0, { damping: 18, stiffness: 180 }));
    badgeOpacity.value = withDelay(900, withTiming(1, { duration: 400 }));

    const timer = setTimeout(
      () => runOnJS(navigate)(isEnrolled, isAuthenticated),
      2400
    );
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const logoStyle  = useAnimatedStyle(() => ({ transform: [{ scale: logoScale.value }], opacity: logoOpacity.value }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.value, transform: [{ translateY: titleY.value }] }));
  const badgeStyle = useAnimatedStyle(() => ({ opacity: badgeOpacity.value }));

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* Logo */}
      <Animated.View style={[{
        width: 110, height: 110, borderRadius: 28,
        backgroundColor: COLORS.primary,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.32,
        shadowRadius: 20,
        elevation: 12,
      }, logoStyle]}>
        <Text style={{ fontSize: 52 }}>⬡</Text>
      </Animated.View>

      {/* Title */}
      <Animated.View style={[{ alignItems: 'center', gap: 8 }, titleStyle]}>
        <Text style={{ color: COLORS.text, fontSize: 40, fontWeight: '900', letterSpacing: 6, textTransform: 'uppercase' }}>
          AEGIS
        </Text>
        <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '700', letterSpacing: 3, textTransform: 'uppercase' }}>
          Datalake 3.0 — NHAI
        </Text>
      </Animated.View>

      {/* Badge */}
      <Animated.View style={[{
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: COLORS.primaryLight,
        borderRadius: BORDER_RADIUS.full,
        paddingHorizontal: 16, paddingVertical: 8,
        borderWidth: 1, borderColor: COLORS.primaryBorder,
      }, badgeStyle]}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success }} />
        <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' }}>
          Fully Offline  ·  Zero Trust
        </Text>
      </Animated.View>
    </View>
  );
}
