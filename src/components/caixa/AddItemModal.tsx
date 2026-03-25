import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Loader2, X, ShoppingBag, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Produto {
  id: string;
  nome: string;
  preco: number;
  imagem_url: string | null;
  categoria_id: string | null;
  categoria_nome?: string;
}

interface Categoria {
  id: string;
  nome: string;
}

interface AddItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  comandaId?: string | null;
  onItemAdded: (item: { produto_id: string; nome: string; preco: number; quantidade: number }) => void;
  mode: 'comanda' | 'avulsa'; // 'comanda' = adicionar à comanda existente, 'avulsa' = venda rápida
}

// Categorias de itens de caixa (geralmente ficam próximos do caixa)
const CAIXA_CATEGORY_KEYWORDS = [
  'bala', 'chiclete', 'doce', 'chocolate', 
  'picolé', 'sorvete', 'sobremesa',
  'água', 'refrigerante', 'bebida',
  'energético', 'suco',
];

export function AddItemModal({
  open,
  onOpenChange,
  empresaId,
  comandaId,
  onItemAdded,
  mode,
}: AddItemModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('rapido');
  const [addingProductId, setAddingProductId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !empresaId) return;

    async function fetchData() {
      setIsLoading(true);
      try {
        // Buscar categorias
        const { data: cats } = await supabase
          .from('categorias')
          .select('id, nome')
          .eq('empresa_id', empresaId)
          .eq('ativo', true)
          .order('ordem');

        setCategorias(cats || []);

        // Buscar produtos
        const { data: prods, error } = await supabase
          .from('produtos')
          .select('id, nome, preco, imagem_url, categoria_id')
          .eq('empresa_id', empresaId)
          .eq('ativo', true)
          .order('nome');

        if (error) throw error;

        if (prods && cats) {
          const prodsWithCategory = prods.map(p => ({
            ...p,
            categoria_nome: cats.find(c => c.id === p.categoria_id)?.nome || 'Outros',
          }));
          setProdutos(prodsWithCategory);
        }
      } catch (err) {
        console.error('[AddItemModal] Erro:', err);
        toast.error('Erro ao carregar produtos');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [open, empresaId]);

  // Filtrar produtos de acesso rápido (itens de caixa)
  const produtosRapidos = useMemo(() => {
    return produtos.filter(p => {
      const nome = p.nome.toLowerCase();
      const categoria = p.categoria_nome?.toLowerCase() || '';
      return CAIXA_CATEGORY_KEYWORDS.some(keyword => 
        nome.includes(keyword) || categoria.includes(keyword)
      );
    }).slice(0, 20);
  }, [produtos]);

  // Filtrar produtos por busca
  const produtosFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return produtos.filter(p => 
      p.nome.toLowerCase().includes(term) ||
      p.categoria_nome?.toLowerCase().includes(term)
    ).slice(0, 30);
  }, [produtos, searchTerm]);

  // Agrupar produtos por categoria
  const produtosPorCategoria = useMemo(() => {
    const grouped: Record<string, Produto[]> = {};
    produtos.forEach(p => {
      const cat = p.categoria_nome || 'Outros';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });
    return grouped;
  }, [produtos]);

  const handleAddItem = async (produto: Produto) => {
    setAddingProductId(produto.id);

    try {
      if (mode === 'comanda' && comandaId) {
        // Adicionar à comanda existente
        const { error } = await supabase.from('pedidos').insert({
          comanda_id: comandaId,
          produto_id: produto.id,
          quantidade: 1,
          preco_unitario: produto.preco,
          subtotal: produto.preco,
          status_cozinha: 'pronto', // Já está pronto pq é item de balcão
        });

        if (error) throw error;

        // Atualizar total da comanda
        const { data: comanda } = await supabase
          .from('comandas')
          .select('total')
          .eq('id', comandaId)
          .single();

        if (comanda) {
          await supabase
            .from('comandas')
            .update({ total: (comanda.total || 0) + produto.preco })
            .eq('id', comandaId);
        }

        toast.success(`${produto.nome} adicionado à comanda!`);
      }

      // Callback para atualizar a UI
      onItemAdded({
        produto_id: produto.id,
        nome: produto.nome,
        preco: produto.preco,
        quantidade: 1,
      });

      if (mode === 'avulsa') {
        toast.success(`${produto.nome} adicionado à venda avulsa!`);
      }
    } catch (err) {
      console.error('[AddItemModal] Erro ao adicionar:', err);
      toast.error('Erro ao adicionar item');
    } finally {
      setAddingProductId(null);
    }
  };

  const renderProductGrid = (items: Produto[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map(produto => (
        <div
          key={produto.id}
          className="border rounded-lg p-3 hover:border-primary cursor-pointer transition-colors relative"
          onClick={() => !addingProductId && handleAddItem(produto)}
        >
          {produto.imagem_url && (
            <div className="h-16 w-full overflow-hidden rounded-md mb-2">
              <img
                src={produto.imagem_url}
                alt={produto.nome}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}
          <p className="text-sm font-medium line-clamp-2">{produto.nome}</p>
          <p className="text-xs text-muted-foreground">{produto.categoria_nome}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="font-bold text-primary">R$ {produto.preco.toFixed(2)}</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              disabled={!!addingProductId}
            >
              {addingProductId === produto.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'comanda' ? (
              <>
                <ShoppingBag className="h-5 w-5 text-primary" />
                Adicionar Item à Comanda
              </>
            ) : (
              <>
                <Package className="h-5 w-5 text-green-600" />
                Venda Avulsa
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === 'comanda'
              ? 'Adicione itens de última hora à comanda do cliente'
              : 'Registre uma venda rápida de balcão'}
          </DialogDescription>
        </DialogHeader>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            autoFocus
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setSearchTerm('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : searchTerm.trim() ? (
          // Resultados da busca
          <ScrollArea className="h-[400px] pr-4">
            {produtosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Nenhum produto encontrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">
                  {produtosFiltrados.length} produto(s) encontrado(s)
                </p>
                {renderProductGrid(produtosFiltrados)}
              </div>
            )}
          </ScrollArea>
        ) : (
          // Tabs: Acesso Rápido / Por Categoria
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="rapido">⚡ Acesso Rápido</TabsTrigger>
              <TabsTrigger value="categorias">📂 Por Categoria</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[400px] pr-4 mt-4">
              <TabsContent value="rapido" className="mt-0">
                {produtosRapidos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Package className="h-12 w-12 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">
                      Nenhum item de acesso rápido encontrado
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cadastre produtos com categorias como "Bebidas", "Doces", etc.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground mb-3">
                      Itens comuns de balcão para adicionar rapidamente
                    </p>
                    {renderProductGrid(produtosRapidos)}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="categorias" className="mt-0 space-y-6">
                {Object.entries(produtosPorCategoria).map(([categoria, prods]) => (
                  <div key={categoria}>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline">{categoria}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {prods.length} produto(s)
                      </span>
                    </div>
                    {renderProductGrid(prods.slice(0, 6))}
                  </div>
                ))}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
