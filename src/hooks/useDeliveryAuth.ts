import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

interface DeliveryAuthResult {
  user: User | null;
  isLoading: boolean;
  isRestaurantStaff: boolean;
  isAuthenticated: boolean;
}

/**
 * Hook para verificar autenticação nas páginas de delivery.
 * Verifica se o usuário está logado e se NÃO é funcionário de restaurante.
 * 
 * @param redirectOnNoAuth - Se true, redireciona para login quando não autenticado
 * @param currentPath - Caminho atual para redirect após login
 */
export function useDeliveryAuth(redirectOnNoAuth = true, currentPath = '/delivery'): DeliveryAuthResult {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestaurantStaff, setIsRestaurantStaff] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setUser(null);
        setIsRestaurantStaff(false);
        if (redirectOnNoAuth) {
          navigate('/delivery/auth', { state: { from: currentPath } });
        }
        return;
      }

      setUser(session.user);

      // Verifica se o usuário tem empresa_id (é funcionário de restaurante)
      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('id', session.user.id)
        .single();

      const hasEmpresa = !!profile?.empresa_id;
      setIsRestaurantStaff(hasEmpresa);

      console.log('[useDeliveryAuth] User:', session.user.id, 'isRestaurantStaff:', hasEmpresa);
    } catch (error) {
      console.error('[useDeliveryAuth] Error:', error);
      setUser(null);
      setIsRestaurantStaff(false);
    } finally {
      setIsLoading(false);
    }
  }, [navigate, redirectOnNoAuth, currentPath]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return {
    user,
    isLoading,
    isRestaurantStaff,
    isAuthenticated: !!user && !isRestaurantStaff,
  };
}
