import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, ChefHat, UtensilsCrossed, Search, ShoppingCart, 
  Plus, Minus, Clock, CheckCircle2, X, Bell, 
  Volume2, History
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

type Categoria = { id: string; nome: string; descricao: string | null; ordem: number; };
type Produto = { id: string; nome: string; descricao: string | null; preco: number; imagem_url: string | null; categoria_id: string | null; ativo: boolean; };
type Empresa = { id: string; nome_fantasia: string; logo_url: string | null; };
type CartItem = { produto: Produto; quantidade: number; notas: string; };
type Pedido = { id: string; produto_id: string; quantidade: number; status_cozinha: 'pendente' | 'preparando' | 'pronto' | 'entregue' | 'cancelado'; notas_cliente: string | null; created_at: string; };

const statusConfig = {
  pendente: { label: 'Aguardando', color: 'bg-yellow-500', icon: Clock },
  preparando: { label: 'Preparando', color: 'bg-blue-500', icon: ChefHat },
  pronto: { label: 'Pronto', color: 'bg-green-500', icon: CheckCircle2 },
  entregue: { label: 'Entregue', color: 'bg-gray-500', icon: CheckCircle2 },
  cancelado: { label: 'Cancelado', color: 'bg-red-500', icon: X },
};

export default function Menu() {
  const { empresaId, mesaId } = useParams<{ empresaId: string; mesaId: string }>();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [mesaNumero, setMesaNumero] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [comandaId, setComandaId] = useState<string | null>(null);
  const [meusPedidos, setMeusPedidos] = useState<Pedido[]>([]);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const [isSendingOrder, setIsSendingOrder] = useState(false);
  const [isCallingWaiter, setIsCallingWaiter] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => { 
    if (empresaId) fetchMenuData(); 
  }, [empresaId, mesaId]);
  
  useEffect(() => {
    const savedComandaId = localStorage.getItem(`comanda_${empresaId}_${mesaId}`);
    if (savedComandaId) {
      setComandaId(savedComandaId);
      fetchMeusPedidos(savedComandaId);
    }
  }, [empresaId, mesaId]);

  const fetchMenuData = async () => {
    try {
      const { data: emp } = await supabase.from('empresas').select('*').eq('id', empresaId).single();
      setEmpresa(emp);
      const { data: mesa } = await supabase.from('mesas').select('*').eq('id', mesaId).single();
      setMesaNumero(mesa?.numero_mesa);
      const { data: cats } = await supabase.from('categorias').select('*').eq('empresa_id', empresaId).order('ordem');
      setCategorias(cats || []);
      const { data: prods } = await supabase.from('produtos').select('*').eq('empresa_id', empresaId).eq('ativo', true);
      setProdutos(prods || []);
    } catch (err) { 
      setError('Erro ao carregar dados'); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const fetchMeusPedidos = async (id: string) => {
    const { data } = await supabase.from('pedidos').select('*').eq('comanda_id', id).order('created_at', { ascending: false });
    setMeusPedidos(data || []);
  };

  const handleCallWaiter = async () => {
    if (!empresaId || !mesaId) return;
    setIsCallingWaiter(true);
    try {
      await supabase.from('chamadas_garcom').insert({
        empresa_id: empresaId,
        mesa_id: mesaId,
        comanda_id: comandaId,
        status: 'pendente'
      });
      toast.success('Garçom chamado! Aguarde...');
    } catch (err) {
      toast.error('Erro ao chamar garçom');
    } finally {
      setIsCallingWaiter(false);
    }
  };

  const handleSendOrder = async () => {
    if (cart.length === 0) return toast.error('Seu carrinho está vazio');
    setIsSendingOrder(true);
    try {
      let currentComandaId = comandaId;
      const cartTotal = cart.reduce((acc, item) => acc + (item.produto.preco * item.quantidade), 0);

      if (!currentComandaId) {
        // Criar nova comanda
        const { data: newCmd, error: cmdErr } = await supabase.from('comandas').insert({
          empresa_id: empresaId, 
          mesa_id: mesaId, 
          status: 'aberta', 
          total: cartTotal
        }).select().single();
        if (cmdErr) throw cmdErr;
        currentComandaId = newCmd.id;
        setComandaId(currentComandaId);
        localStorage.setItem(`comanda_${empresaId}_${mesaId}`, currentComandaId);
      } else {
        // Atualizar total da comanda existente
        const { data: cmdAtual } = await supabase.from('comandas').select('total').eq('id', currentComandaId).single();
        const novoTotal = (cmdAtual?.total || 0) + cartTotal;
        await supabase.from('comandas').update({ total: novoTotal }).eq('id', currentComandaId);
      }

      // Inserir pedidos
      const pedidos = cart.map(item => ({
        comanda_id: currentComandaId,
        produto_id: item.produto.id,
        quantidade: item.quantidade,
        preco_unitario: item.produto.preco,
        subtotal: item.produto.preco * item.quantidade,
        notas_cliente: item.notas || null,
        status_cozinha: 'pendente' as const
      }));
      await supabase.from('pedidos').insert(pedidos);
      
      // Atualizar mesa para OCUPADA
      await supabase.from('mesas').update({ status: 'ocupada' }).eq('id', mesaId);

      toast.success('Pedido enviado para a cozinha!');
      setCart([]);
      setIsCartOpen(false);
      fetchMeusPedidos(currentComandaId);
    } catch (err) { 
      console.error(err);
      toast.error('Ocorreu um erro ao processar seu pedido'); 
    } finally { 
      setIsSendingOrder(false); 
    }
  };

  const addToCart = (p: Produto) => {
    setCart(prev => {
      const exist = prev.find(i => i.produto.id === p.id);
      if (exist) return prev.map(i => i.produto.id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i);
      return [...prev, { produto: p, quantidade: 1, notas: '' }];
    });
    toast.success(`${p.nome} no carrinho`);
  };

  const updateCartItem = (id: string, qtd: number) => {
    if (qtd <= 0) {
      setCart(prev => prev.filter(i => i.produto.id !== id));
    } else {
      setCart(prev => prev.map(i => i.produto.id === id ? { ...i, quantidade: qtd } : i));
    }
  };

  const updateCartNotes = (id: string, notas: string) => {
    setCart(prev => prev.map(i => i.produto.id === id ? { ...i, notas } : i));
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.produto.preco * item.quantidade), 0);
  const cartItemCount = cart.reduce((acc, item) => acc + item.quantidade, 0);
  const filteredProducts = produtos.filter(p => 
    p.nome.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.descricao && p.descricao.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
          <Loader2 className="w-12 h-12 text-primary" />
        </motion.div>
        <p className="text-muted-foreground animate-pulse font-medium">Carregando cardápio...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-red-50 p-4 rounded-full mb-4">
          <UtensilsCrossed className="w-12 h-12 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">{error}</h1>
        <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24 font-sans antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                {empresa?.logo_url ? (
                  <img src={empresa.logo_url} alt={empresa.nome_fantasia} className="w-14 h-14 rounded-2xl object-cover shadow-md border-2 border-white" />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
                    <UtensilsCrossed className="w-7 h-7 text-white" />
                  </div>
                )}
              </motion.div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 leading-tight">{empresa?.nome_fantasia}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold px-2 py-0">
                    Mesa {mesaNumero}
                  </Badge>
                  <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Aberto
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="rounded-full text-slate-500" onClick={() => setSoundEnabled(!soundEnabled)}>
                <Volume2 className={`w-5 h-5 ${!soundEnabled && 'opacity-30'}`} />
              </Button>
              {meusPedidos.length > 0 && (
                <Button variant="default" size="sm" onClick={() => setIsOrdersOpen(true)} className="rounded-full font-bold shadow-md">
                  <History className="w-4 h-4 mr-2" /> Meus Pedidos
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Search and Categories */}
      <section className="bg-white border-b border-slate-200 sticky top-[89px] z-40">
        <div className="container mx-auto px-4 pt-4 pb-2">
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-colors group-focus-within:text-primary" />
            <Input 
              placeholder="O que você deseja comer hoje?" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="pl-11 h-12 bg-slate-100 border-transparent rounded-2xl focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/20 transition-all text-base" 
            />
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-3 no-scrollbar scroll-smooth">
            <Button 
              variant={activeCategory === 'all' ? 'default' : 'secondary'} 
              onClick={() => setActiveCategory('all')} 
              className={`rounded-xl px-6 h-10 font-bold whitespace-nowrap transition-all ${activeCategory === 'all' ? 'shadow-lg shadow-primary/30' : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200'}`}
            >
              Todos
            </Button>
            {categorias.map((cat) => (
              <Button 
                key={cat.id} 
                variant={activeCategory === cat.id ? 'default' : 'secondary'} 
                onClick={() => setActiveCategory(cat.id)} 
                className={`rounded-xl px-6 h-10 font-bold whitespace-nowrap transition-all ${activeCategory === cat.id ? 'shadow-lg shadow-primary/30' : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200'}`}
              >
                {cat.nome}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredProducts.filter(p => activeCategory === 'all' || p.categoria_id === activeCategory).map((produto) => {
              const itemNoCarrinho = cart.find(i => i.produto.id === produto.id);
              return (
                <motion.div key={produto.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
                  <Card className="group overflow-hidden border-none shadow-sm hover:shadow-xl transition-all duration-300 rounded-[2rem] bg-white">
                    <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden">
                      {produto.imagem_url ? (
                        <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ChefHat className="w-16 h-16 text-slate-200" />
                        </div>
                      )}
                      <div className="absolute top-4 right-4">
                        <Badge className="bg-white/90 backdrop-blur-md text-slate-900 border-none font-black shadow-sm px-3 py-1">
                          R$ {produto.preco.toFixed(2).replace('.', ',')}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-6">
                      <h3 className="font-extrabold text-slate-800 text-lg mb-1 group-hover:text-primary transition-colors">
                        {produto.nome}
                      </h3>
                      <p className="text-sm text-slate-500 line-clamp-2 min-h-[40px] leading-relaxed mb-4">
                        {produto.descricao || 'Sem descrição disponível.'}
                      </p>
                      <div className="flex items-center justify-between gap-4">
                        {itemNoCarrinho ? (
                          <div className="flex items-center justify-between w-full bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                            <Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl bg-white shadow-sm" onClick={() => updateCartItem(produto.id, itemNoCarrinho.quantidade - 1)}>
                              <Minus className="w-4 h-4 text-slate-600" />
                            </Button>
                            <span className="font-black text-slate-800 text-lg">{itemNoCarrinho.quantidade}</span>
                            <Button size="icon" variant="default" className="h-10 w-10 rounded-xl shadow-md" onClick={() => updateCartItem(produto.id, itemNoCarrinho.quantidade + 1)}>
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button 
                            onClick={() => addToCart(produto)} 
                            className="w-full rounded-2xl h-12 font-black shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-all active:scale-95"
                          >
                            Adicionar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </main>

      {/* Waiter Button */}
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="fixed bottom-24 right-6 z-50">
        <Button
          onClick={handleCallWaiter}
          disabled={isCallingWaiter}
          size="lg"
          variant="outline"
          className="rounded-full h-14 w-14 shadow-lg bg-white border-2 border-amber-400 hover:bg-amber-50"
        >
          <Bell className="w-6 h-6 text-amber-600" />
        </Button>
      </motion.div>

      {/* Cart Button */}
      {cartItemCount > 0 && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }} 
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-white via-white to-transparent"
        >
          <Button 
            onClick={() => setIsCartOpen(true)} 
            className="w-full h-16 rounded-2xl font-black text-lg shadow-2xl shadow-primary/40 flex items-center justify-between px-6"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-xl p-2">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <span>Ver Carrinho</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-white text-primary font-black">{cartItemCount}</Badge>
              <span>R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
            </div>
          </Button>
        </motion.div>
      )}

      {/* Cart Sheet */}
      <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-2xl font-black">Seu Pedido</SheetTitle>
            <SheetDescription>Revise os itens antes de enviar</SheetDescription>
          </SheetHeader>
          
          <ScrollArea className="flex-1 h-[calc(100%-200px)]">
            <div className="space-y-4 pr-4">
              {cart.map((item) => (
                <Card key={item.produto.id} className="border-none shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
                        {item.produto.imagem_url ? (
                          <img src={item.produto.imagem_url} alt={item.produto.nome} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ChefHat className="w-8 h-8 text-slate-300" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-800">{item.produto.nome}</h4>
                        <p className="text-primary font-black">R$ {(item.produto.preco * item.quantidade).toFixed(2).replace('.', ',')}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg" onClick={() => updateCartItem(item.produto.id, item.quantidade - 1)}>
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="font-bold w-8 text-center">{item.quantidade}</span>
                          <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg" onClick={() => updateCartItem(item.produto.id, item.quantidade + 1)}>
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <Textarea 
                      placeholder="Alguma observação? (ex: sem cebola)" 
                      value={item.notas}
                      onChange={(e) => updateCartNotes(item.produto.id, e.target.value)}
                      className="mt-3 text-sm"
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>

          <SheetFooter className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t">
            <div className="w-full space-y-4">
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-slate-600">Total</span>
                <span className="text-2xl font-black text-primary">R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
              </div>
              <Button 
                onClick={handleSendOrder} 
                disabled={isSendingOrder}
                className="w-full h-14 rounded-2xl font-black text-lg"
              >
                {isSendingOrder ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Enviando...</>
                ) : (
                  'Enviar Pedido'
                )}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Orders Sheet */}
      <Sheet open={isOrdersOpen} onOpenChange={setIsOrdersOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-xl font-black">Meus Pedidos</SheetTitle>
            <SheetDescription>Acompanhe o status dos seus pedidos</SheetDescription>
          </SheetHeader>
          
          <ScrollArea className="h-[calc(100vh-120px)] mt-4">
            <div className="space-y-3 pr-4">
              {meusPedidos.map((pedido) => {
                const produto = produtos.find(p => p.id === pedido.produto_id);
                const status = statusConfig[pedido.status_cozinha];
                const StatusIcon = status?.icon || Clock;
                
                return (
                  <Card key={pedido.id} className="border-none shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-slate-800">{produto?.nome || 'Produto'}</h4>
                          <p className="text-sm text-slate-500">Qtd: {pedido.quantidade}</p>
                          {pedido.notas_cliente && (
                            <p className="text-xs text-slate-400 mt-1">Obs: {pedido.notas_cliente}</p>
                          )}
                        </div>
                        <Badge className={`${status?.color} text-white font-bold`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {status?.label}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
