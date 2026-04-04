/**
 * PWA Migration - Script de Migração e Lifecycle do PWA
 * 
 * Gerencia a migração de dados do localStorage para Dexie.js,
 * verificação de quota de armazenamento e logs de auditoria.
 * 
 * Funcionalidades:
 * - Migração automática de dados legados
 * - Verificação de quota de disco
 * - Logs de auditoria para suporte técnico
 * - Exportação de emergência
 */

import { db } from './db';
import { syncLogger } from './syncLogger';

// ==================== TIPOS ====================

interface MigrationResult {
  success: boolean;
  migratedTables: string[];
  errors: string[];
  timestamp: string;
}

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

// ==================== CONSTANTES ====================

const MIGRATION_KEY = 'fcp_migration_completed_v10';
const MAX_SYNC_LOGS = 50;

// Mapeamento de chaves do localStorage para tabelas do Dexie
const LEGACY_STORAGE_KEYS: Record<string, string> = {
  'fcp_pedidos': 'pedidos',
  'fcp_comandas': 'comandas',
  'fcp_mesas': 'mesas',
  'fcp_produtos': 'produtos',
  'fcp_categorias': 'categorias',
  'food_comanda_pedidos': 'pedidos',
  'food_comanda_mesas': 'mesas',
  'cart_items': 'itens_pedido',
  'pending_orders': 'pedidos',
};

// ==================== MIGRAÇÃO INICIAL ====================

/**
 * Verifica se já executou a migração
 */
