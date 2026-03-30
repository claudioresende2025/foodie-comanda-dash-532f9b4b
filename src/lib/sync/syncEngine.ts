import { supabase } from '@/integrations/supabase/client'
import { localDb } from '../db/localDb'
import { TABLES_TO_SYNC, getLastSyncTime, setLastSyncTime } from './initialSync'
import { resolveConflict } from './conflictResolver'
import { setSyncStatus } from './syncStatus'
import { uploadPendingData } from './uploadSync'

/**
 * Sync completo: primeiro sobe dados locais, depois baixa novidades.
 */
export async function runSync(empresaId: string): Promise<void> {
  if (!navigator.onLine) return

  try {
    setSyncStatus('syncing')

    // 1. Upload: envia operações offline ao Supabase
    await uploadPendingData(empresaId)

    // 2. Delta pull: baixa apenas registros alterados desde o último sync
    await deltaPullFromSupabase(empresaId)

    setSyncStatus('synced')
  } catch (err) {
    console.error('[SyncEngine] Falhou:', err)
    setSyncStatus('error')
  }
}

async function deltaPullFromSupabase(empresaId: string): Promise<void> {
  const lastSync = getLastSyncTime(empresaId)
  const now = new Date().toISOString()

  for (const table of TABLES_TO_SYNC) {
    let query = supabase
      .from(table)
      .select('*')
      .gte('updated_at', lastSync)

    // pedidos não tem empresa_id direto
    if (table !== 'pedidos') {
      query = query.eq('empresa_id', empresaId)
    }

    const { data, error } = await query

    if (error || !data) continue

    for (const remoteRecord of data) {
      const localRecord = await (localDb as any)[table].get(remoteRecord.id)

      if (!localRecord) {
        await (localDb as any)[table].put({
          ...remoteRecord,
          _synced: true,
          _deleted: false,
          _local_version: 1,
        })
      } else {
        const resolved = resolveConflict(localRecord, {
          ...remoteRecord,
          _synced: true,
          _deleted: false,
          _local_version: localRecord._local_version,
        })
        await (localDb as any)[table].put(resolved)
      }
    }
  }

  setLastSyncTime(empresaId, now)
}
