import React from 'react';
import { View, Text, Switch, TouchableOpacity, ScrollView, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types';
import { useSettingsStore } from '@/store/settingsStore';
import { useEnrollmentStore } from '@/store/enrollmentStore';
import { useVerificationStore } from '@/store/verificationStore';
import { useAuthStore } from '@/store/authStore';
import { deleteEncryptionKey } from '@/lib/crypto/faceEncryption';
import { COLORS, BORDER_RADIUS } from '@/lib/constants';

function SectionLabel({ label }: { label: string }) {
  return (
    <Text style={{
      color: COLORS.primary,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      marginBottom: 8,
      marginLeft: 4,
    }}>
      {label}
    </Text>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={{
      backgroundColor: COLORS.surface,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: COLORS.border,
      marginBottom: 20,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
      ...style,
    }}>
      {children}
    </View>
  );
}

function ToggleRow({ label, desc, value, onToggle, disabled = false }: {
  label: string; desc?: string; value: boolean; onToggle: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 14, paddingHorizontal: 16,
      borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
    }}>
      <View style={{ flex: 1, paddingRight: 16 }}>
        <Text style={{ color: disabled ? COLORS.textMuted : COLORS.text, fontSize: 15, fontWeight: '600' }}>{label}</Text>
        {desc && <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 2, lineHeight: 17 }}>{desc}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: COLORS.border, true: `${COLORS.primary}60` }}
        thumbColor={value ? COLORS.primary : '#D1D5DB'}
        ios_backgroundColor={COLORS.border}
      />
    </View>
  );
}

export function SettingsScreen() {
  const voiceGuidance  = useSettingsStore((s) => s.voiceGuidance);
  const hapticFeedback = useSettingsStore((s) => s.hapticFeedback);
  const autoBrightness = useSettingsStore((s) => s.autoBrightness);
  const language       = useSettingsStore((s) => s.language);
  const demoMode       = useSettingsStore((s) => s.demoMode);
  const showDebugPanel = useSettingsStore((s) => s.showDebugPanel);
  const syncEnabled    = useSettingsStore((s) => s.syncEnabled);
  const updateSetting  = useSettingsStore((s) => s.updateSetting);

  const authEmployeeId   = useAuthStore((s) => s.employeeId);
  const authEmployeeName = useAuthStore((s) => s.employeeName);
  const authSite         = useAuthStore((s) => s.site);
  const authRole         = useAuthStore((s) => s.role);
  const logout           = useAuthStore((s) => s.logout);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const clearAllEnrollments = useEnrollmentStore((s) => s.clearAllEnrollments);
  const clearHistory        = useVerificationStore((s) => s.clearHistory);

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'You will need to sign in again to access the app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            logout();
            navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
          },
        },
      ]
    );
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete your enrolled face, verification history, and encryption keys.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            clearAllEnrollments();
            clearHistory();
            await deleteEncryptionKey().catch(() => null);
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18 }}>
          <Text style={{ color: COLORS.text, fontSize: 26, fontWeight: '900' }}>Settings</Text>
          <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 2 }}>AEGIS v1.0.0  ·  NHAI Datalake 3.0</Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

          {/* System */}
          <SectionLabel label="System" />
          <Card>
            <ToggleRow label="Voice Guidance" desc="Audio instructions in English or Hindi"
              value={voiceGuidance} onToggle={(v) => updateSetting('voiceGuidance', v)} />
            <ToggleRow label="Haptic Feedback" desc="Vibration on key interactions"
              value={hapticFeedback} onToggle={(v) => updateSetting('hapticFeedback', v)} />
            <View style={{ borderBottomWidth: 0 }}>
              <ToggleRow label="Auto Brightness" desc="Switch theme based on ambient light"
                value={autoBrightness} onToggle={(v) => updateSetting('autoBrightness', v)} />
            </View>
          </Card>

          {/* Language */}
          <SectionLabel label="Language" />
          <Card>
            <View style={{ flexDirection: 'row' }}>
              {(['en', 'hi'] as const).map((lang, i) => (
                <TouchableOpacity
                  key={lang}
                  onPress={() => updateSetting('language', lang)}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 16,
                    backgroundColor: language === lang ? COLORS.primaryLight : 'transparent',
                    borderRightWidth: i === 0 ? 1 : 0,
                    borderRightColor: COLORS.borderLight,
                  }}
                >
                  <Text style={{ color: language === lang ? COLORS.primary : COLORS.textSub, fontSize: 15, fontWeight: language === lang ? '800' : '500' }}>
                    {lang === 'en' ? '🇬🇧  English' : '🇮🇳  हिंदी'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Developer */}
          <SectionLabel label="Developer" />
          <Card>
            <ToggleRow label="Demo Mode" desc="Simulate successful verification quickly"
              value={demoMode} onToggle={(v) => updateSetting('demoMode', v)} />
            <View style={{ borderBottomWidth: 0 }}>
              <ToggleRow label="Debug Panel" desc="Show real-time inference metrics overlay"
                value={showDebugPanel} onToggle={(v) => updateSetting('showDebugPanel', v)} />
            </View>
          </Card>

          {/* Backend Sync */}
          <SectionLabel label="Backend Sync" />
          <Card>
            <ToggleRow label="Sync to Datalake" desc="Upload verified records when online"
              value={syncEnabled} onToggle={(v) => updateSetting('syncEnabled', v)} />
          </Card>

          {/* Account */}
          <SectionLabel label="Account" />
          <Card style={{ marginBottom: 20, padding: 0 }}>
            {/* User info row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
              <View style={{
                width: 46, height: 46, borderRadius: 23,
                backgroundColor: COLORS.primaryLight,
                alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Text style={{ fontSize: 22 }}>👤</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
                  {authEmployeeName ?? authEmployeeId ?? 'Employee'}
                </Text>
                <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                  {authEmployeeId}{authRole ? `  ·  ${authRole}` : ''}
                </Text>
                {authSite ? (
                  <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '600', marginTop: 2 }} numberOfLines={1}>
                    📍 {authSite}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Sign Out button */}
            <View style={{ borderTopWidth: 1, borderTopColor: COLORS.borderLight }}>
              <TouchableOpacity
                onPress={handleLogout}
                style={{
                  margin: 12,
                  paddingVertical: 13,
                  borderRadius: BORDER_RADIUS.md,
                  backgroundColor: COLORS.dangerBg,
                  borderWidth: 1,
                  borderColor: COLORS.dangerBorder,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: COLORS.danger, fontSize: 14, fontWeight: '700' }}>
                  Sign Out
                </Text>
              </TouchableOpacity>
            </View>
          </Card>

          {/* Privacy */}
          <SectionLabel label="Privacy" />
          <Card>
            <View style={{ padding: 16 }}>
              <Text style={{ color: COLORS.textSub, fontSize: 13, lineHeight: 20 }}>
                Your biometric data never leaves this device without your consent. All face embeddings are AES-256 encrypted with a device-bound key stored in the Secure Enclave / Android Keystore.
              </Text>
            </View>
          </Card>

          {/* Danger zone */}
          <TouchableOpacity
            onPress={handleClearData}
            style={{
              backgroundColor: COLORS.dangerBg,
              borderRadius: BORDER_RADIUS.md,
              borderWidth: 1,
              borderColor: COLORS.dangerBorder,
              padding: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: COLORS.danger, fontSize: 15, fontWeight: '700' }}>Clear All Local Data</Text>
            <Text style={{ color: COLORS.danger, fontSize: 12, marginTop: 4, opacity: 0.65 }}>
              Deletes enrollment, history, and encryption keys
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
