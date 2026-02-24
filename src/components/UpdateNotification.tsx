import { useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

declare const __BUILD_TIMESTAMP__: string;

export const UpdateNotification = () => {
  const [showNotification, setShowNotification] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const showTimerRef = useRef<number | null>(null);

  const triggerShowWithDelay = () => {
    if (showTimerRef.current) return;
    showTimerRef.current = window.setTimeout(() => {
      setShowNotification(true);
      showTimerRef.current = null;
    }, 10000);
  };

  useEffect(() => {
    // Verificação por build timestamp (funciona sem SW)
    const currentBuild = typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : '';
    const lastBuild = localStorage.getItem('app_build_version');

    if (currentBuild && lastBuild && lastBuild !== currentBuild) {
      setShowNotification(true);
      sessionStorage.setItem('update_available', '1');
    } else if (currentBuild && !lastBuild) {
      // Primeira vez: salva sem mostrar notificação
      localStorage.setItem('app_build_version', currentBuild);
    }

    if (sessionStorage.getItem('update_available') === '1') {
      setShowNotification(true);
    }

    if (!('serviceWorker' in navigator)) {
      return;
    }

    const checkForUpdates = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          if (registration.waiting) {
            setWaitingWorker(registration.waiting);
            triggerShowWithDelay();
            sessionStorage.setItem('update_available', '1');
          }

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setWaitingWorker(newWorker);
                  triggerShowWithDelay();
                  sessionStorage.setItem('update_available', '1');
                }
              });
            }
          });
        }

        navigator.serviceWorker.ready.then((reg) => {
          if (reg) {
            if (reg.waiting) {
              setWaitingWorker(reg.waiting);
              triggerShowWithDelay();
              sessionStorage.setItem('update_available', '1');
            }
            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    setWaitingWorker(newWorker);
                    triggerShowWithDelay();
                    sessionStorage.setItem('update_available', '1');
                  }
                });
              }
            });
          }
        }).catch(() => {});

        const interval = setInterval(async () => {
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
      if (e.data && (e.data.type === 'NEW_VERSION_AVAILABLE' || e.data.type === 'SW_UPDATED')) {
        triggerShowWithDelay();
        sessionStorage.setItem('update_available', '1');
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage as EventListener);

    checkForUpdates();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
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
