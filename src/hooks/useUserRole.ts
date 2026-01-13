import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// Tipos válidos do enum app_role no banco de dados
export type AppRole = 'proprietario' | 'gerente' | 'garcom' | 'caixa';

export interface UserRoleData {
  role: AppRole | null;
  isLoading: boolean;
  isProprietario: boolean;
  isGerente: boolean;
  isGarcom: boolean;
  isCaixa: boolean;
  isSuperAdmin: boolean;
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
  canAccessMarketing: boolean;
  canEditPixKey: boolean;
  // Limites do plano
  kdsScreensLimit: number | null;
  staffLimit: number | null;
  mesasLimit: number | null;
  garcomLimit: number | null;
  // Plano atual
  planoSlug: string | null;
  planoNome: string | null;
  refetch: () => Promise<void>;
}

// Recursos padrão por plano
const defaultPlanResources: Record<string, {
  recursos: Record<string, boolean | string>;
  kds_screens: number | null;
  staff_limit: number | null;
  mesas_limit: number | null;
  garcom_limit: number | null;
}> = {
  bronze: {
    recursos: {
      dashboard: true,
      cardapio: true,
      delivery: 'whatsapp', // WhatsApp básico
      empresa: true,
      configuracoes: true,
      mesas: true,
      kds: true,
      estatisticas: false,
      marketing: false,
      garcom: true,
      caixa: true,
      equipe: true,
      pedidos: true,
    },
    kds_screens: 1,
    staff_limit: 2,
    mesas_limit: 10,
    garcom_limit: 1,
  },
  prata: {
    recursos: {
      dashboard: true,
      cardapio: true,
      delivery: true,
      empresa: true,
      configuracoes: true,
      mesas: true,
      kds: true,
      estatisticas: false,
      marketing: false,
      garcom: true,
      caixa: true,
      equipe: true,
      pedidos: true,
    },
    kds_screens: 1,
    staff_limit: 5,
    mesas_limit: null, // ilimitado
    garcom_limit: 3,
  },
  ouro: {
    recursos: {
      dashboard: true,
      cardapio: true,
      delivery: true,
      empresa: true,
      configuracoes: true,
      mesas: true,
      kds: true,
      estatisticas: true,
      marketing: true,
      garcom: true,
      caixa: true,
      equipe: true,
      pedidos: true,
    },
    kds_screens: null, // ilimitado
    staff_limit: null, // ilimitado
    mesas_limit: null, // ilimitado
    garcom_limit: null, // ilimitado
  },
};

