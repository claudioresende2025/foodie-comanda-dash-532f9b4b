import { useNavigate } from 'react-router-dom';
import { Utensils, User, ChefHat, Truck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export default function AuthChoice() {
  const navigate = useNavigate();

  // Verificar se já está logado
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Redirecionar com base no role
        const { data: profile } = await supabase
          .from('profiles')
          .select('empresa_id')
          .eq('id', session.user.id)
          .single();

        if (profile?.empresa_id) {
          const { data: userRole } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .eq('empresa_id', profile.empresa_id)
            .maybeSingle();

          const staffRoles = ['proprietario', 'gerente', 'garcom', 'caixa', 'motoboy'];
          if (userRole?.role && staffRoles.includes(userRole.role)) {
            navigate('/admin');
          } else {
            navigate(`/menu/${profile.empresa_id}`);
          }
        } else {
          navigate('/admin/onboarding');
        }
      }
    };
    checkSession();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-500 via-green-600 to-emerald-700 flex flex-col items-center justify-center p-6">
      {/* Logo Section */}
      <div className="text-center mb-10">
        <div className="w-24 h-24 bg-white rounded-3xl shadow-2xl flex items-center justify-center mx-auto mb-6 animate-bounce">
          <Utensils className="w-12 h-12 text-green-600" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">
          Food Comanda Pro
        </h1>
        <p className="text-green-100 text-lg">
          Como você deseja acessar?
        </p>
      </div>

      {/* Selection Cards */}
      <div className="w-full max-w-md space-y-4">
        {/* Cliente Option */}
        <Card 
          className="group hover:scale-105 transition-all duration-300 cursor-pointer overflow-hidden border-0 shadow-xl bg-white/95 backdrop-blur-sm"
          onClick={() => navigate('/auth/cliente')}
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all group-hover:scale-110">
                <Truck className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-800 mb-1">
                  Sou Cliente
                </h2>
                <p className="text-gray-500 text-sm">
                  Quero fazer pedidos e acompanhar
                </p>
              </div>
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                <span className="text-gray-400 group-hover:text-orange-500 text-xl">→</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Restaurante Option */}
        <Card 
          className="group hover:scale-105 transition-all duration-300 cursor-pointer overflow-hidden border-0 shadow-xl bg-white/95 backdrop-blur-sm"
          onClick={() => navigate('/auth/restaurante')}
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all group-hover:scale-110">
                <ChefHat className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-800 mb-1">
                  Sou Restaurante
                </h2>
                <p className="text-gray-500 text-sm">
                  Quero gerenciar meu estabelecimento
                </p>
              </div>
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <span className="text-gray-400 group-hover:text-blue-500 text-xl">→</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Funcionário Option */}
        <Card 
          className="group hover:scale-105 transition-all duration-300 cursor-pointer overflow-hidden border-0 shadow-xl bg-white/95 backdrop-blur-sm"
          onClick={() => navigate('/auth/restaurante')}
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all group-hover:scale-110">
                <User className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-800 mb-1">
                  Sou Funcionário
                </h2>
                <p className="text-gray-500 text-sm">
                  Garçom, Caixa, Gerente ou Motoboy
                </p>
              </div>
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                <span className="text-gray-400 group-hover:text-purple-500 text-xl">→</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="mt-12 text-center">
        <p className="text-green-200 text-sm">
          © 2026 Food Comanda Pro
        </p>
      </div>
    </div>
  );
}
