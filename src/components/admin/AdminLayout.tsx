import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AdminSidebar } from './AdminSidebar';
import { Loader2 } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';

// Roles que pertencem à equipe (staff) - devem ter acesso ao Admin
const STAFF_ROLES = ['proprietario', 'gerente', 'garcom', 'caixa', 'motoboy'];

export function AdminLayout() {
  const { user, loading, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Ler configuração de menu compacto do localStorage
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("fcd-settings");
      if (saved) {
        const settings = JSON.parse(saved);
        // compactMenu = true significa sidebar colapsada (defaultOpen = false)
        return !settings.compactMenu;
      }
    } catch (e) {
      console.warn('Erro ao ler configurações:', e);
    }
    return true; // expandido por padrão
  });
  
  // Handler que também persiste no localStorage
  const handleSidebarOpenChange = (open: boolean) => {
    setSidebarOpen(open);
    try {
      const saved = localStorage.getItem("fcd-settings");
      const settings = saved ? JSON.parse(saved) : {};
      settings.compactMenu = !open;
      localStorage.setItem("fcd-settings", JSON.stringify(settings));
    } catch (e) {
      console.warn('Erro ao salvar configurações:', e);
    }
  };
  
  // Atualizar quando a configuração mudar (mesmo na mesma aba)
  useEffect(() => {
    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.compactMenu === 'boolean') {
        setSidebarOpen(!customEvent.detail.compactMenu);
      }
    };
    
    const handleStorage = () => {
      try {
        const saved = localStorage.getItem("fcd-settings");
        if (saved) {
          const settings = JSON.parse(saved);
          setSidebarOpen(!settings.compactMenu);
        }
      } catch (e) {
        console.warn('Erro ao ler configurações:', e);
      }
    };
    
    window.addEventListener('fcd-settings-changed', handleSettingsChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('fcd-settings-changed', handleSettingsChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);
  
  const {
    role,
    isLoading: roleLoading,
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
    canAccessMarketing,
  } = useUserRole();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Bloquear usuários 'client' (sem role de staff) de acessar rotas admin
  useEffect(() => {
    if (loading || roleLoading || !user || !profile?.empresa_id) return;
    
    // Se role não estiver na lista de staff, bloquear acesso
    if (role && !STAFF_ROLES.includes(role)) {
      toast.error('Você não tem permissão para acessar o painel administrativo.');
      navigate(`/menu/${profile.empresa_id}`);
      return;
    }
    
    // Se não tem role definido, também bloquear (é um cliente)
    if (!role) {
      navigate(`/menu/${profile.empresa_id}`);
      return;
    }
  }, [loading, roleLoading, user, role, profile, navigate]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (loading || roleLoading || !user) return;
    const path = location.pathname;
    
    // Lista de rotas com suas permissões e URLs
    const routePermissions = [
      { permission: canAccessDashboard, url: '/admin', match: (p: string) => p === '/admin' },
      { permission: canAccessMesas, url: '/admin/mesas', match: (p: string) => p.startsWith('/admin/mesas') },
      { permission: canManageMenu, url: '/admin/cardapio', match: (p: string) => p.startsWith('/admin/cardapio') },
      { permission: canAccessPedidos, url: '/admin/pedidos', match: (p: string) => p.startsWith('/admin/pedidos') },
      { permission: canAccessDelivery, url: '/admin/delivery', match: (p: string) => p === '/admin/delivery' },
      { permission: canAccessDeliveryStats, url: '/admin/delivery/dashboard', match: (p: string) => p.startsWith('/admin/delivery/dashboard') },
      { permission: canAccessGarcom, url: '/admin/garcom', match: (p: string) => p.startsWith('/admin/garcom') },
      { permission: canAccessCaixa, url: '/admin/caixa', match: (p: string) => p.startsWith('/admin/caixa') },
      { permission: canAccessEquipe, url: '/admin/equipe', match: (p: string) => p.startsWith('/admin/equipe') },
      { permission: canAccessEmpresa, url: '/admin/empresa', match: (p: string) => p.startsWith('/admin/empresa') },
      { permission: canAccessConfiguracoes, url: '/admin/configuracoes', match: (p: string) => p.startsWith('/admin/configuracoes') },
      { permission: canAccessMarketing, url: '/admin/marketing', match: (p: string) => p.startsWith('/admin/marketing') },
      { permission: true, url: '/admin/assinatura', match: (p: string) => p.startsWith('/admin/assinatura') },
    ];
    
    // Encontra a rota atual
    const currentRoute = routePermissions.find((r) => r.match(path));
    
    // Se a rota atual não tem permissão, redireciona para a primeira rota disponível
    if (currentRoute && !currentRoute.permission) {
      const firstAvailable = routePermissions.find((r) => r.permission && r.url !== '/admin/assinatura');
      if (firstAvailable) {
        navigate(firstAvailable.url);
      }
    }
  }, [
    loading,
    roleLoading,
    user,
    location.pathname,
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
    canAccessMarketing,
    navigate,
  ]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={handleSidebarOpenChange}>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur px-4 md:px-6">
            <SidebarTrigger className="-ml-2" />
          </header>
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
