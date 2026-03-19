import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { NavLink } from '@/components/NavLink';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Users,
  ClipboardList,
  Wallet,
  Settings,
  LogOut,
  Building2,
  ChefHat,
  Utensils,
  UserCheck,
  Truck,
  Bike,
  Loader2,
  Megaphone,
  CreditCard,
  Shield,
  BarChart3,
  Star,
} from 'lucide-react';
import UpgradeModal from '@/components/UpgradeModal';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';
import { NotificationToggle } from '@/components/notifications/NotificationToggle';
import { ThemeToggle } from './ThemeToggle';
import { Badge } from '@/components/ui/badge';

type MenuItemKey = 
  | 'dashboard' 
  | 'mesas' 
  | 'cardapio' 
  | 'pedidos' 
  | 'delivery' 
  | 'deliveryStats' 
  | 'marketing'
  | 'garcom' 
  | 'caixa' 
  | 'equipe' 
  | 'empresa' 
  | 'configuracoes'
  | 'assinatura'
  | 'administracao'
  | 'entregador'
  | 'desempenho'
  | 'avaliacoes';

interface MenuItem {
  key: MenuItemKey;
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

const allMenuItems: MenuItem[] = [
  { key: 'dashboard', title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
  { key: 'mesas', title: 'Mesas', url: '/admin/mesas', icon: UtensilsCrossed },
  { key: 'cardapio', title: 'Cardápio', url: '/admin/cardapio', icon: ChefHat },
  { key: 'pedidos', title: 'Pedidos (KDS)', url: '/admin/pedidos', icon: ClipboardList },
  { key: 'entregador', title: 'Painel Entregador', url: '/admin/entregador', icon: Bike },
  { key: 'delivery', title: 'Delivery', url: '/admin/delivery', icon: Truck },
  { key: 'deliveryStats', title: 'Estatísticas Delivery', url: '/admin/delivery/dashboard', icon: Truck },
  { key: 'desempenho', title: 'Desempenho', url: '/admin/desempenho', icon: BarChart3 },
  { key: 'avaliacoes', title: 'Avaliações', url: '/admin/avaliacoes', icon: Star },
  { key: 'marketing', title: 'Marketing', url: '/admin/marketing', icon: Megaphone },
  { key: 'garcom', title: 'Garçom', url: '/admin/garcom', icon: UserCheck },
  { key: 'caixa', title: 'Caixa', url: '/admin/caixa', icon: Wallet },
  { key: 'equipe', title: 'Equipe', url: '/admin/equipe', icon: Users },
  { key: 'empresa', title: 'Empresa', url: '/admin/empresa', icon: Building2 },
  { key: 'assinatura', title: 'Assinatura', url: '/admin/assinatura', icon: CreditCard },
  { key: 'administracao', title: 'Administração', url: '/super-admin', icon: Shield },
  { key: 'configuracoes', title: 'Configurações', url: '/admin/configuracoes', icon: Settings },
];

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user, profile } = useAuth();
  const { setOpenMobile, isMobile, state } = useSidebar();
  const collapsed = state === 'collapsed';
  const {
    role,
    isLoading: isRoleLoading,
    isProprietario,
    isGerente,
    isSuperAdmin,
    isMotoboy,
    canAccessDashboard,
    canAccessMesas,
    canAccessCardapio,
    canAccessPedidos,
    canAccessDelivery,
    canAccessDeliveryStats,
    canAccessGarcom,
    canAccessCaixa,
    canAccessEquipe,
    canAccessEmpresa,
    canAccessConfiguracoes,
    canAccessMarketing,
    canAccessAssinatura,
    canAccessEntregador,
    isGarcom,
    planoSlug,
  } = useUserRole();

  // Verificar se é staff (não é proprietário/gerente/super admin)
  const isStaff = !isProprietario && !isGerente && !isSuperAdmin;
  
  // Mapeamento de roles para labels em português
  const roleLabels: Record<string, string> = {
    proprietario: 'Proprietário',
    gerente: 'Gerente',
    garcom: 'Garçom',
    caixa: 'Caixa',
    motoboy: 'Motoboy',
  };

  const handleLogout = async () => {
    try {
      await signOut();
      
      // Limpar storage local do Supabase
      localStorage.removeItem('sb-zlwpxflqtyhdwanmupgy-auth-token');
      sessionStorage.clear();
      
      toast.success('Logout realizado com sucesso!');
      window.location.href = '/auth';
    } catch (err) {
      console.error('Exceção no logout:', err);
      toast.error('Erro ao sair. Tente novamente.');
    }
  };

