/**
 * OfflineIndicator - Indicador visual do status de conexão
 * 
 * Usa o ConnectionManager para mostrar:
 * - Status atual (online/offline/syncing)
 * - Quantidade de dados pendentes
 * - Última sincronização
 * - Botão para sincronizar manualmente
 * 
 * Também:
 * - Invalida as queries quando a conexão é restaurada
 * - Alerta o usuário se tentar fechar com dados pendentes
 * - Registra logs de sincronização
 */

import { useEffect, useRef, useCallback } from 'react';
import { WifiOff, Wifi, RefreshCw, Cloud, CloudOff, Loader2, Database, AlertTriangle } from 'lucide-react';
import { useConnection } from '@/hooks/useConnection';
import { useBeforeUnload } from '@/hooks/useBeforeUnload';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { syncLogger } from '@/lib/syncLogger';

export function OfflineIndicator() {
  const queryClient = useQueryClient();
  
  // Ativar alerta de beforeunload quando houver pendências
  useBeforeUnload();
  
  // Callback para invalidar queries quando a conexão é restaurada
  const handleConnectionRestored = useCallback(() => {
    console.log('[OfflineIndicator] Conexão restaurada - invalidando queries...');
    syncLogger.connectionChange('online');
    queryClient.invalidateQueries();
  }, [queryClient]);

  const { 
    isOnline, 
    status, 
    pendingCount, 
    supabaseReachable,
    lastSync,
    forceSync 
  } = useConnection({ onConnectionRestored: handleConnectionRestored });
  
  const previousStatus = useRef(status);
  const syncToastId = useRef<string | number | undefined>();

  // Notificar usuário quando mudar de status com toasts mais detalhados
  useEffect(() => {
    if (previousStatus.current !== status) {
      // Fechar toast anterior
      if (syncToastId.current) {
        toast.dismiss(syncToastId.current);
      }

      if (status === 'offline' && previousStatus.current !== 'checking') {
        syncLogger.connectionChange('offline');
        syncToastId.current = toast.warning(
          'Conexão perdida. Operando em modo offline.',
          { 
            duration: 5000,
            id: 'connection-status',
            description: pendingCount > 0 
              ? `${pendingCount} item(s) serão sincronizados quando a conexão voltar.`
              : 'Os dados estão sendo salvos localmente.',
            icon: <WifiOff className="w-5 h-5" />,
          }
        );
      } else if (status === 'online' && previousStatus.current === 'offline') {
        syncLogger.connectionChange('online');
        syncToastId.current = toast.success(
          'Conexão restaurada!',
          { 
            duration: 4000,
            id: 'connection-status',
            description: 'Dados sincronizados com sucesso.',
            icon: <Wifi className="w-5 h-5" />,
          }
        );
      } else if (status === 'syncing') {
        syncLogger.connectionChange('syncing');
        // Toast discreto para sincronização
        syncToastId.current = toast.loading(
          'Sincronizando dados...',
          { 
            id: 'connection-status',
            description: `${pendingCount} item(s) pendente(s)`,
          }
        );
      }
      previousStatus.current = status;
    }
  }, [status, pendingCount]);

  const handleSyncClick = async () => {
    if (status === 'syncing') {
      toast.info('Sincronização em andamento...');
      return;
    }
    
    if (status === 'offline' || !navigator.onLine) {
      toast.error('Sem conexão. Conecte-se à internet para sincronizar.');
      return;
    }
    
    toast.info('Iniciando sincronização...', { duration: 2000 });
    const success = await forceSync();
    
    if (success) {
      toast.success(`Sincronização concluída! ${pendingCount > 0 ? `${pendingCount} item(s) sincronizado(s).` : ''}`);
      // Forçar atualização das queries
      handleConnectionRestored();
    } else {
      toast.error('Erro na sincronização. Verifique a conexão e tente novamente.');
    }
  };

  const formatLastSync = () => {
    if (!lastSync) return null;
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastSync.getTime()) / 1000);
    
    if (diff < 60) return 'agora';
    if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
    return lastSync.toLocaleDateString('pt-BR');
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'online':
        return {
          bgColor: 'bg-green-500/90',
          textColor: 'text-white',
          icon: <Wifi className="w-4 h-4" />,
          label: 'Online',
          animate: false
        };
      case 'syncing':
        return {
          bgColor: 'bg-blue-500/90',
          textColor: 'text-white',
          icon: <RefreshCw className="w-4 h-4 animate-spin" />,
          label: 'Sincronizando...',
          animate: false
        };
      case 'checking':
        return {
          bgColor: 'bg-gray-500/90',
          textColor: 'text-white',
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          label: 'Verificando...',
          animate: false
        };
      case 'offline':
      default:
        return {
          bgColor: 'bg-orange-500',
          textColor: 'text-white',
          icon: <Database className="w-4 h-4" />,
          label: 'Modo Local',
          animate: false
        };
    }
  };

  const statusConfig = getStatusConfig();
  const lastSyncText = formatLastSync();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Indicador de pendências - só mostra se online e tem pendências */}
      {pendingCount > 0 && status !== 'offline' && (
        <button
          onClick={handleSyncClick}
          disabled={status === 'syncing'}
          className="flex items-center gap-2 bg-yellow-500/90 text-yellow-950 px-3 py-1.5 rounded-full text-sm font-medium shadow-lg hover:bg-yellow-400 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${status === 'syncing' ? 'animate-spin' : ''}`} />
          {status === 'syncing' ? 'Sincronizando...' : `${pendingCount} pendente(s)`}
        </button>
      )}

      {/* Status de conexão principal */}
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium shadow-lg transition-all ${
          statusConfig.bgColor
        } ${statusConfig.textColor} ${statusConfig.animate ? 'animate-pulse' : ''}`}
      >
        {statusConfig.icon}
        <span>{statusConfig.label}</span>
        
        {/* Indicador de Supabase */}
        {status === 'online' && (
          <span className="ml-1 opacity-70">
            {supabaseReachable ? (
              <Cloud className="w-3 h-3 inline" />
            ) : (
              <CloudOff className="w-3 h-3 inline" />
            )}
          </span>
        )}
      </div>

      {/* Última sincronização - só mostra se offline e tem data */}
      {status === 'offline' && lastSyncText && (
        <div className="text-xs text-gray-400 bg-gray-800/80 px-2 py-1 rounded">
          Última sync: {lastSyncText}
        </div>
      )}
    </div>
  );
}
