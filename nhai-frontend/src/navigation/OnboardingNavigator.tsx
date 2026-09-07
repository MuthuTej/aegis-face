import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '@/types';
import { WelcomeScreen } from '@/screens/WelcomeScreen';
import { PermissionsScreen } from '@/screens/PermissionsScreen';
import { EnrollmentScreen } from '@/screens/EnrollmentScreen';
import { EnrollmentSuccessScreen } from '@/screens/EnrollmentSuccessScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Permissions" component={PermissionsScreen} />
      <Stack.Screen name="Enrollment" component={EnrollmentScreen} />
      <Stack.Screen name="EnrollmentSuccess" component={EnrollmentSuccessScreen} />
    </Stack.Navigator>
  );
}
