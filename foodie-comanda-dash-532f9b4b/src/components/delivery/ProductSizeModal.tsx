import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ShoppingCart, Plus, Minus } from 'lucide-react';

// Tipo para variações de tamanho
export interface VariacaoTamanho {
  nome: string;
  preco: number;
}

interface Product {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  imagem_url: string | null;
  variacoes?: VariacaoTamanho[] | null;
}

interface ProductSizeModalProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart: (tamanho: string, preco: number, quantidade?: number) => void;
}

// Estado de quantidades por tamanho
interface QuantidadesPorTamanho {
  [tamanho: string]: number;
}

export function ProductSizeModal({
  product,
  open,
  onOpenChange,
  onAddToCart,
}: ProductSizeModalProps) {
  const [quantidades, setQuantidades] = useState<QuantidadesPorTamanho>({});

  const variacoes = product.variacoes || [];
  
  // Reset quantidades quando abre o modal
  useEffect(() => {
    if (open) {
      setQuantidades({});
    }
  }, [open]);

  const getQuantidade = (tamanho: string) => quantidades[tamanho] || 0;

  const incrementar = (tamanho: string) => {
    setQuantidades(prev => ({
      ...prev,
      [tamanho]: (prev[tamanho] || 0) + 1
    }));
  };

  const decrementar = (tamanho: string) => {
    setQuantidades(prev => {
      const atual = prev[tamanho] || 0;
      if (atual <= 0) return prev;
      const novasQuantidades = { ...prev };
      if (atual === 1) {
        delete novasQuantidades[tamanho];
      } else {
        novasQuantidades[tamanho] = atual - 1;
      }
      return novasQuantidades;
    });
  };

  // Calcula total de itens e valor
  const totalItens = Object.values(quantidades).reduce((sum, qtd) => sum + qtd, 0);
  const totalValor = variacoes.reduce((sum, v) => {
    const qtd = quantidades[v.nome] || 0;
    return sum + (v.preco * qtd);
  }, 0);

  const handleAddToCart = () => {
    // Adiciona cada tamanho selecionado ao carrinho
    variacoes.forEach(variacao => {
      const qtd = quantidades[variacao.nome];
      if (qtd && qtd > 0) {
        // Adiciona a quantidade selecionada de cada tamanho
        for (let i = 0; i < qtd; i++) {
          onAddToCart(variacao.nome, variacao.preco);
        }
      }
    });
    setQuantidades({});
    onOpenChange(false);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setQuantidades({});
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{product.nome}</DialogTitle>
          <DialogDescription>
            Selecione os tamanhos e quantidades desejadas
          </DialogDescription>
        </DialogHeader>

        {product.imagem_url && (
          <div className="w-full aspect-video rounded-lg overflow-hidden bg-muted mb-4">
            <img
              src={product.imagem_url}
              alt={product.nome}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {product.descricao && (
          <p className="text-sm text-muted-foreground mb-4">{product.descricao}</p>
        )}

        <div className="space-y-3">
          <Label className="text-base font-semibold">Escolha tamanho e quantidade:</Label>
          
          <div className="space-y-2">
            {variacoes.map((variacao) => {
              const qtd = getQuantidade(variacao.nome);
              return (
                <div
                  key={variacao.nome}
                  className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                    qtd > 0
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex-1">
                    <span className="font-medium">{variacao.nome}</span>
                    <p className="text-sm font-bold text-primary">
                      R$ {variacao.preco.toFixed(2)}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {qtd > 0 ? (
                      <>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 rounded-full"
                          onClick={() => decrementar(variacao.nome)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-bold text-primary">{qtd}</span>
                        <Button
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={() => incrementar(variacao.nome)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => incrementar(variacao.nome)}
                        className="h-8"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Resumo */}
        {totalItens > 0 && (
          <div className="bg-muted/50 p-3 rounded-lg mt-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {totalItens} {totalItens === 1 ? 'item' : 'itens'} selecionado{totalItens > 1 ? 's' : ''}
              </span>
              <span className="font-bold text-primary">
                Total: R$ {totalValor.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleAddToCart}
            disabled={totalItens === 0}
            className="flex-1"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Adicionar ({totalItens})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}