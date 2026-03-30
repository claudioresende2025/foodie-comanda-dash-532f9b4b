import { supabase } from '@/integrations/supabase/client'
import { localDb } from '../db/localDb'
import {
  getPendingOperations,
  removeFromQueue,
  markAttemptFailed,
} from '../db/syncQueue'
import { setSyncStatus } from './syncStatus'

export interface UploadProgress {
  pending: number
  sent: number
  failed: number
  done: boolean
}

const MAX_ATTEMPTS = 5

export async function uploadPendingData(
  empresaId: string,
  onProgress?: (p: UploadProgress) => void
): Promise<UploadProgress> {
  setSyncStatus('syncing')

  const pending = await getPendingOperations(empresaId)
  const total = pending.length
  let sent = 0
  let failed = 0

  onProgress?.({ pending: total, sent: 0, failed: 0, done: false })

  for (const item of pending) {
    if (item.attempts >= MAX_ATTEMPTS) {
      failed++
      onProgress?.({ pending: total, sent, failed, done: false })
      continue
    }

    try {
      const payload = JSON.parse(item.payload)

      if (item.operation === 'INSERT' || item.operation === 'UPDATE') {
        const { error } = await supabase
          .from(item.table_name)
          .upsert(payload, { onConflict: 'id' })

        if (error) throw new Error(error.message)

        await (localDb as any)[item.table_name]
          ?.update(item.record_id, { _synced: true })
      }

      if (item.operation === 'DELETE') {
        const { error } = await supabase
          .from(item.table_name)
          .delete()
          .eq('id', item.record_id)
          .eq('empresa_id', empresaId)

        if (error) throw new Error(error.message)

        await (localDb as any)[item.table_name]?.delete(item.record_id)
      }

      await removeFromQueue(item.id!)
      sent++
    } catch (err: any) {
      await markAttemptFailed(item.id!, err.message)
      failed++
    }

    onProgress?.({ pending: total, sent, failed, done: false })
  }

  const result: UploadProgress = { pending: total, sent, failed, done: true }
  onProgress?.(result)

  if (failed === 0) setSyncStatus('synced')
  else setSyncStatus('error')

  return result
}
