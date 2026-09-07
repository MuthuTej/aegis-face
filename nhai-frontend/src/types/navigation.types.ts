import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp, RouteProp } from '@react-navigation/native';

// ─── Root Stack ──────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Onboarding: undefined;
  Main: undefined;
};

// ─── Onboarding Stack ────────────────────────────────────────────────────────

export type OnboardingStackParamList = {
  Welcome: undefined;
  Permissions: undefined;
  Enrollment: undefined;
  EnrollmentSuccess: { enrollmentId: string };
};

// ─── Main Tab Navigator ──────────────────────────────────────────────────────

export type MainTabParamList = {
  Home: undefined;
  Sentinel: undefined;
  History: undefined;
  Settings: undefined;
};

// ─── Modal / Debug Stack on top of Main ──────────────────────────────────────

export type MainStackParamList = {
  MainTabs: undefined;
  VerificationResult: {
    success: boolean;
    confidence: number;
    latencyMs: number;
    livenessScore: number;
    environment: string;
    timestamp: number;
  };
  Debug: undefined;
  ExplainerModal: {
    title: string;
    description: string;
    confidenceBreakdown: Record<string, number>;
  };
};

// ─── Navigation prop helpers ─────────────────────────────────────────────────

export type RootNavProp = NativeStackNavigationProp<RootStackParamList>;
export type OnboardingNavProp = NativeStackNavigationProp<OnboardingStackParamList>;
export type MainTabNavProp = BottomTabNavigationProp<MainTabParamList>;
export type MainStackNavProp = NativeStackNavigationProp<MainStackParamList>;

export type SentinelNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Sentinel'>,
  NativeStackNavigationProp<MainStackParamList>
>;

// Route prop helpers
export type EnrollmentSuccessRouteProp = RouteProp<OnboardingStackParamList, 'EnrollmentSuccess'>;
export type VerificationResultRouteProp = RouteProp<MainStackParamList, 'VerificationResult'>;
export type ExplainerModalRouteProp = RouteProp<MainStackParamList, 'ExplainerModal'>;
