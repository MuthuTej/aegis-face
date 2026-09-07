import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettingsStore } from '@/store/settingsStore';
import { COLORS, BORDER_RADIUS } from '@/lib/constants';
import { formatRelativeTime } from '@/utils/formatters';
import {
  fetchAttendance,
  fetchDevices,
  pingBackend,
  type BackendAttendanceRecord,
  type BackendDevice,
} from '@/services/api/adminApi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPassed(r: BackendAttendanceRecord): boolean {
  return r.livenessPassed && (r.matchScore ?? 0) >= 0.5;
}

function scoreColor(s: number) {
  if (s >= 0.8) return COLORS.success;
  if (s >= 0.6) return COLORS.primary;
  return COLORS.danger;
}

function syncDelay(capturedAt: string, receivedAt?: string): string | null {
  if (!receivedAt) return null;
  const d = Math.round((new Date(receivedAt).getTime() - new Date(capturedAt).getTime()) / 1000);
  if (d < 0 || d > 3600) return null;
  return d < 60 ? `+${d}s` : `+${Math.round(d / 60)}m`;
}

// ─── Section label ────────────────────────────────────────────────────────────

function SL({ text }: { text: string }) {
  return (
    <Text style={{
      color: COLORS.textMuted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      marginBottom: 10,
      marginLeft: 2,
    }}>
      {text}
    </Text>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color, bg, icon }: {
  label: string; value: string | number; color: string; bg: string; icon: string;
}) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: COLORS.surface,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingVertical: 16,
      paddingHorizontal: 8,
      alignItems: 'center',
      gap: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
    }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
      <Text style={{ color, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ color: COLORS.textMuted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' }}>
        {label}
      </Text>
    </View>
  );
}

// ─── Record card ──────────────────────────────────────────────────────────────

