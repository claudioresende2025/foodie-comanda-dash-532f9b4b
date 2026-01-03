import { memo } from 'react';
import { Plus, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ProductCardProps {
  product: {
    id: string;
    nome: string;
    descricao: string | null;
    preco: number;
    imagem_url: string | null;
  };
  quantity?: number;
  onAdd: () => void;
  onRemove?: () => void;
}

export const ProductCard = memo(function ProductCard({ 
  product, 
  quantity = 0, 
  onAdd, 
  onRemove 
}: ProductCardProps) {
  return (
    <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow border-0 bg-card">
      <div className="flex p-3 gap-3">
        {product.imagem_url && (
          <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
            <img
              src={product.imagem_url}
              alt={product.nome}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground line-clamp-1">{product.nome}</h3>
          {product.descricao && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{product.descricao}</p>
          )}
          <p className="text-primary font-bold mt-1.5">R$ {product.preco.toFixed(2)}</p>
        </div>
        <div className="flex items-center">
          {quantity > 0 ? (
            <div className="flex items-center gap-2 bg-primary/10 rounded-full p-1">
              <Button 
                size="icon" 
                variant="ghost"
                className="h-8 w-8 rounded-full text-primary hover:bg-primary/20"
                onClick={onRemove}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-6 text-center font-bold text-primary">{quantity}</span>
              <Button 
                size="icon" 
                className="h-8 w-8 rounded-full"
                onClick={onAdd}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button 
              size="icon" 
              className="h-10 w-10 rounded-full shadow-md"
              onClick={onAdd}
            >
              <Plus className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
});
