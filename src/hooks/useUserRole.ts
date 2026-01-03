import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// Tipos válidos do enum app_role no banco de dados
export type AppRole = 'proprietario' | 'gerente' | 'garcom' | 'caixa';

interface UserRoleData {
  role: AppRole | null;
  isLoading: boolean;
  isProprietario: boolean;
  isGerente: boolean;
  isGarcom: boolean;
  isCaixa: boolean;
  canManageTeam: boolean;
  canManageCompany: boolean;
  canManageMenu: boolean;
  canAccessCaixa: boolean;
  canManageCategories: boolean;
  canAccessDashboard: boolean;
  canAccessMesas: boolean;
  canAccessPedidos: boolean;
  canAccessDelivery: boolean;
  canAccessDeliveryStats: boolean;
  canAccessGarcom: boolean;
  canAccessEquipe: boolean;
  canAccessEmpresa: boolean;
  canAccessConfiguracoes: boolean;
  canEditPixKey: boolean;
  refetch: () => Promise<void>;
}

export function useUserRole(): UserRoleData {
  const { user, profile } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRole = useCallback(async () => {
    if (!user?.id || !profile?.empresa_id) {
      setRole(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('empresa_id', profile.empresa_id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user role:', error);
        setRole(null);
      } else {
        setRole(data?.role as AppRole || null);
      }
    } catch (err) {
      console.error('Error fetching user role:', err);
      setRole(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, profile?.empresa_id]);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  const isProprietario = role === 'proprietario';
  const isGerente = role === 'gerente';
  const isGarcom = role === 'garcom';
  const isCaixa = role === 'caixa';

  // Permissões por role
  const isAdmin = isProprietario || isGerente;

  return {
    role,
    isLoading,
    isProprietario,
    isGerente,
    isGarcom,
    isCaixa,
    // Permissões gerais
    canManageTeam: isProprietario,
    canManageCompany: isAdmin,
    canManageMenu: isAdmin,
    canManageCategories: isAdmin, // Garçom só visualiza
    canEditPixKey: isProprietario, // Só proprietário edita PIX
    // Acesso às páginas
    canAccessDashboard: isAdmin || isCaixa,
    canAccessMesas: isAdmin || isGarcom || isCaixa,
    canAccessPedidos: isAdmin || isGarcom,
    canAccessDelivery: isAdmin || isCaixa,
    canAccessDeliveryStats: isAdmin || isCaixa,
    canAccessGarcom: isAdmin || isGarcom || isCaixa,
    canAccessCaixa: isAdmin || isCaixa,
    canAccessEquipe: isAdmin,
    canAccessEmpresa: isAdmin,
    canAccessConfiguracoes: isAdmin,
    refetch: fetchRole,
  };
}
