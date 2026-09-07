import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUIStore } from '@/store/uiStore';
import { useEnrollmentStore } from '@/store/enrollmentStore';
import { useVerificationStore } from '@/store/verificationStore';
import { COLORS, BORDER_RADIUS, MATCHING, LIVENESS } from '@/lib/constants';
import { formatLatency, formatFps, formatBytes, formatConfidence } from '@/utils/formatters';

function Card({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={{
      backgroundColor: COLORS.surface,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 16,
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    }}>
      <Text style={{ color: COLORS.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function MetricRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ color: COLORS.textSub, fontSize: 12, fontFamily: 'Courier' }}>{label}</Text>
      <Text style={{ color: color ?? COLORS.primary, fontSize: 12, fontWeight: '700', fontFamily: 'Courier' }}>{value}</Text>
    </View>
  );
}

function ModelBadge({ name, sizeKb, inputSize, outputDim, status }: {
  name: string; sizeKb: number; inputSize: string; outputDim: string;
  status: 'loaded' | 'pending' | 'error';
}) {
  const statusColor = status === 'loaded' ? COLORS.success : status === 'error' ? COLORS.danger : COLORS.warning;
  const statusBg = status === 'loaded' ? COLORS.successBg : status === 'error' ? COLORS.dangerBg : COLORS.warningBg;

  return (
    <View style={{
      backgroundColor: COLORS.bg,
      borderRadius: BORDER_RADIUS.sm,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 12,
      gap: 8,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '700' }}>{name}</Text>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 5,
          backgroundColor: statusBg,
          paddingHorizontal: 8, paddingVertical: 3,
          borderRadius: BORDER_RADIUS.full,
        }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: statusColor }} />
          <Text style={{ color: statusColor, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {status}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        {sizeKb > 0 && (
          <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>
            Size: <Text style={{ color: COLORS.primary }}>{formatBytes(sizeKb * 1024)}</Text>
          </Text>
        )}
        <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>
          Input: <Text style={{ color: COLORS.primary }}>{inputSize}</Text>
        </Text>
        <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>
          Out: <Text style={{ color: COLORS.primary }}>{outputDim}</Text>
        </Text>
      </View>
    </View>
  );
}

export function DebugScreen() {
  const debugMetrics = useUIStore((s) => s.debugMetrics);
  const enrolledFaces = useEnrollmentStore((s) => s.enrolledFaces);
  const history = useVerificationStore((s) => s.history);
  const successCount = history.filter((r) => r.status === 'success').length;
  const avgLatency = history.length > 0
    ? history.reduce((sum, r) => sum + r.latencyMs, 0) / history.length
    : 0;

  const [detectorStatus, setDetectorStatus] = useState<'loaded' | 'pending' | 'error'>('pending');
  const [embeddingStatus, setEmbeddingStatus] = useState<'loaded' | 'pending' | 'error'>('pending');
  const [storageBackend, setStorageBackend] = useState<string>('asyncstorage');

  useEffect(() => {
    try {
      const det = require('@/services/faceDetection/faceDetector') as { getFaceDetectorStatus: () => string };
      const raw = det.getFaceDetectorStatus();
      setDetectorStatus(raw === 'loaded' ? 'loaded' : raw === 'error' ? 'error' : 'pending');
    } catch { /* not available */ }

    try {
      const emb = require('@/services/faceRecognition/mobileFaceNet') as { getMobileFaceNetStatus: () => string };
      const raw = emb.getMobileFaceNetStatus();
      setEmbeddingStatus(raw === 'loaded' ? 'loaded' : raw === 'error' ? 'error' : 'pending');
    } catch { /* not available */ }

    try {
      const store = require('@storage/faceStorage') as { getStorageBackend: () => string };
      setStorageBackend(store.getStorageBackend());
    } catch { /* not available */ }
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
          <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' }}>
            Developer
          </Text>
          <Text style={{ color: COLORS.text, fontSize: 24, fontWeight: '900', marginTop: 2 }}>
            Metrics Console
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 14 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Live Performance */}
          <Card title="Live Performance">
            {[
              { label: 'Frame Processing', value: formatLatency(debugMetrics.frameProcessingMs), color: COLORS.primary },
              { label: 'Model Inference',  value: formatLatency(debugMetrics.modelInferenceMs),  color: COLORS.primary },
              { label: 'Total Pipeline',   value: formatLatency(debugMetrics.totalPipelineMs),   color: COLORS.warning },
              { label: 'Camera FPS',       value: formatFps(debugMetrics.currentFps),            color: COLORS.success },
              { label: 'RAM Usage',        value: formatBytes(debugMetrics.ramUsageMb * 1024 * 1024), color: debugMetrics.ramUsageMb > 200 ? COLORS.danger : COLORS.success },
            ].map((row) => <MetricRow key={row.label} {...row} />)}
          </Card>

          {/* Confidence Breakdown */}
          <Card title="Confidence Breakdown">
            {Object.entries(debugMetrics.confidenceBreakdown).map(([key, val]) => (
              <View key={key} style={{ gap: 5 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: COLORS.textSub, fontSize: 12, textTransform: 'capitalize' }}>
                    {key.replace(/([A-Z])/g, ' $1')}
                  </Text>
                  <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '700' }}>
                    {formatConfidence(val)}
                  </Text>
                </View>
                <View style={{ height: 5, backgroundColor: COLORS.borderLight, borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${val * 100}%`, backgroundColor: COLORS.primary, borderRadius: 3 }} />
                </View>
              </View>
            ))}
          </Card>

          {/* ML Models */}
          <Card title="Loaded Models">
            <ModelBadge name="BlazeFace Detector"    sizeKb={640}  inputSize="128×128"  outputDim="bbox×16"  status={detectorStatus} />
            <ModelBadge name="MobileFaceNet INT8"    sizeKb={4200} inputSize="112×112"  outputDim="128-d"    status={embeddingStatus} />
            <ModelBadge name="Liveness (Geometric)"  sizeKb={0}    inputSize="landmarks" outputDim="EAR/yaw" status="loaded" />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>Storage backend:</Text>
              <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '700' }}>{storageBackend.toUpperCase()}</Text>
            </View>
          </Card>

          {/* Session Stats */}
          <Card title="Session Statistics">
            {[
              { label: 'Total Verifications', value: String(history.length) },
              { label: 'Success Rate', value: history.length > 0 ? `${Math.round((successCount / history.length) * 100)}%` : '—', color: COLORS.success },
              { label: 'Avg. Latency', value: avgLatency > 0 ? formatLatency(avgLatency) : '—' },
              { label: 'Enrolled Faces', value: String(enrolledFaces.length) },
              { label: 'Match Threshold', value: formatConfidence(MATCHING.DEFAULT_THRESHOLD) },
              { label: 'Embedding Dim', value: String(MATCHING.EMBEDDING_DIM) },
              { label: 'Challenge Count', value: String(LIVENESS.CHALLENGE_COUNT) },
            ].map((row) => <MetricRow key={row.label} {...row} />)}
          </Card>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
