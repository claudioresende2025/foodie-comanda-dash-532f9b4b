import { useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

declare const __BUILD_TIMESTAMP__: string;

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as any).standalone === true;

export const UpdateNotification = () => {
  const [showNotification, setShowNotification] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const checkIntervalRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const showingRef = useRef(false);

  const scheduleNotification = (worker?: ServiceWorker) => {
    if (!mountedRef.current) return;
    if (showingRef.current) return;

    if (worker) setWaitingWorker(worker);
    if (showTimerRef.current) return;

    console.log('[UpdateNotification] Agendando notificação para 3 segundos');

    showTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current) {
        console.log('[UpdateNotification] Mostrando notificação');
        showingRef.current = true;
        setShowNotification(true);
      }
      showTimerRef.current = null;
    }, 3000);
  };

  const checkVersionByFetch = async () => {
    if (!mountedRef.current) return;

    try {
      // Check 1: version.json
      try {
        const vRes = await fetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' });
        if (vRes.ok) {
          const vData = await vRes.json();
          const serverBuildVersion = vData.version;
          const localBuildVersion = localStorage.getItem('app_version_json');
          if (serverBuildVersion && localBuildVersion && serverBuildVersion !== localBuildVersion) {
            console.log('[UpdateNotification] version.json divergiu:', localBuildVersion, '->', serverBuildVersion);
            localStorage.setItem('app_version_json', serverBuildVersion);
            scheduleNotification();
            return;
          } else if (serverBuildVersion && !localBuildVersion) {
            localStorage.setItem('app_version_json', serverBuildVersion);
          }
        }
      } catch (e) { /* version.json pode nao existir em dev */ }

      // Check 2: hash de assets no index.html
      const response = await fetch(`/index.html?_nocache=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (response.ok) {
        const html = await response.text();
        const match = html.match(/assets\/index-([A-Za-z0-9_-]+)\.(js|css)/);
        const serverVersion = match ? match[1] : null;
        const localVersion = localStorage.getItem('app_js_version');

        console.log('[UpdateNotification] Versão local:', localVersion, '| Servidor:', serverVersion);

        if (serverVersion && localVersion && serverVersion !== localVersion) {
          console.log('[UpdateNotification] Nova versão detectada via fetch!');
          localStorage.setItem('app_js_version', serverVersion);
          scheduleNotification();
        } else if (serverVersion && !localVersion) {
          localStorage.setItem('app_js_version', serverVersion);
          console.log('[UpdateNotification] Versão inicial salva:', serverVersion);
        }
      }
    } catch (error) {
      // Silenciar erros de rede
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    showingRef.current = false;
    console.log('[UpdateNotification] Componente montado, standalone:', isStandalone());

    // Build timestamp check
    const currentBuild = typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : '';
    const lastBuild = localStorage.getItem('app_build_version');

    if (currentBuild && lastBuild && lastBuild !== currentBuild) {
      console.log('[UpdateNotification] Build diferente:', lastBuild, '->', currentBuild);
      localStorage.setItem('app_build_version', currentBuild);
      scheduleNotification();
    } else if (currentBuild) {
      localStorage.setItem('app_build_version', currentBuild);
    }

    // Fetch check imediato
    checkVersionByFetch();

    // Intervalo de verificação — mais frequente em PWA standalone
    const interval = isStandalone() ? 20000 : 30000;
    checkIntervalRef.current = window.setInterval(checkVersionByFetch, interval);

    // Service Worker
    if ('serviceWorker' in navigator) {
      const checkSW = async () => {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            if (registration.waiting) {
              console.log('[UpdateNotification] SW waiting encontrado');
              scheduleNotification(registration.waiting);
              return;
            }

            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[UpdateNotification] Novo SW instalado');
                    scheduleNotification(newWorker);
                  }
                });
              }
            });

            await registration.update();
          }
        } catch (error) {
          console.error('[UpdateNotification] Erro SW:', error);
        }
      };

      const onMessage = (e: MessageEvent) => {
        if (e.data && (e.data.type === 'NEW_VERSION_AVAILABLE' || e.data.type === 'SW_UPDATED')) {
          console.log('[UpdateNotification] Mensagem SW recebida:', e.data.type);
          scheduleNotification();
        }
      };

      navigator.serviceWorker.addEventListener('message', onMessage as EventListener);
      checkSW();

      // Polling SW — 3 min em standalone, 5 min normal
      const swPollMs = isStandalone() ? 3 * 60 * 1000 : 5 * 60 * 1000;
      const swPollInterval = window.setInterval(async () => {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.update();
            if (reg.waiting) scheduleNotification(reg.waiting);
          }
        } catch (e) { /* ignorar */ }
      }, swPollMs);

      const handleVisibility = () => {
        if (!document.hidden) {
          checkSW();
          checkVersionByFetch();
        }
      };

      document.addEventListener('visibilitychange', handleVisibility);

      return () => {
        mountedRef.current = false;
        document.removeEventListener('visibilitychange', handleVisibility);
        navigator.serviceWorker.removeEventListener('message', onMessage as EventListener);
        if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
        if (checkIntervalRef.current) window.clearInterval(checkIntervalRef.current);
        window.clearInterval(swPollInterval);
      };
    }

    return () => {
      mountedRef.current = false;
      if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
      if (checkIntervalRef.current) window.clearInterval(checkIntervalRef.current);
    };
  }, []);

  const handleUpdate = async () => {
    localStorage.removeItem('app_js_version');
    localStorage.removeItem('app_build_version');
    localStorage.removeItem('app_version_json');

    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }

    // Limpar todos os caches do SW
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch (e) {
        console.warn('[UpdateNotification] Erro ao limpar caches:', e);
      }
    }

    window.location.reload();
  };

  const handleClose = () => {
    showingRef.current = false;
    setShowNotification(false);
  };

  if (!showNotification) return null;

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
