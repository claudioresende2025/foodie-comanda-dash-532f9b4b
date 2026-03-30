import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Check, AlertCircle, Upload } from 'lucide-react'
import { UploadProgress } from '@/lib/sync/uploadSync'

interface UploadProgressModalProps {
  open: boolean
  progress: UploadProgress | null
  onDismiss: () => void
}

export function UploadProgressModal({ open, progress, onDismiss }: UploadProgressModalProps) {
  if (!progress) return null

  const total = progress.pending
  const processed = progress.sent + progress.failed
  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Sincronizando dados offline
          </DialogTitle>
          <DialogDescription>
            Enviando {total} operação{total > 1 ? 'ões' : ''} pendente{total > 1 ? 's' : ''} para a nuvem...
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Progress value={percentage} className="h-3" />

          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{processed} de {total}</span>
            <span>{percentage}%</span>
          </div>

          {progress.done && (
            <div className="space-y-2">
              {progress.sent > 0 && (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <Check className="w-4 h-4" />
                  {progress.sent} enviado{progress.sent > 1 ? 's' : ''} com sucesso
                </div>
              )}
              {progress.failed > 0 && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {progress.failed} falhou{progress.failed > 1 ? 'ram' : ''}
                </div>
              )}
              <Button onClick={onDismiss} className="w-full mt-2">
                Fechar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
