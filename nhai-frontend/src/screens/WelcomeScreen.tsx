import React from 'react';
import { View, Text, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '@/types';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { COLORS, BORDER_RADIUS } from '@/lib/constants';

interface Props {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Welcome'>;
}

const FEATURES = [
  { icon: '🧠', title: 'On-Device AI', desc: 'Face recognition runs entirely on your device. No biometric data ever leaves.', color: COLORS.primary, bg: COLORS.primaryLight },
  { icon: '⚡', title: 'Sub-Second Auth', desc: 'MobileFaceNet inference in under 400ms — even without internet.', color: COLORS.amber, bg: COLORS.amberBg },
  { icon: '🔒', title: 'Zero Trust', desc: 'AES-256 encrypted biometrics, device-bound keys, tamper-proof storage.', color: COLORS.success, bg: COLORS.successBg },
  { icon: '🌐', title: 'Works Offline', desc: 'Operates in remote sites, tunnels, and no-network environments.', color: COLORS.purple, bg: COLORS.purpleBg },
];

export function WelcomeScreen({ navigation }: Props) {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={{ alignItems: 'center', paddingTop: 40, paddingBottom: 36 }}>
            {/* Logo mark */}
            <View style={{
              width: 96, height: 96, borderRadius: 24,
              backgroundColor: COLORS.primary,
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 24,
              shadowColor: COLORS.primary,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.30,
              shadowRadius: 16,
              elevation: 10,
            }}>
              <Text style={{ fontSize: 44 }}>⬡</Text>
            </View>

            <Text style={{ color: COLORS.text, fontSize: 32, fontWeight: '900', letterSpacing: 3, textTransform: 'uppercase' }}>
              AEGIS
            </Text>
            <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginTop: 6 }}>
              Facial Verification System
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: COLORS.primaryLight,
              borderRadius: BORDER_RADIUS.full,
              paddingHorizontal: 14, paddingVertical: 6,
              borderWidth: 1, borderColor: COLORS.primaryBorder,
              marginTop: 14,
            }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success }} />
              <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '600', letterSpacing: 0.8 }}>
                NHAI Datalake 3.0  ·  Ministry of Road Transport
              </Text>
            </View>
          </View>

          {/* Features */}
          <View style={{ gap: 12, marginBottom: 32 }}>
            {FEATURES.map((f) => (
              <View key={f.title} style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 14,
                backgroundColor: COLORS.surface,
                borderRadius: BORDER_RADIUS.md,
                borderWidth: 1,
                borderColor: COLORS.border,
                padding: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 3,
                elevation: 1,
              }}>
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: f.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 22 }}>{f.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 3 }}>{f.title}</Text>
                  <Text style={{ color: COLORS.textSub, fontSize: 13, lineHeight: 19 }}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <PremiumButton
            label="Begin Enrollment"
            onPress={() => navigation.navigate('Permissions')}
            size="lg"
            fullWidth
          />

          <Text style={{ color: COLORS.textMuted, fontSize: 11, textAlign: 'center', marginTop: 14, lineHeight: 17 }}>
            By continuing, you consent to biometric data processing under PDPA 2023
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