export function isMigrationCompleted(): boolean {
  try {
    return localStorage.getItem(MIGRATION_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Marca a migração como concluída
 */
function markMigrationCompleted(): void {
  try {
    localStorage.setItem(MIGRATION_KEY, 'true');
    localStorage.setItem('fcp_migration_timestamp', new Date().toISOString());
  } catch (e) {
    console.warn('[PWA Migration] Não foi possível marcar migração como concluída:', e);
  }
}

/**
 * Executa a migração de dados do localStorage para Dexie.js
 * Deve ser chamado na inicialização do app
 */
export async function runInitialMigration(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    migratedTables: [],
    errors: [],
    timestamp: new Date().toISOString()
  };

  // Pular se já migrou
  if (isMigrationCompleted()) {
    console.log('[PWA Migration] Migração já foi executada anteriormente');
    return result;
  }

  console.log('[PWA Migration] 🔄 Iniciando migração de dados legados...');
  
  try {
    // 1. Migrar dados do localStorage
    for (const [localKey, dexieTable] of Object.entries(LEGACY_STORAGE_KEYS)) {
      try {
        const rawData = localStorage.getItem(localKey);
        
        if (rawData) {
          const data = JSON.parse(rawData);
          
          if (Array.isArray(data) && data.length > 0 && db[dexieTable]) {
            // Adicionar flags de sincronização
            const dataWithSync = data.map(item => ({
              ...item,
              id: item.id || crypto.randomUUID(),
              sincronizado: 0,
              sync_status: 'pending',
              atualizado_em: new Date().toISOString()
            }));

            await db[dexieTable].bulkPut(dataWithSync);
            result.migratedTables.push(`${localKey} → ${dexieTable} (${data.length} registros)`);
            
            console.log(`[PWA Migration] ✓ Migrado ${localKey} → ${dexieTable}: ${data.length} registros`);
            
            // Limpar localStorage após migração bem-sucedida
            localStorage.removeItem(localKey);
          }
        }
      } catch (e: any) {
        const error = `Erro ao migrar ${localKey}: ${e.message}`;
        result.errors.push(error);
        console.error(`[PWA Migration] ✗ ${error}`);
      }
    }

    // 2. Migrar estado de autenticação legado
    await migrateAuthState();

    // 3. Registrar log de migração
    await addSyncLog({
      timestamp: new Date().toISOString(),
      type: 'info',
      operation: 'migration',
      message: `Migração concluída: ${result.migratedTables.length} tabelas migradas`,
      details: { tables: result.migratedTables, errors: result.errors }
    });

    // 4. Marcar migração como concluída
    markMigrationCompleted();

    console.log('[PWA Migration] ✅ Migração concluída com sucesso');
    syncLogger.log('success', 'migration', 'Migração inicial concluída', {
      tables: result.migratedTables.length,
      errors: result.errors.length
    });

  } catch (e: any) {
    result.success = false;
    result.errors.push(`Erro crítico na migração: ${e.message}`);
    console.error('[PWA Migration] ❌ Erro crítico:', e);
  }

  return result;
}

/**
 * Migra estado de autenticação do localStorage para Dexie
 */
async function migrateAuthState(): Promise<void> {
  const authKeys = [
    'sb-tqmunlilydcowndqxiir-auth-token',
    'fcp_user',
    'fcp_empresa_id',
    'fcp_profile'
  ];

  for (const key of authKeys) {
    try {
      const data = localStorage.getItem(key);
      if (data && key.includes('profile')) {
        const profile = JSON.parse(data);
        if (profile.email && db.users_cache) {
          await db.users_cache.put({
            email: profile.email.toLowerCase(),
            id: profile.id,
            nome: profile.nome || profile.email.split('@')[0],
            empresa_id: profile.empresa_id,
            role: profile.role || 'proprietario',
            cached_at: new Date().toISOString(),
            last_online_at: new Date().toISOString(),
            session_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          });
          console.log('[PWA Migration] ✓ Perfil de usuário migrado para cache offline');
        }
      }
    } catch (e) {
      // Ignorar erros de parsing
    }
  }
}

// ==================== VERIFICAÇÃO DE QUOTA ====================

/**
 * Formata bytes para formato legível (KB, MB, GB)
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Verifica a quota de armazenamento disponível
 * Usa a API navigator.storage.estimate()
 * 
 * @returns Informações sobre uso de armazenamento
 */
export async function checkStorageQuota(): Promise<StorageQuota> {
  const defaultResult: StorageQuota = {
    usage: 0,
    quota: 0,
    usagePercent: 0,
    usageFormatted: 'Desconhecido',
    quotaFormatted: 'Desconhecido',
    isLow: false,
    isCritical: false
  };

  if (!navigator.storage?.estimate) {
    console.warn('[PWA Storage] API navigator.storage.estimate() não suportada');
    return defaultResult;
  }

  try {
    const estimate = await navigator.storage.estimate();
    
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const usagePercent = quota > 0 ? (usage / quota) * 100 : 0;

    const result: StorageQuota = {
      usage,
      quota,
      usagePercent: Math.round(usagePercent * 100) / 100,
      usageFormatted: formatBytes(usage),
      quotaFormatted: formatBytes(quota),
      isLow: usagePercent >= 80, // Aviso em 80%
      isCritical: usagePercent >= 95 // Crítico em 95%
    };

    // Log se estiver baixo
    if (result.isCritical) {
      console.error(`[PWA Storage] ⚠️ CRÍTICO: Armazenamento em ${result.usagePercent}%`);
      await addSyncLog({
        timestamp: new Date().toISOString(),
        type: 'error',
        operation: 'storage_check',
        message: `Armazenamento crítico: ${result.usageFormatted} / ${result.quotaFormatted}`,
        details: result
      });
    } else if (result.isLow) {
      console.warn(`[PWA Storage] ⚠️ Armazenamento baixo: ${result.usagePercent}%`);
      await addSyncLog({
        timestamp: new Date().toISOString(),
        type: 'warning',
        operation: 'storage_check',
        message: `Armazenamento baixo: ${result.usageFormatted} / ${result.quotaFormatted}`,
        details: result
      });
    } else {
      console.log(`[PWA Storage] ✓ Armazenamento OK: ${result.usageFormatted} / ${result.quotaFormatted} (${result.usagePercent}%)`);
    }

    return result;

  } catch (e: any) {
    console.error('[PWA Storage] Erro ao verificar quota:', e);
    return defaultResult;
  }
}

/**
 * Solicita armazenamento persistente do navegador
 * Evita que o navegador limpe os dados automaticamente
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) {
    console.warn('[PWA Storage] API navigator.storage.persist() não suportada');
    return false;
  }

  try {
    // Verificar se já é persistente
    const isPersisted = await navigator.storage.persisted();
    
    if (isPersisted) {
      console.log('[PWA Storage] ✓ Armazenamento já é persistente');
      return true;
    }

    // Solicitar persistência
    const granted = await navigator.storage.persist();
    
    if (granted) {
      console.log('[PWA Storage] ✓ Armazenamento persistente concedido');
      await addSyncLog({
        timestamp: new Date().toISOString(),
        type: 'success',
        operation: 'storage_persist',
        message: 'Armazenamento persistente concedido pelo navegador'
      });
    } else {
      console.warn('[PWA Storage] ✗ Armazenamento persistente negado');
    }

    return granted;
  } catch (e: any) {
    console.error('[PWA Storage] Erro ao solicitar persistência:', e);
    return false;
  }
}

// ==================== LOGS DE AUDITORIA ====================

/**
 * Adiciona um log de sincronização ao Dexie
 * Mantém apenas os últimos MAX_SYNC_LOGS registros
 */
export async function addSyncLog(log: SyncLog): Promise<void> {
  try {
    if (!db.logs_sincronizacao) {
      console.warn('[PWA Logs] Tabela logs_sincronizacao não disponível');
      return;
    }

    // Adicionar log
    await db.logs_sincronizacao.add({
      ...log,
      timestamp: log.timestamp || new Date().toISOString()
    });

    // Manter apenas os últimos 50 logs
    const count = await db.logs_sincronizacao.count();
    
    if (count > MAX_SYNC_LOGS) {
      const excess = count - MAX_SYNC_LOGS;
      const oldLogs = await db.logs_sincronizacao
        .orderBy('timestamp')
        .limit(excess)
        .primaryKeys();
      
      await db.logs_sincronizacao.bulkDelete(oldLogs);
    }

  } catch (e: any) {
    console.error('[PWA Logs] Erro ao adicionar log:', e);
  }
}

/**
 * Retorna os últimos N logs de sincronização
 */
export async function getSyncLogs(limit: number = MAX_SYNC_LOGS): Promise<SyncLog[]> {
  try {
    if (!db.logs_sincronizacao) {
      return [];
    }

    const logs = await db.logs_sincronizacao
      .orderBy('timestamp')
      .reverse()
      .limit(limit)
      .toArray();

    return logs;
  } catch (e: any) {
    console.error('[PWA Logs] Erro ao buscar logs:', e);
    return [];
  }
}

/**
 * Retorna apenas logs de erro
 */
export async function getErrorLogs(): Promise<SyncLog[]> {
  try {
    if (!db.logs_sincronizacao) {
      return [];
    }

    const logs = await db.logs_sincronizacao
      .filter(log => log.type === 'error')
      .reverse()
      .sortBy('timestamp');

    return logs;
  } catch (e: any) {
    console.error('[PWA Logs] Erro ao buscar logs de erro:', e);
    return [];
  }
}

/**
 * Limpa todos os logs mais antigos que X dias
 */
export async function cleanOldLogs(daysOld: number = 7): Promise<number> {
  try {
    if (!db.logs_sincronizacao) return 0;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);
    const cutoffStr = cutoff.toISOString();

    const oldLogs = await db.logs_sincronizacao
      .filter(log => log.timestamp < cutoffStr)
      .primaryKeys();

    await db.logs_sincronizacao.bulkDelete(oldLogs);

    console.log(`[PWA Logs] ${oldLogs.length} logs antigos removidos`);
    return oldLogs.length;

  } catch (e: any) {
    console.error('[PWA Logs] Erro ao limpar logs:', e);
    return 0;
  }
}

// ==================== EXPORTAÇÃO DE EMERGÊNCIA ====================

interface ExportData {
  exportedAt: string;
  appVersion: string;
  tables: Record<string, any[]>;
  pendingCount: number;
  storageInfo?: StorageQuota;
}

/**
 * Exporta todos os dados pendentes de sincronização para um arquivo JSON
 * Útil quando a internet não volta e o cliente precisa trocar de aparelho
 */
export async function exportPendingData(): Promise<ExportData> {
  console.log('[PWA Export] Iniciando exportação de dados pendentes...');

  const tables = [
    'pedidos',
    'comandas',
    'mesas',
    'produtos',
    'categorias',
    'movimentacoes_caixa',
    'vendas_concluidas',
    'chamadas_garcom',
    'pedidos_delivery',
    'itens_delivery',
    'itens_pedido',
  ];

  const exportData: ExportData = {
    exportedAt: new Date().toISOString(),
    appVersion: '1.0.0', // TODO: pegar do package.json
    tables: {},
    pendingCount: 0
  };

  for (const tableName of tables) {
    try {
      if (!db[tableName]) continue;

      // Buscar TODOS os registros pendentes de sincronização
      const pendentes = await db[tableName]
        .filter((record: any) => 
          record.sincronizado === 0 || 
          record.sync_status === 'pending' ||
          record.sync_status === 'error'
        )
        .toArray();

      if (pendentes.length > 0) {
        exportData.tables[tableName] = pendentes;
        exportData.pendingCount += pendentes.length;
        console.log(`[PWA Export] ${tableName}: ${pendentes.length} registros pendentes`);
      }
    } catch (e: any) {
      console.error(`[PWA Export] Erro ao exportar ${tableName}:`, e);
    }
  }

  // Adicionar info de armazenamento
  try {
    exportData.storageInfo = await checkStorageQuota();
  } catch (e) {
    // Ignorar erro
  }

  // Registrar log
  await addSyncLog({
    timestamp: new Date().toISOString(),
    type: 'info',
    operation: 'export',
    message: `Exportação de emergência: ${exportData.pendingCount} registros exportados`,
    details: { tables: Object.keys(exportData.tables) }
  });

  console.log(`[PWA Export] ✅ Exportação concluída: ${exportData.pendingCount} registros`);

  return exportData;
}

/**
 * Baixa os dados pendentes como arquivo JSON
 */
export async function downloadPendingDataAsFile(): Promise<void> {
  const data = await exportPendingData();
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { 
    type: 'application/json' 
  });
  
  const url = URL.createObjectURL(blob);
  const filename = `food-comanda-backup-${new Date().toISOString().split('T')[0]}.json`;
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);

  console.log(`[PWA Export] 📥 Arquivo ${filename} baixado`);
}

