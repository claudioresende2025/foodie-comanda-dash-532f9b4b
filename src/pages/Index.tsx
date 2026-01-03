import { Link, useNavigate } from 'react-router-dom';
import { Utensils, Truck, ChefHat, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useEffect, useState } from 'react';

const Index = () => {
  const navigate = useNavigate();
  const [showSelection, setShowSelection] = useState(false);

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
    
    // No subdomain detected, show selection screen
    setShowSelection(true);
  }, [navigate]);

  // Show loading while checking subdomain
  if (!showSelection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 via-green-600 to-emerald-700 flex items-center justify-center">
        <div className="w-16 h-16 bg-white rounded-2xl shadow-2xl flex items-center justify-center animate-pulse">
          <Utensils className="w-8 h-8 text-green-600" />
        </div>
      </div>
    );
  }

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
          Escolha como deseja acessar
        </p>
      </div>

      {/* Selection Cards */}
      <div className="w-full max-w-md space-y-4">
        {/* Delivery Option */}
        <Link to="/delivery" className="block">
          <Card className="group hover:scale-105 transition-all duration-300 cursor-pointer overflow-hidden border-0 shadow-xl bg-white/95 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all group-hover:scale-110">
                  <Truck className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-800 mb-1">
                    Fazer Pedido
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Peça delivery dos melhores restaurantes
                  </p>
                </div>
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                  <span className="text-gray-400 group-hover:text-orange-500 text-xl">→</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Admin Option */}
        <Link to="/auth" className="block">
          <Card className="group hover:scale-105 transition-all duration-300 cursor-pointer overflow-hidden border-0 shadow-xl bg-white/95 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all group-hover:scale-110">
                  <ChefHat className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-800 mb-1">
                    Administrador
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Gerencie seu restaurante
                  </p>
                </div>
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <span className="text-gray-400 group-hover:text-blue-500 text-xl">→</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Footer */}
      <div className="mt-12 text-center">
        <p className="text-green-200 text-sm">
          © 2024 Food Comanda Pro
        </p>
        <div className="flex items-center justify-center gap-2 mt-2 text-green-100/70 text-xs">
          <Users className="w-3 h-3" />
          <span>Milhares de restaurantes conectados</span>
        </div>
      </div>
    </div>
  );
};

export default Index;
