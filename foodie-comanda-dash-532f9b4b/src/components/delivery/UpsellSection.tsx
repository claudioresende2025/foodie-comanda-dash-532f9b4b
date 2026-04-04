import { useState, useEffect } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
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

interface UpsellSectionProps {
  empresaId: string;
  cartProductIds: string[]; // IDs dos produtos já no carrinho
  onAddToCart: (product: UpsellProduct) => void;
}

// Categorias típicas de upsell (acompanhamentos)
const UPSELL_CATEGORY_KEYWORDS = [
  'bebida', 'bebidas', 'drink', 'drinks',
  'refrigerante', 'refrigerantes', 'suco', 'sucos',
  'água', 'agua', 'sobremesa', 'sobremesas',
  'acompanhamento', 'acompanhamentos', 'extra', 'extras',
  'adicional', 'adicionais', 'porção', 'porções',
];

export function UpsellSection({ empresaId, cartProductIds, onAddToCart }: UpsellSectionProps) {
  const [products, setProducts] = useState<UpsellProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchUpsellProducts() {
      if (!empresaId) return;
      
      setIsLoading(true);
      try {
        // Buscar categorias que parecem ser de acompanhamento
        const { data: categorias } = await supabase
          .from('categorias')
          .select('id, nome')
          .eq('empresa_id', empresaId);

        let upsellCategoryIds: string[] = [];
        
        if (categorias && categorias.length > 0) {
          // Filtrar categorias que parecem ser de upsell
          upsellCategoryIds = categorias
            .filter(cat => 
              UPSELL_CATEGORY_KEYWORDS.some(keyword => 
                cat.nome.toLowerCase().includes(keyword)
              )
            )
            .map(cat => cat.id);
        }

        // Buscar produtos para upsell
        let query = supabase
          .from('produtos')
          .select(`
            id,
            nome,
            descricao,
            preco,
            imagem_url,
            categoria_id,
            categorias(nome)
          `)
          .eq('empresa_id', empresaId)
          .eq('ativo', true)
          .order('preco', { ascending: true })
          .limit(10);

        // Se encontrou categorias de upsell, filtrar por elas
        if (upsellCategoryIds.length > 0) {
          query = query.in('categoria_id', upsellCategoryIds);
        } else {
          // Senão, buscar produtos de menor valor (acompanhamentos típicos)
          query = query.lt('preco', 30); // Produtos abaixo de R$30
        }

        const { data: prods, error } = await query;

        if (error) {
          console.error('[Upsell] Erro ao buscar produtos:', error);
          return;
        }

        if (prods && prods.length > 0) {
          // Filtrar produtos que já estão no carrinho
          const filteredProducts = prods
            .filter(p => !cartProductIds.includes(p.id))
            .map(p => ({
              id: p.id,
              nome: p.nome,
              descricao: p.descricao,
              preco: p.preco,
              imagem_url: p.imagem_url,
              categoria_nome: (p.categorias as any)?.nome || undefined,
            }))
            .slice(0, 6); // Máximo 6 produtos

          setProducts(filteredProducts);
        }
      } catch (err) {
        console.error('[Upsell] Erro:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUpsellProducts();
  }, [empresaId, cartProductIds]);

  const handleAdd = (product: UpsellProduct) => {
    onAddToCart(product);
    setAddedIds(prev => new Set(prev).add(product.id));
    toast.success(`${product.nome} adicionado!`);
  };

  // Não mostrar nada se não houver produtos de upsell
  if (!isLoading && products.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-amber-500" />
        <h3 className="font-bold text-base text-primary">Que tal adicionar?</h3>
      </div>
      
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <p className="text-sm text-muted-foreground">Carregando sugestões...</p>
          </div>
        ) : (
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-3 pb-2">
              {products.map((product) => {
                const isAdded = addedIds.has(product.id);
                
                return (
                  <div
                    key={product.id}
                    className="flex-shrink-0 w-[140px] bg-white rounded-xl border shadow-sm overflow-hidden"
                  >
                    {product.imagem_url && (
                      <div className="h-20 w-full overflow-hidden">
                        <img
                          src={product.imagem_url}
                          alt={product.nome}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="p-2 space-y-1">
                      <p className="text-xs font-semibold text-foreground line-clamp-2 leading-tight">
                        {product.nome}
                      </p>
                      {product.categoria_nome && (
                        <p className="text-[10px] text-muted-foreground">
                          {product.categoria_nome}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-sm font-bold text-primary">
                          R$ {product.preco.toFixed(2)}
                        </span>
                        <Button
                          size="sm"
                          variant={isAdded ? "secondary" : "default"}
                          className="h-7 w-7 p-0 rounded-lg"
                          onClick={() => !isAdded && handleAdd(product)}
                          disabled={isAdded}
                        >
                          {isAdded ? (
                            <span className="text-xs">✓</span>
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
        
        <p className="text-xs text-muted-foreground text-center mt-2">
          Deslize para ver mais opções
        </p>
      </div>
    </div>
  );
}
