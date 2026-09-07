import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList, MainStackParamList } from '@/types';
import { SplashScreen } from '@/screens/SplashScreen';
import { LoginScreen } from '@/screens/LoginScreen';
import { OnboardingNavigator } from './OnboardingNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { VerificationResultScreen } from '@/screens/VerificationResultScreen';
import { DebugScreen } from '@/screens/DebugScreen';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

function MainStackNavigator() {
  return (
    <MainStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <MainStack.Screen name="MainTabs" component={MainTabNavigator} />
      <MainStack.Screen
        name="VerificationResult"
        component={VerificationResultScreen}
        options={{ animation: 'fade_from_bottom', presentation: 'fullScreenModal' }}
      />
      <MainStack.Screen
        name="Debug"
        component={DebugScreen}
        options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
      />
    </MainStack.Navigator>
  );
}

export function RootNavigator() {
  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: '#F4F6FA' },
      }}
    >
      <RootStack.Screen name="Splash"      component={SplashScreen} />
      <RootStack.Screen name="Auth"        component={LoginScreen}
        options={{ animation: 'fade' }}
      />
      <RootStack.Screen name="Onboarding"  component={OnboardingNavigator} />
      <RootStack.Screen name="Main"        component={MainStackNavigator} />
    </RootStack.Navigator>
  );
}
