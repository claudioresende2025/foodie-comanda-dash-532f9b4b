import { memo } from 'react';
import { Plus, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Tipo para variações de tamanho
interface VariacaoTamanho {
  nome: string;
  preco: number;
}

interface ProductCardProps {
  product: {
    id: string;
    nome: string;
    descricao: string | null;
    preco: number;
    imagem_url: string | null;
    variacoes?: VariacaoTamanho[] | null;
  };
  quantity?: number;
  onAdd: () => void;
  onRemove?: () => void;
  onOpenSizeModal?: () => void; // Abre modal de seleção de tamanho
}

export const ProductCard = memo(function ProductCard({ 
  product, 
  quantity = 0, 
  onAdd, 
  onRemove,
  onOpenSizeModal
}: ProductCardProps) {
  const hasVariacoes = product.variacoes && Array.isArray(product.variacoes) && product.variacoes.length > 0;
  
  // Determina o menor preço das variações ou usa o preço único
  const menorPreco = hasVariacoes 
    ? Math.min(...(product.variacoes!.map(v => v.preco)))
    : product.preco;

  const handleAddClick = () => {
    if (hasVariacoes && onOpenSizeModal) {
      // Produto com variações: abre modal para selecionar tamanho
      onOpenSizeModal();
    } else {
      // Produto sem variações: adiciona diretamente
      onAdd();
    }
  };

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
          <div className="mt-1.5">
            {hasVariacoes ? (
              <>
                <p className="text-primary font-bold">A partir de R$ {menorPreco.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">
                  {product.variacoes!.length} tamanho{product.variacoes!.length > 1 ? 's' : ''} disponíve{product.variacoes!.length > 1 ? 'is' : 'l'}
                </p>
              </>
            ) : (
              <p className="text-primary font-bold">R$ {product.preco.toFixed(2)}</p>
            )}
          </div>
        </div>
        <div className="flex items-center">
          {quantity > 0 && !hasVariacoes ? (
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
                onClick={handleAddClick}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button 
              size="icon" 
              className="h-10 w-10 rounded-full shadow-md"
              onClick={handleAddClick}
            >
              <Plus className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
});
