import { useNavigate } from 'react-router-dom';
import { Building2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface RestaurantStaffBlockProps {
  onLogout?: () => void;
}

/**
 * Componente exibido quando um funcionário de restaurante tenta acessar a área de delivery.
 */
export function RestaurantStaffBlock({ onLogout }: RestaurantStaffBlockProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (onLogout) {
      onLogout();
    } else {
      navigate('/delivery/auth');
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-orange-100 flex items-center justify-center">
          <Building2 className="w-10 h-10 text-orange-600" />
        </div>
        <h2 className="text-xl font-bold mb-3 text-foreground">
          Você está logado como funcionário
        </h2>
        <p className="text-muted-foreground mb-6">
          Esta área é exclusiva para clientes de delivery. Para fazer pedidos como cliente, 
          faça logout e crie uma conta de cliente, ou acesse o painel administrativo do seu restaurante.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button 
            onClick={() => navigate('/admin')}
            className="bg-primary hover:bg-primary/90"
          >
            <Building2 className="w-4 h-4 mr-2" />
            Ir para o Painel Admin
          </Button>
          <Button 
            variant="outline"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Fazer Logout
          </Button>
        </div>
      </div>
    </div>
  );
}
