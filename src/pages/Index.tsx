import { useNavigate } from 'react-router-dom';
import { Utensils, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// Roles que pertencem à equipe (staff)
const STAFF_ROLES = ['proprietario', 'gerente', 'garcom', 'caixa', 'motoboy'];

const Index = () => {
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(true);

  useEffect(() => {
    const hostname = window.location.hostname;
    
    // Check for subdomain-based routing
    if (hostname.startsWith('delivery.') || hostname.startsWith('delivery-')) {
      navigate('/delivery', { replace: true });
      return;
    }
    
    if (hostname.startsWith('admin.') || hostname.startsWith('admin-')) {
      navigate('/auth', { replace: true });
      return;
    }
    
    // Aguardar carregamento da autenticação
    if (loading) return;

    // Se não está logado, redireciona para login
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }

    // Se está logado, verifica o role e redireciona
    const checkRoleAndRedirect = async () => {
      if (!profile?.empresa_id) {
        // Usuário sem empresa - vai para onboarding
        navigate('/admin/onboarding', { replace: true });
        return;
      }

      // Buscar role do usuário
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('empresa_id', profile.empresa_id)
        .maybeSingle();

      const role = userRole?.role;

      // Se é staff, vai para admin
      if (role && STAFF_ROLES.includes(role)) {
        navigate('/admin', { replace: true });
      } else {
        // Se é client ou não tem role, vai para o cardápio
        navigate(`/menu/${profile.empresa_id}`, { replace: true });
      }
    };

    checkRoleAndRedirect();
  }, [navigate, loading, user, profile]);

  // Loading screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-500 via-green-600 to-emerald-700 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-white rounded-2xl shadow-2xl flex items-center justify-center mx-auto mb-4">
          <Utensils className="w-8 h-8 text-green-600" />
        </div>
        <Loader2 className="w-6 h-6 animate-spin text-white mx-auto mb-2" />
        <p className="text-green-100 text-sm">Carregando...</p>
      </div>
    </div>
  );
};

export default Index;
