import { localDb, SyncQueueItem } from './localDb'

export async function enqueueOperation(
  tableName: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  recordId: string,
  empresaId: string,
  payload: object
): Promise<void> {
  // Evita duplicatas: remove entrada anterior para o mesmo record+operation
  await localDb.sync_queue
    .where('record_id').equals(recordId)
    .and(item => item.table_name === tableName && item.operation === operation)
    .delete()

  const item: SyncQueueItem = {
    table_name: tableName,
    operation,
    record_id: recordId,
    empresa_id: empresaId,
    payload: JSON.stringify(payload),
    created_at: new Date().toISOString(),
    attempts: 0,
  }

  await localDb.sync_queue.add(item)
}

export async function getPendingOperations(empresaId: string): Promise<SyncQueueItem[]> {
  return localDb.sync_queue
    .where('empresa_id').equals(empresaId)
    .sortBy('created_at')
}

export async function countPendingOperations(empresaId: string): Promise<number> {
  return localDb.sync_queue
    .where('empresa_id').equals(empresaId)
    .count()
}

export async function removeFromQueue(id: number): Promise<void> {
  await localDb.sync_queue.delete(id)
}

export async function markAttemptFailed(id: number, error: string): Promise<void> {
  const item = await localDb.sync_queue.get(id)
  if (!item) return
  await localDb.sync_queue.update(id, {
    attempts: item.attempts + 1,
    last_error: error,
  })
}

export async function clearQueue(empresaId: string): Promise<void> {
  await localDb.sync_queue.where('empresa_id').equals(empresaId).delete()
}
