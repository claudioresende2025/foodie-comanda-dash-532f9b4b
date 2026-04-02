import { db } from './db';

/**
 * offlineGuard — Proíbe chamadas Supabase quando offline.
 * Se navigator.onLine === false, retorna dados do Dexie imediatamente.
 * Se online, executa a query Supabase normalmente.
 *
 * @param table - Nome da tabela no Dexie (ex: 'produtos', 'mesas')
 * @param supabaseQuery - Função que executa a query Supabase (só chamada se online)
 * @param filter - Filtro opcional para Dexie (ex: { key: 'empresa_id', value: '...' })
 * @returns Array de dados (Dexie ou Supabase)
 */
export async function offlineGuard<T = any>(
  table: string,
  supabaseQuery: () => Promise<{ data: T[] | null; error: any }>,
  filter?: { key: string; value: string }
): Promise<T[]> {
  // OFFLINE: retorno imediato do Dexie — NUNCA espera rede
  if (!navigator.onLine) {
    return getDexieData<T>(table, filter);
  }

  // ONLINE: tenta Supabase com fallback Dexie
  try {
    const { data, error } = await supabaseQuery();
    if (!error && data) return data;
    // Se Supabase retornou erro, fallback para Dexie
    return getDexieData<T>(table, filter);
  } catch {
    return getDexieData<T>(table, filter);
  }
}

async function getDexieData<T>(table: string, filter?: { key: string; value: string }): Promise<T[]> {
  try {
    const dexieTable = (db as any)[table];
    if (!dexieTable) return [];
    if (filter) {
      return await dexieTable.where(filter.key).equals(filter.value).toArray();
    }
    return await dexieTable.toArray();
  } catch {
    return [];
  }
}
