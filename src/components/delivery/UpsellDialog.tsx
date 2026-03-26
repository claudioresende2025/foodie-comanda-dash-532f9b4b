import { useState, useEffect } from 'react';
import { Plus, Sparkles, ShoppingBag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UpsellProduct {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  imagem_url: string | null;
  categoria_nome?: string;
}

interface UpsellDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  cartProductIds: string[];
  onAddToCart: (product: UpsellProduct) => void;
  onContinue: () => void;
}

const UPSELL_CATEGORY_KEYWORDS = [
  'bebida', 'bebidas', 'drink', 'drinks',
  'refrigerante', 'refrigerantes', 'suco', 'sucos',
  'água', 'agua', 'sobremesa', 'sobremesas',
  'acompanhamento', 'acompanhamentos', 'extra', 'extras',
  'adicional', 'adicionais', 'porção', 'porções',
];

export function UpsellDialog({
  open,
  onOpenChange,
  empresaId,
  cartProductIds,
  onAddToCart,
  onContinue,
}: UpsellDialogProps) {
  const [products, setProducts] = useState<UpsellProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const addedCount = addedIds.size;

  useEffect(() => {
    if (!open || !empresaId) return;

    async function fetchUpsellProducts() {
      setIsLoading(true);
      try {
        const { data: categorias } = await supabase
          .from('categorias')
          .select('id, nome')
          .eq('empresa_id', empresaId);

        let upsellCategoryIds: string[] = [];
        if (categorias && categorias.length > 0) {
          upsellCategoryIds = categorias
            .filter(cat =>
              UPSELL_CATEGORY_KEYWORDS.some(keyword =>
                cat.nome.toLowerCase().includes(keyword)
              )
            )
            .map(cat => cat.id);
        }

        let query = supabase
          .from('produtos')
          .select(`id, nome, descricao, preco, imagem_url, categoria_id, categorias(nome)`)
          .eq('empresa_id', empresaId)
          .eq('ativo', true)
          .order('preco', { ascending: true })
          .limit(12);

        if (upsellCategoryIds.length > 0) {
          query = query.in('categoria_id', upsellCategoryIds);
        } else {
          query = query.lt('preco', 30);
        }

        const { data: prods, error } = await query;
        if (error) {
          console.error('[UpsellDialog] Erro:', error);
          return;
        }

        if (prods && prods.length > 0) {
          const filtered = prods
            .filter(p => !cartProductIds.includes(p.id))
            .map(p => ({
              id: p.id,
              nome: p.nome,
              descricao: p.descricao,
              preco: p.preco,
              imagem_url: p.imagem_url,
              categoria_nome: (p.categorias as any)?.nome || undefined,
            }))
            .slice(0, 8);
          setProducts(filtered);
        } else {
          setProducts([]);
        }
      } catch (err) {
        console.error('[UpsellDialog] Erro:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUpsellProducts();
  }, [open, empresaId, cartProductIds]);

  const handleAdd = (product: UpsellProduct) => {
    onAddToCart(product);
    setAddedIds(prev => new Set(prev).add(product.id));
    toast.success(`${product.nome} adicionado!`);
  };

  const handleContinue = () => {
    onOpenChange(false);
    onContinue();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0">
        {/* Header chamativo */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5 sm:rounded-t-lg">
          <DialogHeader>
            <DialogTitle className="text-white text-xl flex items-center gap-2">
              <Sparkles className="h-6 w-6" />
              Que tal completar seu pedido?
            </DialogTitle>
            <DialogDescription className="text-white/90 text-sm mt-1">
              Adicione acompanhamentos e bebidas antes de finalizar!
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Grid de produtos */}
        <div className="p-4 overflow-y-auto max-h-[55vh] sm:max-h-[50vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">Carregando sugestões...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">Nenhuma sugestão disponível</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {products.map((product) => {
                const isAdded = addedIds.has(product.id);
                return (
                  <div
                    key={product.id}
                    className={`relative bg-card rounded-xl border-2 overflow-hidden transition-all duration-200 ${
                      isAdded
                        ? 'border-green-500 shadow-md shadow-green-500/10'
                        : 'border-border hover:border-primary/40 hover:shadow-sm'
                    }`}
                  >
                    {isAdded && (
                      <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full h-5 w-5 flex items-center justify-center z-10">
                        <span className="text-xs font-bold">✓</span>
                      </div>
                    )}
                    {product.imagem_url ? (
                      <div className="h-24 w-full overflow-hidden">
                        <img
                          src={product.imagem_url}
                          alt={product.nome}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="h-24 w-full bg-muted flex items-center justify-center">
                        <ShoppingBag className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="p-2.5 space-y-1.5">
                      <p className="text-xs font-semibold text-foreground line-clamp-2 leading-tight">
                        {product.nome}
                      </p>
                      {product.categoria_nome && (
                        <p className="text-[10px] text-muted-foreground">
                          {product.categoria_nome}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-sm font-bold text-primary">
                          R$ {product.preco.toFixed(2)}
                        </span>
                        <Button
                          size="sm"
                          variant={isAdded ? 'secondary' : 'default'}
                          className="h-7 px-2 rounded-lg text-xs"
                          onClick={() => !isAdded && handleAdd(product)}
                          disabled={isAdded}
                        >
                          {isAdded ? 'Adicionado' : (
                            <>
                              <Plus className="h-3.5 w-3.5 mr-0.5" />
                              Adicionar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer com botões */}
        <div className="border-t p-4 space-y-2 bg-muted/30">
          {addedCount > 0 && (
            <p className="text-center text-sm text-green-600 font-medium">
              ✨ {addedCount} {addedCount === 1 ? 'item adicionado' : 'itens adicionados'} ao pedido!
            </p>
          )}
          <Button
            className="w-full h-12 text-base font-bold rounded-xl"
            onClick={handleContinue}
          >
            {addedCount > 0 ? 'Continuar para pagamento' : 'Continuar sem adicionar'}
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
