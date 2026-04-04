/**
 * Offline Query Helper - Sistema de Queries Offline-First
 * 
 * Este helper garante que todas as queries funcionem offline:
 * 1. Sempre retorna dados do IndexedDB primeiro (resposta imediata)
 * 2. Se online, busca dados atualizados do Supabase em background
 * 3. Atualiza o IndexedDB com dados novos
 * 4. Retorna dados locais quando offline
 */

import { db } from './db';
import { supabase } from '@/integrations/supabase/client';

// Tipos para as tabelas suportadas
type TabelaLocal = 'mesas' | 'produtos' | 'categorias' | 'comandas' | 'pedidos' | 
                   'chamadas_garcom' | 'empresa' | 'caixa' | 'movimentacoes_caixa' | 
                   'vendas_concluidas' | 'pedidos_delivery' | 'itens_delivery';

interface QueryOptions {
  tabela: TabelaLocal;
  filtro?: { campo: string; valor: string | number };
  ordenar?: { campo: string; direcao?: 'asc' | 'desc' };
  select?: string;
}

/**
 * Query Offline-First para dados de uma tabela
 * Retorna dados locais imediatamente, sincroniza em background se online
 */
export async function queryOfflineFirst<T>({
  tabela,
  filtro,
  ordenar,
  select = '*',
}: QueryOptions): Promise<T[]> {
  // 1. BUSCAR DADOS LOCAIS PRIMEIRO (fonte da verdade operacional)
  let dadosLocais: T[] = [];
  
  try {
    const tabelaLocal = db[tabela];
    if (tabelaLocal) {
      if (filtro) {
        dadosLocais = await tabelaLocal.where(filtro.campo).equals(filtro.valor).toArray() as T[];
      } else {
        dadosLocais = await tabelaLocal.toArray() as T[];
      }
      
      // Ordenar localmente se necessário
      if (ordenar && dadosLocais.length > 0) {
        dadosLocais.sort((a: any, b: any) => {
          const valA = a[ordenar.campo];
          const valB = b[ordenar.campo];
          if (ordenar.direcao === 'desc') {
            return valB > valA ? 1 : -1;
          }
          return valA > valB ? 1 : -1;
        });
      }
      
      console.log(`[Offline-First] ${tabela}: ${dadosLocais.length} registros locais`);
    }
  } catch (err) {
    console.warn(`[Offline-First] Erro ao ler IndexedDB (${tabela}):`, err);
  }

  // 2. SE ONLINE, BUSCAR DADOS ATUALIZADOS DO SUPABASE EM BACKGROUND
  if (navigator.onLine) {
    try {
      let query = supabase.from(tabela).select(select);
      
      if (filtro) {
        query = query.eq(filtro.campo, filtro.valor);
      }
      
      if (ordenar) {
        query = query.order(ordenar.campo, { ascending: ordenar.direcao !== 'desc' });
      }
      
      const { data, error } = await query;
      
      if (!error && data && data.length > 0) {
        // Atualizar banco local com dados da nuvem
        const dadosComSync = data.map((item: any) => ({
          ...item,
          sincronizado: 1,
          numero: item.numero_mesa || item.numero, // compatibilidade mesas
        }));
        
        try {
          await db[tabela].bulkPut(dadosComSync);
          console.log(`[Offline-First] ${tabela}: ${data.length} registros sincronizados do Supabase`);
        } catch (e) {
          console.warn(`[Offline-First] Erro ao salvar ${tabela} no IndexedDB:`, e);
        }
        
        return data as T[];
      }
    } catch (err) {
      console.warn(`[Offline-First] Supabase inacessível para ${tabela}, usando dados locais`);
    }
  }

  // 3. RETORNAR DADOS LOCAIS
  return dadosLocais;
}

/**
 * Salva dados localmente e tenta sincronizar com servidor
 * Retorna imediatamente após salvar localmente (UI otimista)
 */
export async function saveOfflineFirst<T extends { id: string }>(
  tabela: TabelaLocal,
  dados: T,
  operacao: 'insert' | 'update' | 'delete' = 'insert'
): Promise<{ success: boolean; data: T | null; error?: string }> {
  
  try {
    // 1. SALVAR LOCALMENTE PRIMEIRO (imediato)
    if (operacao === 'delete') {
      await db[tabela].delete(dados.id);
    } else {
      await db[tabela].put({
        ...dados,
        sincronizado: 0,
        atualizado_em: new Date().toISOString(),
      });
    }
    
    console.log(`[Offline-First] ${tabela} ${operacao}: salvo localmente`);
    
    // 2. SE ONLINE, SINCRONIZAR EM BACKGROUND (não bloqueia)
    if (navigator.onLine) {
      syncToServer(tabela, dados, operacao).catch(console.warn);
    }
    
    return { success: true, data: dados };
  } catch (err: any) {
    console.error(`[Offline-First] Erro ao salvar ${tabela}:`, err);
    return { success: false, data: null, error: err.message };
  }
}

/**
 * Sincroniza um registro específico com o servidor
 */
async function syncToServer<T extends { id: string }>(
  tabela: TabelaLocal,
  dados: T,
  operacao: 'insert' | 'update' | 'delete'
): Promise<void> {
  try {
    const { sincronizado, numero, atualizado_em, criado_em, ...dadosLimpos } = dados as any;
    
    let error;
    
    if (operacao === 'delete') {
      const result = await supabase.from(tabela).delete().eq('id', dados.id);
      error = result.error;
    } else if (operacao === 'insert') {
      const result = await supabase.from(tabela).insert(dadosLimpos);
      error = result.error;
    } else {
      const result = await supabase.from(tabela).update(dadosLimpos).eq('id', dados.id);
      error = result.error;
    }
    
    if (!error) {
      if (operacao !== 'delete') {
        await db[tabela].update(dados.id, { sincronizado: 1 });
      }
      console.log(`[Offline-First] ${tabela} ${operacao}: sincronizado com servidor`);
    } else {
      console.warn(`[Offline-First] Erro ao sincronizar ${tabela}:`, error);
    }
  } catch (err) {
    console.error(`[Offline-First] Falha na sincronização de ${tabela}:`, err);
  }
}

/**
 * Helper para criar queryFn offline-first para useQuery
 */
export function createOfflineQueryFn<T>(options: QueryOptions) {
  return async (): Promise<T[]> => {
    return queryOfflineFirst<T>(options);
  };
}
