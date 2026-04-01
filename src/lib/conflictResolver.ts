/**
 * Conflict Resolver - Lógica de Resolução de Conflitos para Sincronização
 * 
 * Implementa estratégias de resolução de conflitos entre dados locais (Dexie)
 * e dados remotos (Supabase), garantindo consistência e integridade.
 * 
 * Funcionalidades:
 * - Last Write Wins com comparação de timestamps
 * - Verificação prévia antes do upsert
 * - Merge de dados quando apropriado
 * - Logs detalhados para análise de conflitos
 */

import { supabase } from '@/integrations/supabase/client';
import { syncLogger } from './syncLogger';

// ==================== TIPOS ====================

export type ConflictResolution = 'local' | 'cloud' | 'merge' | 'skip';

export interface ConflictResult {
  resolution: ConflictResolution;
  shouldSync: boolean;
  cloudRecord?: Record<string, any>;
  mergedData?: Record<string, any>;
  reason: string;
}

export interface CompareResult {
  localNewer: boolean;
  cloudNewer: boolean;
  sameTimestamp: boolean;
  localTimestamp: Date;
  cloudTimestamp: Date;
  timeDiffMs: number;
}

// ==================== FUNÇÕES AUXILIARES ====================

/**
 * Extrai o timestamp de atualização de um registro
 * Suporta múltiplos formatos de campo de timestamp
 */
