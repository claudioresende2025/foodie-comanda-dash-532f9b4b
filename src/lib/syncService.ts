/**
 * SyncService - Serviço Global de Sincronização Offline-First
 * 
 * Este serviço gerencia a sincronização bidirecional entre Dexie (local) e Supabase (nuvem).
 * 
 * Funcionalidades:
 * - Fila de operações pendentes com retry automático
 * - Detecção e resolução de conflitos (updated_at)
 * - Sincronização em segundo plano com debounce
 * - BroadcastChannel para comunicação entre abas
 * - Monitor de conexão automático
 * - Gancho de impressão local
 * - Recuperação de falhas parciais
 * - Logs estruturados via syncLogger
 */

import { supabase } from '@/integrations/supabase/client';
import { syncLogger } from './syncLogger';
import { 
  conflictResolver, 
  resolveWithLastWriteWins, 
  applyCloudResolution,
  markSyncError,
  clearSyncError,
  parseSupabaseError 
} from './conflictResolver';

// ==================== TIPOS ====================

type OperationType = 'INSERT' | 'UPDATE' | 'DELETE';

interface PendingOperation {
  id: string;
  table: string;
  type: OperationType;
  data: Record<string, any>;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

interface SyncProgress {
  current: number;
  total: number;
  table: string;
}

interface BroadcastMessage {
  type: 'PEDIDO_NOVO' | 'PEDIDO_ATUALIZADO' | 'COMANDA_FECHADA' | 'MESA_ATUALIZADA' | 'SYNC_COMPLETE' | 'IMPRESSAO_PENDENTE';
  payload: any;
  timestamp: string;
  tabId: string;
}

interface PrintJob {
  pedidoId: string;
  tipo: 'cozinha' | 'cliente' | 'ambos';
  tentativas: number;
  dados: any;
}

type SyncListener = (progress: SyncProgress) => void;
type SyncCompleteListener = (result: SyncResult) => void;
type BroadcastListener = (message: BroadcastMessage) => void;
type PrintListener = (job: PrintJob) => void;

// ==================== CLASSE PRINCIPAL ====================

class SyncService {
  private isSyncing = false;
  private syncListeners: Set<SyncListener> = new Set();
  private completeListeners: Set<SyncCompleteListener> = new Set();
  private broadcastListeners: Set<BroadcastListener> = new Set();
  private printListeners: Set<PrintListener> = new Set();
  private retryTimeout: number | null = null;
  private syncDebounceTimeout: number | null = null;
  private maxRetries = 3;
  private retryDelay = 5000; // 5 segundos
  private syncDebounceDelay = 2000; // 2 segundos de debounce
  private tabId: string;
  private broadcastChannel: BroadcastChannel | null = null;
  private connectionListenerAttached = false;

  // Tabelas que devem ser sincronizadas (bidirecional)
  private readonly syncTables = [
    'comandas',
    'pedidos',
    'mesas',
    'chamadas_garcom',
    'movimentacoes_caixa',
    'vendas_concluidas',
    'pedidos_delivery',
    'itens_delivery',
  ];

  // Tabelas apenas download (não editadas localmente)
  private readonly downloadOnlyTables = [
    'produtos',
    'categorias',
    'cupons',
    'combos',
    'promocoes',
  ];

  // Tabelas com relacionamento pai-filho (sincronização atômica)
  private readonly atomicRelations = [
    { parent: 'pedidos', child: 'itens_pedido', foreignKey: 'pedido_id' },
    { parent: 'pedidos_delivery', child: 'itens_delivery', foreignKey: 'pedido_delivery_id' },
    { parent: 'comandas', child: 'pedidos', foreignKey: 'comanda_id' },
  ];

  // Tempo máximo para manter dados sincronizados no Dexie (housekeeping)
  private readonly housekeepingDays = 7;

  constructor() {
    this.tabId = crypto.randomUUID();
    this.initBroadcastChannel();
    this.initConnectionMonitor();
  }

  // ==================== BROADCAST CHANNEL ====================

  /**
   * Inicializa o BroadcastChannel para comunicação entre abas
   */
  private initBroadcastChannel(): void {
    if (typeof BroadcastChannel === 'undefined') {
      console.warn('[SyncService] BroadcastChannel não suportado neste navegador');
      return;
    }

    try {
      this.broadcastChannel = new BroadcastChannel('food_comanda_updates');
      
      this.broadcastChannel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
        // Ignorar mensagens da própria aba
        if (event.data.tabId === this.tabId) return;
        
        console.log('[SyncService] Mensagem recebida de outra aba:', event.data.type);
        this.notifyBroadcastListeners(event.data);
        
        // Ações automáticas baseadas no tipo
        this.handleBroadcastMessage(event.data);
      };

      this.broadcastChannel.onmessageerror = (error) => {
        console.error('[SyncService] Erro no BroadcastChannel:', error);
      };

      console.log('[SyncService] BroadcastChannel inicializado');
    } catch (error) {
      console.error('[SyncService] Falha ao inicializar BroadcastChannel:', error);
    }
  }

