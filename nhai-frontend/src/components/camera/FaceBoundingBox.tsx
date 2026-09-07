import React, { useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import type { BoundingBox } from '@/types';
import { COLORS } from '@/lib/constants';

type BoxState = 'searching' | 'detected' | 'liveness' | 'verified' | 'failed';

interface FaceBoundingBoxProps {
  boundingBox: BoundingBox | null;
  state: BoxState;
}

const STATE_COLORS: Record<BoxState, string> = {
  searching: 'rgba(0,180,200,0.60)',
  detected: COLORS.cyanAegis,
  liveness: COLORS.amberAegis,
  verified: COLORS.success,
  failed: COLORS.danger,
};

const CORNER_LEN = 28;
const CORNER_W = 3;

export function FaceBoundingBox({ boundingBox, state }: FaceBoundingBoxProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const bx = useSharedValue(0.22);
  const by = useSharedValue(0.18);
  const bw = useSharedValue(0.54);
  const bh = useSharedValue(0.58);

  useEffect(() => {
    const target = boundingBox ?? { x: 0.22, y: 0.18, width: 0.54, height: 0.58 };
    bx.value = withSpring(target.x, { damping: 20, stiffness: 180 });
    by.value = withSpring(target.y, { damping: 20, stiffness: 180 });
    bw.value = withSpring(target.width, { damping: 20, stiffness: 180 });
    bh.value = withSpring(target.height, { damping: 20, stiffness: 180 });
  }, [boundingBox, bx, by, bw, bh]);

  const boxColor = STATE_COLORS[state];

  const containerStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: bx.value * screenWidth,
    top: by.value * screenHeight,
    width: bw.value * screenWidth,
    height: bh.value * screenHeight,
  }));

  return (
    <Animated.View style={[containerStyle, { pointerEvents: 'none' }]}>
      {/* Top-left corner */}
      <View style={{ position: 'absolute', top: 0, left: 0 }}>
        <View style={{ width: CORNER_LEN, height: CORNER_W, backgroundColor: boxColor, borderRadius: 2 }} />
        <View style={{ width: CORNER_W, height: CORNER_LEN, backgroundColor: boxColor, borderRadius: 2 }} />
      </View>

      {/* Top-right corner */}
      <View style={{ position: 'absolute', top: 0, right: 0, alignItems: 'flex-end' }}>
        <View style={{ width: CORNER_LEN, height: CORNER_W, backgroundColor: boxColor, borderRadius: 2 }} />
        <View style={{ width: CORNER_W, height: CORNER_LEN, backgroundColor: boxColor, borderRadius: 2 }} />
      </View>

      {/* Bottom-left corner */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, justifyContent: 'flex-end' }}>
        <View style={{ width: CORNER_W, height: CORNER_LEN, backgroundColor: boxColor, borderRadius: 2 }} />
        <View style={{ width: CORNER_LEN, height: CORNER_W, backgroundColor: boxColor, borderRadius: 2 }} />
      </View>

      {/* Bottom-right corner */}
      <View style={{ position: 'absolute', bottom: 0, right: 0, alignItems: 'flex-end', justifyContent: 'flex-end' }}>
        <View style={{ width: CORNER_W, height: CORNER_LEN, backgroundColor: boxColor, borderRadius: 2 }} />
        <View style={{ width: CORNER_LEN, height: CORNER_W, backgroundColor: boxColor, borderRadius: 2 }} />
      </View>
    </Animated.View>
  );
}