function RecordCard({ record }: { record: BackendAttendanceRecord }) {
  const ok = isPassed(record);
  const score = record.matchScore ?? 0;
  const pct = Math.round(score * 100);
  const bar = scoreColor(score);
  const hasGps = record.latitude != null;
  const delay = syncDelay(record.capturedAt, record.receivedAt);

  return (
    <View style={{
      backgroundColor: COLORS.surface,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderLeftWidth: 4,
      borderLeftColor: ok ? COLORS.success : COLORS.danger,
      marginBottom: 12,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          <View style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: ok ? COLORS.successBg : COLORS.dangerBg,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ color: ok ? COLORS.success : COLORS.danger, fontSize: 18, fontWeight: '900' }}>
              {ok ? '✓' : '✗'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: '800' }}>{record.employeeId}</Text>
            <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 1, fontFamily: 'Courier' }} numberOfLines={1}>
              {record.deviceId ?? '—'}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text style={{ color: COLORS.textSub, fontSize: 11 }}>
            {formatRelativeTime(new Date(record.capturedAt).getTime())}
          </Text>
          <Text style={{ color: COLORS.textMuted, fontSize: 10, fontFamily: 'Courier' }}>
            #{record.clientUuid.slice(-8).toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Score bar */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ color: COLORS.textMuted, fontSize: 10, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' }}>
            Match Score
          </Text>
          <Text style={{ color: bar, fontSize: 13, fontWeight: '900' }}>{pct}%</Text>
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: COLORS.borderLight, overflow: 'hidden' }}>
          <View style={{ width: `${pct}%`, height: '100%', borderRadius: 4, backgroundColor: bar }} />
        </View>
        <Text style={{ color: COLORS.textMuted, fontSize: 9, marginTop: 4, textAlign: 'right' }}>
          {pct >= 80 ? 'High confidence' : pct >= 60 ? 'Acceptable' : 'Low confidence'}
        </Text>
      </View>

      {/* Detail row */}
      <View style={{
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: COLORS.borderLight,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
      }}>
        {/* GPS */}
        <View style={{ flex: 3 }}>
          <Text style={{ color: COLORS.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
            Location
          </Text>
          {hasGps ? (
            <>
              <Text style={{ color: COLORS.amber, fontSize: 11, fontWeight: '700', fontFamily: 'Courier' }}>
                {record.latitude!.toFixed(5)},
              </Text>
              <Text style={{ color: COLORS.amber, fontSize: 11, fontWeight: '700', fontFamily: 'Courier' }}>
                {record.longitude!.toFixed(5)}
              </Text>
            </>
          ) : (
            <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>No GPS</Text>
          )}
        </View>

        <View style={{ width: 1, backgroundColor: COLORS.borderLight }} />

        {/* Liveness */}
        <View style={{ flex: 2, alignItems: 'center' }}>
          <Text style={{ color: COLORS.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
            Liveness
          </Text>
          <View style={{
            paddingHorizontal: 10, paddingVertical: 4,
            borderRadius: BORDER_RADIUS.full,
            backgroundColor: record.livenessPassed ? COLORS.successBg : COLORS.dangerBg,
            borderWidth: 1,
            borderColor: record.livenessPassed ? COLORS.successBorder : COLORS.dangerBorder,
          }}>
            <Text style={{ color: record.livenessPassed ? COLORS.success : COLORS.danger, fontSize: 10, fontWeight: '800' }}>
              {record.livenessPassed ? 'PASS' : 'FAIL'}
            </Text>
          </View>
          {record.livenessMethod && (
            <Text style={{ color: COLORS.textSub, fontSize: 10, marginTop: 4, textTransform: 'capitalize' }}>
              {record.livenessMethod}
            </Text>
          )}
        </View>

        <View style={{ width: 1, backgroundColor: COLORS.borderLight }} />

        {/* Sync */}
        <View style={{ flex: 2, alignItems: 'flex-end' }}>
          <Text style={{ color: COLORS.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
            Sync
          </Text>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.success, marginBottom: 4 }} />
          <Text style={{ color: COLORS.textMuted, fontSize: 10 }}>{delay ?? 'synced'}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Device row ───────────────────────────────────────────────────────────────

function DeviceRow({ device, isLast }: { device: BackendDevice; isLast: boolean }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 14,
      borderBottomWidth: isLast ? 0 : 1,
      borderBottomColor: COLORS.borderLight,
    }}>
      <View style={{
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: COLORS.primaryLight,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 18 }}>📱</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
          {device.name ?? device.device_id}
        </Text>
        <Text style={{ color: COLORS.textMuted, fontSize: 11, fontFamily: 'Courier', marginTop: 1 }} numberOfLines={1}>
          {device.device_id}
        </Text>
        {device.last_seen_at && (
          <Text style={{ color: COLORS.textMuted, fontSize: 10, marginTop: 2 }}>
            Last seen {formatRelativeTime(new Date(device.last_seen_at).getTime())}
          </Text>
        )}
      </View>
      <View style={{
        paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: BORDER_RADIUS.full,
        backgroundColor: COLORS.successBg,
        borderWidth: 1, borderColor: COLORS.successBorder,
      }}>
        <Text style={{ color: COLORS.success, fontSize: 9, fontWeight: '700', letterSpacing: 0.6 }}>ACTIVE</Text>
      </View>
    </View>
  );
}

// ─── Liveness chart ───────────────────────────────────────────────────────────

function LivenessChart({ records }: { records: BackendAttendanceRecord[] }) {
  const counts: Record<string, number> = {};
  for (const r of records) {
    const m = r.livenessMethod ?? 'unknown';
    counts[m] = (counts[m] ?? 0) + 1;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const maxVal = Math.max(...entries.map(([, v]) => v), 1);

  const palette: Record<string, string> = {
    blink: COLORS.primary,
    smile: COLORS.amber,
    turn: COLORS.purple,
    multi: COLORS.success,
    unknown: COLORS.textMuted,
  };

  return (
    <View style={{ gap: 12 }}>
      {entries.map(([method, count]) => (
        <View key={method} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }}>
              {method}
            </Text>
            <Text style={{ color: COLORS.textSub, fontSize: 13 }}>
              {count} verification{count !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: COLORS.borderLight, overflow: 'hidden' }}>
            <View style={{
              width: `${(count / maxVal) * 100}%`,
              height: '100%',
              borderRadius: 4,
              backgroundColor: palette[method] ?? COLORS.primary,
            }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

// Progressive messages for slow connections / cold starts
const SLOW_MESSAGES = [
  'Connecting to backend…',
  'Server is starting up, please wait…',
  'Almost there — Railway is waking up…',
  'Still trying… this can take up to 60 s on first connection.',
];

export function DashboardScreen() {
  const syncEndpoint = useSettingsStore((s) => s.syncEndpoint);
  const [records, setRecords] = useState<BackendAttendanceRecord[]>([]);
  const [devices, setDevices] = useState<BackendDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadMsg, setLoadMsg] = useState(SLOW_MESSAGES[0]);
  const [error, setError]     = useState<string | null>(null);
  const [pingMs, setPingMs]   = useState<number | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const slowTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearSlowTimers = () => {
    slowTimers.current.forEach(clearTimeout);
    slowTimers.current = [];
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLoadMsg(SLOW_MESSAGES[0]!);
    clearSlowTimers();

    // Escalate loading message as time passes
    [5_000, 15_000, 30_000].forEach((delay, i) => {
      slowTimers.current.push(
        setTimeout(() => setLoadMsg(SLOW_MESSAGES[i + 1] ?? SLOW_MESSAGES[SLOW_MESSAGES.length - 1]!), delay)
      );
    });

    try {
      const [recs, devs] = await Promise.all([
        fetchAttendance(syncEndpoint),
        fetchDevices(syncEndpoint),
      ]);
      setRecords([...recs].sort((a, b) =>
        new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
      ));
      setDevices(devs);
      setLastRefresh(new Date());
      setPingMs(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not reach backend.';
      setError(msg);
    } finally {
      clearSlowTimers();
      setLoading(false);
    }
  }, [syncEndpoint]);

  const handlePing = useCallback(async () => {
    setPingMs(null);
    const { ok, ms } = await pingBackend(syncEndpoint);
    setPingMs(ok ? ms : -1);
  }, [syncEndpoint]);

  useEffect(() => { load(); }, [load]);

  const total = records.length;
  const successCount = records.filter(isPassed).length;
  const failedCount = total - successCount;
  const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0;
  const uniqueEmployees = new Set(records.map((r) => r.employeeId)).size;
  const gpsCount = records.filter((r) => r.latitude != null).length;
  const avgScore = total > 0 ? records.reduce((s, r) => s + (r.matchScore ?? 0), 0) / total : 0;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.primary} colors={[COLORS.primary]} />
          }
        >
          {/* Header */}
          <View style={{ paddingTop: 20, paddingBottom: 24 }}>
            <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '700', letterSpacing: 1.8, textTransform: 'uppercase' }}>
              NHAI Datalake 3.0
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ color: COLORS.text, fontSize: 28, fontWeight: '900' }}>Dashboard</Text>
              <TouchableOpacity
                onPress={load}
                disabled={loading}
                style={{ padding: 8, backgroundColor: COLORS.primaryLight, borderRadius: BORDER_RADIUS.full }}
              >
                <Text style={{ color: loading ? COLORS.textMuted : COLORS.primary, fontSize: 18 }}>↻</Text>
              </TouchableOpacity>
            </View>
            {lastRefresh && !loading && (
              <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 4 }}>
                Updated {formatRelativeTime(lastRefresh.getTime())}
              </Text>
            )}
          </View>

          {/* Error */}
          {error && (
            <View style={{
              backgroundColor: COLORS.dangerBg,
              borderRadius: BORDER_RADIUS.md,
              borderWidth: 1, borderColor: COLORS.dangerBorder,
              padding: 16, marginBottom: 20, gap: 10,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Text style={{ fontSize: 18 }}>⚠️</Text>
                <Text style={{ color: COLORS.danger, fontSize: 13, flex: 1, lineHeight: 19 }}>{error}</Text>
              </View>

              {/* Ping test */}
              <View style={{
                backgroundColor: COLORS.surface,
                borderRadius: BORDER_RADIUS.sm,
                borderWidth: 1, borderColor: COLORS.border,
                padding: 12, gap: 6,
              }}>
                <Text style={{ color: COLORS.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' }}>
                  Server
                </Text>
                <Text style={{ color: COLORS.textSub, fontSize: 12, fontFamily: 'Courier' }} numberOfLines={1}>
                  {syncEndpoint}
                </Text>
                {pingMs !== null && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: pingMs >= 0 ? COLORS.success : COLORS.danger }} />
                    <Text style={{ color: pingMs >= 0 ? COLORS.success : COLORS.danger, fontSize: 12, fontWeight: '700' }}>
                      {pingMs >= 0 ? `Reachable  ·  ${pingMs} ms` : 'Unreachable'}
                    </Text>
                  </View>
                )}
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={load}
                  style={{ flex: 1, height: 40, backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.sm, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>↻  Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handlePing}
                  style={{ flex: 1, height: 40, backgroundColor: COLORS.bg, borderRadius: BORDER_RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: COLORS.textSub, fontSize: 13, fontWeight: '600' }}>Ping Server</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* First load */}
          {loading && total === 0 ? (
            <View style={{ height: 240, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <ActivityIndicator color={COLORS.primary} size="large" />
              <Text style={{ color: COLORS.textSub, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 }}>{loadMsg}</Text>
            </View>
          ) : (
            <>
              {/* Stat cards */}
              <SL text="Overview" />
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                <StatCard label="Total" value={total} color={COLORS.primary} bg={COLORS.primaryLight} icon="📊" />
                <StatCard label="Pass Rate" value={`${successRate}%`} color={COLORS.success} bg={COLORS.successBg} icon="✓" />
                <StatCard label="Devices" value={devices.length} color={COLORS.amber} bg={COLORS.amberBg} icon="📱" />
                <StatCard label="Staff" value={uniqueEmployees} color={COLORS.purple} bg={COLORS.purpleBg} icon="👤" />
              </View>

              {/* Breakdown */}
              <SL text="Verification Breakdown" />
              <View style={{
                backgroundColor: COLORS.surface,
                borderRadius: BORDER_RADIUS.md,
                borderWidth: 1, borderColor: COLORS.border,
                padding: 16, marginBottom: 24,
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.success }} />
                    <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '700' }}>{successCount} Passed</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '700' }}>{failedCount} Failed</Text>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: failedCount > 0 ? COLORS.danger : COLORS.border }} />
                  </View>
                </View>

                {/* Bar */}
                <View style={{ height: 12, borderRadius: 6, backgroundColor: failedCount > 0 ? COLORS.dangerBg : COLORS.borderLight, overflow: 'hidden' }}>
                  {successRate > 0 && (
                    <View style={{ width: `${successRate}%`, height: '100%', borderRadius: 6, backgroundColor: COLORS.success }} />
                  )}
                </View>

                {/* Sub-stats */}
                <View style={{ flexDirection: 'row', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.borderLight }}>
                  {[
                    { label: 'GPS Tagged', value: gpsCount, color: COLORS.amber },
                    { label: 'No Location', value: total - gpsCount, color: COLORS.primary },
                    { label: 'Avg Score', value: `${(avgScore * 100).toFixed(0)}%`, color: COLORS.purple },
                  ].map(({ label, value, color }) => (
                    <View key={label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                      <Text style={{ color, fontSize: 20, fontWeight: '900' }}>{value}</Text>
                      <Text style={{ color: COLORS.textMuted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'center' }}>
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Liveness methods */}
              {total > 0 && (
                <>
                  <SL text="Liveness Methods" />
                  <View style={{
                    backgroundColor: COLORS.surface,
                    borderRadius: BORDER_RADIUS.md,
                    borderWidth: 1, borderColor: COLORS.border,
                    padding: 16, marginBottom: 24,
                    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
                  }}>
                    <LivenessChart records={records} />
                  </View>
                </>
              )}

              {/* Attendance records */}
              {records.length > 0 && (
                <>
                  <SL text={`Attendance Records · ${total}`} />
                  {records.map((r) => (
                    <RecordCard key={r.clientUuid} record={r} />
                  ))}
                </>
              )}

              {/* Devices */}
              {devices.length > 0 && (
                <>
                  <SL text={`Registered Devices · ${devices.length}`} />
                  <View style={{
                    backgroundColor: COLORS.surface,
                    borderRadius: BORDER_RADIUS.md,
                    borderWidth: 1, borderColor: COLORS.border,
                    paddingHorizontal: 16, paddingVertical: 4, marginBottom: 20,
                    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
                  }}>
                    {devices.map((d, i) => (
                      <DeviceRow key={d.device_id ?? String(i)} device={d} isLast={i === devices.length - 1} />
                    ))}
                  </View>
                </>
              )}

              <Text style={{ color: COLORS.textMuted, fontSize: 10, textAlign: 'center', letterSpacing: 0.8, marginTop: 8 }}>
                AEGIS v1.0.0  ·  Ministry of Road Transport &amp; Highways
              </Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
