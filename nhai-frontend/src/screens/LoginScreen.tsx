import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StatusBar,
  KeyboardAvoidingView, Platform, ScrollView,
  TextInput as RNTextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSequence, withTiming, withSpring,
} from 'react-native-reanimated';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { useEnrollmentStore } from '@/store/enrollmentStore';
import { useSettingsStore } from '@/store/settingsStore';
import { COLORS, BORDER_RADIUS } from '@/lib/constants';

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Auth'>;
}

type Mode = 'signin' | 'signup';

// ─── Input field ──────────────────────────────────────────────────────────────

function Field({
  label, value, onChangeText, placeholder, secure, autoCapitalize = 'none',
  returnKeyType = 'next', onSubmitEditing, inputRef, editable = true, hasError = false,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  secure?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  returnKeyType?: 'next' | 'done' | 'go';
  onSubmitEditing?: () => void;
  inputRef?: React.RefObject<RNTextInput | null>;
  editable?: boolean;
  hasError?: boolean;
  hint?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: COLORS.textSub, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
        {label}
      </Text>
      <View>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          secureTextEntry={secure && !show}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          editable={editable}
          style={{
            height: 50,
            backgroundColor: COLORS.bg,
            borderRadius: BORDER_RADIUS.sm,
            borderWidth: 1.5,
            borderColor: hasError ? COLORS.dangerBorder : COLORS.border,
            paddingHorizontal: 14,
            paddingRight: secure ? 48 : 14,
            fontSize: 15,
            color: COLORS.text,
          }}
        />
        {secure && (
          <TouchableOpacity
            onPress={() => setShow((v) => !v)}
            style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ fontSize: 17 }}>{show ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {hint && (
        <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 4 }}>{hint}</Text>
      )}
    </View>
  );
}

// ─── Site chips ───────────────────────────────────────────────────────────────

const SITE_PRESETS = ['NH-44', 'NH-48', 'NH-19', 'NH-27', 'NH-16', 'Toll Plaza'];

