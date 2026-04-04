import { memo, useEffect, useState } from 'react';
import { Search, LogOut } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { NotificationToggle } from '@/components/notifications/NotificationToggle';

interface DeliveryHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

export const DeliveryHeader = memo(function DeliveryHeader({ 
  searchQuery, 
  onSearchChange 
}: DeliveryHeaderProps) {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      // Limpar storage local do Supabase ANTES do signOut
      localStorage.removeItem('sb-zlwpxflqtyhdwanmupgy-auth-token');
      sessionStorage.clear();
      
      // Tentar fazer logout no Supabase (ignorar erro se já não houver sessão)
      await supabase.auth.signOut().catch(() => {});
      
      // Redirecionar
      window.location.href = '/delivery/auth';
    } catch (err) {
      console.error('Exceção no logout:', err);
      // Mesmo com erro, redirecionar
      window.location.href = '/delivery/auth';
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg backdrop-blur-sm">
      <div className="container mx-auto px-4 py-3 safe-area-inset-top">
        {/* Linha superior: Logo à esquerda, ações à direita */}
        <div className="flex items-center justify-between mb-3">
          {/* Logo no canto esquerdo */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-card/20 backdrop-blur-sm overflow-hidden flex-shrink-0 shadow-lg ring-2 ring-white/20">
              <img 
                src="/pwa-icon.png" 
                alt="Food Comanda Pro" 
                className="w-full h-full object-cover"
                loading="eager"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold tracking-tight truncate">Food Comanda Pro</h1>
              <p className="text-[10px] sm:text-xs text-primary-foreground/70 font-medium">Delivery</p>
            </div>
          </div>
          
          {/* Ações à direita */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <NotificationToggle 
              type="delivery" 
              variant="ghost"
              className="text-white hover:bg-white/20 [&>svg]:text-white"
            />
            {isLoggedIn && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleLogout}
                className="text-primary-foreground hover:bg-white/20 gap-1 px-2 sm:px-3"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-xs sm:text-sm font-medium hidden sm:inline">Sair</span>
              </Button>
            )}
          </div>
        </div>
        
        {/* Barra de busca */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Buscar restaurantes..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-12 h-11 sm:h-12 bg-card text-foreground rounded-xl border-0 shadow-md focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
      </div>
    </header>
  );
});