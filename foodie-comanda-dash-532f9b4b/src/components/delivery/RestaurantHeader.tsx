import { memo } from 'react';
import { ArrowLeft, Store, Clock, Truck, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface RestaurantHeaderProps {
  empresa: {
    nome_fantasia: string;
    logo_url: string | null;
    endereco_completo: string | null;
  } | null;
  config: {
    tempo_estimado_min: number;
    tempo_estimado_max: number;
    taxa_entrega: number;
    pedido_minimo: number;
  } | null;
  onBack: () => void;
}

export const RestaurantHeader = memo(function RestaurantHeader({ 
  empresa, 
  config, 
  onBack 
}: RestaurantHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg safe-area-inset-top">
      <div className="flex items-center gap-3 px-4 py-4">
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-primary-foreground hover:bg-white/10 rounded-full flex-shrink-0"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="w-11 h-11 rounded-xl bg-card/20 backdrop-blur-sm overflow-hidden flex-shrink-0 ring-2 ring-white/20">
          {empresa?.logo_url ? (
            <img 
              src={empresa.logo_url} 
              alt={empresa.nome_fantasia}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Store className="w-6 h-6 text-primary-foreground/70" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{empresa?.nome_fantasia}</h1>
          {empresa?.endereco_completo && (
            <p className="text-xs text-primary-foreground/70 flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3" />
              {empresa.endereco_completo}
            </p>
          )}
        </div>
      </div>
      
      {config && (
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          <Badge variant="secondary" className="flex items-center gap-1 whitespace-nowrap bg-white/20 text-primary-foreground border-0">
            <Clock className="w-3 h-3" />
            {config.tempo_estimado_min}-{config.tempo_estimado_max} min
          </Badge>
          {config.taxa_entrega > 0 ? (
            <Badge variant="secondary" className="flex items-center gap-1 whitespace-nowrap bg-white/20 text-primary-foreground border-0">
              <Truck className="w-3 h-3" />
              R$ {config.taxa_entrega.toFixed(2)}
            </Badge>
          ) : (
            <Badge className="bg-green-500 text-white border-0 whitespace-nowrap">
              Entrega Grátis
            </Badge>
          )}
          {config.pedido_minimo > 0 && (
            <Badge variant="secondary" className="whitespace-nowrap bg-white/20 text-primary-foreground border-0">
              Mín. R$ {config.pedido_minimo.toFixed(2)}
            </Badge>
          )}
        </div>
      )}
    </header>
  );
});
