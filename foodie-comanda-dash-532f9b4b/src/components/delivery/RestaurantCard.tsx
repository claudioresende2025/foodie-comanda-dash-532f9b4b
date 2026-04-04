import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, MapPin, Clock, Truck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
    } | null;
  };
}

export const RestaurantCard = memo(function RestaurantCard({ empresa }: RestaurantCardProps) {
  const navigate = useNavigate();

  // Se por algum motivo a empresa vier vazia, não renderiza nada para não quebrar o app
  if (!empresa) return null;

  const handleClick = () => {
    if (empresa.id) {
      navigate(`/delivery/${empresa.id}`);
    }
  };

  return (
    <div 
      onClick={handleClick} 
      className="block touch-manipulation cursor-pointer group"
    >
      <Card className="hover:shadow-xl transition-all duration-300 h-full overflow-hidden border-0 shadow-md hover:scale-[1.02] active:scale-[0.98]">
        <CardContent className="p-0">
          {/* Área da Imagem */}
          <div className="aspect-[16/10] bg-muted relative overflow-hidden">
            {empresa.logo_url ? (
              <img
                src={empresa.logo_url}
                alt={empresa.nome_fantasia || 'Restaurante'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                <Store className="w-12 h-12 text-primary/30" />
              </div>
            )}
            
            {/* Badge de Entrega Grátis - Seguro contra nulos */}
            {empresa.config?.taxa_entrega === 0 && (
              <Badge className="absolute top-3 right-3 bg-green-600 text-white shadow-lg border-none">
                Entrega Grátis
              </Badge>
            )}
          </div>

          {/* Informações do Restaurante */}
          <div className="p-4">
            <h3 className="font-bold text-lg text-foreground mb-1 line-clamp-1 group-hover:text-primary transition-colors">
              {empresa.nome_fantasia || "Nome não disponível"}
            </h3>
            
            {empresa.endereco_completo && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-3">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-primary/60" />
                <span className="line-clamp-1">{empresa.endereco_completo}</span>
              </p>
            )}

            {/* Informações de Entrega */}
            {empresa.config ? (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="flex items-center gap-1 font-medium bg-secondary/50">
                  <Clock className="w-3 h-3" />
                  {empresa.config.tempo_estimado_min || 0}-{empresa.config.tempo_estimado_max || 0} min
                </Badge>
                
                <Badge variant="outline" className="flex items-center gap-1">
                  <Truck className="w-3 h-3 text-muted-foreground" />
                  R$ {(empresa.config.taxa_entrega || 0).toFixed(2)}
                </Badge>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-muted-foreground italic py-1">
                <Store className="w-3 h-3" />
                Clique para ver horários
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
