import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AdminSidebar } from './AdminSidebar';
import { Loader2 } from 'lucide-react';

export function AdminLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const debug = typeof window !== 'undefined' && window.location.search.includes('debug=1');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

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
    if (debug) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div style={{ maxWidth: 900 }}>
            <h2 className="text-xl font-bold mb-2">DEBUG - AdminLayout</h2>
            <p className="mb-2">`user` is not available — Auth returned null.</p>
            <p className="text-sm text-muted-foreground">Verifique sessão e autenticação.</p>
          </div>
        </div>
      );
    }
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
