import { useState, useEffect, useCallback } from 'react';
import { 
  checkStorageQuota, 
  getSyncLogs, 
  requestPersistentStorage,
  initPWAMigration 
} from '@/lib/pwaMigration';
import { syncService } from '@/lib/syncService';

// ==================== TIPOS ====================

interface StorageQuota {
  usage: number;
  quota: number;
  usagePercent: number;
  usageFormatted: string;
  quotaFormatted: string;
  isLow: boolean;
  isCritical: boolean;
}

interface SyncLog {
  id?: number;
  timestamp: string;
  type: 'success' | 'error' | 'warning' | 'info';
  operation: string;
  table?: string;
  recordId?: string;
  message: string;
  details?: Record<string, any>;
}

interface PWAStatus {
  isOnline: boolean;
  pendingCount: number;
  storageQuota: StorageQuota | null;
  isPersisted: boolean;
  swVersion: string | null;
  lastSyncLogs: SyncLog[];
  isInitialized: boolean;
}

interface SWUpdateMessage {
  type: 'SW_UPDATED';
  version: string;
  buildDate: string;
  message: string;
}

// ==================== HOOK ====================

export function usePWAStatus() {
  const [status, setStatus] = useState<PWAStatus>({
    isOnline: navigator.onLine,
    pendingCount: 0,
    storageQuota: null,
    isPersisted: false,
    swVersion: null,
    lastSyncLogs: [],
    isInitialized: false
  });

  const [swUpdateAvailable, setSwUpdateAvailable] = useState<SWUpdateMessage | null>(null);

  // Atualiza o status de conexão
  const updateOnlineStatus = useCallback(() => {
    setStatus(prev => ({ ...prev, isOnline: navigator.onLine }));
  }, []);

  // Atualiza a contagem de pendentes
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await syncService.countPending();
      setStatus(prev => ({ ...prev, pendingCount: count }));
    } catch (e) {
      console.error('[usePWAStatus] Erro ao contar pendentes:', e);
    }
  }, []);

  // Atualiza a quota de armazenamento
  const updateStorageQuota = useCallback(async () => {
    try {
      const quota = await checkStorageQuota();
      setStatus(prev => ({ ...prev, storageQuota: quota }));
      return quota;
    } catch (e) {
      console.error('[usePWAStatus] Erro ao verificar quota:', e);
      return null;
    }
  }, []);

  // Atualiza os logs de sincronização
  const updateSyncLogs = useCallback(async () => {
    try {
      const logs = await getSyncLogs(20);
      setStatus(prev => ({ ...prev, lastSyncLogs: logs }));
      return logs;
    } catch (e) {
      console.error('[usePWAStatus] Erro ao buscar logs:', e);
      return [];
    }
  }, []);

  // Solicita armazenamento persistente
  const requestPersistence = useCallback(async () => {
    try {
      const granted = await requestPersistentStorage();
      setStatus(prev => ({ ...prev, isPersisted: granted }));
      return granted;
    } catch (e) {
      console.error('[usePWAStatus] Erro ao solicitar persistência:', e);
      return false;
    }
  }, []);

  // Inicializa o PWA
  const initialize = useCallback(async () => {
    try {
      await initPWAMigration();
      setStatus(prev => ({ ...prev, isInitialized: true }));
      
      // Atualizar todos os status
      await Promise.all([
        updatePendingCount(),
        updateStorageQuota(),
        updateSyncLogs()
      ]);

      // Verificar se armazenamento é persistente
      if (navigator.storage?.persisted) {
        const persisted = await navigator.storage.persisted();
        setStatus(prev => ({ ...prev, isPersisted: persisted }));
      }

    } catch (e) {
      console.error('[usePWAStatus] Erro na inicialização:', e);
    }
  }, [updatePendingCount, updateStorageQuota, updateSyncLogs]);

  // Listener para mensagens do Service Worker
  useEffect(() => {
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        setSwUpdateAvailable(event.data as SWUpdateMessage);
        setStatus(prev => ({ ...prev, swVersion: event.data.version }));
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleSWMessage);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  }, []);

  // Listeners de conexão
  useEffect(() => {
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, [updateOnlineStatus]);

  // Inicialização
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Atualizar pendentes periodicamente
  useEffect(() => {
    const interval = setInterval(updatePendingCount, 30000); // 30 segundos
    return () => clearInterval(interval);
  }, [updatePendingCount]);

  // Recarrega a página para aplicar atualização do SW
  const applySwUpdate = useCallback(() => {
    if (swUpdateAvailable) {
      window.location.reload();
    }
  }, [swUpdateAvailable]);

  // Dispara atualização do SW manualmente
  const checkForSwUpdate = useCallback(async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
      }
    }
  }, []);

  return {
    ...status,
    swUpdateAvailable,
    updatePendingCount,
    updateStorageQuota,
    updateSyncLogs,
    requestPersistence,
    applySwUpdate,
    checkForSwUpdate,
    refresh: initialize
  };
}

export default usePWAStatus;
