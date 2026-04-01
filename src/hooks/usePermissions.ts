/**
 * usePermissions - Hook para verificar permissões do usuário
 * 
 * Uso:
 * const { canViewFaturamento, canManageTeam, hasPermission } = usePermissions();
 * 
 * if (canViewFaturamento) {
 *   // Mostrar faturamento
 * }
 * 
 * if (hasPermission('canOperateCaixa')) {
 *   // Mostrar operações de caixa
 * }
 */

import { useAuth } from '@/contexts/AuthContext';

export function usePermissions() {
  const { permissions, isOfflineSession } = useAuth();

  // Permissões padrão se não houver permissões carregadas
  const defaultPermissions = {
    canViewFaturamento: true,
    canViewRelatorios: true,
    canManageTeam: true,
    canManageProdutos: true,
    canManageMesas: true,
    canOperateCaixa: true,
    canTakeOrders: true,
    canDelivery: false,
    canAccessAdmin: true,
  };

  const currentPermissions = permissions || defaultPermissions;

  /**
   * Verifica se o usuário tem uma permissão específica
   */
  const hasPermission = (permission: keyof typeof defaultPermissions): boolean => {
    return currentPermissions[permission] ?? false;
  };

  /**
   * Verifica se o usuário tem TODAS as permissões listadas
   */
  const hasAllPermissions = (permissionList: (keyof typeof defaultPermissions)[]): boolean => {
    return permissionList.every(p => currentPermissions[p]);
  };

  /**
   * Verifica se o usuário tem ALGUMA das permissões listadas
   */
  const hasAnyPermission = (permissionList: (keyof typeof defaultPermissions)[]): boolean => {
    return permissionList.some(p => currentPermissions[p]);
  };

  return {
    // Permissões individuais
    canViewFaturamento: currentPermissions.canViewFaturamento,
    canViewRelatorios: currentPermissions.canViewRelatorios,
    canManageTeam: currentPermissions.canManageTeam,
    canManageProdutos: currentPermissions.canManageProdutos,
    canManageMesas: currentPermissions.canManageMesas,
    canOperateCaixa: currentPermissions.canOperateCaixa,
    canTakeOrders: currentPermissions.canTakeOrders,
    canDelivery: currentPermissions.canDelivery,
    canAccessAdmin: currentPermissions.canAccessAdmin,
    
    // Status
    isOfflineSession,
    permissionsLoaded: !!permissions,
    
    // Funções auxiliares
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    
    // Objeto completo de permissões
    permissions: currentPermissions,
  };
}

export default usePermissions;
