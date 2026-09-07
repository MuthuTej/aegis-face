import React from 'react';
import { View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { MainTabParamList } from '@/types';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { SentinelScreen } from '@/screens/SentinelScreen';
import { HistoryScreen } from '@/screens/HistoryScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { COLORS } from '@/lib/constants';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<string, { icon: string; label: string }> = {
  Home:     { icon: '📊', label: 'Dashboard' },
  Sentinel: { icon: '👁',  label: 'Verify' },
  History:  { icon: '📋', label: 'History' },
  Settings: { icon: '⚙',  label: 'Settings' },
};

function TabBarIcon({ name, focused }: { name: string; label: string; focused: boolean }) {
  const scale = useSharedValue(1);
  const meta = TAB_ICONS[name];

  React.useEffect(() => {
    scale.value = withSpring(focused ? 1.15 : 1, { damping: 18, stiffness: 220 });
  }, [focused, scale]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!meta) return null;

  return (
    <View style={{ alignItems: 'center', gap: 3 }}>
      <Animated.Text
        style={[
          { fontSize: 20, lineHeight: 24 },
          iconStyle,
        ]}
      >
        {meta.icon}
      </Animated.Text>
      <Text
        style={{
          fontSize: 10,
          fontWeight: focused ? '700' : '500',
          color: focused ? COLORS.primary : COLORS.textMuted,
          letterSpacing: 0.2,
        }}
      >
        {meta.label}
      </Text>
      {focused && (
        <View
          style={{
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: COLORS.primary,
            marginTop: 1,
          }}
        />
      )}
    </View>
  );
}

export function MainTabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          height: 62 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 10,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        tabBarShowLabel: false,
        tabBarIcon: ({ focused }) => (
          <TabBarIcon name={route.name} label={route.name} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen
        name="Sentinel"
        component={SentinelScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: focused ? COLORS.primary : COLORS.primaryLight,
                borderWidth: 2,
                borderColor: focused ? COLORS.primary : COLORS.primaryBorder,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: -20,
                shadowColor: COLORS.primary,
                shadowRadius: 10,
                shadowOpacity: focused ? 0.35 : 0.10,
                elevation: focused ? 8 : 2,
              }}
            >
              <Text style={{ fontSize: 22, color: focused ? '#FFF' : COLORS.primary }}>
                👁
              </Text>
            </View>
          ),
        }}
      />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
