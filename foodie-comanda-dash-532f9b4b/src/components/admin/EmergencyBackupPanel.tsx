import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Download, 
  HardDrive, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2,
  Clock,
  FileJson,
  Database,
  Wifi,
  WifiOff,
  Shield,
  Trash2
} from 'lucide-react';
import { usePWAStatus } from '@/hooks/usePWAStatus';
import { 
  downloadPendingDataAsFile, 
  exportAllData, 
  getSyncLogs,
  cleanOldLogs 
} from '@/lib/pwaMigration';
import { syncService } from '@/lib/syncService';
import { toast } from 'sonner';

export function EmergencyBackupPanel() {
  const { 
    isOnline, 
    pendingCount, 
    storageQuota, 
    isPersisted,
    swVersion,
    lastSyncLogs,
    swUpdateAvailable,
    updateStorageQuota,
    updateSyncLogs,
    requestPersistence,
    applySwUpdate
  } = usePWAStatus();

  const [isExporting, setIsExporting] = useState(false);
  const [isExportingFull, setIsExportingFull] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [isForceSyncing, setIsForceSyncing] = useState(false);
  const [isCleaningLogs, setIsCleaningLogs] = useState(false);

  // Exportar dados pendentes
  const handleExportPending = async () => {
    setIsExporting(true);
    try {
      await downloadPendingDataAsFile();
      toast.success('Backup dos dados pendentes baixado!', {
        description: 'Guarde este arquivo em local seguro.'
      });
    } catch (error: any) {
      toast.error('Erro ao exportar dados', {
        description: error.message
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Exportar todos os dados
  const handleExportAll = async () => {
    setIsExportingFull(true);
    try {
      const data = await exportAllData();
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { 
        type: 'application/json' 
      });
      
      const url = URL.createObjectURL(blob);
      const filename = `food-comanda-backup-completo-${new Date().toISOString().split('T')[0]}.json`;
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);

      toast.success('Backup completo baixado!', {
        description: `${Object.values(data.tables).flat().length} registros exportados`
      });
    } catch (error: any) {
      toast.error('Erro ao exportar backup completo', {
        description: error.message
      });
    } finally {
      setIsExportingFull(false);
    }
  };

  // Forçar sincronização de emergência
  const handleForceSync = async () => {
    if (!isOnline) {
      toast.error('Sem conexão com a internet');
      return;
    }

    setIsForceSyncing(true);
    try {
      const result = await syncService.forceSyncAll();
      
      if (result.success) {
        toast.success('Sincronização forçada concluída!', {
          description: `${result.synced} registros sincronizados`
        });
      } else {
        toast.warning('Sincronização parcial', {
          description: `${result.synced} ok, ${result.failed} falhas`
        });
      }
      
      await updateSyncLogs();
    } catch (error: any) {
      toast.error('Erro na sincronização forçada', {
        description: error.message
      });
    } finally {
      setIsForceSyncing(false);
    }
  };

  // Limpar logs antigos
  const handleCleanLogs = async () => {
    setIsCleaningLogs(true);
    try {
      const removed = await cleanOldLogs(7);
      toast.success(`${removed} logs antigos removidos`);
      await updateSyncLogs();
    } catch (error: any) {
      toast.error('Erro ao limpar logs', { description: error.message });
    } finally {
      setIsCleaningLogs(false);
    }
  };

  // Solicitar armazenamento persistente
  const handleRequestPersistence = async () => {
    const granted = await requestPersistence();
    if (granted) {
      toast.success('Armazenamento persistente ativado!', {
        description: 'Seus dados estão mais seguros agora.'
      });
    } else {
      toast.warning('Persistência não concedida', {
        description: 'O navegador pode limpar os dados automaticamente.'
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Alerta de atualização disponível */}
      {swUpdateAvailable && (
        <Alert className="border-blue-500 bg-blue-50">
          <RefreshCw className="h-4 w-4 text-blue-500" />
          <AlertTitle>Nova versão disponível!</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>Versão {swUpdateAvailable.version} está pronta para uso.</span>
            <Button size="sm" onClick={applySwUpdate}>
              Atualizar Agora
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Alerta de armazenamento crítico */}
      {storageQuota?.isCritical && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Armazenamento Crítico!</AlertTitle>
          <AlertDescription>
            O dispositivo está quase sem espaço ({storageQuota.usagePercent}% usado).
            Exporte os dados pendentes imediatamente!
          </AlertDescription>
        </Alert>
      )}

      {/* Status Geral */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Status do Sistema
          </CardTitle>
          <CardDescription>
            Informações sobre sincronização e armazenamento offline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Conexão */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              {isOnline ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-500" />
              )}
              <div>
                <p className="text-sm font-medium">Conexão</p>
                <p className="text-xs text-muted-foreground">
                  {isOnline ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>

            {/* Pendentes */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Clock className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Pendentes</p>
                <p className="text-xs text-muted-foreground">
                  {pendingCount} registro(s)
                </p>
              </div>
              {pendingCount > 0 && (
                <Badge variant="outline" className="ml-auto">
                  {pendingCount}
                </Badge>
              )}
            </div>

            {/* Armazenamento */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <HardDrive className={`h-5 w-5 ${
                storageQuota?.isCritical ? 'text-red-500' : 
                storageQuota?.isLow ? 'text-yellow-500' : 'text-green-500'
              }`} />
              <div>
                <p className="text-sm font-medium">Armazenamento</p>
                <p className="text-xs text-muted-foreground">
                  {storageQuota ? `${storageQuota.usageFormatted} / ${storageQuota.quotaFormatted}` : 'Verificando...'}
                </p>
              </div>
              {storageQuota && (
                <Badge variant={storageQuota.isCritical ? 'destructive' : 'outline'} className="ml-auto">
                  {storageQuota.usagePercent}%
                </Badge>
              )}
            </div>

            {/* Persistência */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Shield className={`h-5 w-5 ${isPersisted ? 'text-green-500' : 'text-gray-400'}`} />
              <div>
                <p className="text-sm font-medium">Persistência</p>
                <p className="text-xs text-muted-foreground">
                  {isPersisted ? 'Ativada' : 'Não ativada'}
                </p>
              </div>
              {!isPersisted && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="ml-auto"
                  onClick={handleRequestPersistence}
                >
                  Ativar
                </Button>
              )}
            </div>
          </div>

          {swVersion && (
            <p className="text-xs text-muted-foreground mt-4">
              Service Worker: v{swVersion}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Ações de Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Backup de Emergência
          </CardTitle>
          <CardDescription>
            Exporte seus dados para recuperação em caso de problemas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Button 
              onClick={handleExportPending}
              disabled={isExporting || pendingCount === 0}
              className="w-full"
              variant={pendingCount > 0 ? 'default' : 'outline'}
            >
              {isExporting ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileJson className="h-4 w-4 mr-2" />
              )}
              Exportar Dados Pendentes
              {pendingCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendingCount}
                </Badge>
              )}
            </Button>

            <Button 
              onClick={handleExportAll}
              disabled={isExportingFull}
              variant="outline"
              className="w-full"
            >
              {isExportingFull ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Database className="h-4 w-4 mr-2" />
              )}
              Backup Completo
            </Button>
          </div>

          <Separator />

          <div className="grid gap-3 md:grid-cols-2">
            <Button 
              onClick={handleForceSync}
              disabled={isForceSyncing || !isOnline}
              variant="outline"
              className="w-full"
            >
              {isForceSyncing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Forçar Sincronização
            </Button>

            <Button 
              onClick={() => updateStorageQuota()}
              variant="outline"
              className="w-full"
            >
              <HardDrive className="h-4 w-4 mr-2" />
              Verificar Armazenamento
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs de Sincronização */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Logs de Sincronização
              </CardTitle>
              <CardDescription>
                Últimas operações para diagnóstico de suporte
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => updateSyncLogs()}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setShowLogs(!showLogs)}
              >
                {showLogs ? 'Ocultar' : 'Mostrar'}
              </Button>
            </div>
          </div>
        </CardHeader>
        {showLogs && (
          <CardContent>
            <ScrollArea className="h-[300px] rounded-md border p-4">
              {lastSyncLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum log de sincronização encontrado
                </p>
              ) : (
                <div className="space-y-2">
                  {lastSyncLogs.map((log, index) => (
                    <div 
                      key={log.id || index} 
                      className="flex items-start gap-2 p-2 rounded-md bg-muted/30 text-xs"
                    >
                      {log.type === 'success' && <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />}
                      {log.type === 'error' && <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />}
                      {log.type === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />}
                      {log.type === 'info' && <Clock className="h-4 w-4 text-blue-500 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{log.operation}</span>
                          {log.table && (
                            <Badge variant="outline" className="text-[10px]">
                              {log.table}
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground truncate">{log.message}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            
            <div className="flex justify-end mt-3">
              <Button 
                size="sm" 
                variant="ghost"
                onClick={handleCleanLogs}
                disabled={isCleaningLogs}
              >
                {isCleaningLogs ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Limpar Logs Antigos
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default EmergencyBackupPanel;
