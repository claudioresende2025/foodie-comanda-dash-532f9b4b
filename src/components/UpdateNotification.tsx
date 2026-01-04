import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const UpdateNotification = () => {
  const [showNotification, setShowNotification] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    // Verifica se o navegador suporta service workers
    if (!('serviceWorker' in navigator)) {
      return;
    }

    // Função para verificar atualizações
    const checkForUpdates = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          // Verifica se há um novo service worker esperando
          if (registration.waiting) {
            setWaitingWorker(registration.waiting);
            setShowNotification(true);
          }

          // Escuta por novas atualizações
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // Novo service worker está pronto para ativar
                  setWaitingWorker(newWorker);
                  setShowNotification(true);
                }
              });
            }
          });

          // Verifica atualizações periodicamente (a cada hora)
          const interval = setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000);

          return () => clearInterval(interval);
        }
      } catch (error) {
        console.error('Erro ao verificar atualizações:', error);
      }
    };

    // Escuta mensagens do service worker
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Service worker foi atualizado, recarrega a página
      window.location.reload();
    });

    // Verifica atualizações quando o componente monta
    checkForUpdates();

    // Verifica atualizações quando a aba fica visível novamente
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkForUpdates();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      // Envia mensagem para o service worker para pular a espera
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      
      // Aguarda o novo service worker assumir o controle e então recarrega
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
  };

  const handleClose = () => {
    setShowNotification(false);
  };

  if (!showNotification) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-green-600 text-white shadow-lg animate-in slide-in-from-top duration-300">
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
