import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, Minus, ShoppingCart, ChefHat, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

type Empresa = {
  id: string;
  nome_fantasia: string;
  logo_url: string | null;
};

type Categoria = {
  id: string;
  nome: string;
  ordem: number;
};

type Produto = {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  imagem_url: string | null;
  categoria_id: string | null;
  ativo: boolean;
};

type CartItem = {
  produto: Produto;
  quantidade: number;
  notas: string;
};

export default function Menu() {
  const { empresaId, mesaId } = useParams<{ empresaId: string; mesaId: string }>();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null);
  const [numeroMesa, setNumeroMesa] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!empresaId) return;

      const [empRes, catRes, prodRes] = await Promise.all([
        supabase.from('empresas').select('id, nome_fantasia, logo_url').eq('id', empresaId).single(),
        supabase.from('categorias').select('*').eq('empresa_id', empresaId).eq('ativo', true).order('ordem'),
        supabase.from('produtos').select('*').eq('empresa_id', empresaId).eq('ativo', true).order('nome'),
      ]);

      setEmpresa(empRes.data);
      setCategorias(catRes.data || []);
      setProdutos(prodRes.data || []);

      // Buscar número da mesa pelo ID
      if (mesaId) {
        const { data: mesa } = await supabase
          .from('mesas')
          .select('numero_mesa')
          .eq('id', mesaId)
          .maybeSingle();
        
        if (mesa) {
          setNumeroMesa(mesa.numero_mesa);
        }
      }

      setIsLoading(false);
    };
    fetchData();
  }, [empresaId, mesaId]);

  const addToCart = (produto: Produto) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.produto.id === produto.id);
      if (existing) {
        return prev.map((item) =>
          item.produto.id === produto.id
            ? { ...item, quantidade: item.quantidade + 1 }
            : item
        );
      }
      return [...prev, { produto, quantidade: 1, notas: '' }];
    });
    toast.success(`${produto.nome} adicionado`);
  };

  const removeFromCart = (produtoId: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.produto.id === produtoId);
      if (existing && existing.quantidade > 1) {
        return prev.map((item) =>
          item.produto.id === produtoId
            ? { ...item, quantidade: item.quantidade - 1 }
            : item
        );
      }
      return prev.filter((item) => item.produto.id !== produtoId);
    });
  };

  const getCartQuantity = (produtoId: string) => {
    const item = cart.find((c) => c.produto.id === produtoId);
    return item?.quantidade || 0;
  };

  const totalCart = cart.reduce(
    (sum, item) => sum + item.produto.preco * item.quantidade,
    0
  );

  const enviarPedido = async () => {
    if (cart.length === 0 || !mesaId || !empresaId) return;

    setIsSending(true);
    try {
      // Buscar mesa pelo ID (UUID)
      const { data: mesa } = await supabase
        .from('mesas')
        .select('id')
        .eq('id', mesaId)
        .maybeSingle();

      if (!mesa) {
        toast.error('Mesa não encontrada');
        setIsSending(false);
        return;
      }

      // Criar ou buscar comanda aberta
      let { data: comanda } = await supabase
        .from('comandas')
        .select('id')
        .eq('mesa_id', mesa.id)
        .eq('status', 'aberta')
        .single();

      if (!comanda) {
        const { data: novaComanda, error: comandaError } = await supabase
          .from('comandas')
          .insert({
            empresa_id: empresaId,
            mesa_id: mesa.id,
            status: 'aberta',
          })
          .select('id')
          .single();

        if (comandaError) throw comandaError;
        comanda = novaComanda;
      }

      // Atualizar mesa para ocupada
      await supabase
        .from('mesas')
        .update({ status: 'ocupada' })
        .eq('id', mesa.id);

      // Inserir pedidos
      const pedidos = cart.map((item) => ({
        comanda_id: comanda!.id,
        produto_id: item.produto.id,
        quantidade: item.quantidade,
        preco_unitario: item.produto.preco,
        subtotal: item.produto.preco * item.quantidade,
        notas_cliente: item.notas || null,
        status_cozinha: 'pendente' as const,
      }));

      const { error: pedidoError } = await supabase.from('pedidos').insert(pedidos);
      if (pedidoError) throw pedidoError;

      setCart([]);
      toast.success('Pedido enviado com sucesso!');
    } catch (error) {
      console.error('Erro ao enviar pedido:', error);
      toast.error('Erro ao enviar pedido');
    } finally {
      setIsSending(false);
    }
  };

  const produtosFiltrados = categoriaAtiva
    ? produtos.filter((p) => p.categoria_id === categoriaAtiva)
    : produtos;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-4 sticky top-0 z-10 shadow-md">
        <h1 className="text-xl font-bold">{empresa?.nome_fantasia}</h1>
        <p className="text-sm opacity-90">Mesa {numeroMesa || '-'}</p>
      </header>

      {/* Categorias */}
      {categorias.length > 0 && (
        <div className="bg-white sticky top-[72px] z-10 border-b overflow-x-auto">
          <div className="flex gap-2 p-3">
            <Button
              variant={categoriaAtiva === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoriaAtiva(null)}
            >
              Todos
            </Button>
            {categorias.map((cat) => (
              <Button
                key={cat.id}
                variant={categoriaAtiva === cat.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategoriaAtiva(cat.id)}
              >
                {cat.nome}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Produtos em Grid */}
      <main className="p-4">
        {produtosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <ChefHat className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum produto disponível</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {produtosFiltrados.map((produto) => {
              const qtd = getCartQuantity(produto.id);
              return (
                <Card key={produto.id} className="shadow-md border-0 overflow-hidden">
                  <div className="aspect-video bg-muted overflow-hidden">
                    {produto.imagem_url ? (
                      <img
                        src={produto.imagem_url}
                        alt={produto.nome}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ChefHat className="w-12 h-12 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-foreground">{produto.nome}</h3>
                    {produto.descricao && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {produto.descricao}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-lg font-bold text-primary">
                        R$ {produto.preco.toFixed(2)}
                      </span>
                      {qtd > 0 ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => removeFromCart(produto.id)}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="font-semibold w-6 text-center">{qtd}</span>
                          <Button
                            size="icon"
                            className="h-8 w-8 bg-primary"
                            onClick={() => addToCart(produto)}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          className="bg-primary hover:bg-primary/90"
                          onClick={() => addToCart(produto)}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Adicionar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Carrinho Fixo */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-20">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart className="w-6 h-6 text-primary" />
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {cart.reduce((sum, item) => sum + item.quantidade, 0)}
                </span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="font-bold text-lg">R$ {totalCart.toFixed(2)}</p>
              </div>
            </div>
            <Button
              className="bg-primary hover:bg-primary/90"
              onClick={enviarPedido}
              disabled={isSending}
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Enviar Pedido
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