function SiteChips({ value, onSelect }: { value: string; onSelect: (s: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
      {SITE_PRESETS.map((s) => (
        <TouchableOpacity
          key={s}
          onPress={() => onSelect(s)}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 5,
            borderRadius: BORDER_RADIUS.full,
            backgroundColor: value === s ? COLORS.primaryLight : COLORS.bg,
            borderWidth: 1,
            borderColor: value === s ? COLORS.primaryBorder : COLORS.border,
          }}
        >
          <Text style={{ color: value === s ? COLORS.primary : COLORS.textSub, fontSize: 12, fontWeight: '600' }}>
            {s}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={{
      backgroundColor: COLORS.dangerBg,
      borderRadius: BORDER_RADIUS.sm,
      borderWidth: 1, borderColor: COLORS.dangerBorder,
      padding: 12, marginBottom: 16,
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    }}>
      <Text style={{ fontSize: 14 }}>⚠️</Text>
      <Text style={{ color: COLORS.danger, fontSize: 13, flex: 1, lineHeight: 19 }}>{message}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function LoginScreen({ navigation }: Props) {
  const login      = useAuthStore((s) => s.login);
  const register   = useAuthStore((s) => s.register);
  const isEnrolled = useEnrollmentStore((s) => s.isEnrolled);
  const endpoint   = useSettingsStore((s) => s.syncEndpoint);

  const [mode, setMode]       = useState<Mode>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [slowHint, setSlowHint] = useState(false);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sign In fields
  const [siId, setSiId]   = useState('');
  const [siPw, setSiPw]   = useState('');

  // Sign Up fields
  const [suId,   setSuId]   = useState('');
  const [suName, setSuName] = useState('');
  const [suSite, setSuSite] = useState('');
  const [suPw,   setSuPw]   = useState('');
  const [suPw2,  setSuPw2]  = useState('');

  // Refs for focus chain
  const siPwRef   = useRef<RNTextInput | null>(null);
  const suNameRef = useRef<RNTextInput | null>(null);
  const suSiteRef = useRef<RNTextInput | null>(null);
  const suPwRef   = useRef<RNTextInput | null>(null);
  const suPw2Ref  = useRef<RNTextInput | null>(null);

  // Card shake on error
  const shakeX = useSharedValue(0);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  // Tab underline slide (value drives the border color in JSX directly)
  const tabX = useSharedValue(0);

  const switchMode = useCallback((m: Mode) => {
    setMode(m);
    setError(null);
    tabX.value = withSpring(m === 'signin' ? 0 : 1, { damping: 18, stiffness: 200 });
  }, [tabX]);

  const shake = useCallback(() => {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 55 }),
      withTiming(10,  { duration: 55 }),
      withTiming(-7,  { duration: 55 }),
      withTiming(7,   { duration: 55 }),
      withTiming(0,   { duration: 55 }),
    );
  }, [shakeX]);

  // ── Sign In ────────────────────────────────────────────────────────────────

  const startSlow = () => {
    setSlowHint(false);
    slowTimer.current = setTimeout(() => setSlowHint(true), 6000);
  };
  const stopSlow = () => {
    setSlowHint(false);
    if (slowTimer.current) { clearTimeout(slowTimer.current); slowTimer.current = null; }
  };

  const handleSignIn = async () => {
    const id = siId.trim();
    if (!id)    { setError('Employee ID is required.'); shake(); return; }
    if (!siPw)  { setError('Password is required.'); shake(); return; }

    setLoading(true); setError(null); startSlow();
    try {
      await login(endpoint, id, siPw);
      navigation.replace(isEnrolled ? 'Main' : 'Onboarding');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed. Please try again.');
      shake();
    } finally {
      stopSlow(); setLoading(false);
    }
  };

  // ── Sign Up ────────────────────────────────────────────────────────────────

  const handleSignUp = async () => {
    const id   = suId.trim();
    const name = suName.trim();
    const site = suSite.trim();

    if (!id)           { setError('Employee ID is required.'); shake(); return; }
    if (!name)         { setError('Employee name is required.'); shake(); return; }
    if (!site)         { setError('Site / location is required.'); shake(); return; }
    if (!suPw)         { setError('Password is required.'); shake(); return; }
    if (suPw.length < 6) { setError('Password must be at least 6 characters.'); shake(); return; }
    if (suPw !== suPw2) { setError('Passwords do not match.'); shake(); return; }

    setLoading(true); setError(null); startSlow();
    try {
      await register(endpoint, id, name, site, suPw);
      navigation.replace('Onboarding');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed. Please try again.');
      shake();
    } finally {
      stopSlow(); setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Brand ── */}
            <View style={{ alignItems: 'center', paddingTop: 40, paddingBottom: 32 }}>
              <View style={{
                width: 76, height: 76, borderRadius: 20,
                backgroundColor: COLORS.primary,
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 18,
                shadowColor: COLORS.primary,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.28, shadowRadius: 14, elevation: 8,
              }}>
                <Text style={{ fontSize: 36 }}>⬡</Text>
              </View>
              <Text style={{ color: COLORS.text, fontSize: 24, fontWeight: '900', letterSpacing: 3, textTransform: 'uppercase' }}>
                AEGIS
              </Text>
              <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginTop: 3 }}>
                NHAI Datalake 3.0
              </Text>
            </View>

            {/* ── Card ── */}
            <Animated.View style={[{
              backgroundColor: COLORS.surface,
              borderRadius: BORDER_RADIUS.lg,
              borderWidth: 1, borderColor: COLORS.border,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
            }, cardStyle]}>

              {/* Tab bar */}
              <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                {(['signin', 'signup'] as Mode[]).map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => switchMode(m)}
                    style={{
                      flex: 1, paddingVertical: 16, alignItems: 'center',
                      borderBottomWidth: 2.5,
                      borderBottomColor: mode === m ? COLORS.primary : 'transparent',
                    }}
                  >
                    <Text style={{
                      fontSize: 14, fontWeight: '700',
                      color: mode === m ? COLORS.primary : COLORS.textMuted,
                    }}>
                      {m === 'signin' ? 'Sign In' : 'Sign Up'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Form body */}
              <View style={{ padding: 24 }}>
                {error && <ErrorBanner message={error} />}

                {mode === 'signin' ? (
                  /* ── Sign In Form ── */
                  <>
                    <Field
                      label="Employee ID"
                      value={siId}
                      onChangeText={(t) => { setSiId(t); setError(null); }}
                      placeholder="e.g. EMP001"
                      autoCapitalize="characters"
                      returnKeyType="next"
                      onSubmitEditing={() => siPwRef.current?.focus()}
                      editable={!loading}
                      hasError={!!error}
                    />
                    <Field
                      label="Password"
                      value={siPw}
                      onChangeText={(t) => { setSiPw(t); setError(null); }}
                      placeholder="Enter your password"
                      secure
                      returnKeyType="done"
                      onSubmitEditing={handleSignIn}
                      inputRef={siPwRef}
                      editable={!loading}
                      hasError={!!error}
                    />

                    <TouchableOpacity
                      onPress={handleSignIn}
                      disabled={loading}
                      style={{
                        height: 52, borderRadius: BORDER_RADIUS.md,
                        backgroundColor: loading ? COLORS.primaryLight : COLORS.primary,
                        alignItems: 'center', justifyContent: 'center',
                        marginTop: 4,
                        shadowColor: COLORS.primary,
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: loading ? 0 : 0.25,
                        shadowRadius: 8, elevation: loading ? 0 : 4,
                      }}
                    >
                      {loading ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <ActivityIndicator color={COLORS.primary} size="small" />
                          <Text style={{ color: COLORS.primary, fontSize: 14, fontWeight: '600' }}>Signing in…</Text>
                        </View>
                      ) : (
                        <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 }}>
                          Sign In
                        </Text>
                      )}
                    </TouchableOpacity>

                    {slowHint && (
                      <View style={{
                        marginTop: 12, padding: 12,
                        backgroundColor: COLORS.warningBg,
                        borderRadius: BORDER_RADIUS.sm,
                        borderWidth: 1, borderColor: COLORS.warningBorder,
                        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
                      }}>
                        <Text style={{ fontSize: 15 }}>⏳</Text>
                        <Text style={{ color: COLORS.warning, fontSize: 12, flex: 1, lineHeight: 18 }}>
                          Server is starting up — Railway can take up to 60 s on first connection. Please wait…
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  /* ── Sign Up Form ── */
                  <>
                    <Field
                      label="Employee ID"
                      value={suId}
                      onChangeText={(t) => { setSuId(t); setError(null); }}
                      placeholder="e.g. EMP002"
                      autoCapitalize="characters"
                      returnKeyType="next"
                      onSubmitEditing={() => suNameRef.current?.focus()}
                      editable={!loading}
                      hasError={!!error}
                      hint="Must be unique across the organisation"
                    />
                    <Field
                      label="Employee Name"
                      value={suName}
                      onChangeText={(t) => { setSuName(t); setError(null); }}
                      placeholder="e.g. Ravi Kumar"
                      autoCapitalize="words"
                      returnKeyType="next"
                      onSubmitEditing={() => suSiteRef.current?.focus()}
                      inputRef={suNameRef}
                      editable={!loading}
                      hasError={!!error}
                    />

                    {/* Site field + quick chips */}
                    <Text style={{ color: COLORS.textSub, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
                      Site / Location
                    </Text>
                    <SiteChips
                      value={suSite}
                      onSelect={(s) => { setSuSite(s); setError(null); }}
                    />
                    <TextInput
                      ref={suSiteRef}
                      value={suSite}
                      onChangeText={(t) => { setSuSite(t); setError(null); }}
                      placeholder="Type or select above"
                      placeholderTextColor={COLORS.textMuted}
                      autoCapitalize="words"
                      returnKeyType="next"
                      onSubmitEditing={() => suPwRef.current?.focus()}
                      editable={!loading}
                      style={{
                        height: 50, backgroundColor: COLORS.bg,
                        borderRadius: BORDER_RADIUS.sm,
                        borderWidth: 1.5, borderColor: COLORS.border,
                        paddingHorizontal: 14, fontSize: 15,
                        color: COLORS.text, marginBottom: 14,
                      }}
                    />

                    <Field
                      label="Password"
                      value={suPw}
                      onChangeText={(t) => { setSuPw(t); setError(null); }}
                      placeholder="Min. 6 characters"
                      secure
                      returnKeyType="next"
                      onSubmitEditing={() => suPw2Ref.current?.focus()}
                      inputRef={suPwRef}
                      editable={!loading}
                      hasError={!!error}
                    />
                    <Field
                      label="Confirm Password"
                      value={suPw2}
                      onChangeText={(t) => { setSuPw2(t); setError(null); }}
                      placeholder="Re-enter password"
                      secure
                      returnKeyType="done"
                      onSubmitEditing={handleSignUp}
                      inputRef={suPw2Ref}
                      editable={!loading}
                      hasError={!!(error && suPw !== suPw2)}
                    />

                    {/* Face enrolment notice */}
                    <View style={{
                      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
                      backgroundColor: COLORS.primaryLight,
                      borderRadius: BORDER_RADIUS.sm,
                      borderWidth: 1, borderColor: COLORS.primaryBorder,
                      padding: 12, marginBottom: 20,
                    }}>
                      <Text style={{ fontSize: 18 }}>📷</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: COLORS.primary, fontSize: 13, fontWeight: '700' }}>
                          Face Verification Required
                        </Text>
                        <Text style={{ color: COLORS.textSub, fontSize: 12, lineHeight: 18, marginTop: 2 }}>
                          After creating your account you will be guided through a quick face enrollment process to enable biometric sign-in.
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={handleSignUp}
                      disabled={loading}
                      style={{
                        height: 52, borderRadius: BORDER_RADIUS.md,
                        backgroundColor: loading ? COLORS.primaryLight : COLORS.primary,
                        alignItems: 'center', justifyContent: 'center',
                        shadowColor: COLORS.primary,
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: loading ? 0 : 0.25,
                        shadowRadius: 8, elevation: loading ? 0 : 4,
                      }}
                    >
                      {loading ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <ActivityIndicator color={COLORS.primary} size="small" />
                          <Text style={{ color: COLORS.primary, fontSize: 14, fontWeight: '600' }}>
                            Creating account…
                          </Text>
                        </View>
                      ) : (
                        <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 }}>
                          Create Account &amp; Enroll Face
                        </Text>
                      )}
                    </TouchableOpacity>

                    {slowHint && (
                      <View style={{
                        marginTop: 12, padding: 12,
                        backgroundColor: COLORS.warningBg,
                        borderRadius: BORDER_RADIUS.sm,
                        borderWidth: 1, borderColor: COLORS.warningBorder,
                        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
                      }}>
                        <Text style={{ fontSize: 15 }}>⏳</Text>
                        <Text style={{ color: COLORS.warning, fontSize: 12, flex: 1, lineHeight: 18 }}>
                          Server is starting up — this may take up to 60 s on first connection.
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            </Animated.View>

            {/* Footer */}
            <Text style={{
              color: COLORS.textMuted, fontSize: 11, textAlign: 'center',
              marginTop: 20, marginBottom: 16, lineHeight: 17,
            }}>
              Ministry of Road Transport &amp; Highways{'\n'}
              Secured by AES-256 · Zero Trust Architecture
            </Text>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}
