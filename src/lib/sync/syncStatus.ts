export type SyncStatus = 'online' | 'offline' | 'syncing' | 'synced' | 'error'

type Listener = (status: SyncStatus) => void

let current: SyncStatus = navigator.onLine ? 'online' : 'offline'
const listeners: Set<Listener> = new Set()

export function getSyncStatus(): SyncStatus {
  return current
}

export function setSyncStatus(status: SyncStatus): void {
  current = status
  listeners.forEach(fn => fn(status))
}

export function onSyncStatusChange(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
