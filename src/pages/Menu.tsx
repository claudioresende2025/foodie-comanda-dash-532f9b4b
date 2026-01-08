import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, ChefHat, UtensilsCrossed, Search, ShoppingCart, 
  Plus, Minus, Clock, CheckCircle2, X, Bell, Volume2 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

// --- Tipos de Dados ---
type Categoria = { id: string; nome: string; descricao: string | null; ordem: number };
type Produto = { id: string; nome: string; descricao: string | null; preco: number; imagem_url: string | null; categoria_id: string | null; ativo: boolean };
type Empresa = { id: string; nome_fantasia: string; logo_url: string | null };
type CartItem = { produto: Produto; quantidade: number; notas: string };
type Pedido = { id: string; produto_id: string; quantidade: number; status_cozinha: string; notas_cliente: string | null; created_at: string; produtos?: { nome: string } };

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
    const [waiterCallPending, setWaiterCallPending] = useState(false);
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
            const { data: empresaData } = await supabase.from('empresas').select('id, nome_fantasia, logo_url').eq('id', empresaId).maybeSingle();
            if (!empresaData) { setError('Restaurante não encontrado.'); return; }
            setEmpresa(empresaData as Empresa);

            if (mesaId) {
                const { data: mesaData } = await supabase.from('mesas').select('numero_mesa').eq('id', mesaId).maybeSingle();
                if (mesaData) setMesaNumero(mesaData.numero_mesa);
            }

            const [catRes, prodRes] = await Promise.all([
                supabase.from('categorias').select('*').eq('empresa_id', empresaId).eq('ativo', true).order('ordem'),
                supabase.from('produtos').select('*').eq('empresa_id', empresaId).eq('ativo', true).order('nome')
            ]);

            setCategorias(catRes.data || []);
            setProdutos(prodRes.data || []);
        } catch (err) { setError('Erro ao carregar cardápio'); }
        finally { setIsLoading(false); }
    };

    const fetchMeusPedidos = async (cmdId: string) => {
        const { data } = await supabase.from('pedidos').select('*, produtos(nome)').eq('comanda_id', cmdId).order('created_at', { ascending: false });
        if (data) setMeusPedidos(data as any);
    };

    const handleCallWaiter = async () => {
        if (!empresaId || !mesaId || waiterCallPending) return;
        setIsCallingWaiter(true);
        try {
            await supabase.from('chamadas_garcom').insert({ empresa_id: empresaId, mesa_id: mesaId, comanda_id: comandaId, status: 'pendente' });
            setWaiterCallPending(true);
            toast.success('Garçom chamado!');
        } finally { setIsCallingWaiter(false); }
    };

    const addToCart = (produto: Produto) => {
        setCart(prev => {
            const existing = prev.find(item => item.produto.id === produto.id);
            if (existing) return prev.map(item => item.produto.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item);
            return [...prev, { produto, quantidade: 1, notas: '' }];
        });
        toast.success(`${produto.nome} adicionado`);
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.produto.preco * item.quantidade), 0);

    // ##########################################
    // FUNÇÃO handleSendOrder CORRIGIDA
    // ##########################################
    const handleSendOrder = async () => {
        if (cart.length === 0 || !empresaId || !mesaId) return;
        setIsSendingOrder(true);

        try {
            let currentComandaId = comandaId;
            const valorPedidoAtual = cartTotal;

            // 1. GERENCIAR COMANDA E STATUS DA MESA
            if (!currentComandaId) {
                const { data: novaComanda, error: errC } = await supabase
                    .from('comandas')
                    .insert({ 
                        empresa_id: empresaId, 
                        mesa_id: mesaId, 
                        status: 'aberta', 
                        total: valorPedidoAtual 
                    })
                    .select().single();

                if (errC) throw errC;
                currentComandaId = novaComanda.id;
                setComandaId(currentComandaId);
                localStorage.setItem(`comanda_${empresaId}_${mesaId}`, currentComandaId);
            } else {
                // Atualizar o total acumulado para o Caixa
                const { data: cmd } = await supabase.from('comandas').select('total').eq('id', currentComandaId).single();
                const novoTotal = (cmd?.total || 0) + valorPedidoAtual;
                await supabase.from('comandas').update({ total: novoTotal }).eq('id', currentComandaId);
            }

            // 2. FORÇAR MESA COMO OCUPADA (Correção solicitada)
            await supabase.from('mesas').update({ status: 'ocupada' }).eq('id', mesaId);

            // 3. INSERIR PEDIDOS
            const itensParaInserir = cart.map(item => ({
                comanda_id: currentComandaId,
                produto_id: item.produto.id,
                quantidade: item.quantidade,
                preco_unitario: item.produto.preco,
                subtotal: item.produto.preco * item.quantidade,
                notas_cliente: item.notas || null,
                status_cozinha: 'pendente'
            }));

            const { error: errP } = await supabase.from('pedidos').insert(itensParaInserir);
            if (errP) throw errP;

            toast.success('Pedido enviado! Mesa continua ocupada.');
            setCart([]);
            setIsCartOpen(false);
            fetchMeusPedidos(currentComandaId);

        } catch (err: any) {
            toast.error('Erro: ' + err.message);
        } finally {
            setIsSendingOrder(false);
        }
    };

    if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="min-h-screen bg-background pb-24">
            <header className="sticky top-0 z-50 bg-primary text-primary-foreground p-4 shadow-lg">
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <UtensilsCrossed className="w-8 h-8" />
                        <div>
                            <h1 className="font-bold text-lg">{empresa?.nome_fantasia}</h1>
                            <p className="text-xs opacity-80">Mesa {mesaNumero}</p>
                        </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => setIsOrdersOpen(true)}>
                        Pedidos ({meusPedidos.length})
                    </Button>
                </div>
            </header>

            <div className="p-4 container mx-auto space-y-4">
                <Input 
                    placeholder="Buscar no cardápio..." 
                    value={searchQuery} 
                    onChange={e => setSearchQuery(e.target.value)}
                    className="bg-card"
                />
                
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <Button variant={activeCategory === 'all' ? 'default' : 'outline'} onClick={() => setActiveCategory('all')}>Todos</Button>
                    {categorias.map(cat => (
                        <Button key={cat.id} variant={activeCategory === cat.id ? 'default' : 'outline'} onClick={() => setActiveCategory(cat.id)}>
                            {cat.nome}
                        </Button>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {produtos.filter(p => (activeCategory === 'all' || p.categoria_id === activeCategory) && p.nome.toLowerCase().includes(searchQuery.toLowerCase())).map(produto => (
                        <Card key={produto.id} className="flex overflow-hidden border-none shadow-sm">
                            <div className="w-24 h-24 bg-muted">
                                {produto.imagem_url && <img src={produto.imagem_url} className="w-full h-full object-cover" />}
                            </div>
                            <div className="flex-1 p-3 flex flex-col justify-between">
                                <h3 className="font-bold text-sm">{produto.nome}</h3>
                                <div className="flex justify-between items-center">
                                    <span className="text-primary font-bold">R$ {produto.preco.toFixed(2)}</span>
                                    <Button size="icon" className="h-8 w-8" onClick={() => addToCart(produto)}><Plus className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Carrinho Fixo */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex gap-3 shadow-2xl">
                <Button variant="outline" className="flex-1 h-12" onClick={handleCallWaiter} disabled={isCallingWaiter}>
                    <Bell className="w-4 h-4 mr-2" /> Garçom
                </Button>
                <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
                    <SheetTrigger asChild>
                        <Button className="flex-[2] h-12" disabled={cart.length === 0}>
                            <ShoppingCart className="w-4 h-4 mr-2" /> Ver Carrinho (R$ {cartTotal.toFixed(2)})
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[80vh]">
                        <SheetHeader><SheetTitle>Seu Carrinho</SheetTitle></SheetHeader>
                        <ScrollArea className="h-[50vh] mt-4 pr-4">
                            {cart.map((item, idx) => (
                                <div key={idx} className="mb-4 p-3 bg-muted rounded-lg space-y-2">
                                    <div className="flex justify-between font-bold">
                                        <span>{item.produto.nome}</span>
                                        <span>R$ {(item.produto.preco * item.quantidade).toFixed(2)}</span>
                                    </div>
                                    <Textarea 
                                        placeholder="Observações..." 
                                        value={item.notas} 
                                        onChange={e => {
                                            const newCart = [...cart];
                                            newCart[idx].notas = e.target.value;
                                            setCart(newCart);
                                        }}
                                    />
                                    <div className="flex items-center gap-4">
                                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => {
                                            const newCart = [...cart];
                                            if(newCart[idx].quantidade > 1) newCart[idx].quantidade--;
                                            else newCart.splice(idx, 1);
                                            setCart(newCart);
                                        }}><Minus /></Button>
                                        <span>{item.quantidade}</span>
                                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => {
                                            const newCart = [...cart];
                                            newCart[idx].quantidade++;
                                            setCart(newCart);
                                        }}><Plus /></Button>
                                    </div>
                                </div>
                            ))}
                        </ScrollArea>
                        <Button className="w-full h-14 mt-4 text-lg" onClick={handleSendOrder} disabled={isSendingOrder}>
                            {isSendingOrder ? <Loader2 className="animate-spin mr-2" /> : "Enviar Pedido"}
                        </Button>
                    </SheetContent>
                </Sheet>
            </div>

            {/* Modal de Pedidos Realizados */}
            <Sheet open={isOrdersOpen} onOpenChange={setIsOrdersOpen}>
                <SheetContent>
                    <SheetHeader><SheetTitle>Meus Pedidos</SheetTitle></SheetHeader>
                    <div className="mt-6 space-y-4">
                        {meusPedidos.map((p) => (
                            <div key={p.id} className="p-3 border rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-sm">{p.quantidade}x {p.produtos?.nome}</p>
                                    <p className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleTimeString()}</p>
                                </div>
                                <Badge>{p.status_cozinha}</Badge>
                            </div>
                        ))}
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
