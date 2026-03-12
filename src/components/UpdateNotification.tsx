import { useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

declare const __BUILD_TIMESTAMP__: string;

export const UpdateNotification = () => {
  const [showNotification, setShowNotification] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const showTimerRef = useRef<number | null>(null);
  const updateDetectedRef = useRef(sessionStorage.getItem('update_notification_shown') === '1');

  // Função unificada para detectar atualização - só dispara uma vez
  const markUpdateAvailable = (worker?: ServiceWorker) => {
    // Se já detectou/mostrou nesta sessão, ignora
    if (updateDetectedRef.current) return;
    if (sessionStorage.getItem('update_notification_shown') === '1') {
      updateDetectedRef.current = true;
      return;
    }
    updateDetectedRef.current = true;
    
    if (worker) {
      setWaitingWorker(worker);
    }
    
    sessionStorage.setItem('update_available', '1');
    
    // Limpa timer anterior se existir
    if (showTimerRef.current) {
      window.clearTimeout(showTimerRef.current);
    }
    
    // Mostra a notificação após 10 segundos
    showTimerRef.current = window.setTimeout(() => {
      setShowNotification(true);
      showTimerRef.current = null;
    }, 10000);
  };

  useEffect(() => {
    // Se já foi mostrado nesta sessão de navegação, não permitir duplicados
    const alreadyShown = sessionStorage.getItem('update_notification_shown') === '1';
    
    // Verificação por build timestamp (funciona sem SW)
    const currentBuild = typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : '';
    const lastBuild = localStorage.getItem('app_build_version');

    if (currentBuild && lastBuild && lastBuild !== currentBuild && !alreadyShown) {
      markUpdateAvailable();
    } else if (currentBuild && !lastBuild) {
      // Primeira vez: salva sem mostrar notificação
      localStorage.setItem('app_build_version', currentBuild);
    }

    // Se já havia update disponível e ainda não foi mostrado
    if (sessionStorage.getItem('update_available') === '1' && !alreadyShown) {
      markUpdateAvailable();
    }

    if (!('serviceWorker' in navigator)) {
      return;
    }

    const checkForUpdates = async () => {
      // Se já detectou/mostrou, não verifica mais
      if (updateDetectedRef.current) return;
      
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          if (registration.waiting) {
            markUpdateAvailable(registration.waiting);
            return; // Para aqui, já detectou
          }

          registration.addEventListener('updatefound', () => {
            if (updateDetectedRef.current) return;
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  markUpdateAvailable(newWorker);
                }
              });
            }
          });
        }

        navigator.serviceWorker.ready.then((reg) => {
          if (updateDetectedRef.current) return;
          if (reg) {
            if (reg.waiting) {
              markUpdateAvailable(reg.waiting);
              return;
            }
            reg.addEventListener('updatefound', () => {
              if (updateDetectedRef.current) return;
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    markUpdateAvailable(newWorker);
                  }
                });
              }
            });
          }
        }).catch(() => {});

        const interval = setInterval(async () => {
          if (updateDetectedRef.current) return;
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.update();
          }
        }, 60 * 1000);

        return () => clearInterval(interval);
      } catch (error) {
        console.error('Erro ao verificar atualizações:', error);
      }
    };

    const onMessage = (e: MessageEvent) => {
      if (updateDetectedRef.current) return;
      if (e.data && (e.data.type === 'NEW_VERSION_AVAILABLE' || e.data.type === 'SW_UPDATED')) {
        markUpdateAvailable();
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage as EventListener);

    checkForUpdates();

    const handleVisibilityChange = () => {
      if (!document.hidden && !updateDetectedRef.current) {
        checkForUpdates();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      navigator.serviceWorker.removeEventListener('message', onMessage as EventListener);
      if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
    };
  }, []);

  const handleUpdate = () => {
    if (isUpdating) return;
    setIsUpdating(true);
    sessionStorage.removeItem('update_available');
    sessionStorage.setItem('update_notification_shown', '1');
    setShowNotification(false);

    // Salva o build atual ao atualizar
    const currentBuild = typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : '';
    if (currentBuild) {
      localStorage.setItem('app_build_version', currentBuild);
    }

    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
      return;
    }
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        });
      } else {
        window.location.reload();
      }
    });
  };

  const handleClose = () => {
    setShowNotification(false);
    sessionStorage.removeItem('update_available');
    sessionStorage.setItem('update_notification_shown', '1');
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
