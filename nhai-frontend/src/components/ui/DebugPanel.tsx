import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useUIStore } from '@/store/uiStore';
import { COLORS, BORDER_RADIUS } from '@/lib/constants';
import { formatLatency, formatFps, formatBytes, formatConfidence } from '@/utils/formatters';

export function DebugPanel() {
  const debugPanelVisible = useUIStore((s) => s.debugPanelVisible);
  const debugMetrics = useUIStore((s) => s.debugMetrics);
  const toggleDebugPanel = useUIStore((s) => s.toggleDebugPanel);

  const translateY = useSharedValue(200);

  React.useEffect(() => {
    translateY.value = withSpring(debugPanelVisible ? 0 : 200, {
      damping: 20,
      stiffness: 200,
    });
  }, [debugPanelVisible, translateY]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!debugPanelVisible) {
    return (
      <TouchableOpacity
        onPress={toggleDebugPanel}
        style={{
          position: 'absolute',
          bottom: 100,
          right: 16,
          backgroundColor: 'rgba(0,229,255,0.15)',
          borderRadius: BORDER_RADIUS.full,
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: 'rgba(0,229,255,0.30)',
          zIndex: 999,
        }}
      >
        <Text style={{ fontSize: 16 }}>🔬</Text>
      </TouchableOpacity>
    );
  }

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(5, 12, 26, 0.96)',
          borderTopWidth: 1,
          borderTopColor: 'rgba(0,229,255,0.25)',
          borderTopLeftRadius: BORDER_RADIUS.lg,
          borderTopRightRadius: BORDER_RADIUS.lg,
          padding: 16,
          zIndex: 999,
          maxHeight: 280,
        },
        panelStyle,
      ]}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ color: COLORS.cyanAegis, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' }}>
          Aegis Debug Console
        </Text>
        <TouchableOpacity onPress={toggleDebugPanel}>
          <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 20, lineHeight: 22 }}>×</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ gap: 6 }}>
          <DebugRow label="Frame Processing" value={formatLatency(debugMetrics.frameProcessingMs)} color={COLORS.cyanAegis} />
          <DebugRow label="Model Inference" value={formatLatency(debugMetrics.modelInferenceMs)} color={COLORS.cyanAegis} />
          <DebugRow label="Total Pipeline" value={formatLatency(debugMetrics.totalPipelineMs)} color={COLORS.amberAegis} />
          <DebugRow label="Current FPS" value={formatFps(debugMetrics.currentFps)} color={COLORS.success} />
          <DebugRow label="RAM Usage" value={formatBytes(debugMetrics.ramUsageMb * 1024 * 1024)} color={debugMetrics.ramUsageMb > 200 ? COLORS.danger : COLORS.success} />
          <DebugRow label="Model Size" value={formatBytes(debugMetrics.modelSizeKb * 1024)} color={COLORS.cyanAegis} />

          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 4 }} />
          <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' }}>Confidence Breakdown</Text>
          <DebugRow label="Face Detection" value={formatConfidence(debugMetrics.confidenceBreakdown.faceDetection)} color={COLORS.success} />
          <DebugRow label="Liveness Check" value={formatConfidence(debugMetrics.confidenceBreakdown.livenessCheck)} color={COLORS.amberAegis} />
          <DebugRow label="Embedding Match" value={formatConfidence(debugMetrics.confidenceBreakdown.embeddingMatch)} color={COLORS.cyanAegis} />
        </View>
      </ScrollView>
    </Animated.View>
  );
}

function DebugRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 }}>
      <Text style={{ color: 'rgba(255,255,255,0.50)', fontSize: 11, fontFamily: 'Courier' }}>
        {label}
      </Text>
      <Text style={{ color, fontSize: 12, fontWeight: '700', fontFamily: 'Courier' }}>
        {value}
      </Text>
    </View>
  );
}
