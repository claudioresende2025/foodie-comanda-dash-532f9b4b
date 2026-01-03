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
  Loader2,
  Megaphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { NotificationToggle } from '@/components/notifications/NotificationToggle';

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
  | 'configuracoes';

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
  { key: 'delivery', title: 'Delivery', url: '/admin/delivery', icon: Truck },
  { key: 'deliveryStats', title: 'Estatísticas Delivery', url: '/admin/delivery/dashboard', icon: Truck },
  { key: 'marketing', title: 'Marketing', url: '/admin/marketing', icon: Megaphone },
  { key: 'garcom', title: 'Garçom', url: '/admin/garcom', icon: UserCheck },
  { key: 'caixa', title: 'Caixa', url: '/admin/caixa', icon: Wallet },
  { key: 'equipe', title: 'Equipe', url: '/admin/equipe', icon: Users },
  { key: 'empresa', title: 'Empresa', url: '/admin/empresa', icon: Building2 },
  { key: 'configuracoes', title: 'Configurações', url: '/admin/configuracoes', icon: Settings },
];

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { setOpenMobile, isMobile } = useSidebar();
  const {
    isLoading: isRoleLoading,
    canAccessDashboard,
    canAccessMesas,
    canManageMenu,
    canAccessPedidos,
    canAccessDelivery,
    canAccessDeliveryStats,
    canAccessGarcom,
    canAccessCaixa,
    canAccessEquipe,
    canAccessEmpresa,
    canAccessConfiguracoes,
    isGarcom,
  } = useUserRole();

  const handleLogout = async () => {
    await signOut();
    toast.success('Logout realizado com sucesso!');
    navigate('/auth');
  };

  const handleMenuClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Mapear permissões para cada item do menu
  const permissionMap: Record<MenuItemKey, boolean> = {
    dashboard: canAccessDashboard,
    mesas: canAccessMesas,
    cardapio: canManageMenu || isGarcom, // Garçom acessa mas só visualiza categorias
    pedidos: canAccessPedidos,
    delivery: canAccessDelivery,
    deliveryStats: canAccessDeliveryStats,
    marketing: canAccessEmpresa || canAccessDelivery, // Proprietário/gerente
    garcom: canAccessGarcom,
    caixa: canAccessCaixa,
    equipe: canAccessEquipe,
    empresa: canAccessEmpresa,
    configuracoes: canAccessConfiguracoes,
  };

  // Filtrar menu items baseado nas permissões
  const visibleMenuItems = allMenuItems.filter(item => permissionMap[item.key]);

  if (isRoleLoading) {
    return (
      <Sidebar>
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sidebar-accent">
              <Utensils className="w-5 h-5 text-sidebar-accent-foreground" />
            </div>
            <div>
              <h2 className="font-bold text-sidebar-foreground">FoodComanda</h2>
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

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sidebar-accent">
            <Utensils className="w-5 h-5 text-sidebar-accent-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-sidebar-foreground">FoodComanda</h2>
            <p className="text-xs text-sidebar-foreground/70">Painel Admin</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">
            Menu Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <NavLink 
                      to={item.url} 
                      end={item.url === '/admin'}
                      className="flex items-center gap-3"
                      onClick={handleMenuClick}
                    >
                      <item.icon className="w-5 h-5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent/50">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
            <span className="text-sm font-medium text-sidebar-accent-foreground">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.email}
            </p>
          </div>
          <NotificationToggle type="admin" />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