/**
 * Exporta TODOS os dados do Dexie (backup completo)
 */
export async function exportAllData(): Promise<ExportData> {
  console.log('[PWA Export] Iniciando backup completo...');

  const tables = [
    'pedidos', 'comandas', 'mesas', 'produtos', 'categorias',
    'movimentacoes_caixa', 'vendas_concluidas', 'chamadas_garcom',
    'pedidos_delivery', 'itens_delivery', 'itens_pedido',
    'caixa', 'empresa', 'cupons', 'combos', 'promocoes',
    'fidelidade_config', 'team_members', 'users_cache',
    'logs_sincronizacao'
  ];

  const exportData: ExportData = {
    exportedAt: new Date().toISOString(),
    appVersion: '1.0.0',
    tables: {},
    pendingCount: 0
  };

  for (const tableName of tables) {
    try {
      if (!db[tableName]) continue;

      const allRecords = await db[tableName].toArray();
      
      if (allRecords.length > 0) {
        exportData.tables[tableName] = allRecords;
        
        // Contar pendentes
        const pendentes = allRecords.filter((r: any) => 
          r.sincronizado === 0 || r.sync_status === 'pending'
        );
        exportData.pendingCount += pendentes.length;
      }
    } catch (e: any) {
      console.error(`[PWA Export] Erro ao exportar ${tableName}:`, e);
    }
  }

  exportData.storageInfo = await checkStorageQuota();

  console.log(`[PWA Export] ✅ Backup completo: ${Object.values(exportData.tables).flat().length} registros totais`);

  return exportData;
}

