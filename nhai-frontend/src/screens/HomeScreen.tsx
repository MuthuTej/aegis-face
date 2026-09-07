import React, { useDeferredValue } from 'react';
import { View, Text, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import { useVerificationStore } from '@/store/verificationStore';
import { useEnrollmentStore } from '@/store/enrollmentStore';
import { useSettingsStore } from '@/store/settingsStore';
import { GlassCard } from '@/components/ui/GlassCard';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { MetricChip } from '@/components/ui/MetricChip';
import { COLORS, BORDER_RADIUS } from '@/lib/constants';
import { formatRelativeTime, formatConfidence, formatLatency } from '@/utils/formatters';
import type { MainTabNavProp } from '@/types';

interface Props { navigation: MainTabNavProp; }

export function HomeScreen({ navigation }: Props) {
  const lastResult    = useDeferredValue(useVerificationStore((s) => s.lastResult));
  const historyCount  = useDeferredValue(useVerificationStore((s) => s.history.length));
  const isEnrolled    = useEnrollmentStore((s) => s.isEnrolled);
  const enrolledCount = useEnrollmentStore((s) => s.enrolledFaces.length);
  const demoMode      = useSettingsStore((s) => s.demoMode);

  const pulseDot = useSharedValue(0.5);
  React.useEffect(() => {
    pulseDot.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.5, { duration: 1000, easing: Easing.inOut(Easing.sin) })
      ), -1, true
    );
  }, [pulseDot]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: pulseDot.value }));

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={{ paddingTop: 24, paddingBottom: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                NHAI Datalake 3.0
              </Text>
              <Text style={{ color: COLORS.text, fontSize: 26, fontWeight: '900', marginTop: 2 }}>Aegis</Text>
            </View>
            {demoMode && (
              <View style={{ backgroundColor: COLORS.warningBg, borderRadius: BORDER_RADIUS.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.warningBorder }}>
                <Text style={{ color: COLORS.warning, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>DEMO</Text>
              </View>
            )}
          </View>

          {/* Status Card */}
          <GlassCard style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ gap: 4 }}>
                <Text style={{ color: COLORS.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' }}>
                  System Status
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Animated.View style={[{ width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.success }, dotStyle]} />
                  <Text style={{ color: COLORS.success, fontSize: 16, fontWeight: '800' }}>Aegis Active</Text>
                </View>
                <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>Fully Offline  ·  On-Device</Text>
              </View>
              <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
                {enrolledCount} face{enrolledCount !== 1 ? 's' : ''} enrolled
              </Text>
            </View>
          </GlassCard>

          {/* Last Verification */}
          {lastResult && (
            <GlassCard style={{ marginBottom: 16 }}>
              <Text style={{ color: COLORS.textMuted, fontSize: 10, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>
                Last Verification
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: lastResult.status === 'success' ? COLORS.successBg : COLORS.dangerBg,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 22 }}>{lastResult.status === 'success' ? '✓' : '✗'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: lastResult.status === 'success' ? COLORS.success : COLORS.danger, fontSize: 16, fontWeight: '800' }}>
                    {lastResult.status === 'success' ? 'Verified' : 'Failed'}
                  </Text>
                  <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 2 }}>
                    {formatRelativeTime(lastResult.timestamp)}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <MetricChip label="Confidence" value={formatConfidence(lastResult.confidence)} color={COLORS.primary} style={{ flex: 1 }} />
                <MetricChip label="Latency"    value={formatLatency(lastResult.latencyMs)}     color={COLORS.amber}   style={{ flex: 1 }} />
                <MetricChip label="Liveness"   value={formatConfidence(lastResult.livenessScore)} color={COLORS.success} style={{ flex: 1 }} />
              </View>
            </GlassCard>
          )}

          {/* Stats */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            <GlassCard style={{ flex: 1 }} noPadding>
              <View style={{ padding: 16, alignItems: 'center', gap: 4 }}>
                <Text style={{ color: COLORS.primary, fontSize: 26, fontWeight: '900' }}>{historyCount}</Text>
                <Text style={{ color: COLORS.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', textAlign: 'center' }}>
                  Verifications
                </Text>
              </View>
            </GlassCard>
            <GlassCard style={{ flex: 1 }} noPadding>
              <View style={{ padding: 16, alignItems: 'center', gap: 4 }}>
                <Text style={{ color: COLORS.success, fontSize: 26, fontWeight: '900' }}>
                  {historyCount > 0
                    ? `${Math.round((useVerificationStore.getState().history.filter(r => r.status === 'success').length / historyCount) * 100)}%`
                    : '—'}
                </Text>
                <Text style={{ color: COLORS.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', textAlign: 'center' }}>
                  Success Rate
                </Text>
              </View>
            </GlassCard>
          </View>

          {/* CTA */}
          {isEnrolled ? (
            <PremiumButton label="Verify Now" onPress={() => navigation.navigate('Sentinel')} size="lg" fullWidth />
          ) : (
            <GlassCard>
              <View style={{ gap: 10 }}>
                <Text style={{ color: COLORS.warning, fontSize: 15, fontWeight: '700' }}>⚠️ Not Enrolled</Text>
                <Text style={{ color: COLORS.textSub, fontSize: 14, lineHeight: 20 }}>
                  You need to enroll your face before you can use verification.
                </Text>
                <PremiumButton label="Enroll Now" onPress={() => {}} size="md" fullWidth />
              </View>
            </GlassCard>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
