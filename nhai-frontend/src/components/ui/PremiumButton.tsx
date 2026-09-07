import React, { useCallback } from 'react';
import {
  Text,
  TouchableOpacity,
  ViewStyle,
  ActivityIndicator,
  StyleProp,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useHaptics } from '@/hooks/useHaptics';
import { COLORS, BORDER_RADIUS } from '@/lib/constants';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface PremiumButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const SIZE_MAP: Record<Size, { height: number; fontSize: number; paddingH: number }> = {
  sm: { height: 38, fontSize: 13, paddingH: 16 },
  md: { height: 50, fontSize: 15, paddingH: 24 },
  lg: { height: 56, fontSize: 16, paddingH: 32 },
};

function getBg(variant: Variant): string {
  if (variant === 'primary') return COLORS.primary;
  if (variant === 'danger') return COLORS.danger;
  if (variant === 'secondary') return COLORS.surface;
  return 'transparent';
}

function getBorder(variant: Variant): string {
  if (variant === 'secondary') return COLORS.primaryBorder;
  if (variant === 'ghost') return 'transparent';
  return 'transparent';
}

function getTextColor(variant: Variant): string {
  if (variant === 'primary' || variant === 'danger') return '#FFFFFF';
  return COLORS.primary;
}

export function PremiumButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  style,
}: PremiumButtonProps) {
  const haptics = useHaptics();
  const scale = useSharedValue(1);
  const dims = SIZE_MAP[size];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    if (disabled || loading) return;
    haptics.light();
    scale.value = withSpring(0.97, { damping: 20, stiffness: 300 }, () => {
      scale.value = withSpring(1, { damping: 15, stiffness: 250 });
    });
    onPress();
  }, [disabled, loading, haptics, scale, onPress]);

  return (
    <Animated.View
      style={[
        {
          alignSelf: fullWidth ? 'stretch' : 'center',
          borderRadius: BORDER_RADIUS.md,
          overflow: 'hidden',
          shadowColor: variant === 'primary' ? COLORS.primary : '#000',
          shadowOffset: { width: 0, height: variant === 'primary' ? 3 : 1 },
          shadowOpacity: variant === 'primary' ? 0.25 : 0.06,
          shadowRadius: variant === 'primary' ? 8 : 3,
          elevation: variant === 'primary' ? 4 : 1,
        },
        animatedStyle,
        style,
      ]}
    >
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.88}
        disabled={disabled || loading}
        style={{
          height: dims.height,
          paddingHorizontal: dims.paddingH,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: disabled ? '#D1D5DB' : getBg(variant),
          borderWidth: variant === 'secondary' || variant === 'ghost' ? 1.5 : 0,
          borderColor: getBorder(variant),
          borderRadius: BORDER_RADIUS.md,
        }}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'primary' ? '#FFF' : COLORS.primary}
          />
        ) : (
          <>
            {icon && <View>{icon}</View>}
            <Text
              style={{
                fontSize: dims.fontSize,
                fontWeight: '700',
                color: disabled ? '#9CA3AF' : getTextColor(variant),
                letterSpacing: 0.3,
              }}
            >
              {label}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
