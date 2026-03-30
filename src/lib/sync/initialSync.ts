import { supabase } from '@/integrations/supabase/client'
import { localDb } from '../db/localDb'
import { setSyncStatus } from './syncStatus'

export const TABLES_TO_SYNC = [
  'categorias',
  'produtos',
  'mesas',
  'comandas',
  'pedidos',
] as const

export type TableName = (typeof TABLES_TO_SYNC)[number]

export interface InitialSyncProgress {
  table: TableName
  loaded: number
  total: number
  done: boolean
}

const PAGE_SIZE = 1000
const INITIAL_SYNC_KEY = (empresaId: string) => `initialSyncDone_${empresaId}`
const LAST_SYNC_KEY = (empresaId: string) => `lastSync_${empresaId}`

export function isInitialSyncDone(empresaId: string): boolean {
  return !!localStorage.getItem(INITIAL_SYNC_KEY(empresaId))
}

export function getLastSyncTime(empresaId: string): string {
  return localStorage.getItem(LAST_SYNC_KEY(empresaId)) || '1970-01-01T00:00:00.000Z'
}

export function setLastSyncTime(empresaId: string, time: string): void {
  localStorage.setItem(LAST_SYNC_KEY(empresaId), time)
}

// Tabelas que não têm empresa_id direto (pedidos usa comanda_id)
const TABLES_WITHOUT_EMPRESA_ID = ['pedidos'] as const

/**
 * Download completo de todos os dados da empresa.
 */
export async function runInitialSync(
  empresaId: string,
  onProgress?: (p: InitialSyncProgress) => void
): Promise<void> {
  setSyncStatus('syncing')

  for (const table of TABLES_TO_SYNC) {
    let loaded = 0
    const hasEmpresaId = !(TABLES_WITHOUT_EMPRESA_ID as readonly string[]).includes(table)

    // 1. Conta total de registros
    let countQuery = supabase.from(table).select('*', { count: 'exact', head: true })
    if (hasEmpresaId) {
      countQuery = countQuery.eq('empresa_id', empresaId)
    }
    const { count, error: countError } = await countQuery

    if (countError) throw new Error(`Erro ao contar ${table}: ${countError.message}`)

    const total = count ?? 0
    onProgress?.({ table, loaded: 0, total, done: false })

    // 2. Baixa em páginas
    while (loaded < total) {
      let dataQuery = supabase
        .from(table)
        .select('*')
        .range(loaded, loaded + PAGE_SIZE - 1)
        .order('created_at', { ascending: true })

      if (hasEmpresaId) {
        dataQuery = dataQuery.eq('empresa_id', empresaId)
      }

      const { data, error } = await dataQuery

      if (error) throw new Error(`Erro ao baixar ${table}: ${error.message}`)
      if (!data || data.length === 0) break

      await (localDb as any)[table].bulkPut(
        data.map((record: any) => ({
          ...record,
          _synced: true,
          _deleted: false,
          _local_version: 1,
        }))
      )

      loaded += data.length
      onProgress?.({ table, loaded, total, done: false })

      if (data.length < PAGE_SIZE) break
    }

    onProgress?.({ table, loaded: total, total, done: true })
  }

  const now = new Date().toISOString()
  localStorage.setItem(INITIAL_SYNC_KEY(empresaId), now)
  setLastSyncTime(empresaId, now)
  setSyncStatus('synced')
}

/**
 * Força redownload completo.
 */
export async function forceFullResync(
  empresaId: string,
  onProgress?: (p: InitialSyncProgress) => void
): Promise<void> {
  for (const table of TABLES_TO_SYNC) {
    await (localDb as any)[table].clear()
  }
  localStorage.removeItem(INITIAL_SYNC_KEY(empresaId))
  await runInitialSync(empresaId, onProgress)
}
