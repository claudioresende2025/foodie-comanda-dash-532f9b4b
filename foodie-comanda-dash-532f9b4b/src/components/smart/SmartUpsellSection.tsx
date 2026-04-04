import { useState, useEffect, useMemo } from 'react';
import { Plus, Sparkles, TrendingUp, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UpsellProduct {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  imagem_url: string | null;
  categoria_id: string | null;
  categoria_nome?: string;
  relevancia?: number; // Score de relevância baseado no carrinho
  razao?: string; // Razão da sugestão
}

interface CartItem {
  produto_id?: string;
  produto?: { id: string; nome: string };
  nome?: string;
  categoria_id?: string;
}

interface SmartUpsellSectionProps {
  empresaId: string;
  cartItems: CartItem[]; // Itens no carrinho para análise
  cartProductIds: string[]; // IDs dos produtos já no carrinho
  onAddToCart: (product: UpsellProduct) => void;
  title?: string;
  maxItems?: number;
}

// ========================================
// REGRAS DE UPSELL INTELIGENTE
// ========================================

// Categorias de complementos por tipo de item
const COMPLEMENTO_RULES: Record<string, string[]> = {
  // Pizza → Bebidas, Bordas recheadas
  pizza: ['bebida', 'refrigerante', 'suco', 'cerveja', 'água', 'borda'],
  // Hamburguer → Batata, Bebidas, Sobremesas
  hamburguer: ['batata', 'fritas', 'onion', 'bebida', 'refrigerante', 'milk shake', 'sorvete'],
  burger: ['batata', 'fritas', 'onion', 'bebida', 'refrigerante', 'milk shake', 'sorvete'],
  lanche: ['batata', 'fritas', 'onion', 'bebida', 'refrigerante', 'milk shake'],
  sanduíche: ['batata', 'fritas', 'bebida', 'suco'],
  // Prato principal → Sobremesas, Bebidas
  prato: ['sobremesa', 'bebida', 'refrigerante', 'suco', 'café'],
  refeição: ['sobremesa', 'bebida', 'refrigerante', 'suco', 'café'],
  // Bebida → Petiscos, Porções
  bebida: ['porção', 'petisco', 'batata', 'fritas'],
  cerveja: ['porção', 'petisco', 'batata', 'fritas', 'amendoim'],
  // Café → Doces
  café: ['bolo', 'torta', 'pão de queijo', 'croissant'],
  // Açaí → Adicionais
  açaí: ['granola', 'banana', 'morango', 'leite condensado'],
};

// Categorias de itens de finalização (sempre sugerir)
const FINALIZACAO_KEYWORDS = [
  'chiclete', 'bala', 'picolé', 'sorvete', 'chocolate',
  'água', 'refrigerante', 'café expresso', 'bombom',
];

// Pesos de relevância
const RELEVANCIA_COMPLEMENTO_DIRETO = 100;
const RELEVANCIA_MESMA_CATEGORIA = 50;
const RELEVANCIA_FINALIZACAO = 80;
const RELEVANCIA_POPULAR = 30;

export function SmartUpsellSection({
  empresaId,
  cartItems,
  cartProductIds,
  onAddToCart,
  title = "Que tal adicionar?",
  maxItems = 8,
}: SmartUpsellSectionProps) {
  const [allProducts, setAllProducts] = useState<UpsellProduct[]>([]);
  const [categorias, setCategorias] = useState<{ id: string; nome: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  // Buscar todos os produtos e categorias
  useEffect(() => {
    async function fetchProducts() {
      if (!empresaId) return;

      setIsLoading(true);
      try {
        // Buscar categorias
        const { data: cats } = await supabase
          .from('categorias')
          .select('id, nome')
          .eq('empresa_id', empresaId)
          .eq('ativo', true);

        setCategorias(cats || []);

        // Buscar produtos
        const { data: prods, error } = await supabase
          .from('produtos')
          .select(`
            id,
            nome,
            descricao,
            preco,
            imagem_url,
            categoria_id
          `)
          .eq('empresa_id', empresaId)
          .eq('ativo', true)
          .order('preco', { ascending: true });

        if (error) {
          console.error('[SmartUpsell] Erro ao buscar produtos:', error);
          return;
        }

        if (prods) {
          const prodsWithCategory = prods.map(p => ({
            ...p,
            categoria_nome: cats?.find(c => c.id === p.categoria_id)?.nome || undefined,
          }));
          setAllProducts(prodsWithCategory);
        }
      } catch (err) {
        console.error('[SmartUpsell] Erro:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProducts();
  }, [empresaId]);

  // Calcular sugestões inteligentes baseadas no carrinho
  const smartSuggestions = useMemo(() => {
    if (allProducts.length === 0) return [];

    // Extrair nomes dos itens do carrinho para análise
    const cartItemNames = cartItems.map(item => {
      const nome = item.nome || item.produto?.nome || '';
      return nome.toLowerCase();
    });

    // Extrair categoria IDs do carrinho
    const cartCategoryIds = cartItems
      .map(item => item.categoria_id)
      .filter(Boolean) as string[];

    // Produtos disponíveis (não estão no carrinho)
    const availableProducts = allProducts.filter(p => !cartProductIds.includes(p.id));

    // Calcular relevância para cada produto
    const scoredProducts = availableProducts.map(product => {
      let relevancia = 0;
      let razao = '';
      const produtoNome = product.nome.toLowerCase();
      const categoriaNome = product.categoria_nome?.toLowerCase() || '';

      // 1. Verificar se é complemento direto de algum item do carrinho
      for (const cartItemName of cartItemNames) {
        for (const [trigger, complementos] of Object.entries(COMPLEMENTO_RULES)) {
          if (cartItemName.includes(trigger)) {
            for (const complemento of complementos) {
              if (produtoNome.includes(complemento) || categoriaNome.includes(complemento)) {
                relevancia += RELEVANCIA_COMPLEMENTO_DIRETO;
                razao = `Combina com ${cartItemName}`;
                break;
              }
            }
          }
        }
      }

      // 2. Verificar se é item de finalização (sempre relevante)
      for (const keyword of FINALIZACAO_KEYWORDS) {
        if (produtoNome.includes(keyword)) {
          relevancia += RELEVANCIA_FINALIZACAO;
          if (!razao) razao = 'Para finalizar';
          break;
        }
      }

      // 3. Verificar produtos populares (preço baixo = geralmente complementos)
      if (product.preco <= 15) {
        relevancia += RELEVANCIA_POPULAR;
        if (!razao) razao = 'Popular';
      }

      // 4. Mesma categoria pode ser interessante (acompanhamento)
      if (cartCategoryIds.includes(product.categoria_id!)) {
        relevancia += RELEVANCIA_MESMA_CATEGORIA / 2; // Menor peso pq pode ser redundante
      }

      return {
        ...product,
        relevancia,
        razao: razao || 'Sugestão',
      };
    });

    // Ordenar por relevância e retornar top N
    return scoredProducts
      .filter(p => p.relevancia > 0)
      .sort((a, b) => b.relevancia - a.relevancia)
      .slice(0, maxItems);
  }, [allProducts, cartItems, cartProductIds, maxItems]);

  // Se não há sugestões inteligentes, mostrar produtos de baixo custo
  const displayProducts = useMemo(() => {
    if (smartSuggestions.length >= 3) return smartSuggestions;

    // Fallback: produtos de baixo custo que não estão no carrinho
    const fallbackProducts = allProducts
      .filter(p => !cartProductIds.includes(p.id) && p.preco <= 20)
      .slice(0, maxItems - smartSuggestions.length)
      .map(p => ({
        ...p,
        relevancia: RELEVANCIA_POPULAR,
        razao: 'Sugestão',
      }));

    return [...smartSuggestions, ...fallbackProducts].slice(0, maxItems);
  }, [smartSuggestions, allProducts, cartProductIds, maxItems]);

  const handleAdd = (product: UpsellProduct) => {
    onAddToCart(product);
    setAddedIds(prev => new Set(prev).add(product.id));
    toast.success(`${product.nome} adicionado!`);
  };

  // Não mostrar nada se não houver produtos de upsell
  if (!isLoading && displayProducts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-amber-500" />
        <h3 className="font-bold text-base text-primary">{title}</h3>
        {smartSuggestions.length > 0 && (
          <Badge variant="secondary" className="text-xs flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Inteligente
          </Badge>
        )}
      </div>

      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <p className="text-sm text-muted-foreground">Carregando sugestões...</p>
          </div>
        ) : (
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-3 pb-2">
              {displayProducts.map((product) => {
                const isAdded = addedIds.has(product.id);

                return (
                  <div
                    key={product.id}
                    className="flex-shrink-0 w-[140px] bg-white dark:bg-card rounded-xl border shadow-sm overflow-hidden"
                  >
                    {product.imagem_url && (
                      <div className="h-20 w-full overflow-hidden relative">
                        <img
                          src={product.imagem_url}
                          alt={product.nome}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {product.relevancia && product.relevancia >= RELEVANCIA_COMPLEMENTO_DIRETO && (
                          <div className="absolute top-1 right-1">
                            <Badge className="bg-green-500 text-white text-[10px] px-1 py-0">
                              <TrendingUp className="h-3 w-3 mr-0.5" />
                              Combina
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="p-2 space-y-1">
                      <p className="text-xs font-semibold text-foreground line-clamp-2 leading-tight">
                        {product.nome}
                      </p>
                      {product.razao && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                          {product.razao}
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
          Deslize para ver mais sugestões
        </p>
      </div>
    </div>
  );
}
