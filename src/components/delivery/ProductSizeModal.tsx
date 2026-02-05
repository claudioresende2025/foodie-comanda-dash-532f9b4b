import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ShoppingCart } from 'lucide-react';

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
  onAddToCart: (tamanho: string, preco: number) => void;
}

export function ProductSizeModal({
  product,
  open,
  onOpenChange,
  onAddToCart,
}: ProductSizeModalProps) {
  const [selectedSize, setSelectedSize] = useState<string>('');

  const variacoes = product.variacoes || [];
  
  const selectedVariacao = variacoes.find(v => v.nome === selectedSize);

  const handleAddToCart = () => {
    if (!selectedSize || !selectedVariacao) return;
    onAddToCart(selectedSize, selectedVariacao.preco);
    setSelectedSize('');
    onOpenChange(false);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedSize('');
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{product.nome}</DialogTitle>
          <DialogDescription>
            Selecione o tamanho desejado
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
          <Label className="text-base font-semibold">Escolha o tamanho:</Label>
          
          <RadioGroup
            value={selectedSize}
            onValueChange={setSelectedSize}
            className="space-y-2"
          >
            {variacoes.map((variacao) => (
              <label
                key={variacao.nome}
                className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedSize === variacao.nome
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={variacao.nome} id={variacao.nome} />
                  <span className="font-medium">{variacao.nome}</span>
                </div>
                <span className="font-bold text-primary">
                  R$ {variacao.preco.toFixed(2)}
                </span>
              </label>
            ))}
          </RadioGroup>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleAddToCart}
            disabled={!selectedSize}
            className="flex-1"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Adicionar
            {selectedVariacao && (
              <span className="ml-1">• R$ {selectedVariacao.preco.toFixed(2)}</span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
