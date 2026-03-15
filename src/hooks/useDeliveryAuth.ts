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

      // Verifica se o usuário tem role ativo em user_roles (é funcionário de restaurante)
      // Apenas considera "funcionário" se tiver role de proprietario, gerente, garcom, caixa ou motoboy
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();

      const staffRoles = ['proprietario', 'gerente', 'garcom', 'caixa', 'motoboy'];
      const hasStaffRole = userRole?.role && staffRoles.includes(userRole.role);
      setIsRestaurantStaff(hasStaffRole);

      console.log('[useDeliveryAuth] User:', session.user.id, 'isRestaurantStaff:', hasStaffRole, 'role:', userRole?.role);
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
