import { memo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, MapPin, Clock, Truck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface RestaurantCardProps {
  empresa: {
    id: string;
    nome_fantasia: string;
    logo_url: string | null;
    endereco_completo: string | null;
    config?: {
      tempo_estimado_min: number;
      tempo_estimado_max: number;
      taxa_entrega: number;
      pedido_minimo: number;
    };
  };
}

export const RestaurantCard = memo(function RestaurantCard({ empresa }: RestaurantCardProps) {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleClick = () => {
    if (!isLoggedIn) {
      navigate('/delivery/auth');
    } else {
      navigate(`/delivery/${empresa.id}`);
    }
  };

  return (
    <div onClick={handleClick} className="block touch-manipulation cursor-pointer">
      <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer h-full overflow-hidden border-0 shadow-md hover:scale-[1.02] active:scale-[0.98]">
        <CardContent className="p-0">
          <div className="aspect-[16/10] bg-muted relative overflow-hidden">
            {empresa.logo_url ? (
              <img
                src={empresa.logo_url}
                alt={empresa.nome_fantasia}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                <Store className="w-16 h-16 text-primary/30" />
              </div>
            )}
            {empresa.config?.taxa_entrega === 0 && (
              <Badge className="absolute top-3 right-3 bg-green-600 text-white shadow-lg">
                Entrega Grátis
              </Badge>
            )}
          </div>
          <div className="p-4">
            <h3 className="font-bold text-lg text-foreground mb-2 line-clamp-1 group-hover:text-primary transition-colors">
              {empresa.nome_fantasia}
            </h3>
            {empresa.endereco_completo && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-3">
                <MapPin className="w-4 h-4 flex-shrink-0 text-primary/60" />
                <span className="line-clamp-1">{empresa.endereco_completo}</span>
              </p>
            )}
            {empresa.config && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="flex items-center gap-1 font-medium">
                  <Clock className="w-3 h-3" />
                  {empresa.config.tempo_estimado_min}-{empresa.config.tempo_estimado_max} min
                </Badge>
                {empresa.config.taxa_entrega > 0 && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Truck className="w-3 h-3" />
                    R$ {empresa.config.taxa_entrega.toFixed(2)}
                  </Badge>
                )}
                {empresa.config.pedido_minimo > 0 && (
                  <Badge variant="outline" className="text-xs">
                    Mín. R$ {empresa.config.pedido_minimo.toFixed(2)}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
