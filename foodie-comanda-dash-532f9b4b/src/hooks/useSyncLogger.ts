/**
 * useSyncLogger - Hook React para usar o SyncLogger
 * 
 * Uso:
 * const { logs, errors, stats, log, clear } = useSyncLogger();
 * 
 * Com filtro por tabela:
 * const { logs } = useSyncLogger({ table: 'pedidos', limit: 20 });
 */

import { useState, useEffect, useCallback } from 'react';
import { syncLogger, SyncLogEntry, SyncStats, LogLevel } from '@/lib/syncLogger';

interface UseSyncLoggerOptions {
  /** Filtrar por tabela específica */
  table?: string;
  /** Limite de logs a retornar */
  limit?: number;
  /** Mostrar apenas erros */
  errorsOnly?: boolean;
}

interface UseSyncLoggerReturn {
  /** Lista de logs */
  logs: SyncLogEntry[];
  /** Lista de erros */
  errors: SyncLogEntry[];
  /** Estatísticas */
  stats: SyncStats;
  /** Adicionar um log */
  log: (level: LogLevel, table: string, message: string, details?: Record<string, any>) => void;
  /** Limpar logs */
  clear: () => void;
  /** Exportar logs como JSON */
  exportLogs: () => string;
}

export function useSyncLogger(options?: UseSyncLoggerOptions): UseSyncLoggerReturn {
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [errors, setErrors] = useState<SyncLogEntry[]>([]);
  const [stats, setStats] = useState<SyncStats>(() => syncLogger.getStats());

  // Função para atualizar os estados
  const refreshLogs = useCallback(() => {
    if (options?.errorsOnly) {
      const errorLogs = syncLogger.getErrors(options?.limit);
      setLogs(errorLogs);
      setErrors(errorLogs);
    } else if (options?.table) {
      const tableLogs = syncLogger.getLogsByTable(options.table, options?.limit);
      setLogs(tableLogs);
      setErrors(tableLogs.filter(l => l.level === 'error'));
    } else {
      setLogs(syncLogger.getLogs(options?.limit));
      setErrors(syncLogger.getErrors(options?.limit));
    }
    setStats(syncLogger.getStats());
  }, [options?.table, options?.limit, options?.errorsOnly]);

  // Inscrever para atualizações em tempo real
  useEffect(() => {
    // Carregar logs iniciais
    refreshLogs();

    // Inscrever para novos logs
    const unsubscribe = syncLogger.subscribe(() => {
      refreshLogs();
    });

    return unsubscribe;
  }, [refreshLogs]);

  const log = useCallback((
    level: LogLevel,
    table: string,
    message: string,
    details?: Record<string, any>
  ) => {
    syncLogger.log(level, table, message, details);
  }, []);

  const clear = useCallback(() => {
    syncLogger.clear();
    refreshLogs();
  }, [refreshLogs]);

  const exportLogs = useCallback(() => {
    return syncLogger.export();
  }, []);

  return {
    logs,
    errors,
    stats,
    log,
    clear,
    exportLogs,
  };
}

export default useSyncLogger;
