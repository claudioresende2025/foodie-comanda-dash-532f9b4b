/**
 * ConnectionStatusBadge - Badge compacto de status de conexão
 * 
 * Um indicador pequeno para ser usado no header/navbar.
 * Mostra: cor (verde/amarelo/vermelho), ícone e tooltip com detalhes.
 * 
 * Uso:
 * <ConnectionStatusBadge />
 * 
 * Com clique para expandir detalhes:
 * <ConnectionStatusBadge showDetails />
 */

import { useState } from 'react';
import { Wifi, WifiOff, RefreshCw, Loader2, Cloud, CloudOff } from 'lucide-react';
import { useConnection } from '@/hooks/useConnection';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ConnectionStatusBadgeProps {
  /** Mostrar detalhes em popover ao clicar */
  showDetails?: boolean;
  /** Tamanho do badge */
  size?: 'sm' | 'md' | 'lg';
  /** Mostrar texto junto ao ícone */
  showText?: boolean;
  /** Classe adicional */
  className?: string;
}

export function ConnectionStatusBadge({
  showDetails = false,
  size = 'md',
  showText = false,
  className,
}: ConnectionStatusBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { 
    status, 
    pendingCount, 
    supabaseReachable, 
    lastSync, 
    forceSync 
  } = useConnection();

  const sizeClasses = {
    sm: 'h-6 px-2 text-xs gap-1',
    md: 'h-8 px-3 text-sm gap-1.5',
    lg: 'h-10 px-4 text-base gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'online':
        return {
          color: 'bg-green-500',
          borderColor: 'border-green-400',
          textColor: 'text-green-100',
          icon: <Wifi className={iconSizes[size]} />,
          label: 'Online',
          description: supabaseReachable 
            ? 'Conectado à nuvem' 
            : 'Online (nuvem inacessível)',
        };
      case 'syncing':
        return {
          color: 'bg-yellow-500',
          borderColor: 'border-yellow-400',
          textColor: 'text-yellow-100',
          icon: <RefreshCw className={cn(iconSizes[size], 'animate-spin')} />,
          label: 'Sincronizando',
          description: `${pendingCount} item(s) pendente(s)`,
        };
      case 'checking':
        return {
          color: 'bg-gray-500',
          borderColor: 'border-gray-400',
          textColor: 'text-gray-100',
          icon: <Loader2 className={cn(iconSizes[size], 'animate-spin')} />,
          label: 'Verificando',
          description: 'Verificando conexão...',
        };
      case 'offline':
      default:
        return {
          color: pendingCount > 0 ? 'bg-red-500' : 'bg-orange-500',
          borderColor: pendingCount > 0 ? 'border-red-400' : 'border-orange-400',
          textColor: 'text-white',
          icon: <WifiOff className={iconSizes[size]} />,
          label: 'Offline',
          description: pendingCount > 0 
            ? `${pendingCount} item(s) aguardando sync`
            : 'Modo local ativo',
        };
    }
  };

  const config = getStatusConfig();

  const formatLastSync = () => {
    if (!lastSync) return 'Nunca';
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastSync.getTime()) / 1000);
    
    if (diff < 60) return 'Agora mesmo';
    if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
    return lastSync.toLocaleDateString('pt-BR');
  };

  const handleSync = async () => {
    if (status === 'syncing') {
      toast.info('Sincronização em andamento...');
      return;
    }
    if (status === 'offline') {
      toast.error('Sem conexão para sincronizar');
      return;
    }
    
    toast.loading('Sincronizando...', { id: 'manual-sync' });
    const success = await forceSync();
    
    if (success) {
      toast.success('Sincronização concluída!', { id: 'manual-sync' });
    } else {
      toast.error('Erro na sincronização', { id: 'manual-sync' });
    }
  };

  const BadgeContent = () => (
    <div
      className={cn(
        'flex items-center rounded-full font-medium transition-all',
        config.color,
        config.textColor,
        sizeClasses[size],
        className
      )}
    >
      {config.icon}
      {showText && <span>{config.label}</span>}
      {pendingCount > 0 && status !== 'syncing' && (
        <span className="ml-1 bg-white/20 px-1.5 rounded-full text-xs">
          {pendingCount}
        </span>
      )}
    </div>
  );

  if (showDetails) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button className="cursor-pointer">
            <BadgeContent />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {config.icon}
              <div>
                <p className="font-medium">{config.label}</p>
                <p className="text-sm text-muted-foreground">{config.description}</p>
              </div>
            </div>

            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Supabase:</span>
                <span className="flex items-center gap-1">
                  {supabaseReachable ? (
                    <>
                      <Cloud className="w-3 h-3 text-green-500" />
                      Conectado
                    </>
                  ) : (
                    <>
                      <CloudOff className="w-3 h-3 text-red-500" />
                      Inacessível
                    </>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pendentes:</span>
                <span className={pendingCount > 0 ? 'text-yellow-500 font-medium' : ''}>
                  {pendingCount} item(s)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Última sync:</span>
                <span>{formatLastSync()}</span>
              </div>
            </div>

            {pendingCount > 0 && status !== 'offline' && (
              <Button 
                size="sm" 
                className="w-full" 
                onClick={handleSync}
                disabled={status === 'syncing'}
              >
                <RefreshCw className={cn('w-4 h-4 mr-2', status === 'syncing' && 'animate-spin')} />
                {status === 'syncing' ? 'Sincronizando...' : 'Sincronizar Agora'}
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <BadgeContent />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.label}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default ConnectionStatusBadge;
