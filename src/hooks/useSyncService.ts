/**
 * useSyncService - Hook React para usar o SyncService
 * 
 * Uso:
 * const { 
 *   saveAndSync, 
 *   syncAll, 
 *   pendingCount, 
 *   isSyncing, 
 *   progress,
 *   onBroadcast,
 *   onPrint
 * } = useSyncService();
 * 
 * Exemplo de salvar com sincronização:
 * const result = await saveAndSync('pedidos', { ...novoPedido });
 * if (result.synced) {
 *   toast.success('Pedido salvo!');
 * } else {
 *   toast.info('Pedido salvo localmente, será sincronizado quando a conexão voltar.');
 * }
 * 
 * Exemplo de ouvir broadcasts de outras abas:
 * useEffect(() => {
 *   const unsub = onBroadcast((msg) => {
 *     if (msg.type === 'PEDIDO_NOVO') refetch();
 *   });
 *   return unsub;
 * }, [onBroadcast]);
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  syncService, 
  SyncProgress, 
  SyncResult, 
  OperationType, 
  BroadcastMessage, 
  PrintJob 
} from '@/lib/syncService';

type BroadcastListener = (message: BroadcastMessage) => void;
type PrintListener = (job: PrintJob) => void;

interface UseSyncServiceReturn {
  /** Salva localmente e tenta sincronizar se online */
  saveAndSync: <T extends Record<string, any>>(
    table: string,
    data: T,
    type?: OperationType
  ) => Promise<{ local: T & { id: string }; synced: boolean; error?: string }>;
  
  /** Salva apenas localmente (offline-first) */
  saveLocal: <T extends Record<string, any>>(
    table: string,
    data: T,
    type?: OperationType
  ) => Promise<T & { id: string }>;
  
  /** Sincroniza todos os registros pendentes */
  syncAll: () => Promise<SyncResult>;
  
  /** Força sincronização imediata (ignora debounce) */
  forceSyncNow: () => Promise<SyncResult>;
  
  /** Baixa dados atualizados do Supabase */
  downloadFromCloud: (empresaId: string) => Promise<void>;
  
  /** Quantidade de registros pendentes */
  pendingCount: number;
  
  /** Se está sincronizando no momento */
  isSyncing: boolean;
  
  /** Progresso atual da sincronização */
  progress: SyncProgress | null;
  
  /** Último resultado da sincronização */
  lastResult: SyncResult | null;
  
  /** Força atualização da contagem de pendentes */
  refreshPendingCount: () => Promise<void>;
  
  /** Envia broadcast para outras abas */
  broadcast: (type: BroadcastMessage['type'], payload: any) => void;
  
  /** Registra listener para broadcasts de outras abas */
  onBroadcast: (listener: BroadcastListener) => () => void;
  
  /** Registra listener para impressões */
  onPrint: (listener: PrintListener) => () => void;
  
  /** Dispara impressão de um pedido */
  dispararImpressao: (pedido: any) => Promise<boolean>;
  
  /** Processa impressões pendentes */
  processarImpressoesPendentes: () => Promise<number>;
  
  /** ID único desta aba */
  tabId: string;
  
  /** Status de conexão */
  isOnline: boolean;
}

export function useSyncService(): UseSyncServiceReturn {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  // Atualizar contagem de pendentes periodicamente
  const refreshPendingCount = useCallback(async () => {
    const count = await syncService.countPending();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    // Contagem inicial
    refreshPendingCount();

    // Atualizar a cada 10 segundos se houver pendentes
    const interval = setInterval(refreshPendingCount, 10000);

    // Inscrever para progresso de sincronização
    const unsubProgress = syncService.onProgress((p) => {
      setProgress(p);
      setIsSyncing(true);
    });

    // Inscrever para conclusão de sincronização
    const unsubComplete = syncService.onComplete((result) => {
      setLastResult(result);
      setIsSyncing(false);
      setProgress(null);
      refreshPendingCount();
    });

    return () => {
      clearInterval(interval);
      unsubProgress();
      unsubComplete();
    };
  }, [refreshPendingCount]);

  // Wrapper para saveAndSync com atualização de estado
  const saveAndSync = useCallback(async <T extends Record<string, any>>(
    table: string,
    data: T,
    type: OperationType = 'INSERT'
  ): Promise<{ local: T & { id: string }; synced: boolean; error?: string }> => {
    const result = await syncService.saveAndSync(table, data, type);
    
    // Atualizar contagem após salvar
    if (!result.synced) {
      setPendingCount(prev => prev + 1);
    }
    
    return result;
  }, []);

  // Wrapper para saveLocal
  const saveLocal = useCallback(async <T extends Record<string, any>>(
    table: string,
    data: T,
    type: OperationType = 'INSERT'
  ): Promise<T & { id: string }> => {
    const result = await syncService.saveLocal(table, data, type);
    setPendingCount(prev => prev + 1);
    return result;
  }, []);

  // Wrapper para syncAll
  const syncAll = useCallback(async (): Promise<SyncResult> => {
    setIsSyncing(true);
    const result = await syncService.syncAll();
    setIsSyncing(false);
    setLastResult(result);
    await refreshPendingCount();
    return result;
  }, [refreshPendingCount]);

  // Wrapper para forceSyncNow
  const forceSyncNow = useCallback(async (): Promise<SyncResult> => {
    setIsSyncing(true);
    const result = await syncService.forceSyncNow();
    setIsSyncing(false);
    setLastResult(result);
    await refreshPendingCount();
    return result;
  }, [refreshPendingCount]);

  // Wrapper para downloadFromCloud
  const downloadFromCloud = useCallback(async (empresaId: string): Promise<void> => {
    await syncService.downloadFromCloud(empresaId);
    await refreshPendingCount();
  }, [refreshPendingCount]);

  // Wrappers para broadcast e listeners
  const broadcast = useCallback((type: BroadcastMessage['type'], payload: any): void => {
    syncService.broadcast(type, payload);
  }, []);

  const onBroadcast = useCallback((listener: BroadcastListener): (() => void) => {
    return syncService.onBroadcast(listener);
  }, []);

  const onPrint = useCallback((listener: PrintListener): (() => void) => {
    return syncService.onPrint(listener);
  }, []);

  // Wrappers para impressão
  const dispararImpressao = useCallback(async (pedido: any): Promise<boolean> => {
    return syncService.dispararImpressaoLocal(pedido);
  }, []);

  const processarImpressoesPendentes = useCallback(async (): Promise<number> => {
    return syncService.processarImpressoesPendentes();
  }, []);

  // Estado de conexão
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    saveAndSync,
    saveLocal,
    syncAll,
    forceSyncNow,
    downloadFromCloud,
    pendingCount,
    isSyncing,
    progress,
    lastResult,
    refreshPendingCount,
    broadcast,
    onBroadcast,
    onPrint,
    dispararImpressao,
    processarImpressoesPendentes,
    tabId: syncService.getTabId(),
    isOnline,
  };
}

export default useSyncService;
