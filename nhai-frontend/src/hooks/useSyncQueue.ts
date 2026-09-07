import { useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import { syncPendingItems, getQueue } from '@/lib/sync/offlineQueue';
import { useSettingsStore } from '@/store/settingsStore';
import { useUIStore } from '@/store/uiStore';

export function useSyncQueue() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  const isOnline = useUIStore((s) => s.isOnline);
  const showToast = useUIStore((s) => s.showToast);
  const syncEnabled = useSettingsStore((s) => s.syncEnabled);
  const syncEndpoint = useSettingsStore((s) => s.syncEndpoint);

  const refreshPendingCount = useCallback(async () => {
    const queue = await getQueue();
    setPendingCount(queue.length);
  }, []);

  const triggerSync = useCallback(async () => {
    if (!syncEnabled || !isOnline || !syncEndpoint || isSyncing) return;
    setIsSyncing(true);
    try {
      const { synced, failed } = await syncPendingItems(syncEndpoint);
      if (synced > 0) {
        showToast(`Synced ${synced} verification${synced > 1 ? 's' : ''}`, 'success');
        setLastSyncAt(Date.now());
      }
      if (failed > 0) {
        showToast(`${failed} item${failed > 1 ? 's' : ''} failed to sync`, 'warning');
      }
    } catch (err) {
      showToast('Sync failed — will retry automatically', 'error');
    } finally {
      setIsSyncing(false);
      void refreshPendingCount();
    }
  }, [syncEnabled, isOnline, syncEndpoint, isSyncing, showToast, refreshPendingCount]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isOnline) void triggerSync();
    });
    return () => subscription.remove();
  }, [isOnline, triggerSync]);

  useEffect(() => {
    if (isOnline && syncEnabled) void triggerSync();
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void refreshPendingCount();
  }, [refreshPendingCount]);

  return { isSyncing, pendingCount, lastSyncAt, triggerSync, refreshPendingCount };
}
