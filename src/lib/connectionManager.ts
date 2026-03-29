/**
 * Connection Manager - Sistema de Detecção Automática de Conexão
 * 
 * Este serviço monitora a conexão com o Supabase em tempo real e:
 * - Detecta automaticamente quando a internet cai
 * - Muda para modo offline sem interromper o sistema
 * - Sincroniza automaticamente quando a conexão volta
 * - Funciona em segundo plano sem impactar a operação
 */

import { supabase } from '@/integrations/supabase/client';
import { db, sincronizarTudo, verificarPendencias, baixarDadosIniciais } from './db';

type ConnectionStatus = 'online' | 'offline' | 'syncing' | 'checking';

interface ConnectionState {
  status: ConnectionStatus;
  lastOnline: Date | null;
  lastSync: Date | null;
  pendingCount: number;
  supabaseReachable: boolean;
  internetAvailable: boolean;
}

type ConnectionListener = (state: ConnectionState) => void;
type OnConnectionRestoredCallback = () => void;

class ConnectionManager {
  private state: ConnectionState = {
    status: 'checking',
    lastOnline: null,
    lastSync: null,
    pendingCount: 0,
    supabaseReachable: false,
    internetAvailable: navigator.onLine,
  };

  private listeners: Set<ConnectionListener> = new Set();
  private onRestoredCallbacks: Set<OnConnectionRestoredCallback> = new Set();
  private checkInterval: number | null = null;
  private syncInterval: number | null = null;
  private isInitialized = false;
  private empresaId: string | null = null;
  private lastCheckTime: number = 0;

  // Configurações OTIMIZADAS para detecção rápida
  private readonly CHECK_INTERVAL = 3000; // Verificar conexão a cada 3 segundos (antes era 5s)
  private readonly SYNC_INTERVAL = 15000; // Tentar sincronizar a cada 15 segundos (antes era 30s)
  private readonly PING_TIMEOUT = 2000; // Timeout para teste de conexão (antes era 3s)
  private readonly MIN_CHECK_INTERVAL = 1000; // Intervalo mínimo entre verificações

  /**
   * Inicializa o gerenciador de conexão
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    console.log('[ConnectionManager] Inicializando...');

    // Eventos do navegador
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Verificação inicial
    await this.checkConnection();

    // Iniciar monitoramento contínuo
    this.startMonitoring();

    this.isInitialized = true;
    console.log('[ConnectionManager] Inicializado com sucesso');
  }

  /**
   * Para o gerenciador de conexão
   */
  destroy(): void {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.listeners.clear();
    this.isInitialized = false;
  }

