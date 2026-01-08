import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, Plus, Minus, ShoppingCart, ChefHat, Send, 
  Search, Bell, Clock, CheckCircle2, X, Volume2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input'; // Faltava
import { Badge } from '@/components/ui/badge'; // Faltava
import { Textarea } from '@/components/ui/textarea'; // Faltava
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'; // Faltava
import { toast } from 'sonner';

// --- Tipos ---
type Empresa = { id: string; nome_fantasia: string; logo_url: string | null };
type Categoria = { id: string; nome: string; ordem: number };
type Produto = { id: string; nome: string; descricao: string | null; preco: number; imagem_url: string | null; categoria_id: string | null; ativo: boolean };
type CartItem = { produto: Produto; quantidade: number; notas: string };
type PedidoNoHistorico = { id: string; status_cozinha: string; quantidade: number; produtos: { nome: string } };

export default function Menu() {
  const { empresaId, mesaId } = useParams<{ empresaId: string; mesaId: string }>();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [mesaNome, setMesaNome] = useState<string>("");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null);
  
  // --- Novos Estados (do Código 2) ---
  const [searchQuery, setSearchQuery] = useState("");
  const [comandaId, setComandaId] = useState<string | null>(null);
  const [meusPedidos, setMeusPedidos] = useState<any[]>([]);
  const [isCallingWaiter, setIsCallingWaiter] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!empresaId || !mesaId) return;

      try {
        const [empRes, catRes, prodRes, mesaRes] = await Promise.all([
          supabase.from('empresas').select('id, nome_fantasia, logo_url').eq('id', empresaId).single(),
          supabase.from('categorias').select('*').eq('empresa_id', empresaId).eq('ativo', true).order('ordem'),
          supabase.from('produtos').select('*').eq('empresa_id', empresaId).eq('ativo', true).order('nome'),
          supabase.from('mesas').select('numero_mesa').eq('id', mesaId).maybeSingle(),
        ]);

        setEmpresa(empRes.data);
        setCategorias(catRes.data || []);
        setProdutos(prodRes.data || []);
        if (mesaRes.data) setMesaNome(mesaRes.data.numero_mesa.toString());

        // Recuperar comanda salva no navegador (Persistência)
        const savedComanda = localStorage.getItem(`comanda_${mesaId}`);
        if (savedComanda) {
          setComandaId(savedComanda);
          fetchHistorico(savedComanda);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [empresaId, mesaId]);

  // --- Realtime (Código 2) ---
  useEffect(() => {
    if (!comandaId) return;

    const channel = supabase
      .channel('monitor-pedidos')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'pedidos', 
        filter: `comanda_id=eq.${comandaId}` 
      }, (payload) => {
        if (payload.new.status_cozinha === 'pronto') {
          new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => {});
          toast.success("🔔 Seu pedido está pronto!");
        }
        fetchHistorico(comandaId);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [comandaId]);

  const fetchHistorico = async (id: string) => {
    const { data } = await supabase
      .from('pedidos')
      .select('id, status_cozinha, quantidade, produtos(nome)')
      .eq('comanda_id', id)
      .order('created_at', { ascending: false });
    setMeusPedidos(data || []);
  };

  const handleCallWaiter = async () => {
    setIsCallingWaiter(true);
    const { error } = await supabase.from('chamadas_garcom').insert({
      empresa_id: empresaId,
      mesa_id: mesaId,
      status: 'pendente'
    });
    if (!error) toast.success("Garçom chamado!");
    setIsCallingWaiter(false);
  };

  const addToCart = (produto: Produto) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.produto.id === produto.id);
      if (existing) return prev.map((item) => item.produto.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item);
      return [...prev, { produto, quantidade: 1, notas: '' }];
    });
    toast.success(`${produto.nome} adicionado`);
  };

  const removeFromCart = (produtoId: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.produto.id === produtoId);
      if (existing && existing.quantidade > 1) return prev.map((item) => item.produto.id === produtoId ? { ...item, quantidade: item.quantidade - 1 } : item);
      return prev.filter((item) => item.produto.id !== produtoId);
    });
  };

  const totalCart = cart.reduce((sum, item) => sum + item.produto.preco * item.quantidade, 0);

  const enviarPedido = async () => {
    if (cart.length === 0 || !mesaId || !empresaId) return;
    setIsSending(true);
    try {
      let currentComandaId = comandaId;

      if (!currentComandaId) {
        const { data: novaComanda, error: errC } = await supabase
          .from('comandas')
          .insert({ empresa_id: empresaId, mesa_id: mesaId, status: 'aberta' })
          .select().single();
        if (errC) throw errC;
        currentComandaId = novaComanda.id;
        setComandaId(currentComandaId);
        localStorage.setItem(`comanda_${mesaId}`, currentComandaId);
        await supabase.from('mesas').update({ status: 'ocupada' }).eq('id', mesaId);
      }

      const pedidos = cart.map((item) => ({
        comanda_id: currentComandaId,
        produto_id: item.produto.id,
        quantidade: item.quantidade,
        preco_unitario: item.produto.preco,
        subtotal: item.produto.preco * item.quantidade,
        notas_cliente: item.notas || null,
        status_cozinha: 'pendente',
      }));

      const { error: pedidoError } = await supabase.from('pedidos').insert(pedidos);
      if (pedidoError) throw pedidoError;

      setCart([]);
      toast.success('Pedido enviado com sucesso!');
      fetchHistorico(currentComandaId);
    } catch (error) {
      toast.error('Erro ao enviar pedido');
    } finally {
      setIsSending(false);
    }
  };

  const produtosFiltrados = produtos.filter(p => 
    (categoriaAtiva ? p.categoria_id === categoriaAtiva : true) &&
    (p.nome.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <header className="bg-primary text-primary-foreground p-4 sticky top-0 z-30 shadow-md">
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          <div>
            <h1 className="text-xl font-bold">{empresa?.nome_fantasia}</h1>
            <p className="text-sm opacity-90">Mesa {mesaNome || "..."}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={handleCallWaiter} disabled={isCallingWaiter}>
            <Bell className="w-4 h-4 mr-2" /> Garçom
          </Button>
        </div>
      </header>

      <div className="p-4 max-w-4xl mx-auto space-y-4">
        {/* Busca (Faltava no Código 1) */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar produto..." 
            className="pl-10 bg-white" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Categorias */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <Button variant={categoriaAtiva === null ? 'default' : 'outline'} size="sm" onClick={() => setCategoriaAtiva(null)}>Todos</Button>
          {categorias.map((cat) => (
            <Button key={cat.id} variant={categoriaAtiva === cat.id ? 'default' : 'outline'} size="sm" onClick={() => setCategoriaAtiva(cat.id)}>{cat.nome}</Button>
          ))}
        </div>
      </div>

      <main className="p-4 max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
        {produtosFiltrados.map((produto) => (
          <Card key={produto.id} className="shadow-sm border-0 flex h-28 overflow-hidden">
            <div className="w-28 bg-muted">
              {produto.imagem_url && <img src={produto.imagem_url} className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 p-3 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm">{produto.nome}</h3>
                <p className="text-xs text-muted-foreground line-clamp-1">{produto.descricao}</p>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-primary">R$ {produto.preco.toFixed(2)}</span>
                <Button size="icon" className="h-8 w-8" onClick={() => addToCart(produto)}><Plus className="w-4 h-4" /></Button>
              </div>
            </div>
          </Card>
        ))}
      </main>

      {/* Footer Carrinho e Histórico (Faltava Meus Pedidos no 1) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-40">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          
          {/* Histórico Lateral (Sheet) */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="relative">
                <Clock className="w-5 h-5 mr-2" /> Meus Pedidos
                {meusPedidos.length > 0 && <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">{meusPedidos.length}</span>}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader><SheetTitle>Meus Pedidos - Mesa {mesaNome}</SheetTitle></SheetHeader>
              <div className="mt-6 space-y-4">
                {meusPedidos.map((p, i) => (
                  <div key={i} className="flex justify-between items-center p-3 border rounded-lg bg-gray-50">
                    <div>
                      <p className="text-sm font-bold">{p.quantidade}x {p.produtos?.nome}</p>
                      <Badge variant="secondary" className="text-[10px] mt-1">{p.status_cozinha}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>

          {/* Carrinho (Faltava Observações no 1) */}
          <Sheet>
            <SheetTrigger asChild>
              <Button disabled={cart.length === 0} className="bg-primary px-8">
                <ShoppingCart className="w-4 h-4 mr-2" /> Ver Carrinho (R$ {totalCart.toFixed(2)})
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh]">
              <SheetHeader><SheetTitle>Seu Carrinho</SheetTitle></SheetHeader>
              <div className="mt-4 space-y-4 overflow-y-auto h-[50vh] pr-2">
                {cart.map((item, i) => (
                  <div key={i} className="space-y-2 p-3 border rounded-lg">
                    <div className="flex justify-between font-bold">
                      <span>{item.quantidade}x {item.produto.nome}</span>
                      <span>R$ {(item.produto.preco * item.quantidade).toFixed(2)}</span>
                    </div>
                    <Textarea 
                      placeholder="Alguma observação? (ex: sem cebola)" 
                      className="text-xs"
                      value={item.notas}
                      onChange={(e) => {
                        const newCart = [...cart];
                        newCart[i].notas = e.target.value;
                        setCart(newCart);
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-6 border-t pt-4">
                <div className="flex justify-between text-xl font-bold mb-4">
                  <span>Total</span>
                  <span>R$ {totalCart.toFixed(2)}</span>
                </div>
                <Button className="w-full h-12" onClick={enviarPedido} disabled={isSending}>
                  {isSending ? <Loader2 className="animate-spin" /> : "Confirmar Pedido"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
}
