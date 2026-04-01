/**
 * useBeforeUnload - Hook para alertar o usuário antes de fechar a aba
 * 
 * Impede que o usuário feche a aba se houver dados pendentes de sincronização.
 * 
 * Uso:
 * useBeforeUnload(); // Ativa o alerta automaticamente quando há pendências
 * 
 * Com verificação customizada:
 * useBeforeUnload({ checkPendingData: async () => await myCustomCheck() });
 */

import { useEffect, useCallback } from 'react';
import { useConnection } from './useConnection';

interface UseBeforeUnloadOptions {
  /** Função customizada para verificar dados pendentes */
  checkPendingData?: () => boolean | Promise<boolean>;
  /** Mensagem customizada (nota: a maioria dos navegadores ignora) */
  message?: string;
  /** Desabilitar o hook */
  disabled?: boolean;
}

export function useBeforeUnload(options?: UseBeforeUnloadOptions) {
  const { pendingCount } = useConnection();

  const defaultCheck = useCallback(() => {
    return pendingCount > 0;
  }, [pendingCount]);

  useEffect(() => {
    if (options?.disabled) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const checkFn = options?.checkPendingData || defaultCheck;
      const hasPendingData = checkFn();

      // Se for Promise, não podemos esperar no beforeunload
      // Então usamos o pendingCount diretamente
      if (hasPendingData instanceof Promise) {
        if (pendingCount > 0) {
          event.preventDefault();
          // Mensagem customizada (maioria dos navegadores ignora e mostra mensagem padrão)
          const message = options?.message || 
            `Você tem ${pendingCount} item(s) pendente(s) de sincronização. Se sair agora, esses dados podem ser perdidos.`;
          event.returnValue = message;
          return message;
        }
      } else if (hasPendingData) {
        event.preventDefault();
        const message = options?.message || 
          `Você tem ${pendingCount} item(s) pendente(s) de sincronização. Se sair agora, esses dados podem ser perdidos.`;
        event.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [pendingCount, options?.disabled, options?.message, options?.checkPendingData, defaultCheck]);
}

export default useBeforeUnload;
