/**
 * OfflineIndicator - Indicador visual do status de conexão
 * 
 * Usa o ConnectionManager para mostrar:
 * - Status atual (online/offline/syncing)
 * - Quantidade de dados pendentes
 * - Última sincronização
 * - Botão para sincronizar manualmente
 */

import { useEffect, useRef } from 'react';
import { WifiOff, Wifi, RefreshCw, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { useConnection } from '@/hooks/useConnection';
import { toast } from 'sonner';

export function OfflineIndicator() {
  const { 
    isOnline, 
    status, 
    pendingCount, 
    supabaseReachable,
    lastSync,
    forceSync 
  } = useConnection();
  
  const previousStatus = useRef(status);

  // Notificar usuário quando mudar de status
  useEffect(() => {
    if (previousStatus.current !== status) {
      if (status === 'offline' && previousStatus.current !== 'checking') {
        toast.warning('Modo Offline ativado. Dados salvos localmente.', { 
          duration: 4000,
          id: 'connection-status'
        });
      } else if (status === 'online' && previousStatus.current === 'offline') {
        toast.success('Conexão restaurada! Sincronizando...', { 
          duration: 3000,
          id: 'connection-status'
        });
      } else if (status === 'syncing') {
        // Não mostrar toast para syncing, apenas o indicador visual
      }
      previousStatus.current = status;
    }
  }, [status]);

  const handleSyncClick = async () => {
    if (status === 'syncing' || status === 'offline') return;
    
    const success = await forceSync();
    if (success) {
      toast.success('Sincronização concluída!');
    } else {
      toast.error('Erro na sincronização. Tente novamente.');
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
          bgColor: 'bg-red-500',
          textColor: 'text-white',
          icon: <WifiOff className="w-4 h-4" />,
          label: 'Modo Offline',
          animate: true
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
