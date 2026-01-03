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
    await supabase.auth.signOut();
    window.location.href = '/delivery/auth';
  };

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg backdrop-blur-sm">
      <div className="container mx-auto px-4 py-5 safe-area-inset-top">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-card/20 backdrop-blur-sm overflow-hidden flex-shrink-0 shadow-lg ring-2 ring-white/20">
            <img 
              src="/pwa-icon.png" 
              alt="Food Comanda Pro" 
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">Food Comanda Pro</h1>
            <p className="text-xs text-primary-foreground/70 font-medium">Delivery</p>
          </div>
          <NotificationToggle type="delivery" />
          {isLoggedIn && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleLogout}
              className="text-primary-foreground hover:bg-white/20 gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Sair</span>
            </Button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Buscar restaurantes..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-12 h-12 bg-card text-foreground rounded-xl border-0 shadow-md focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
      </div>
    </header>
  );
});