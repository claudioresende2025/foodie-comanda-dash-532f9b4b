import { useState, useEffect } from 'react';
import { WifiOff, Wifi, CloudOff, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { verificarPendencias, sincronizarTudo } from '@/lib/db';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendencias, setPendencias] = useState<Record<string, number>>({});
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      toast.success('Conexão restaurada! Sincronizando dados...', { duration: 3000 });
      
      // Sincronizar automaticamente ao voltar online
      setIsSyncing(true);
      try {
        await sincronizarTudo(supabase);
        toast.success('Dados sincronizados com sucesso!');
      } catch (err) {
        console.error('Erro na sincronização:', err);
      } finally {
        setIsSyncing(false);
        atualizarPendencias();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Você está offline. Os dados serão salvos localmente.', { duration: 5000 });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const atualizarPendencias = async () => {
    try {
      const p = await verificarPendencias();
      setPendencias(p);
    } catch (err) {
      // Ignora erros
    }
  };

  // Verificar pendências periodicamente
  useEffect(() => {
    atualizarPendencias();
    const interval = setInterval(atualizarPendencias, 30000);
    return () => clearInterval(interval);
  }, []);

  const totalPendencias = Object.values(pendencias).reduce((a, b) => a + b, 0);

  const handleSyncClick = async () => {
    if (!isOnline || isSyncing) return;
    
    setIsSyncing(true);
    try {
      await sincronizarTudo(supabase);
      toast.success('Sincronização concluída!');
      atualizarPendencias();
    } catch (err) {
      toast.error('Erro na sincronização');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Indicador de pendências */}
      {totalPendencias > 0 && isOnline && (
        <button
          onClick={handleSyncClick}
          disabled={isSyncing}
          className="flex items-center gap-2 bg-yellow-500/90 text-yellow-950 px-3 py-1.5 rounded-full text-sm font-medium shadow-lg hover:bg-yellow-400 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Sincronizando...' : `${totalPendencias} pendente(s)`}
        </button>
      )}

      {/* Status de conexão */}
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium shadow-lg transition-all ${
          isOnline
            ? 'bg-green-500/90 text-white'
            : 'bg-red-500 text-white animate-pulse'
        }`}
      >
        {isOnline ? (
          <>
            <Wifi className="w-4 h-4" />
            <span>Online</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" />
            <span>Offline - Modo Local</span>
          </>
        )}
      </div>
    </div>
  );
}
