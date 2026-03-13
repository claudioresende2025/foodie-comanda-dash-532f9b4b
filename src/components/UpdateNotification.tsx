import { useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

declare const __BUILD_TIMESTAMP__: string;

export const UpdateNotification = () => {
  const [showNotification, setShowNotification] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const showTimerRef = useRef<number | null>(null);
  const hasUpdatedRef = useRef(sessionStorage.getItem('update_applied_this_session') === '1');
  const checkIntervalRef = useRef<number | null>(null);

  // Função unificada para detectar atualização
  const markUpdateAvailable = (worker?: ServiceWorker) => {
    if (hasUpdatedRef.current) return;
    
    if (worker) {
      setWaitingWorker(worker);
    }
    
    sessionStorage.setItem('update_available', '1');
    
    if (showTimerRef.current) {
      window.clearTimeout(showTimerRef.current);
    }
    
    // Mostra a notificação após 10 segundos
    showTimerRef.current = window.setTimeout(() => {
      setShowNotification(true);
      showTimerRef.current = null;
    }, 10000);
  };

  // Verificação por fetch (funciona em desktop e mobile)
  const checkVersionByFetch = async () => {
    if (hasUpdatedRef.current) return;
    
    try {
      // Busca o index.html com cache-bust para obter versão atual do servidor
      const response = await fetch(`/index.html?_=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (response.ok) {
        const html = await response.text();
        // Procura pelo hash do JS bundle no HTML
        const match = html.match(/index-([A-Za-z0-9]+)\.js/);
        const serverVersion = match ? match[1] : null;
        const localVersion = localStorage.getItem('app_js_version');
        
        if (serverVersion && localVersion && serverVersion !== localVersion) {
          console.log('[UpdateNotification] Nova versão detectada via fetch:', serverVersion, 'vs', localVersion);
          markUpdateAvailable();
        } else if (serverVersion && !localVersion) {
          // Primeira vez: salvar versão atual
          localStorage.setItem('app_js_version', serverVersion);
        }
      }
    } catch (error) {
      // Silenciar erros de fetch
    }
  };

  useEffect(() => {
    // Verificação por build timestamp
    const currentBuild = typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : '';
    const lastBuild = localStorage.getItem('app_build_version');

    if (currentBuild && lastBuild && lastBuild !== currentBuild) {
      markUpdateAvailable();
    } else if (currentBuild && !lastBuild) {
      localStorage.setItem('app_build_version', currentBuild);
    }

    // Se já havia update disponível
    if (sessionStorage.getItem('update_available') === '1') {
      markUpdateAvailable();
    }

    // Verificação periódica por fetch (funciona sem SW)
    checkVersionByFetch();
    checkIntervalRef.current = window.setInterval(checkVersionByFetch, 10 * 1000);

    // Service Worker (se disponível)
    if ('serviceWorker' in navigator) {
      const checkForUpdates = async () => {
        if (hasUpdatedRef.current) return;
        
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            if (registration.waiting) {
              markUpdateAvailable(registration.waiting);
              return;
            }

            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    markUpdateAvailable(newWorker);
                  }
                });
              }
            });

            // Força verificação de atualização do SW
            await registration.update();
          }
        } catch (error) {
          console.error('Erro ao verificar SW:', error);
        }
      };

      const onMessage = (e: MessageEvent) => {
        if (hasUpdatedRef.current) return;
        if (e.data && (e.data.type === 'NEW_VERSION_AVAILABLE' || e.data.type === 'SW_UPDATED')) {
          markUpdateAvailable();
        }
      };
      
      navigator.serviceWorker.addEventListener('message', onMessage as EventListener);
      checkForUpdates();

      const handleVisibilityChange = () => {
        if (!document.hidden && !hasUpdatedRef.current) {
          checkForUpdates();
          checkVersionByFetch();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        navigator.serviceWorker.removeEventListener('message', onMessage as EventListener);
        if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
        if (checkIntervalRef.current) window.clearInterval(checkIntervalRef.current);
      };
    }

    return () => {
      if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
      if (checkIntervalRef.current) window.clearInterval(checkIntervalRef.current);
    };
  }, []);

  const handleUpdate = () => {
    if (isUpdating) return;
    setIsUpdating(true);
    sessionStorage.removeItem('update_available');
    sessionStorage.setItem('update_applied_this_session', '1');
    hasUpdatedRef.current = true;
    setShowNotification(false);

    // Salva o build atual ao atualizar
    const currentBuild = typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : '';
    if (currentBuild) {
      localStorage.setItem('app_build_version', currentBuild);
    }
    
    // Limpa versão JS para forçar nova verificação após reload
    localStorage.removeItem('app_js_version');

    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
      // Timeout de fallback caso controllerchange não dispare
      setTimeout(() => window.location.reload(), 1000);
      return;
    }
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
          });
          setTimeout(() => window.location.reload(), 1000);
        } else {
          window.location.reload();
        }
      }).catch(() => {
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  };

  const handleClose = () => {
    setShowNotification(false);
    // Não bloquear futuras notificações - apenas esconder esta
    sessionStorage.removeItem('update_available');
  };

  if (!showNotification) {
    return null;
  }

  return (
    <div 
      className="fixed top-0 left-0 right-0 bg-green-600 text-white shadow-lg animate-in slide-in-from-top duration-300"
      style={{ zIndex: 9999 }}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            <span className="font-medium">Nova atualização disponível!</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleUpdate}
              disabled={isUpdating}
              size="sm"
              variant="secondary"
              className="bg-white text-green-600 hover:bg-gray-100"
            >
              Atualizar
            </Button>
            <Button
              onClick={handleClose}
              size="sm"
              variant="ghost"
              className="text-white hover:bg-green-700"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