  /**
   * Adiciona um listener para mudanças de estado
   */
  subscribe(listener: ConnectionListener): () => void {
    this.listeners.add(listener);
    // Notifica imediatamente com o estado atual
    listener(this.state);
    
    // Retorna função para cancelar inscrição
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Retorna o estado atual
   */
  getState(): ConnectionState {
    return { ...this.state };
  }

  /**
   * Verifica se está online
   */
  isOnline(): boolean {
    return this.state.status === 'online' || this.state.status === 'syncing';
  }

  /**
   * Força uma verificação de conexão
   */
  async forceCheck(): Promise<boolean> {
    return this.checkConnection();
  }

  /**
   * Força uma sincronização
   */
  async forceSync(): Promise<boolean> {
    if (!this.state.supabaseReachable) {
      console.log('[ConnectionManager] Não é possível sincronizar - Supabase não acessível');
      return false;
    }

    return this.syncData();
  }

  /**
   * Define o ID da empresa para sincronização bidirecional
   */
  setEmpresaId(id: string | null): void {
    this.empresaId = id;
    console.log('[ConnectionManager] Empresa ID configurado:', id);
  }

  /**
   * Registra callback para quando a conexão é restaurada
   */
  onConnectionRestored(callback: OnConnectionRestoredCallback): () => void {
    this.onRestoredCallbacks.add(callback);
    return () => {
      this.onRestoredCallbacks.delete(callback);
    };
  }

  // ==================== MÉTODOS PRIVADOS ====================

  private handleOnline = async (): Promise<void> => {
    console.log('[ConnectionManager] Evento: online - verificando conexão imediatamente');
    this.lastCheckTime = 0; // Reset para forçar verificação imediata
    this.updateState({ internetAvailable: true });
    
    // Verificação imediata + segunda verificação após 500ms (redundância)
    await this.checkConnection();
    setTimeout(() => this.checkConnection(), 500);
  };

  private handleOffline = (): void => {
    console.log('[ConnectionManager] Evento: offline - modo local ativado');
    this.updateState({
      internetAvailable: false,
      supabaseReachable: false,
      status: 'offline',
    });
  };

  private startMonitoring(): void {
    // Verificar conexão periodicamente
    this.checkInterval = window.setInterval(async () => {
      await this.checkConnection();
    }, this.CHECK_INTERVAL);

    // Tentar sincronizar periodicamente
    this.syncInterval = window.setInterval(async () => {
      if (this.state.supabaseReachable && this.state.pendingCount > 0) {
        await this.syncData();
      }
    }, this.SYNC_INTERVAL);
  }

  private async checkConnection(): Promise<boolean> {
    // Evitar verificações muito frequentes
    const now = Date.now();
    if (now - this.lastCheckTime < this.MIN_CHECK_INTERVAL) {
      return this.state.supabaseReachable;
    }
    this.lastCheckTime = now;

    // Se navegador diz que está offline, não precisa testar
    if (!navigator.onLine) {
      this.updateState({
        internetAvailable: false,
        supabaseReachable: false,
        status: 'offline',
      });
      return false;
    }

    try {
      // OTIMIZAÇÃO: Usar HEAD request ao Supabase (mais leve que query)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.PING_TIMEOUT);
      
      // Tentar um fetch HEAD ao endpoint do Supabase (mais rápido que query)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tqmunlilydcowndqxiir.supabase.co';
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache',
      });

      clearTimeout(timeoutId);

      // Se chegou resposta (mesmo 401), significa que está online
      if (response) {
        this.handleConnectionRestored();
        return true;
      }

      throw new Error('No response');

    } catch (err: any) {
      // Verificar se é erro de rede/timeout
      if (err.name === 'AbortError' || 
          err.message?.includes('fetch') || 
          err.message?.includes('network') ||
          err.code === 'ECONNREFUSED') {
        console.log('[ConnectionManager] Supabase não acessível');
        this.updateState({
          supabaseReachable: false,
          status: 'offline',
        });
        return false;
      }

      // Outros erros (como de auth) podem significar que está online
      console.log('[ConnectionManager] Erro ao verificar conexão:', err.message);
      return false;
    }
  }

  private handleConnectionRestored(): void {
    const wasOffline = this.state.status === 'offline';
    
    this.updateState({
      internetAvailable: true,
      supabaseReachable: true,
      status: 'online',
      lastOnline: new Date(),
    });

    // Se estava offline e voltou, sincronização bidirecional
    if (wasOffline) {
      console.log('[ConnectionManager] Conexão restaurada! Iniciando sincronização bidirecional...');
      this.fullSync();
    }
  }

  /**
   * Sincronização bidirecional: envia e recebe dados
   */
  private async fullSync(): Promise<void> {
    try {
      // 1. Primeiro baixar dados atualizados do Supabase
      if (this.empresaId) {
        console.log('[ConnectionManager] Baixando dados atualizados do servidor...');
        await baixarDadosIniciais(this.empresaId);
      }

      // 2. Depois enviar dados locais pendentes
      console.log('[ConnectionManager] Enviando dados locais pendentes...');
      await this.syncData();

      // 3. Notificar callbacks de que a conexão foi restaurada
      this.onRestoredCallbacks.forEach(callback => {
        try {
          callback();
        } catch (err) {
          console.error('[ConnectionManager] Erro em callback onRestored:', err);
        }
      });
    } catch (err) {
      console.error('[ConnectionManager] Erro na sincronização completa:', err);
    }
  }

  private async syncData(): Promise<boolean> {
    if (this.state.status === 'syncing') {
      console.log('[ConnectionManager] Sincronização já em andamento');
      return false;
    }

    try {
      this.updateState({ status: 'syncing' });
      console.log('[ConnectionManager] Sincronizando dados...');

      await sincronizarTudo();

      // Atualizar contagem de pendentes
      const pendingCount = await verificarPendencias();

      this.updateState({
        status: 'online',
        lastSync: new Date(),
        pendingCount,
      });

      console.log('[ConnectionManager] Sincronização concluída');
      return true;

    } catch (err) {
      console.error('[ConnectionManager] Erro na sincronização:', err);
      this.updateState({ status: 'online' });
      return false;
    }
  }

  private async updatePendingCount(): Promise<void> {
    try {
      const count = await verificarPendencias();
      this.updateState({ pendingCount: count });
    } catch (err) {
      console.error('[ConnectionManager] Erro ao contar pendentes:', err);
    }
  }

  private updateState(partial: Partial<ConnectionState>): void {
    const previousStatus = this.state.status;
    this.state = { ...this.state, ...partial };

    // Log apenas se mudou o status
    if (partial.status && partial.status !== previousStatus) {
      console.log(`[ConnectionManager] Status: ${previousStatus} → ${this.state.status}`);
    }

    // Notificar listeners
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const stateCopy = { ...this.state };
    this.listeners.forEach(listener => {
      try {
        listener(stateCopy);
      } catch (err) {
        console.error('[ConnectionManager] Erro em listener:', err);
      }
    });
  }
}

// Singleton - instância única do gerenciador
export const connectionManager = new ConnectionManager();

// Exportar tipos
export type { ConnectionStatus, ConnectionState, ConnectionListener };
