import { useEffect, useState } from 'react'
import { getSyncStatus, onSyncStatusChange, SyncStatus } from '../sync/syncStatus'

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus())

  useEffect(() => {
    return onSyncStatusChange(setStatus)
  }, [])

  return status
}
