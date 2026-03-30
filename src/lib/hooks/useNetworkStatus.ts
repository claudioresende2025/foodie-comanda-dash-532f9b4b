import { useEffect, useState } from 'react'
import { setSyncStatus } from '../sync/syncStatus'
import { runSync } from '../sync/syncEngine'
import { uploadPendingData, UploadProgress } from '../sync/uploadSync'
import { countPendingOperations } from '../db/syncQueue'

interface NetworkStatus {
  isOnline: boolean
  showUploadModal: boolean
  uploadProgress: UploadProgress | null
  pendingCount: number
  dismissModal: () => void
}

export function useNetworkStatus(empresaId: string): NetworkStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [pendingCount, setPendingCount] = useState(0)

  // Atualiza contagem de pendentes periodicamente (offline)
  useEffect(() => {
    if (!empresaId) return

    const updateCount = async () => {
      const count = await countPendingOperations(empresaId)
      setPendingCount(count)
    }

    updateCount()
    const interval = setInterval(updateCount, 5000)
    return () => clearInterval(interval)
  }, [empresaId])

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true)
      setSyncStatus('syncing')

      const count = await countPendingOperations(empresaId)

      if (count > 0) {
        setShowUploadModal(true)
        await uploadPendingData(empresaId, (p) => {
          setUploadProgress(p)
          if (p.done) {
            setTimeout(() => setShowUploadModal(false), 2000)
          }
        })
      }

      await runSync(empresaId)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setSyncStatus('offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [empresaId])

  return {
    isOnline,
    showUploadModal,
    uploadProgress,
    pendingCount,
    dismissModal: () => setShowUploadModal(false),
  }
}
