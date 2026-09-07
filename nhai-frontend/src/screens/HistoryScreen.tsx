import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StatusBar,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { VerificationResult } from '@/types';
import { useVerificationStore } from '@/store/verificationStore';
import { useSettingsStore } from '@/store/settingsStore';
import { COLORS, BORDER_RADIUS } from '@/lib/constants';
import { formatRelativeTime, formatConfidence, formatLatency, truncateId } from '@/utils/formatters';
import { fetchAttendance, type BackendAttendanceRecord } from '@/services/api/adminApi';

type Filter = 'all' | 'success' | 'failed';
type Source = 'local' | 'cloud';

// ─── Local record item ────────────────────────────────────────────────────────

function LocalItem({ item }: { item: VerificationResult }) {
  const ok = item.status === 'success';
  return (
    <View style={{
      backgroundColor: COLORS.surface,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderLeftWidth: 4,
      borderLeftColor: ok ? COLORS.success : COLORS.danger,
      marginBottom: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
      overflow: 'hidden',
    }}>
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: ok ? COLORS.successBg : COLORS.dangerBg,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ color: ok ? COLORS.success : COLORS.danger, fontSize: 16, fontWeight: '900' }}>
              {ok ? '✓' : '✗'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: '700' }}>
                {ok ? 'Verified' : 'Failed'}
              </Text>
              <Text style={{ color: COLORS.textMuted, fontSize: 10, fontFamily: 'Courier' }}>
                #{truncateId(item.id)}
              </Text>
            </View>
            <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 2 }}>
              {formatRelativeTime(item.timestamp)}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.borderLight }}>
          {[
            { label: 'Confidence', value: formatConfidence(item.confidence), color: COLORS.primary },
            { label: 'Latency', value: formatLatency(item.latencyMs), color: COLORS.amber },
            { label: 'Env', value: item.environment, color: COLORS.textSub },
          ].map(({ label, value, color }) => (
            <View key={label} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
              <Text style={{ color, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>{value}</Text>
              <Text style={{ color: COLORS.textMuted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
            </View>
          ))}
          <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.synced ? COLORS.success : COLORS.warning }} />
            <Text style={{ color: COLORS.textMuted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {item.synced ? 'Synced' : 'Local'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Cloud record item ────────────────────────────────────────────────────────

function CloudItem({ item }: { item: BackendAttendanceRecord }) {
  const ok = item.livenessPassed && (item.matchScore ?? 0) >= 0.5;
  const pct = Math.round((item.matchScore ?? 0) * 100);
  const hasGps = item.latitude != null;

  return (
    <View style={{
      backgroundColor: COLORS.surface,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderLeftWidth: 4,
      borderLeftColor: ok ? COLORS.success : COLORS.danger,
      marginBottom: 10,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    }}>
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: ok ? COLORS.successBg : COLORS.dangerBg,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ color: ok ? COLORS.success : COLORS.danger, fontSize: 16, fontWeight: '900' }}>
              {ok ? '✓' : '✗'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: '700' }}>{item.employeeId}</Text>
              <Text style={{ color: COLORS.textMuted, fontSize: 10, fontFamily: 'Courier' }}>
                #{item.clientUuid.slice(-8).toUpperCase()}
              </Text>
            </View>
            <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 2 }}>
              {formatRelativeTime(new Date(item.capturedAt).getTime())}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.borderLight }}>
          <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
            <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '700' }}>{pct}%</Text>
            <Text style={{ color: COLORS.textMuted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>Score</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
            <Text style={{ color: ok ? COLORS.success : COLORS.danger, fontSize: 12, fontWeight: '700' }}>
              {item.livenessPassed ? 'Pass' : 'Fail'}
            </Text>
            <Text style={{ color: COLORS.textMuted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>Liveness</Text>
          </View>
          <View style={{ flex: 2, alignItems: 'center', gap: 2 }}>
            <Text style={{ color: hasGps ? COLORS.amber : COLORS.textMuted, fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
              {hasGps ? `${item.latitude!.toFixed(4)}, ${item.longitude!.toFixed(4)}` : 'No GPS'}
            </Text>
            <Text style={{ color: COLORS.textMuted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>GPS</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function HistoryScreen() {
  const history = useVerificationStore((s) => s.history);
  const clearHistory = useVerificationStore((s) => s.clearHistory);
  const syncEndpoint = useSettingsStore((s) => s.syncEndpoint);

  const [filter, setFilter] = useState<Filter>('all');
  const [source, setSource] = useState<Source>('local');
  const [backendRecords, setBackendRecords] = useState<BackendAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCloud = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const recs = await fetchAttendance(syncEndpoint);
      setBackendRecords([...recs].sort((a, b) =>
        new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
      ));
    } catch {
      setError('Could not reach backend.');
    } finally {
      setLoading(false);
    }
  }, [syncEndpoint]);

  useEffect(() => {
    if (source === 'cloud') loadCloud();
  }, [source, loadCloud]);

  const filteredLocal = history.filter((r) => filter === 'all' || r.status === filter);
  const filteredCloud = backendRecords.filter((r) => {
    if (filter === 'all') return true;
    const ok = r.livenessPassed && (r.matchScore ?? 0) >= 0.5;
    return filter === 'success' ? ok : !ok;
  });

  const total = source === 'local' ? history.length : backendRecords.length;
  const passed = source === 'local'
    ? history.filter((r) => r.status === 'success').length
    : backendRecords.filter((r) => r.livenessPassed && (r.matchScore ?? 0) >= 0.5).length;

  const Pill = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 16, paddingVertical: 8,
        borderRadius: BORDER_RADIUS.full,
        backgroundColor: active ? COLORS.primary : COLORS.surface,
        borderWidth: 1,
        borderColor: active ? COLORS.primary : COLORS.border,
      }}
    >
      <Text style={{ color: active ? '#FFF' : COLORS.textSub, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: COLORS.text, fontSize: 26, fontWeight: '900' }}>Audit Log</Text>
            <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 2 }}>
              {total} records  ·  {passed} passed  ·  {total - passed} failed
            </Text>
          </View>
          {source === 'local' && history.length > 0 ? (
            <TouchableOpacity onPress={clearHistory} style={{ paddingVertical: 6, paddingHorizontal: 12, backgroundColor: COLORS.dangerBg, borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: COLORS.dangerBorder }}>
              <Text style={{ color: COLORS.danger, fontSize: 12, fontWeight: '600' }}>Clear</Text>
            </TouchableOpacity>
          ) : source === 'cloud' ? (
            <TouchableOpacity onPress={loadCloud} disabled={loading} style={{ padding: 8, backgroundColor: COLORS.primaryLight, borderRadius: BORDER_RADIUS.full }}>
              <Text style={{ color: loading ? COLORS.textMuted : COLORS.primary, fontSize: 16 }}>↻</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Source toggle */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 10 }}>
          <Pill label="📱  Local" active={source === 'local'} onPress={() => setSource('local')} />
          <Pill label="☁️  Cloud" active={source === 'cloud'} onPress={() => setSource('cloud')} />
        </View>

        {/* Filter pills */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 16 }}>
          {(['all', 'success', 'failed'] as Filter[]).map((f) => (
            <Pill key={f} label={f} active={filter === f} onPress={() => setFilter(f)} />
          ))}
        </View>

        {/* Content */}
        {source === 'cloud' && loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <ActivityIndicator color={COLORS.primary} size="large" />
            <Text style={{ color: COLORS.textSub, fontSize: 13 }}>Loading backend records…</Text>
          </View>
        ) : source === 'cloud' && error ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 }}>
            <Text style={{ fontSize: 36 }}>⚠️</Text>
            <Text style={{ color: COLORS.danger, fontSize: 13, textAlign: 'center' }}>{error}</Text>
            <TouchableOpacity onPress={loadCloud} style={{ paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.primaryLight, borderRadius: BORDER_RADIUS.full }}>
              <Text style={{ color: COLORS.primary, fontSize: 13, fontWeight: '700' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (source === 'local' ? filteredLocal : filteredCloud).length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Text style={{ fontSize: 48 }}>🔒</Text>
            <Text style={{ color: COLORS.textMuted, fontSize: 14, textAlign: 'center' }}>
              {source === 'cloud' ? 'No records on server' : 'No verification records yet'}
            </Text>
          </View>
        ) : source === 'local' ? (
          <FlatList
            data={filteredLocal}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <LocalItem item={item} />}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <FlatList
            data={filteredCloud}
            keyExtractor={(item, i) => item.clientUuid ?? String(i)}
            renderItem={({ item }) => <CloudItem item={item} />}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={loadCloud} tintColor={COLORS.primary} colors={[COLORS.primary]} />
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}