export function useUserRole(): UserRoleData {
  const { user, profile } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [planData, setPlanData] = useState<{
    planoSlug: string | null;
    planoNome: string | null;
    recursos: Record<string, boolean | string>;
    kdsScreensLimit: number | null;
    staffLimit: number | null;
    mesasLimit: number | null;
    garcomLimit: number | null;
  }>({
    planoSlug: null,
    planoNome: null,
    recursos: {},
    kdsScreensLimit: null,
    staffLimit: null,
    mesasLimit: null,
    garcomLimit: null,
  });

  const fetchRole = useCallback(async () => {
    if (!user?.id || !profile?.empresa_id) {
      setRole(null);
      setIsLoading(false);
      return;
    }

    try {
      // Buscar role, overrides e assinatura em paralelo
      const [roleResult, overridesResult, assinaturaResult] = await Promise.all([
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('empresa_id', profile.empresa_id)
          .maybeSingle(),
        (supabase as any)
          .from('empresa_overrides')
          .select('overrides,kds_screens_limit,staff_limit,mesas_limit,garcom_limit')
          .eq('empresa_id', profile.empresa_id)
          .maybeSingle(),
        (supabase as any)
          .from('assinaturas')
          .select('*, plano:planos(*)')
          .eq('empresa_id', profile.empresa_id)
          .maybeSingle(),
      ]);

      // Check super admin status
      try {
        const { data: saData } = await (supabase as any)
          .from('super_admins')
          .select('user_id')
          .eq('user_id', user.id)
          .eq('ativo', true)
          .maybeSingle();
        setIsSuperAdmin(Boolean(saData?.user_id));
      } catch (e) {
        setIsSuperAdmin(false);
      }

      // Set role
      if (roleResult.error) {
        console.error('Error fetching user role:', roleResult.error);
        setRole(null);
      } else {
        setRole(roleResult.data?.role as AppRole || null);
      }

      // Process overrides and plan data
      const overrides = overridesResult.data || null;
      const assinatura = assinaturaResult.data || null;

      // Determine plano slug and recursos
      const rawSlug = assinatura?.plano?.slug?.toLowerCase() || assinatura?.plano?.nome?.toLowerCase() || '';
      // Normalize slug - extract base plan name (bronze, prata, ouro)
      let planoSlug: string | null = null;
      if (rawSlug.includes('bronze') || rawSlug.includes('iniciante') || rawSlug.includes('basico') || rawSlug.includes('básico')) {
        planoSlug = 'bronze';
      } else if (rawSlug.includes('prata') || rawSlug.includes('profissional')) {
        planoSlug = 'prata';
      } else if (rawSlug.includes('ouro') || rawSlug.includes('enterprise') || rawSlug.includes('gold')) {
        planoSlug = 'ouro';
      }
      
      let planoNome = assinatura?.plano?.nome || null;
      let planoRecursos: Record<string, boolean | string> = {};

      // Get recursos from plano or use defaults based on normalized slug
      // IGNORAMOS recursos do banco se for array (apenas strings de exibição)
      // Usamos os recursos definidos hardcoded no código para garantir as permissões corretas
      if (planoSlug && defaultPlanResources[planoSlug]) {
        planoRecursos = defaultPlanResources[planoSlug].recursos;
      } else if (assinatura?.plano?.recursos && !Array.isArray(assinatura.plano.recursos) && Object.keys(assinatura.plano.recursos).length > 0) {
        // Fallback: se tiver recursos no banco e NÃO for array (ex: JSON de configs), usa eles
        planoRecursos = assinatura.plano.recursos;
      }

      // If still empty and has assinatura, default to bronze
      if (Object.keys(planoRecursos).length === 0 && assinatura) {
        planoRecursos = defaultPlanResources['bronze'].recursos;
        planoSlug = planoSlug || 'bronze';
      }

      // Merge overrides with plan recursos (overrides take precedence)
      const overridesRecursos = overrides?.overrides || {};
      const mergedRecursos = { ...planoRecursos, ...overridesRecursos };

      // Calculate limits (overrides > plano > defaults)
      const defaultLimits = planoSlug && defaultPlanResources[planoSlug] 
        ? defaultPlanResources[planoSlug] 
        : { kds_screens: null, staff_limit: null, mesas_limit: null, garcom_limit: null };

      const kdsScreensLimit = overrides?.kds_screens_limit ?? assinatura?.plano?.kds_screens ?? defaultLimits.kds_screens;
      const staffLimit = overrides?.staff_limit ?? assinatura?.plano?.staff_limit ?? defaultLimits.staff_limit;
      const mesasLimit = overrides?.mesas_limit ?? assinatura?.plano?.limite_mesas ?? defaultLimits.mesas_limit;
      const garcomLimit = overrides?.garcom_limit ?? assinatura?.plano?.garcom_limit ?? defaultLimits.garcom_limit;

      setPlanData({
        planoSlug,
        planoNome,
        recursos: mergedRecursos,
        kdsScreensLimit,
        staffLimit,
        mesasLimit,
        garcomLimit,
      });

      // Cache for other components
      (window as any).__empresaFeatureCache = {
        overrides,
        assinatura,
        isSuperAdmin,
        planoRecursos: mergedRecursos,
        computedKdsScreens: kdsScreensLimit,
        computedStaffLimit: staffLimit,
        computedMesasLimit: mesasLimit,
        computedGarcomLimit: garcomLimit,
        planoSlug,
        planoNome,
      };
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

  // Helper to resolve feature access from plan
  const resolveFeature = (key: string): boolean => {
    const value = planData.recursos[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value !== 'false' && value !== '';
    return false;
  };

  // Super admin tem acesso total, outros respeitam o plano
  const hasFullAccess = isSuperAdmin;

  return {
    role,
    isLoading,
    isProprietario,
    isGerente,
    isGarcom,
    isCaixa,
    isSuperAdmin,
    // Permissões gerais
    canManageTeam: isProprietario && resolveFeature('equipe'),
    canManageCompany: isAdmin,
    canManageMenu: (isAdmin || resolveFeature('cardapio')) && resolveFeature('cardapio'),
    canManageCategories: isAdmin && resolveFeature('cardapio'),
    canEditPixKey: isProprietario,
    // Acesso às páginas - respeita o plano (exceto super admin)
    canAccessDashboard: hasFullAccess || ((isAdmin || isCaixa) && resolveFeature('dashboard')),
    canAccessMesas: hasFullAccess || ((isAdmin || isGarcom || isCaixa) && resolveFeature('mesas')),
    canAccessPedidos: hasFullAccess || ((isAdmin || isGarcom) && (resolveFeature('kds') || resolveFeature('pedidos'))),
    canAccessDelivery: hasFullAccess || ((isAdmin || isCaixa) && resolveFeature('delivery')),
    canAccessDeliveryStats: hasFullAccess || (isAdmin && resolveFeature('estatisticas')),
    canAccessGarcom: hasFullAccess || ((isAdmin || isGarcom || isCaixa) && resolveFeature('garcom')),
canAccessCaixa: hasFullAccess || ((isAdmin || isCaixa) && resolveFeature('caixa')), // GARÇOM não tem acesso
    canAccessEquipe: hasFullAccess || (isAdmin && resolveFeature('equipe')), // Apenas admin
    canAccessEmpresa: hasFullAccess || (isAdmin && resolveFeature('empresa')),
    canAccessConfiguracoes: hasFullAccess || (isAdmin && resolveFeature('configuracoes')),
    canAccessMarketing: hasFullAccess || (isAdmin && resolveFeature('marketing')),
    // Limites
    kdsScreensLimit: planData.kdsScreensLimit,
    staffLimit: planData.staffLimit,
    mesasLimit: planData.mesasLimit,
    garcomLimit: planData.garcomLimit,
    // Plano
    planoSlug: planData.planoSlug,
    planoNome: planData.planoNome,
    refetch: fetchRole,
  };
}
