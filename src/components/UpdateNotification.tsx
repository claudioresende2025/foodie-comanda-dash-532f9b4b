import { useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

declare const __BUILD_TIMESTAMP__: string;

export const UpdateNotification = () => {
  const [showNotification, setShowNotification] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const showTimerRef = useRef<number | null>(null);
  const checkIntervalRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  // Verificar se já atualizou nesta sessão
  const hasUpdatedThisSession = () => {
    return sessionStorage.getItem('update_applied_this_session') === '1';
  };

  // Função para mostrar notificação após delay
  const scheduleNotification = (worker?: ServiceWorker) => {
    if (hasUpdatedThisSession() || !mountedRef.current) return;
    if (showNotification) return; // Já está mostrando
    
    if (worker) {
      setWaitingWorker(worker);
    }
    
    // Marca que há update disponível
    sessionStorage.setItem('update_available', '1');
    
    // Se já havia timer, não criar outro
    if (showTimerRef.current) return;
    
    console.log('[UpdateNotification] Agendando notificação para 3 segundos');
    
    // Mostra após 3 segundos
    showTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current && !hasUpdatedThisSession()) {
        console.log('[UpdateNotification] Mostrando notificação');
        setShowNotification(true);
      }
      showTimerRef.current = null;
    }, 3000);
  };

  // Verificação por fetch - funciona em desktop e mobile
  const checkVersionByFetch = async () => {
    if (hasUpdatedThisSession() || !mountedRef.current) return;
    
    try {
      const response = await fetch(`/index.html?_=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (response.ok) {
        const html = await response.text();
        const match = html.match(/index-([A-Za-z0-9]+)\.js/);
        const serverVersion = match ? match[1] : null;
        const localVersion = localStorage.getItem('app_js_version');
        
        console.log('[UpdateNotification] Versão local:', localVersion, '| Servidor:', serverVersion);
        
        if (serverVersion && localVersion && serverVersion !== localVersion) {
          console.log('[UpdateNotification] Nova versão detectada!');
          scheduleNotification();
        } else if (serverVersion && !localVersion) {
          // Primeira vez: salvar versão atual
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
    console.log('[UpdateNotification] Componente montado');
    
    // Se já havia update disponível na sessão, agendar notificação
    if (sessionStorage.getItem('update_available') === '1' && !hasUpdatedThisSession()) {
      console.log('[UpdateNotification] Update já disponível na sessão');
      scheduleNotification();
    }

    // Verificação por build timestamp
    const currentBuild = typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : '';
    const lastBuild = localStorage.getItem('app_build_version');

    if (currentBuild && lastBuild && lastBuild !== currentBuild) {
      console.log('[UpdateNotification] Build diferente:', lastBuild, '->', currentBuild);
      scheduleNotification();
    } else if (currentBuild && !lastBuild) {
      localStorage.setItem('app_build_version', currentBuild);
    }

    // Verificação imediata por fetch
    checkVersionByFetch();
    
    // Verificação periódica a cada 30 segundos (não precisa ser tão frequente)
    checkIntervalRef.current = window.setInterval(checkVersionByFetch, 30000);

    // Service Worker (se disponível)
    if ('serviceWorker' in navigator) {
      const checkSW = async () => {
        if (hasUpdatedThisSession()) return;
        
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

            // Força verificação de atualização do SW
            await registration.update();
          }
        } catch (error) {
          console.error('[UpdateNotification] Erro SW:', error);
        }
      };

      const onMessage = (e: MessageEvent) => {
        if (hasUpdatedThisSession()) return;
        if (e.data && (e.data.type === 'NEW_VERSION_AVAILABLE' || e.data.type === 'SW_UPDATED')) {
          console.log('[UpdateNotification] Mensagem SW recebida:', e.data.type);
          scheduleNotification();
        }
      };
      
      navigator.serviceWorker.addEventListener('message', onMessage as EventListener);
      checkSW();

      // Verificar ao voltar para a aba
      const handleVisibility = () => {
        if (!document.hidden && !hasUpdatedThisSession()) {
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
      };
    }

    return () => {
      mountedRef.current = false;
      if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
      if (checkIntervalRef.current) window.clearInterval(checkIntervalRef.current);
    };
  }, []);

  const handleUpdate = () => {
    // Limpa estados para evitar loop
    sessionStorage.removeItem('update_available');
    sessionStorage.setItem('update_applied_this_session', '1');
    localStorage.removeItem('app_js_version');
    
    // Reload IMEDIATO
    window.location.reload();
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
