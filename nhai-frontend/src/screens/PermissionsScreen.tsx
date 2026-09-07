import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCameraPermissions } from 'expo-camera';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '@/types';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { COLORS, BORDER_RADIUS } from '@/lib/constants';

interface Props {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Permissions'>;
}

export function PermissionsScreen({ navigation }: Props) {
  const [cameraPermission, requestPermission] = useCameraPermissions();
  const hasCamera = cameraPermission?.granted ?? false;
  const [requesting, setRequesting] = useState(false);

  const permissions = [
    {
      id: 'camera',
      icon: '📷',
      title: 'Camera',
      desc: 'Required for facial recognition and liveness detection.',
      required: true,
      granted: hasCamera,
    },
    {
      id: 'storage',
      icon: '🗄️',
      title: 'Local Storage',
      desc: 'Securely stores encrypted biometric templates on-device.',
      required: true,
      granted: true,
    },
    {
      id: 'location',
      icon: '📍',
      title: 'Location',
      desc: 'Adds GPS coordinates to verification audit logs.',
      required: false,
      granted: false,
    },
  ];

  const canProceed = permissions.filter((p) => p.required).every((p) => p.granted);

  const handleRequestCamera = async () => {
    setRequesting(true);
    await requestPermission();
    setRequesting(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      <SafeAreaView style={{ flex: 1, paddingHorizontal: 24 }}>
        {/* Header */}
        <View style={{ paddingTop: 40, paddingBottom: 28 }}>
          <View style={{
            width: 52, height: 52, borderRadius: 14,
            backgroundColor: COLORS.primaryLight,
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            <Text style={{ fontSize: 26 }}>🔐</Text>
          </View>
          <Text style={{ color: COLORS.text, fontSize: 26, fontWeight: '900' }}>Permissions</Text>
          <Text style={{ color: COLORS.textSub, fontSize: 14, lineHeight: 21, marginTop: 6 }}>
            Aegis needs these to protect your identity securely, entirely offline.
          </Text>
        </View>

        {/* Permission cards */}
        <View style={{ gap: 12, flex: 1 }}>
          {permissions.map((perm) => (
            <TouchableOpacity
              key={perm.id}
              onPress={perm.id === 'camera' && !perm.granted ? handleRequestCamera : undefined}
              activeOpacity={perm.id === 'camera' && !perm.granted ? 0.7 : 1}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                backgroundColor: COLORS.surface,
                borderRadius: BORDER_RADIUS.md,
                borderWidth: 1,
                borderColor: perm.granted ? COLORS.successBorder : COLORS.border,
                padding: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 3,
                elevation: 1,
              }}
            >
              {/* Icon */}
              <View style={{
                width: 46, height: 46, borderRadius: 12,
                backgroundColor: perm.granted ? COLORS.successBg : COLORS.bg,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 22 }}>{perm.icon}</Text>
              </View>

              {/* Text */}
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: '700' }}>{perm.title}</Text>
                  {!perm.required && (
                    <View style={{
                      backgroundColor: COLORS.borderLight,
                      borderRadius: BORDER_RADIUS.full,
                      paddingHorizontal: 8, paddingVertical: 2,
                    }}>
                      <Text style={{ color: COLORS.textMuted, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        Optional
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: COLORS.textSub, fontSize: 13, lineHeight: 18 }}>{perm.desc}</Text>
              </View>

              {/* Status indicator */}
              <View style={{
                width: 30, height: 30, borderRadius: 15,
                backgroundColor: perm.granted ? COLORS.successBg : COLORS.bg,
                borderWidth: 1.5,
                borderColor: perm.granted ? COLORS.successBorder : COLORS.border,
                alignItems: 'center', justifyContent: 'center',
              }}>
                {perm.granted ? (
                  <Text style={{ color: COLORS.success, fontSize: 14, fontWeight: '900' }}>✓</Text>
                ) : (
                  <Text style={{ color: COLORS.textMuted, fontSize: 16, lineHeight: 20 }}>›</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bottom CTA */}
        <View style={{ paddingBottom: 32, paddingTop: 20, gap: 10 }}>
          <PremiumButton
            label={canProceed ? 'Start Enrollment' : 'Grant Camera Access'}
            onPress={canProceed ? () => navigation.navigate('Enrollment') : handleRequestCamera}
            loading={requesting}
            fullWidth
            size="lg"
          />
          {!canProceed && (
            <Text style={{ color: COLORS.textMuted, textAlign: 'center', fontSize: 12, lineHeight: 18 }}>
              Camera permission is required to continue
            </Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
