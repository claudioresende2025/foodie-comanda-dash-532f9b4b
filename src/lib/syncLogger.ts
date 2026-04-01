/**
 * syncLogger - Sistema de Log de Sincronização
 * 
 * Registra eventos de sincronização para debug e suporte.
 * Os logs ficam disponíveis no console e podem ser exibidos em uma tela de suporte.
 * 
 * Uso:
 * import { syncLogger } from '@/lib/syncLogger';
 * 
 * syncLogger.log('info', 'pedidos', 'Sincronização iniciada');
 * syncLogger.log('error', 'comandas', 'Falha ao sincronizar', { id: '123', error: 'Timeout' });
 * syncLogger.log('success', 'mesas', 'Mesa atualizada', { id: '456' });
 * 
 * // Ver logs
 * const allLogs = syncLogger.getLogs();
 * const errors = syncLogger.getErrors();
 */

type LogLevel = 'info' | 'success' | 'warning' | 'error';

interface SyncLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  table: string;
  message: string;
  details?: Record<string, any>;
}

interface SyncStats {
  totalLogs: number;
  errors: number;
  warnings: number;
  successes: number;
  lastError: SyncLogEntry | null;
  lastSync: string | null;
}

type LogListener = (entry: SyncLogEntry) => void;

const MAX_LOGS = 500; // Limite de logs em memória

class SyncLogger {
  private logs: SyncLogEntry[] = [];
  private listeners: Set<LogListener> = new Set();

  /**
   * Registra um evento de sincronização
   */
  log(
    level: LogLevel,
    table: string,
    message: string,
    details?: Record<string, any>
  ): void {
    const entry: SyncLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      table,
      message,
      details,
    };

    // Adicionar ao array
    this.logs.push(entry);

    // Manter limite de logs
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(-MAX_LOGS);
    }

    // Notificar listeners
    this.notifyListeners(entry);

    // Console log com formatação por nível
    this.consoleLog(entry);
  }

  /**
   * Formata e envia para o console
   */
  private consoleLog(entry: SyncLogEntry): void {
    const prefix = `[SyncLog] [${entry.table}]`;
    const time = new Date(entry.timestamp).toLocaleTimeString('pt-BR');
    
    switch (entry.level) {
      case 'error':
        console.error(`❌ ${prefix} ${entry.message}`, entry.details || '');
        break;
      case 'warning':
        console.warn(`⚠️ ${prefix} ${entry.message}`, entry.details || '');
        break;
      case 'success':
        console.log(`✅ ${prefix} ${entry.message}`, entry.details || '');
        break;
      case 'info':
      default:
        console.log(`ℹ️ ${prefix} ${entry.message}`, entry.details || '');
        break;
    }
  }

  /**
   * Retorna todos os logs
   */
  getLogs(limit?: number): SyncLogEntry[] {
    const logs = [...this.logs].reverse(); // Mais recentes primeiro
    return limit ? logs.slice(0, limit) : logs;
  }

  /**
   * Retorna apenas os erros
   */
  getErrors(limit?: number): SyncLogEntry[] {
    const errors = this.logs.filter(l => l.level === 'error').reverse();
    return limit ? errors.slice(0, limit) : errors;
  }

  /**
   * Retorna logs de uma tabela específica
   */
  getLogsByTable(table: string, limit?: number): SyncLogEntry[] {
    const tableLogs = this.logs.filter(l => l.table === table).reverse();
    return limit ? tableLogs.slice(0, limit) : tableLogs;
  }

  /**
   * Retorna estatísticas gerais
   */
  getStats(): SyncStats {
    const errors = this.logs.filter(l => l.level === 'error');
    const lastError = errors.length > 0 ? errors[errors.length - 1] : null;
    const lastSuccessEntry = this.logs.filter(l => l.level === 'success').pop();

    return {
      totalLogs: this.logs.length,
      errors: errors.length,
      warnings: this.logs.filter(l => l.level === 'warning').length,
      successes: this.logs.filter(l => l.level === 'success').length,
      lastError,
      lastSync: lastSuccessEntry?.timestamp || null,
    };
  }

  /**
   * Limpa todos os logs
   */
  clear(): void {
    this.logs = [];
    console.log('[SyncLog] Logs limpos');
  }

  /**
   * Exporta logs para download/debug
   */
  export(): string {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      stats: this.getStats(),
      logs: this.logs,
    }, null, 2);
  }

  /**
   * Inscreve um listener para novos logs
   */
  subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(entry: SyncLogEntry): void {
    this.listeners.forEach(listener => {
      try {
        listener(entry);
      } catch (e) {
        console.error('[SyncLog] Erro em listener:', e);
      }
    });
  }

  // ==================== HELPERS ====================

  /** Log de início de sincronização */
  syncStarted(table: string, count: number): void {
    this.log('info', table, `Sincronização iniciada: ${count} item(s) pendente(s)`);
  }

  /** Log de item sincronizado com sucesso */
  itemSynced(table: string, id: string): void {
    this.log('success', table, `Item sincronizado`, { id });
  }

  /** Log de erro em item específico */
  itemError(table: string, id: string, error: string): void {
    this.log('error', table, `Falha ao sincronizar item`, { id, error });
  }

  /** Log de sincronização completa */
  syncCompleted(table: string, synced: number, failed: number): void {
    if (failed > 0) {
      this.log('warning', table, `Sincronização parcial: ${synced} ok, ${failed} falha(s)`);
    } else {
      this.log('success', table, `Sincronização completa: ${synced} item(s)`);
    }
  }

  /** Log de conexão */
  connectionChange(status: 'online' | 'offline' | 'syncing'): void {
    const messages = {
      online: 'Conexão restaurada',
      offline: 'Conexão perdida - modo offline',
      syncing: 'Sincronização automática iniciada',
    };
    this.log(status === 'offline' ? 'warning' : 'info', 'connection', messages[status]);
  }
}

// Singleton
export const syncLogger = new SyncLogger();

// Exportar tipos
export type { SyncLogEntry, SyncStats, LogLevel };
