import { useSyncStatus } from '@/lib/hooks/useSyncStatus'
import { Wifi, WifiOff, RefreshCw, Check, AlertCircle } from 'lucide-react'

const statusConfig = {
  online: { color: 'bg-green-500', icon: Wifi, label: 'Online' },
  offline: { color: 'bg-red-500', icon: WifiOff, label: 'Offline' },
  syncing: { color: 'bg-yellow-500', icon: RefreshCw, label: 'Sincronizando...' },
  synced: { color: 'bg-green-500', icon: Check, label: 'Sincronizado' },
  error: { color: 'bg-red-500', icon: AlertCircle, label: 'Erro de sync' },
}

interface SyncStatusIndicatorProps {
  pendingCount?: number
}

export function SyncStatusIndicator({ pendingCount = 0 }: SyncStatusIndicatorProps) {
  const status = useSyncStatus()
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <div className={`w-2 h-2 rounded-full ${config.color} ${status === 'syncing' ? 'animate-pulse' : ''}`} />
      <Icon className={`w-3.5 h-3.5 ${status === 'syncing' ? 'animate-spin' : ''}`} />
      <span>{config.label}</span>
      {pendingCount > 0 && status === 'offline' && (
        <span className="text-yellow-600 font-medium">
          ({pendingCount} pendente{pendingCount > 1 ? 's' : ''})
        </span>
      )}
    </div>
  )
}
