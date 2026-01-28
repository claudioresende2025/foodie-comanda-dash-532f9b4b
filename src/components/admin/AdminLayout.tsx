import { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AdminSidebar } from './AdminSidebar';
import { Loader2 } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';

export function AdminLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const {
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

  useEffect(() => {
    if (loading || roleLoading || !user) return;
    const path = location.pathname;
    const checks: { test: boolean; match: (p: string) => boolean }[] = [
      { test: canAccessDashboard, match: (p) => p === '/admin' },
      { test: canAccessMesas, match: (p) => p.startsWith('/admin/mesas') },
      { test: canManageMenu, match: (p) => p.startsWith('/admin/cardapio') },
      { test: canAccessPedidos, match: (p) => p.startsWith('/admin/pedidos') },
      { test: canAccessDelivery, match: (p) => p === '/admin/delivery' },
      { test: canAccessDeliveryStats, match: (p) => p.startsWith('/admin/delivery/dashboard') },
      { test: canAccessGarcom, match: (p) => p.startsWith('/admin/garcom') },
      { test: canAccessCaixa, match: (p) => p.startsWith('/admin/caixa') },
      { test: canAccessEquipe, match: (p) => p.startsWith('/admin/equipe') },
      { test: canAccessEmpresa, match: (p) => p.startsWith('/admin/empresa') },
      { test: canAccessConfiguracoes, match: (p) => p.startsWith('/admin/configuracoes') },
      { test: canAccessMarketing, match: (p) => p.startsWith('/admin/marketing') },
      { test: true, match: (p) => p.startsWith('/admin/assinatura') },
    ];
    const match = checks.find((c) => c.match(path));
    // Se encontrou uma rota correspondente mas o usuário não tem permissão,
    // NÃO redirecionar automaticamente em reloads de páginas internas (ex: /admin/mesas).
    // Apenas redireciona quando o usuário está na raiz '/admin'.
    if (match && !match.test) {
      if (path === '/admin') {
        navigate('/admin/assinatura');
      } else {
        // Apenas notifica o usuário; não forza navegação ao atualizar a página.
        // Navegação forçada causa comportamento indesejado ao dar refresh em páginas válidas.
        toast.error('Recurso indisponível no seu plano');
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
    <SidebarProvider>
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
