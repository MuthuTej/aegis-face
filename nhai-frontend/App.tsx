/**
 * Aegis — NHAI Datalake 3.0 Facial Verification App
 * Root component: providers, theme, navigation, ambient listeners.
 */

import './global.css';

import React, { useEffect } from 'react';
import { StatusBar, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';

import { RootNavigator } from '@/navigation/RootNavigator';
import { useAmbientLight } from '@/hooks/useAmbientLight';
import { COLORS } from '@/lib/constants';

// Keep native splash visible while JS loads
SplashScreen.preventAutoHideAsync().catch(() => null);

// Navigation theme
const NAVIGATION_THEME = {
  dark: true,
  colors: {
    primary: COLORS.cyanAegis,
    background: COLORS.navy900,
    card: COLORS.navy800,
    text: COLORS.white,
    border: 'rgba(0,229,255,0.15)',
    notification: COLORS.amberAegis,
  },
  fonts: Platform.select({
    ios: {
      regular: { fontFamily: 'System', fontWeight: '400' as const },
      medium: { fontFamily: 'System', fontWeight: '500' as const },
      bold: { fontFamily: 'System', fontWeight: '700' as const },
      heavy: { fontFamily: 'System', fontWeight: '900' as const },
    },
    default: {
      regular: { fontFamily: 'sans-serif', fontWeight: 'normal' as const },
      medium: { fontFamily: 'sans-serif-medium', fontWeight: 'normal' as const },
      bold: { fontFamily: 'sans-serif', fontWeight: '700' as const },
      heavy: { fontFamily: 'sans-serif', fontWeight: '900' as const },
    },
  })!,
};

function AegisProviders({ children }: { children: React.ReactNode }) {
  // Ambient light sensor drives theme switching
  useAmbientLight();
  return <>{children}</>;
}

export default function App() {
  useEffect(() => {
    // Hide native splash after React has painted
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => null);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer theme={NAVIGATION_THEME}>
          <AegisProviders>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.navy950} />
            <RootNavigator />
          </AegisProviders>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
