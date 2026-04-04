import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour
const THROTTLE_INTERVAL = 30 * 1000; // 30 seconds
const STORAGE_KEY = 'lastActivity';

export function useInactivityTimeout(isAuthenticated: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const handleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: 'Sessão expirada',
        description: 'Você foi desconectado por inatividade. Faça login novamente.',
        variant: 'destructive',
      });
      window.location.replace('/auth');
    } catch (e) {
      console.error('Erro ao fazer logout por inatividade:', e);
    }
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(handleLogout, INACTIVITY_TIMEOUT);
  }, [handleLogout]);

  const handleActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRef.current < THROTTLE_INTERVAL) return;
    lastActivityRef.current = now;

    try {
      localStorage.setItem(STORAGE_KEY, String(now));
    } catch {}

    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    if (!isAuthenticated) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    // Initialize
    lastActivityRef.current = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {}
    resetTimer();

    const events: (keyof DocumentEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((event) => document.addEventListener(event, handleActivity, { passive: true }));

    // Cross-tab sync
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      const otherTabActivity = Number(e.newValue);
      if (otherTabActivity > lastActivityRef.current) {
        lastActivityRef.current = otherTabActivity;
        resetTimer();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) => document.removeEventListener(event, handleActivity));
      window.removeEventListener('storage', handleStorage);
    };
  }, [isAuthenticated, handleActivity, resetTimer]);
}
