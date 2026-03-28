/**
 * useConnection - Hook para usar o ConnectionManager nos componentes React
 * 
 * Uso:
 * const { isOnline, status, pendingCount, forceSync } = useConnection();
 */

import { useState, useEffect, useCallback } from 'react';
import { connectionManager, ConnectionState, ConnectionStatus } from '@/lib/connectionManager';

interface UseConnectionReturn {
  /** Se está online e conectado ao Supabase */
  isOnline: boolean;
  /** Status atual: 'online' | 'offline' | 'syncing' | 'checking' */
  status: ConnectionStatus;
  /** Quantidade de registros pendentes de sincronização */
  pendingCount: number;
  /** Se o navegador tem internet */
  internetAvailable: boolean;
  /** Se o Supabase está acessível */
  supabaseReachable: boolean;
  /** Data da última conexão bem-sucedida */
  lastOnline: Date | null;
  /** Data da última sincronização bem-sucedida */
  lastSync: Date | null;
  /** Força uma verificação de conexão */
  forceCheck: () => Promise<boolean>;
  /** Força uma sincronização */
  forceSync: () => Promise<boolean>;
}

export function useConnection(): UseConnectionReturn {
  const [state, setState] = useState<ConnectionState>(() => connectionManager.getState());

  useEffect(() => {
    // Inscrever para receber atualizações
    const unsubscribe = connectionManager.subscribe((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, []);

  const forceCheck = useCallback(async () => {
    return connectionManager.forceCheck();
  }, []);

  const forceSync = useCallback(async () => {
    return connectionManager.forceSync();
  }, []);

  return {
    isOnline: state.status === 'online' || state.status === 'syncing',
    status: state.status,
    pendingCount: state.pendingCount,
    internetAvailable: state.internetAvailable,
    supabaseReachable: state.supabaseReachable,
    lastOnline: state.lastOnline,
    lastSync: state.lastSync,
    forceCheck,
    forceSync,
  };
}

export default useConnection;