  const handleMenuClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<string | null>(null);

  // Mapear permissões para cada item do menu
  const permissionMap: Record<MenuItemKey, boolean> = {
    dashboard: canAccessDashboard,
    mesas: canAccessMesas,
    cardapio: canAccessCardapio,
    pedidos: canAccessPedidos,
    entregador: canAccessEntregador,
    delivery: canAccessDelivery,
    deliveryStats: canAccessDeliveryStats,
    desempenho: canAccessDeliveryStats,
    avaliacoes: canAccessDeliveryStats,
    marketing: canAccessMarketing,
    garcom: canAccessGarcom,
    caixa: canAccessCaixa,
    equipe: canAccessEquipe,
    empresa: canAccessEmpresa,
    assinatura: canAccessAssinatura,
    administracao: isSuperAdmin,
    configuracoes: canAccessConfiguracoes,
  };

  // Para Staff: filtrar menu para mostrar apenas itens com permissão
  // Para Proprietário/Gerente/SuperAdmin: mostrar todos os itens
  const visibleMenuItems = useMemo(() => {
    if (isProprietario || isGerente || isSuperAdmin) {
      return allMenuItems.filter(item => item.key !== 'administracao' || isSuperAdmin);
    }
    // Staff: mostrar apenas itens permitidos (sem cadeados)
    return allMenuItems.filter(item => permissionMap[item.key]);
  }, [isProprietario, isGerente, isSuperAdmin, canAccessDashboard, canAccessMesas, canAccessCardapio, 
      canAccessPedidos, canAccessDelivery, canAccessDeliveryStats, canAccessMarketing, 
      canAccessGarcom, canAccessCaixa, canAccessEquipe, canAccessEmpresa, canAccessConfiguracoes, 
      canAccessAssinatura, canAccessEntregador]);

  if (isRoleLoading) {
    return (
      <Sidebar>
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sidebar-accent">
              <Utensils className="w-5 h-5 text-sidebar-accent-foreground" />
            </div>
            <div>
              <h2 className="font-bold text-sidebar-foreground">Food Comanda Pro</h2>
              <p className="text-xs text-sidebar-foreground/70">Painel Admin</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-sidebar-foreground/50" />
        </SidebarContent>
      </Sidebar>
    );
  }

  // Se o usuário está em onboarding (sem empresa), ocultar o sidebar completamente
  if (!profile?.empresa_id) {
    return null;
  }

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sidebar-accent">
            <Utensils className="w-5 h-5 text-sidebar-accent-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-sidebar-foreground">Food Comanda Pro</h2>
            <p className="text-xs text-sidebar-foreground/70">Painel Admin</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-hide">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">
            Menu Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map((item) => {
                const allowed = permissionMap[item.key];
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                      {allowed ? (
                        <NavLink 
                          to={item.url} 
                          end={item.url === '/admin'}
                          className="flex items-center gap-3"
                          onClick={handleMenuClick}
                        >
                          <item.icon className="w-5 h-5" />
                          <span>{item.title}</span>
                        </NavLink>
                      ) : isStaff ? (
                        // Staff sem permissão: apenas toast (não modal de upgrade)
                        <button
                          onClick={() => toast.error('Seu perfil não tem permissão para acessar esta página')}
                          className="flex items-center gap-3 text-sidebar-foreground opacity-50 cursor-not-allowed"
                        >
                          <item.icon className="w-5 h-5" />
                          <span>{item.title}</span>
                        </button>
                      ) : (
                        // Proprietário/Gerente sem permissão por plano: modal de upgrade
                        <button
                          onClick={() => { setUpgradeFeature(item.title); setUpgradeOpen(true); }}
                          className="flex items-center gap-3 text-sidebar-foreground"
                          title="Recurso bloqueado"
                        >
                          <item.icon className="w-5 h-5 opacity-60" />
                          <span>{item.title}</span>
                          <span className="ml-auto text-xs text-muted-foreground">🔒</span>
                        </button>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} feature={upgradeFeature} />

      <SidebarFooter className="p-4">
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-sidebar-accent/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center">
              <span className="text-sm font-medium text-sidebar-accent-foreground">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.email}
              </p>
              {isSuperAdmin ? (
                <Badge variant="default" className="text-xs mt-1 bg-purple-600 hover:bg-purple-700">
                  Administrador
                </Badge>
              ) : role ? (
                <Badge variant="secondary" className="text-xs mt-1">
                  {roleLabels[role] || role}
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-sidebar-border">
            <div className="flex items-center gap-1">
              <NotificationToggle type="admin" />
              <ThemeToggle />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