function extractTimestamp(record: Record<string, any>): Date {
  const timestampFields = [
    'updated_at',
    'atualizado_em',
    '_updatedAt',
    'modified_at',
    'modificado_em'
  ];

  for (const field of timestampFields) {
    if (record[field]) {
      const date = new Date(record[field]);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  // Fallback: usar created_at ou data atual
  const fallbackFields = ['created_at', 'criado_em', 'data_criacao'];
  for (const field of fallbackFields) {
    if (record[field]) {
      const date = new Date(record[field]);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  return new Date(0); // Epoch como último recurso
}

/**
 * Compara timestamps entre registro local e da nuvem
 */
export function compareTimestamps(
  localRecord: Record<string, any>,
  cloudRecord: Record<string, any>
): CompareResult {
  const localTimestamp = extractTimestamp(localRecord);
  const cloudTimestamp = extractTimestamp(cloudRecord);
  const timeDiffMs = localTimestamp.getTime() - cloudTimestamp.getTime();

  // Tolerância de 1 segundo para considerar "mesmo timestamp"
  const TOLERANCE_MS = 1000;

  return {
    localNewer: timeDiffMs > TOLERANCE_MS,
    cloudNewer: timeDiffMs < -TOLERANCE_MS,
    sameTimestamp: Math.abs(timeDiffMs) <= TOLERANCE_MS,
    localTimestamp,
    cloudTimestamp,
    timeDiffMs
  };
}

/**
 * Busca o registro atual na nuvem para comparação
 */
export async function fetchCloudRecord(
  table: string,
  id: string
): Promise<{ data: Record<string, any> | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (e: any) {
    return { data: null, error: e.message || 'Erro desconhecido' };
  }
}

// ==================== RESOLUÇÃO DE CONFLITOS ====================

/**
 * Estratégia "Last Write Wins" (LWW)
 * Compara timestamps e determina qual versão deve prevalecer
 */
export async function resolveWithLastWriteWins(
  table: string,
  localRecord: Record<string, any>
): Promise<ConflictResult> {
  // Se offline, não podemos comparar - sincronizar depois
  if (!navigator.onLine) {
    return {
      resolution: 'skip',
      shouldSync: false,
      reason: 'Offline - verificação adiada'
    };
  }

  try {
    // Buscar versão atual na nuvem
    const { data: cloudRecord, error } = await fetchCloudRecord(table, localRecord.id);

    if (error) {
      syncLogger.log('warning', table, 'Erro ao buscar registro na nuvem para comparação', {
        id: localRecord.id,
        error
      });
      // Em caso de erro de rede, tentar sincronizar
      return {
        resolution: 'local',
        shouldSync: true,
        reason: `Erro ao buscar nuvem: ${error}`
      };
    }

    // Registro não existe na nuvem - pode criar
    if (!cloudRecord) {
      return {
        resolution: 'local',
        shouldSync: true,
        reason: 'Registro não existe na nuvem - será criado'
      };
    }

    // Comparar timestamps
    const comparison = compareTimestamps(localRecord, cloudRecord);

    if (comparison.cloudNewer) {
      // Cloud é mais recente - baixar versão da nuvem
      syncLogger.log('info', table, 'Conflito resolvido: Cloud vence (mais recente)', {
        id: localRecord.id,
        localTime: comparison.localTimestamp.toISOString(),
        cloudTime: comparison.cloudTimestamp.toISOString(),
        diffMs: comparison.timeDiffMs
      });

      return {
        resolution: 'cloud',
        shouldSync: false,
        cloudRecord,
        reason: `Cloud mais recente por ${Math.abs(comparison.timeDiffMs)}ms`
      };
    }

    if (comparison.localNewer) {
      // Local é mais recente - enviar para nuvem
      syncLogger.log('info', table, 'Conflito resolvido: Local vence (mais recente)', {
        id: localRecord.id,
        localTime: comparison.localTimestamp.toISOString(),
        cloudTime: comparison.cloudTimestamp.toISOString(),
        diffMs: comparison.timeDiffMs
      });

      return {
        resolution: 'local',
        shouldSync: true,
        cloudRecord,
        reason: `Local mais recente por ${comparison.timeDiffMs}ms`
      };
    }

    // Mesmo timestamp - cloud prevalece para consistência
    syncLogger.log('info', table, 'Timestamps iguais: Cloud prevalece por padrão', {
      id: localRecord.id,
      timestamp: comparison.localTimestamp.toISOString()
    });

    return {
      resolution: 'cloud',
      shouldSync: false,
      cloudRecord,
      reason: 'Timestamps iguais - cloud prevalece'
    };

  } catch (e: any) {
    syncLogger.log('error', table, 'Exceção ao resolver conflito', {
      id: localRecord.id,
      error: e.message
    });

    // Em caso de exceção, tentar sincronizar
    return {
      resolution: 'local',
      shouldSync: true,
      reason: `Exceção: ${e.message}`
    };
  }
}

/**
 * Aplica a resolução de conflito no banco local (quando cloud vence)
 */
export async function applyCloudResolution(
  table: string,
  cloudRecord: Record<string, any>
): Promise<boolean> {
  try {
    const { db } = await import('./db');

    if (!db[table]) {
      console.error(`[ConflictResolver] Tabela ${table} não encontrada no Dexie`);
      return false;
    }

    // Atualizar registro local com dados da nuvem
    await db[table].put({
      ...cloudRecord,
      sincronizado: 1,
      sync_status: 'synced',
      sync_error: null,
      numero: cloudRecord.numero_mesa || cloudRecord.numero // compatibilidade mesas
    });

    console.log(`[ConflictResolver] Registro ${table}/${cloudRecord.id} atualizado com versão da nuvem`);
    syncLogger.log('success', table, 'Registro atualizado com versão da nuvem', {
      id: cloudRecord.id
    });

    return true;
  } catch (e: any) {
    console.error(`[ConflictResolver] Erro ao aplicar resolução cloud:`, e);
    return false;
  }
}

// ==================== VALIDAÇÃO DE PAYLOAD ====================

/**
 * Erros conhecidos do Supabase e suas causas
 */
const KNOWN_ERRORS: Record<string, string> = {
  '23503': 'Violação de chave estrangeira - registro referenciado não existe',
  '23505': 'Violação de chave única - registro duplicado',
  '23502': 'Violação de NOT NULL - campo obrigatório ausente',
  '22P02': 'Tipo de dado inválido',
  '42501': 'Permissão negada - RLS bloqueia operação',
  '42P01': 'Tabela não encontrada',
  'PGRST116': 'Nenhum registro encontrado',
  'PGRST301': 'Conflito de versão da API'
};

/**
 * Interpreta erro do Supabase para mensagem amigável
 */
export function parseSupabaseError(error: any): {
  code: string;
  message: string;
  isRetryable: boolean;
} {
  const code = error?.code || error?.error?.code || 'UNKNOWN';
  const rawMessage = error?.message || error?.error?.message || 'Erro desconhecido';

  const friendlyMessage = KNOWN_ERRORS[code] || rawMessage;

  // Erros que podem ser resolvidos com retry (temporários)
  const retryableCodes = ['NETWORK_ERROR', 'TIMEOUT', '503', '502', '504'];
  const isRetryable = retryableCodes.some(c => code.includes(c) || rawMessage.includes(c));

  return {
    code,
    message: friendlyMessage,
    isRetryable
  };
}

/**
 * Marca um registro com erro de sincronização
 */
export async function markSyncError(
  table: string,
  id: string,
  error: string,
  errorCode?: string
): Promise<void> {
  try {
    const { db } = await import('./db');

    if (!db[table]) return;

    await db[table].update(id, {
      sync_status: 'error',
      sync_error: error,
      sync_error_code: errorCode,
      sync_error_at: new Date().toISOString()
    });

    console.log(`[ConflictResolver] Registro ${table}/${id} marcado com erro: ${error}`);
    syncLogger.log('error', table, 'Registro marcado com erro', { id, error, errorCode });

  } catch (e: any) {
    console.error(`[ConflictResolver] Erro ao marcar sync_error:`, e);
  }
}

/**
 * Limpa erro de sincronização após sucesso
 */
export async function clearSyncError(
  table: string,
  id: string
): Promise<void> {
  try {
    const { db } = await import('./db');

    if (!db[table]) return;

    await db[table].update(id, {
      sync_status: 'synced',
      sync_error: null,
      sync_error_code: null,
      sync_error_at: null
    });

  } catch (e: any) {
    console.error(`[ConflictResolver] Erro ao limpar sync_error:`, e);
  }
}

// ==================== EXPORTS ====================

export const conflictResolver = {
  compareTimestamps,
  fetchCloudRecord,
  resolveWithLastWriteWins,
  applyCloudResolution,
  parseSupabaseError,
  markSyncError,
  clearSyncError
};

export default conflictResolver;
