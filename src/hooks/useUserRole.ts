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
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRole = useCallback(async () => {
    if (!user?.id || !profile?.empresa_id) {
      setRole(null);
      setIsLoading(false);
      return;
    }

    try {
      const [{ data: roleData }, { data: overridesData }, { data: assinaturaData }] = await Promise.all([
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('empresa_id', profile.empresa_id)
          .maybeSingle(),
        supabase
          .from('empresa_overrides')
          .select('overrides,kds_screens_limit,staff_limit')
          .eq('empresa_id', profile.empresa_id)
          .maybeSingle(),
        (supabase as any)
          .from('assinaturas')
          .select('*, plano:planos(*)')
          .eq('empresa_id', profile.empresa_id)
          .maybeSingle(),
      ]);

      // Additionally check if this user is a global super admin (no empresa context required)
      try {
        const { data: saData } = await supabase
          .from('super_admins')
          .select('user_id')
          .eq('user_id', user.id)
          .eq('ativo', true)
          .maybeSingle();
        setIsSuperAdmin(Boolean(saData && saData.user_id));
      } catch (e) {
        setIsSuperAdmin(false);
      }

      if (roleData.error) {
        console.error('Error fetching user role:', roleData.error);
        setRole(null);
      } else {
        setRole(roleData.data?.role as AppRole || null);
      }

      // Store overrides and plano recursos in local state via profile (avoid adding new state: attach to profile object if present)
      // We will attach to window.__empresaFeatureCache for simple access by UI (ephemeral)
      try {
        const overrides = overridesData.data || null;
        const assinatura = assinaturaData.data || null;
        (window as any).__empresaFeatureCache = { overrides, assinatura, isSuperAdmin };
      } catch (e) {
        console.warn('Could not cache empresa features', e);
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
  const isAdmin = isProprietario || isGerente || isSuperAdmin;

  // read plan and overrides from cache if available
  const cache = (window as any).__empresaFeatureCache || {};
  const overrides = cache.overrides?.overrides || {};
  const planoRecursos = cache.assinatura?.plano?.recursos || {};

  const resolveFeature = (key: string) => {
    // override trumps plan
    if (overrides && Object.prototype.hasOwnProperty.call(overrides, key)) {
      return overrides[key];
    }
    return planoRecursos?.[key] ?? false;
  };

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
    canManageMenu: isAdmin || resolveFeature('cardapio'),
    canManageCategories: isAdmin, // Garçom só visualiza
    canEditPixKey: isProprietario, // Só proprietário edita PIX
    // Acesso às páginas (combine role + plan/overrides)
    canAccessDashboard: isAdmin || isCaixa || resolveFeature('dashboard'),
    canAccessMesas: isAdmin || isGarcom || isCaixa || resolveFeature('mesas'),
    canAccessPedidos: isAdmin || isGarcom || resolveFeature('kds') || resolveFeature('pedidos'),
    canAccessDelivery: isAdmin || isCaixa || resolveFeature('delivery'),
    canAccessDeliveryStats: isAdmin || resolveFeature('estatisticas'),
    canAccessGarcom: isAdmin || isGarcom || isCaixa || resolveFeature('garcom'),
    canAccessCaixa: isAdmin || isCaixa || resolveFeature('caixa'),
    canAccessEquipe: isAdmin || resolveFeature('equipe'),
    canAccessEmpresa: isAdmin || resolveFeature('empresa'),
    canAccessConfiguracoes: isAdmin || resolveFeature('configuracoes'),
    // limits
    kdsScreensLimit: cache.overrides?.kds_screens_limit ?? cache.assinatura?.plano?.recursos?.kds_screens ?? null,
    equipeLimit: cache.overrides?.staff_limit ?? cache.assinatura?.plano?.recursos?.equipe_limit ?? null,
    refetch: fetchRole,
  };
}