// ==================== INICIALIZAÇÃO ====================

/**
 * Inicializa o módulo de migração do PWA
 * Deve ser chamado no startup do app (App.tsx ou main.tsx)
 */
export async function initPWAMigration(): Promise<void> {
  console.log('[PWA Migration] 🚀 Inicializando módulo de lifecycle...');

  try {
    // 1. Executar migração se necessário
    await runInitialMigration();

    // 2. Solicitar armazenamento persistente
    await requestPersistentStorage();

    // 3. Verificar quota de armazenamento
    const quota = await checkStorageQuota();
    
    if (quota.isCritical) {
      // Mostrar alerta de armazenamento crítico
      console.error('[PWA Migration] ⚠️ AVISO: Armazenamento crítico!');
    }

    // 4. Registrar inicialização nos logs
    await addSyncLog({
      timestamp: new Date().toISOString(),
      type: 'info',
      operation: 'startup',
      message: 'PWA inicializado com sucesso',
      details: {
        storage: quota,
        online: navigator.onLine,
        serviceWorker: 'serviceWorker' in navigator
      }
    });

    console.log('[PWA Migration] ✅ Módulo de lifecycle inicializado');

  } catch (e: any) {
    console.error('[PWA Migration] ❌ Erro na inicialização:', e);
  }
}

// ==================== EXPORTS ====================

export const pwaMigration = {
  runInitialMigration,
  isMigrationCompleted,
  checkStorageQuota,
  requestPersistentStorage,
  addSyncLog,
  getSyncLogs,
  getErrorLogs,
  cleanOldLogs,
  exportPendingData,
  downloadPendingDataAsFile,
  exportAllData,
  initPWAMigration
};

export default pwaMigration;