  /**
   * Processa mensagens recebidas do BroadcastChannel
   */
  private async handleBroadcastMessage(message: BroadcastMessage): Promise<void> {
    switch (message.type) {
      case 'PEDIDO_NOVO':
      case 'PEDIDO_ATUALIZADO':
        // Atualizar dados locais se necessário
        if (message.payload?.id) {
          await this.refreshLocalRecord('pedidos', message.payload.id);
        }
        break;
      
      case 'COMANDA_FECHADA':
        if (message.payload?.id) {
          await this.refreshLocalRecord('comandas', message.payload.id);
        }
        break;

      case 'SYNC_COMPLETE':
        // Outra aba concluiu sincronização, pode ser útil atualizar UI
        console.log('[SyncService] Outra aba concluiu sincronização');
        break;

      case 'IMPRESSAO_PENDENTE':
        // Notificar listeners de impressão
        if (message.payload) {
          this.notifyPrintListeners(message.payload);
        }
        break;
    }
  }

  /**
   * Atualiza um registro local buscando da nuvem
   */
  private async refreshLocalRecord(table: string, id: string): Promise<void> {
    if (!navigator.onLine) return;

    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        const { db } = await import('./db');
        if (db[table]) {
          await db[table].put({ ...data, sincronizado: 1 });
          console.log(`[SyncService] Registro ${table}/${id} atualizado localmente`);
        }
      }
    } catch (e) {
      console.error(`[SyncService] Erro ao atualizar ${table}/${id}:`, e);
    }
  }

  /**
   * Envia uma mensagem para todas as outras abas
   */
  broadcast(type: BroadcastMessage['type'], payload: any): void {
    if (!this.broadcastChannel) return;

    const message: BroadcastMessage = {
      type,
      payload,
      timestamp: new Date().toISOString(),
      tabId: this.tabId,
    };

    try {
      this.broadcastChannel.postMessage(message);
      console.log('[SyncService] Broadcast enviado:', type);
    } catch (error) {
      console.error('[SyncService] Erro ao enviar broadcast:', error);
    }
  }

  // ==================== MONITOR DE CONEXÃO ====================

  /**
   * Configura listeners para mudanças de conexão
   */
  private initConnectionMonitor(): void {
    if (this.connectionListenerAttached || typeof window === 'undefined') return;

    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    this.connectionListenerAttached = true;
    console.log('[SyncService] Monitor de conexão ativado');
  }

  /**
   * Handler quando a conexão volta
   */
  private handleOnline(): void {
    console.log('[SyncService] 🟢 Conexão restaurada - Iniciando sincronização...');
    
    // Usar debounce para evitar múltiplas sincronizações
    this.debouncedSync();
  }

  /**
   * Handler quando a conexão cai
   */
  private handleOffline(): void {
    console.log('[SyncService] 🔴 Conexão perdida - Modo offline ativado');
    
    // Cancelar sincronização em andamento
    if (this.syncDebounceTimeout) {
      clearTimeout(this.syncDebounceTimeout);
      this.syncDebounceTimeout = null;
    }
  }

  /**
   * Sincronização com debounce de 2 segundos
   */
  private debouncedSync(): void {
    if (this.syncDebounceTimeout) {
      clearTimeout(this.syncDebounceTimeout);
    }

    this.syncDebounceTimeout = window.setTimeout(async () => {
      if (navigator.onLine && !this.isSyncing) {
        console.log('[SyncService] Executando sincronização após debounce...');
        await this.syncAll();
      }
    }, this.syncDebounceDelay);
  }

  // ==================== IMPRESSÃO LOCAL ====================

  /**
   * Dispara impressão local para um pedido
   * Verifica se o pedido ainda não foi impresso localmente
   */
  async dispararImpressaoLocal(pedido: any): Promise<boolean> {
    // Verificar se já foi impresso
    if (pedido.impresso_local === true) {
      console.log(`[SyncService] Pedido ${pedido.id} já foi impresso localmente`);
      return false;
    }

    const printJob: PrintJob = {
      pedidoId: pedido.id,
      tipo: pedido.tipo_impressao || 'cozinha',
      tentativas: 0,
      dados: {
        itens: pedido.itens,
        mesa: pedido.mesa_numero,
        comanda: pedido.comanda_id,
        observacoes: pedido.observacoes,
        horario: pedido.criado_em || new Date().toISOString(),
      },
    };

    // Notificar listeners de impressão
    this.notifyPrintListeners(printJob);

    // Broadcast para outras abas (pode haver um KDS/impressora em outra aba)
    this.broadcast('IMPRESSAO_PENDENTE', printJob);

    // Marcar como impresso localmente
    try {
      const { db } = await import('./db');
      if (db.pedidos) {
        await db.pedidos.update(pedido.id, { impresso_local: true });
        console.log(`[SyncService] ✓ Pedido ${pedido.id} marcado como impresso`);
      }
      return true;
    } catch (error) {
      console.error('[SyncService] Erro ao marcar pedido como impresso:', error);
      return false;
    }
  }

  /**
   * Verifica e dispara impressões pendentes
   */
  async processarImpressoesPendentes(): Promise<number> {
    try {
      const { db } = await import('./db');
      if (!db.pedidos) return 0;

      const pendentes = await db.pedidos
        .where('impresso_local')
        .equals(false)
        .toArray();

      let impressos = 0;
      for (const pedido of pendentes) {
        const success = await this.dispararImpressaoLocal(pedido);
        if (success) impressos++;
      }

      console.log(`[SyncService] ${impressos} impressões processadas`);
      return impressos;
    } catch (error) {
      console.error('[SyncService] Erro ao processar impressões:', error);
      return 0;
    }
  }

  // ==================== RESOLUÇÃO DE CONFLITOS ====================

  /**
   * Resolve conflito entre dados locais e da nuvem
   * Estratégia: dados mais recentes (updated_at) prevalecem
   */
  private async resolveConflict(
    table: string,
    localRecord: Record<string, any>,
    cloudRecord: Record<string, any>
  ): Promise<'local' | 'cloud' | 'merge'> {
    const localUpdatedAt = new Date(localRecord._updatedAt || localRecord.atualizado_em || 0);
    const cloudUpdatedAt = new Date(cloudRecord.atualizado_em || cloudRecord.updated_at || 0);

    if (cloudUpdatedAt > localUpdatedAt) {
      // Dados da nuvem são mais recentes
      console.log(`[SyncService] Conflito em ${table}/${localRecord.id}: Cloud vence (mais recente)`);
      return 'cloud';
    } else if (localUpdatedAt > cloudUpdatedAt) {
      // Dados locais são mais recentes
      console.log(`[SyncService] Conflito em ${table}/${localRecord.id}: Local vence (mais recente)`);
      return 'local';
    }

    // Mesmo timestamp - priorizar cloud para consistência
    return 'cloud';
  }

  /**
   * Verifica se há conflito antes de sincronizar
   */
  private async checkAndResolveConflict(
    table: string,
    localRecord: Record<string, any>
  ): Promise<{ shouldSync: boolean; updatedRecord?: Record<string, any> }> {
    if (!navigator.onLine) {
      return { shouldSync: true };
    }

    try {
      // Buscar versão atual na nuvem
      const { data: cloudRecord, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', localRecord.id)
        .single();

      if (error || !cloudRecord) {
        // Registro não existe na nuvem, pode sincronizar
        return { shouldSync: true };
      }

      const resolution = await this.resolveConflict(table, localRecord, cloudRecord);

      switch (resolution) {
        case 'local':
          // Dados locais prevalecem, sincronizar
          return { shouldSync: true };
        
        case 'cloud':
          // Dados da nuvem prevalecem, atualizar local
          const { db } = await import('./db');
          if (db[table]) {
            await db[table].put({ ...cloudRecord, sincronizado: 1 });
          }
          return { shouldSync: false, updatedRecord: cloudRecord };
        
        default:
          return { shouldSync: true };
      }
    } catch (error) {
      console.error(`[SyncService] Erro ao verificar conflito:`, error);
      return { shouldSync: true }; // Em caso de erro, tentar sincronizar
    }
  }

  // ==================== OPERAÇÕES CRUD ====================

  /**
   * Salva uma operação localmente com flag de pendente
   */
  async saveLocal<T extends Record<string, any>>(
    table: string,
    data: T,
    type: OperationType = 'INSERT'
  ): Promise<T & { id: string }> {
    const { db } = await import('./db');
    
    // Garantir UUID
    const id = data.id || (type === 'INSERT' ? crypto.randomUUID() : undefined);

    // Marcar como não sincronizado
    const record = {
      ...data,
      id,
      sincronizado: 0,
      impresso_local: data.impresso_local ?? false,
      _operation: type,
      _updatedAt: new Date().toISOString(),
    };

    // Salvar no Dexie
    if (db[table]) {
      await db[table].put(record);
      console.log(`[SyncService] Salvo localmente em ${table}:`, record.id);
    }

    return record as T & { id: string };
  }

  /**
   * Salva localmente E tenta sincronizar imediatamente se online
   */
  async saveAndSync<T extends Record<string, any>>(
    table: string,
    data: T,
    type: OperationType = 'INSERT'
  ): Promise<{ local: T & { id: string }; synced: boolean; error?: string }> {
    // 1. Sempre salvar localmente primeiro
    const localRecord = await this.saveLocal(table, data, type);

    // 2. Se for um pedido novo, disparar impressão
    if (table === 'pedidos' && type === 'INSERT') {
      await this.dispararImpressaoLocal(localRecord);
    }

    // 3. Notificar outras abas
    if (table === 'pedidos') {
      this.broadcast(type === 'INSERT' ? 'PEDIDO_NOVO' : 'PEDIDO_ATUALIZADO', localRecord);
    } else if (table === 'comandas' && data.status === 'fechada') {
      this.broadcast('COMANDA_FECHADA', localRecord);
    } else if (table === 'mesas') {
      this.broadcast('MESA_ATUALIZADA', localRecord);
    }

    // 4. Se online, tentar sincronizar imediatamente
    if (navigator.onLine) {
      try {
        // Verificar conflitos antes de sincronizar
        const conflictCheck = await this.checkAndResolveConflict(table, localRecord);
        
        if (!conflictCheck.shouldSync) {
          // Dados da nuvem eram mais recentes, local foi atualizado
          return { 
            local: (conflictCheck.updatedRecord || localRecord) as T & { id: string }, 
            synced: true 
          };
        }

        const result = await this.syncSingleRecord(table, localRecord, type);
        
        if (result.success) {
          // Marcar como sincronizado
          const { db } = await import('./db');
          if (db[table]) {
            await db[table].update(localRecord.id, { sincronizado: 1 });
          }
          return { local: localRecord, synced: true };
        } else {
          return { local: localRecord, synced: false, error: result.error };
        }
      } catch (error: any) {
        console.warn(`[SyncService] Falha ao sincronizar ${table}:`, error.message);
        return { local: localRecord, synced: false, error: error.message };
      }
    }

    return { local: localRecord, synced: false };
  }

  /**
   * Sincroniza um único registro com o Supabase
   * Implementa Last Write Wins verificando timestamp ANTES do upsert
   */
  private async syncSingleRecord(
    table: string,
    record: Record<string, any>,
    type: OperationType,
    forceSync: boolean = false
  ): Promise<{ success: boolean; error?: string; resolution?: string }> {
    try {
      const { db } = await import('./db');

      // Verificar Last Write Wins ANTES de enviar (exceto se forceSync)
      if (!forceSync && (type === 'INSERT' || type === 'UPDATE')) {
        const conflictResult = await resolveWithLastWriteWins(table, record);

        if (!conflictResult.shouldSync) {
          // Cloud é mais recente - baixar versão da nuvem
          if (conflictResult.cloudRecord) {
            await applyCloudResolution(table, conflictResult.cloudRecord);
          }
          
          console.log(`[SyncService] ⬇ ${table}/${record.id} - Cloud mais recente, baixado`);
          syncLogger.log('info', table, 'Cloud mais recente, versão baixada', { id: record.id });
          
          return { 
            success: true, 
            resolution: 'cloud_downloaded'
          };
        }
      }

      // Remover campos locais antes de enviar
      const { 
        sincronizado, _operation, _updatedAt, _retryCount, _lastError, _failedAt,
        numero, atualizado_em, criado_em, 
        sync_status, sync_error, sync_error_code, sync_error_at,
        ...dataToSync 
      } = record;

      // Garantir que updated_at está presente para LWW funcionar na nuvem
      if (!dataToSync.updated_at) {
        dataToSync.updated_at = new Date().toISOString();
      }

      switch (type) {
        case 'INSERT':
        case 'UPDATE': {
          const { error } = await supabase
            .from(table)
            .upsert([dataToSync], { onConflict: 'id' });
          
          if (error) {
            // Tratar erro de payload
            const parsedError = parseSupabaseError(error);
            console.error(`[SyncService] Erro ao upsert ${table}:`, parsedError);
            
            // Marcar registro com erro
            await markSyncError(table, record.id, parsedError.message, parsedError.code);
            
            return { 
              success: false, 
              error: parsedError.message 
            };
          }
          break;
        }
        case 'DELETE': {
          const { error } = await supabase
            .from(table)
            .delete()
            .eq('id', record.id);
          
          if (error) {
            const parsedError = parseSupabaseError(error);
            console.error(`[SyncService] Erro ao delete ${table}:`, parsedError);
            await markSyncError(table, record.id, parsedError.message, parsedError.code);
            return { success: false, error: parsedError.message };
          }
          break;
        }
      }

      // Sucesso - limpar qualquer erro anterior
      await clearSyncError(table, record.id);

      console.log(`[SyncService] ✓ Sincronizado ${table}/${record.id}`);
      syncLogger.itemSynced(table, record.id);
      return { success: true, resolution: 'uploaded' };

    } catch (error: any) {
      syncLogger.itemError(table, record.id, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sincroniza todos os registros pendentes de todas as tabelas
   */
  async syncAll(): Promise<SyncResult> {
    if (this.isSyncing) {
      console.log('[SyncService] Sincronização já em andamento');
      return { success: false, synced: 0, failed: 0, errors: ['Sincronização já em andamento'] };
    }

    if (!navigator.onLine) {
      console.log('[SyncService] Offline - sincronização adiada');
      syncLogger.log('warning', 'sync', 'Sincronização adiada: offline');
      return { success: false, synced: 0, failed: 0, errors: ['Sem conexão'] };
    }

    this.isSyncing = true;
    const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] };

    try {
      const { db } = await import('./db');

      // Contar total de pendentes para progresso
      let totalPending = 0;
      for (const table of this.syncTables) {
        if (db[table]) {
          const count = await db[table].where('sincronizado').equals(0).count();
          totalPending += count;
        }
      }

      if (totalPending === 0) {
        console.log('[SyncService] Nenhum registro pendente');
        this.isSyncing = false;
        return result;
      }

      console.log(`[SyncService] Iniciando sincronização de ${totalPending} registros...`);
      syncLogger.log('info', 'sync', `Sincronização iniciada: ${totalPending} item(s) pendente(s)`);
      let processed = 0;

      // Processar cada tabela
      for (const table of this.syncTables) {
        if (!db[table]) continue;

        const pendentes = await db[table].where('sincronizado').equals(0).toArray();
        
        if (pendentes.length === 0) continue;

        console.log(`[SyncService] Sincronizando ${pendentes.length} registros de ${table}...`);
        syncLogger.syncStarted(table, pendentes.length);

        for (const record of pendentes) {
          // Notificar progresso
          processed++;
          this.notifyProgress({ current: processed, total: totalPending, table });

          let syncResult: { success: boolean; error?: string };

          // Usar operações atômicas para pedidos (garantir que itens vão junto)
          if (table === 'pedidos') {
            syncResult = await this.syncAtomicPedido(record.id);
          } else if (table === 'pedidos_delivery') {
            syncResult = await this.syncAtomicDelivery(record.id);
          } else {
            const type = record._operation || 'UPDATE';
            syncResult = await this.syncSingleRecord(table, record, type as OperationType);
          }

          if (syncResult.success) {
            // syncAtomicPedido já marca como sincronizado, mas garantir aqui também
            if (table !== 'pedidos' && table !== 'pedidos_delivery') {
              await db[table].update(record.id, { 
                sincronizado: 1, 
                _operation: null,
                sync_status: 'synced' 
              });
            }
            result.synced++;
          } else {
            result.failed++;
            result.errors.push(`${table}/${record.id}: ${syncResult.error}`);
            syncLogger.itemError(table, record.id, syncResult.error || 'Erro desconhecido');
            
            // Incrementar contador de retry
            const retryCount = (record._retryCount || 0) + 1;
            if (retryCount >= this.maxRetries) {
              console.error(`[SyncService] Máximo de tentativas atingido para ${table}/${record.id}`);
              syncLogger.log('error', table, `Máximo de tentativas atingido`, { id: record.id, retryCount });
              // Marcar como erro permanente
              await db[table].update(record.id, { 
                _retryCount: retryCount,
                _lastError: syncResult.error,
                _failedAt: new Date().toISOString()
              });
            } else {
              await db[table].update(record.id, { _retryCount: retryCount });
            }
          }
        }
        
        // Log de conclusão por tabela
        const tabelaSynced = pendentes.filter(p => result.errors.every(e => !e.includes(p.id))).length;
        const tabelaFailed = pendentes.length - tabelaSynced;
        syncLogger.syncCompleted(table, tabelaSynced, tabelaFailed);
      }

      result.success = result.failed === 0;
      console.log(`[SyncService] ✅ Sincronização concluída: ${result.synced} ok, ${result.failed} falhas`);
      syncLogger.log(
        result.success ? 'success' : 'warning', 
        'sync', 
        `Sincronização concluída: ${result.synced} ok, ${result.failed} falha(s)`
      );

    } catch (error: any) {
      console.error('[SyncService] Erro na sincronização:', error);
      syncLogger.log('error', 'sync', 'Erro crítico na sincronização', { error: error.message });
      result.success = false;
      result.errors.push(error.message);
    } finally {
      this.isSyncing = false;
      this.notifyComplete(result);
    }

    return result;
  }

  /**
   * Baixa dados atualizados do Supabase para o Dexie
   */
  async downloadFromCloud(empresaId: string): Promise<void> {
    if (!navigator.onLine || !empresaId) return;

    const { db } = await import('./db');
    console.log('[SyncService] Baixando dados da nuvem...');

    const tabelasParaBaixar = [
      { nome: 'produtos', filtro: 'empresa_id' },
      { nome: 'categorias', filtro: 'empresa_id' },
      { nome: 'mesas', filtro: 'empresa_id' },
      { nome: 'comandas', filtro: 'empresa_id', extra: { status: 'aberta' } },
    ];

    for (const tabela of tabelasParaBaixar) {
      try {
        let query = supabase.from(tabela.nome).select('*');
        
        if (tabela.filtro) {
          query = query.eq(tabela.filtro, empresaId);
        }
        
        if (tabela.extra) {
          for (const [key, value] of Object.entries(tabela.extra)) {
            query = query.eq(key, value);
          }
        }

        const { data, error } = await query;

        if (!error && data && db[tabela.nome]) {
          const dadosComSync = data.map(item => ({
            ...item,
            sincronizado: 1,
            numero: item.numero_mesa || item.numero
          }));
          await db[tabela.nome].bulkPut(dadosComSync);
          console.log(`[SyncService] ✓ Baixado ${data.length} registros de ${tabela.nome}`);
        }
      } catch (e) {
        console.error(`[SyncService] Erro ao baixar ${tabela.nome}:`, e);
      }
    }
  }

  /**
   * Conta registros pendentes de sincronização
   */
  async countPending(): Promise<number> {
    const { db } = await import('./db');
    let total = 0;

    for (const table of this.syncTables) {
      if (db[table]) {
        try {
          const count = await db[table].where('sincronizado').equals(0).count();
          total += count;
        } catch (e) {
          // Tabela pode não existir ainda
        }
      }
    }

    return total;
  }

  /**
   * Agenda retry automático quando a conexão voltar
   */
  scheduleRetry(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }

    this.retryTimeout = window.setTimeout(async () => {
      if (navigator.onLine) {
        console.log('[SyncService] Tentando sincronização automática...');
        await this.syncAll();
      } else {
        this.scheduleRetry();
      }
    }, this.retryDelay);
  }

  /**
   * @deprecated Use housekeeping() em vez deste método
   * Limpa registros sincronizados antigos (manutenção)
   */
  async cleanup(daysOld: number = 30): Promise<void> {
    // Delegar para housekeeping que é mais completo
    await this.housekeeping(daysOld);
  }

  // ==================== LISTENERS ====================

  onProgress(listener: SyncListener): () => void {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  onComplete(listener: SyncCompleteListener): () => void {
    this.completeListeners.add(listener);
    return () => this.completeListeners.delete(listener);
  }

  onBroadcast(listener: BroadcastListener): () => void {
    this.broadcastListeners.add(listener);
    return () => this.broadcastListeners.delete(listener);
  }

  onPrint(listener: PrintListener): () => void {
    this.printListeners.add(listener);
    return () => this.printListeners.delete(listener);
  }

  private notifyProgress(progress: SyncProgress): void {
    this.syncListeners.forEach(listener => {
      try {
        listener(progress);
      } catch (e) {
        console.error('[SyncService] Erro em listener de progresso:', e);
      }
    });
  }

  private notifyComplete(result: SyncResult): void {
    this.completeListeners.forEach(listener => {
      try {
        listener(result);
      } catch (e) {
        console.error('[SyncService] Erro em listener de conclusão:', e);
      }
    });

    // Notificar outras abas que a sincronização foi concluída
    this.broadcast('SYNC_COMPLETE', result);
  }

  private notifyBroadcastListeners(message: BroadcastMessage): void {
    this.broadcastListeners.forEach(listener => {
      try {
        listener(message);
      } catch (e) {
        console.error('[SyncService] Erro em listener de broadcast:', e);
      }
    });
  }

  private notifyPrintListeners(job: PrintJob): void {
    this.printListeners.forEach(listener => {
      try {
        listener(job);
      } catch (e) {
        console.error('[SyncService] Erro em listener de impressão:', e);
      }
    });
  }

  // ==================== STATUS ====================

  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  getTabId(): string {
    return this.tabId;
  }

  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Força sincronização imediata (ignora debounce)
   */
  async forceSyncNow(): Promise<SyncResult> {
    if (this.syncDebounceTimeout) {
      clearTimeout(this.syncDebounceTimeout);
      this.syncDebounceTimeout = null;
    }
    return this.syncAll();
  }

  // ==================== MODO DE RECUPERAÇÃO FORÇADA ====================

  /**
   * MODO DE EMERGÊNCIA: Força envio de TODOS os dados locais para a nuvem
   * Ignora completamente as verificações de timestamp (Last Write Wins)
   * Use apenas quando o suporte técnico precisar recuperar dados corrompidos
   */
  async forceSyncAll(): Promise<SyncResult> {
    console.warn('[SyncService] ⚠️ MODO DE EMERGÊNCIA: forceSyncAll() ativado');
    syncLogger.log('warning', 'sync', 'MODO DE EMERGÊNCIA: forceSyncAll() ativado - timestamps ignorados');

    if (this.isSyncing) {
      return { success: false, synced: 0, failed: 0, errors: ['Sincronização já em andamento'] };
    }

    if (!navigator.onLine) {
      return { success: false, synced: 0, failed: 0, errors: ['Sem conexão'] };
    }

    this.isSyncing = true;
    const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] };

    try {
      const { db } = await import('./db');

      // Sincronizar TODOS os registros não sincronizados, ignorando LWW
      for (const table of this.syncTables) {
        if (!db[table]) continue;

        // Pegar TODOS os pendentes, incluindo os com erro
        const pendentes = await db[table]
          .filter((record: any) => record.sincronizado === 0 || record.sync_status === 'error')
          .toArray();

        if (pendentes.length === 0) continue;

        console.log(`[SyncService] FORCE: Sincronizando ${pendentes.length} registros de ${table}...`);
        syncLogger.log('info', table, `FORCE: ${pendentes.length} registros`, {});

        for (const record of pendentes) {
          const type = record._operation || 'UPDATE';
          
          // forceSync = true ignora a verificação de timestamp
          const syncResult = await this.syncSingleRecord(table, record, type as OperationType, true);

          if (syncResult.success) {
            await db[table].update(record.id, { 
              sincronizado: 1, 
              _operation: null,
              sync_status: 'synced',
              sync_error: null,
              _retryCount: 0
            });
            result.synced++;
          } else {
            result.failed++;
            result.errors.push(`${table}/${record.id}: ${syncResult.error}`);
          }
        }
      }

      result.success = result.failed === 0;
      console.log(`[SyncService] FORCE: Concluído - ${result.synced} ok, ${result.failed} falhas`);
      syncLogger.log(
        result.success ? 'success' : 'warning',
        'sync',
        `FORCE concluído: ${result.synced} ok, ${result.failed} falha(s)`
      );

    } catch (error: any) {
      console.error('[SyncService] FORCE: Erro crítico:', error);
      result.success = false;
      result.errors.push(error.message);
    } finally {
      this.isSyncing = false;
      this.notifyComplete(result);
    }

    return result;
  }

  // ==================== OPERAÇÕES ATÔMICAS ====================

  /**
   * Sincroniza um pedido junto com seus itens em operação atômica
   * Garante que pedidos nunca fiquem sem itens no banco de dados
   */
  async syncAtomicPedido(pedidoId: string): Promise<{ success: boolean; error?: string }> {
    console.log(`[SyncService] Iniciando sincronização atômica do pedido ${pedidoId}`);
    
    try {
      const { db } = await import('./db');

      // 1. Buscar o pedido
      const pedido = await db.pedidos.get(pedidoId);
      if (!pedido) {
        return { success: false, error: 'Pedido não encontrado' };
      }

      // 2. Buscar itens do pedido
      const itensPedido = db.itens_pedido 
        ? await db.itens_pedido.where('pedido_id').equals(pedidoId).toArray()
        : [];

      // 3. Preparar dados para envio
      const { 
        sincronizado, _operation, _updatedAt, numero, atualizado_em, criado_em,
        sync_status, sync_error, sync_error_code, sync_error_at,
        ...pedidoData 
      } = pedido;

      pedidoData.updated_at = new Date().toISOString();

      // 4. Enviar pedido primeiro
      const { error: pedidoError } = await supabase
        .from('pedidos')
        .upsert([pedidoData], { onConflict: 'id' });

      if (pedidoError) {
        const parsedError = parseSupabaseError(pedidoError);
        await markSyncError('pedidos', pedidoId, parsedError.message, parsedError.code);
        return { success: false, error: `Pedido: ${parsedError.message}` };
      }

      // 5. Enviar itens em sequência (após pedido estar na nuvem)
      for (const item of itensPedido) {
        const { 
          sincronizado: itemSync, _operation: itemOp, atualizado_em: itemAt,
          sync_status: itemSyncStatus, sync_error: itemSyncError,
          ...itemData 
        } = item;

        itemData.updated_at = new Date().toISOString();

        const { error: itemError } = await supabase
          .from('itens_pedido')
          .upsert([itemData], { onConflict: 'id' });

        if (itemError) {
          const parsedError = parseSupabaseError(itemError);
          await markSyncError('itens_pedido', item.id, parsedError.message, parsedError.code);
          console.error(`[SyncService] Erro no item ${item.id}:`, parsedError);
          // Continuar com outros itens, mas marcar erro
        } else {
          await db.itens_pedido?.update(item.id, { 
            sincronizado: 1, 
            sync_status: 'synced',
            sync_error: null 
          });
        }
      }

      // 6. Marcar pedido como sincronizado
      await db.pedidos.update(pedidoId, { 
        sincronizado: 1, 
        sync_status: 'synced',
        sync_error: null 
      });

      console.log(`[SyncService] ✓ Pedido ${pedidoId} sincronizado atomicamente com ${itensPedido.length} itens`);
      syncLogger.log('success', 'pedidos', 'Pedido sincronizado atomicamente', { 
        id: pedidoId, 
        itens: itensPedido.length 
      });

      return { success: true };

    } catch (error: any) {
      console.error(`[SyncService] Erro na sincronização atômica:`, error);
      await markSyncError('pedidos', pedidoId, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sincroniza um pedido de delivery com seus itens atomicamente
   */
  async syncAtomicDelivery(pedidoDeliveryId: string): Promise<{ success: boolean; error?: string }> {
    console.log(`[SyncService] Sincronização atômica do pedido delivery ${pedidoDeliveryId}`);

    try {
      const { db } = await import('./db');

      // 1. Buscar pedido delivery
      const pedido = await db.pedidos_delivery?.get(pedidoDeliveryId);
      if (!pedido) {
        return { success: false, error: 'Pedido delivery não encontrado' };
      }

      // 2. Buscar itens
      const itens = db.itens_delivery 
        ? await db.itens_delivery.where('pedido_delivery_id').equals(pedidoDeliveryId).toArray()
        : [];

      // 3. Enviar pedido
      const { sincronizado, sync_status, sync_error, ...pedidoData } = pedido;
      pedidoData.updated_at = new Date().toISOString();

      const { error: pedidoError } = await supabase
        .from('pedidos_delivery')
        .upsert([pedidoData], { onConflict: 'id' });

      if (pedidoError) {
        const parsedError = parseSupabaseError(pedidoError);
        await markSyncError('pedidos_delivery', pedidoDeliveryId, parsedError.message, parsedError.code);
        return { success: false, error: parsedError.message };
      }

      // 4. Enviar itens
      for (const item of itens) {
        const { sincronizado: iSync, sync_status: iStat, sync_error: iErr, ...itemData } = item;
        itemData.updated_at = new Date().toISOString();

        const { error: itemError } = await supabase
          .from('itens_delivery')
          .upsert([itemData], { onConflict: 'id' });

        if (!itemError && db.itens_delivery) {
          await db.itens_delivery.update(item.id, { sincronizado: 1, sync_status: 'synced' });
        }
      }

      // 5. Marcar como sincronizado
      await db.pedidos_delivery?.update(pedidoDeliveryId, { 
        sincronizado: 1, 
        sync_status: 'synced' 
      });

      console.log(`[SyncService] ✓ Pedido delivery ${pedidoDeliveryId} sincronizado com ${itens.length} itens`);
      return { success: true };

    } catch (error: any) {
      await markSyncError('pedidos_delivery', pedidoDeliveryId, error.message);
      return { success: false, error: error.message };
    }
  }

  // ==================== HOUSEKEEPING (LIMPEZA DE DADOS ANTIGOS) ====================

  /**
   * Remove dados sincronizados mais antigos que X dias do Dexie
   * Isso evita que o IndexedDB cresça indefinidamente
   * Padrão: 7 dias (configurável)
   */
  async housekeeping(daysOld: number = this.housekeepingDays): Promise<{
    removed: number;
    tables: Record<string, number>;
  }> {
    console.log(`[SyncService] 🧹 Iniciando housekeeping (dados > ${daysOld} dias)...`);
    syncLogger.log('info', 'housekeeping', `Iniciando limpeza de dados > ${daysOld} dias`);

    const { db } = await import('./db');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffTimestamp = cutoffDate.getTime();

    const result = {
      removed: 0,
      tables: {} as Record<string, number>
    };

    // Tabelas que podem ser limpas (dados transacionais)
    const cleanableTables = [
      { name: 'pedidos', dateField: 'criado_em' },
      { name: 'comandas', dateField: 'criado_em' },
      { name: 'vendas_concluidas', dateField: 'data_fechamento' },
      { name: 'movimentacoes_caixa', dateField: 'data_hora' },
      { name: 'chamadas_garcom', dateField: 'created_at' },
      { name: 'itens_pedido', dateField: 'created_at' },
    ];

    for (const { name: table, dateField } of cleanableTables) {
      if (!db[table]) continue;

      try {
        // Buscar registros SINCRONIZADOS mais antigos que X dias
        const toDelete = await db[table]
          .where('sincronizado')
          .equals(1)
          .filter((record: any) => {
            const recordDate = new Date(record[dateField] || record.criado_em || record.created_at || 0);
            return recordDate.getTime() < cutoffTimestamp;
          })
          .toArray();

        if (toDelete.length > 0) {
          const ids = toDelete.map((r: any) => r.id);
          await db[table].bulkDelete(ids);
          
          result.tables[table] = toDelete.length;
          result.removed += toDelete.length;
          
          console.log(`[SyncService] 🧹 ${table}: ${toDelete.length} registros removidos`);
        }
      } catch (e: any) {
        console.error(`[SyncService] Erro no housekeeping de ${table}:`, e);
        syncLogger.log('error', 'housekeeping', `Erro em ${table}`, { error: e.message });
      }
    }

    console.log(`[SyncService] 🧹 Housekeeping concluído: ${result.removed} registros removidos`);
    syncLogger.log('success', 'housekeeping', `Concluído: ${result.removed} registros removidos`, result.tables);

    return result;
  }

  /**
   * Agenda housekeeping para executar periodicamente (ex: diariamente)
   */
  scheduleHousekeeping(intervalHours: number = 24): void {
    const intervalMs = intervalHours * 60 * 60 * 1000;

    // Executar uma vez ao iniciar
    setTimeout(() => {
      this.housekeeping().catch(console.error);
    }, 60000); // 1 minuto após iniciar

    // Agendar execuções periódicas
    setInterval(() => {
      this.housekeeping().catch(console.error);
    }, intervalMs);

    console.log(`[SyncService] Housekeeping agendado para executar a cada ${intervalHours}h`);
  }

  // ==================== DEBUG E SUPORTE ====================

  /**
   * Retorna registros com erro de sincronização para análise
   */
  async getRecordsWithErrors(): Promise<Record<string, any[]>> {
    const { db } = await import('./db');
    const result: Record<string, any[]> = {};

    for (const table of this.syncTables) {
      if (!db[table]) continue;

      try {
        const errors = await db[table]
          .filter((record: any) => record.sync_status === 'error')
          .toArray();

        if (errors.length > 0) {
          result[table] = errors.map((r: any) => ({
            id: r.id,
            sync_error: r.sync_error,
            sync_error_code: r.sync_error_code,
            sync_error_at: r.sync_error_at,
            _retryCount: r._retryCount
          }));
        }
      } catch (e) {
        // Tabela pode não ter o campo sync_status ainda
      }
    }

    return result;
  }

  /**
   * Reseta erros de sincronização para um registro específico
   * Permite tentar sincronizar novamente
   */
  async resetSyncError(table: string, id: string): Promise<void> {
    const { db } = await import('./db');

    if (!db[table]) return;

    await db[table].update(id, {
      sincronizado: 0,
      sync_status: 'pending',
      sync_error: null,
      sync_error_code: null,
      sync_error_at: null,
      _retryCount: 0
    });

    console.log(`[SyncService] Erro resetado para ${table}/${id}`);
    syncLogger.log('info', table, 'Erro de sincronização resetado', { id });
  }

  /**
   * Reseta todos os erros de sincronização
   */
  async resetAllSyncErrors(): Promise<number> {
    const { db } = await import('./db');
    let count = 0;

    for (const table of this.syncTables) {
      if (!db[table]) continue;

      try {
        const errors = await db[table]
          .filter((record: any) => record.sync_status === 'error')
          .toArray();

        for (const record of errors) {
          await this.resetSyncError(table, record.id);
          count++;
        }
      } catch (e) {
        // Ignorar erros
      }
    }

    console.log(`[SyncService] ${count} erros de sincronização resetados`);
    return count;
  }

  /**
   * Limpa recursos ao desmontar
   */
  destroy(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
    
    if (this.syncDebounceTimeout) {
      clearTimeout(this.syncDebounceTimeout);
    }

    if (typeof window !== 'undefined' && this.connectionListenerAttached) {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
      this.connectionListenerAttached = false;
    }

    this.syncListeners.clear();
    this.completeListeners.clear();
    this.broadcastListeners.clear();
    this.printListeners.clear();

    console.log('[SyncService] Recursos liberados');
  }
}

// Singleton
export const syncService = new SyncService();

// Exportar tipos
export type { SyncResult, SyncProgress, OperationType, BroadcastMessage, PrintJob };
