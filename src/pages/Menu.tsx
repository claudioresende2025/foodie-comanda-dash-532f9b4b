import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ChefHat, UtensilsCrossed, Search, ShoppingCart, Plus, Minus, Trash2, Clock, CheckCircle2, X, Bell, Volume2, Printer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

// --- Tipos de Dados ---

type Categoria = {
    id: string;
    nome: string;
    descricao: string | null;
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

type Empresa = {
    id: string;
    nome_fantasia: string;
    logo_url: string | null;
};

type CartItem = {
    produto: Produto;
    quantidade: number;
    notas: string;
};

type Pedido = {
    id: string;
    produto_id: string;
    quantidade: number;
    status_cozinha: 'pendente' | 'preparando' | 'pronto' | 'entregue' | 'cancelado';
    notas_cliente: string | null;
    created_at: string;
};

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

    // --- Fetch Inicial ---
    useEffect(() => {
        if (empresaId) {
            fetchMenuData();
        }
    }, [empresaId, mesaId]);

    // CORREÇÃO 1: Garante que a mesa mude para ocupada ao abrir o cardápio
    useEffect(() => {
        const ocuparMesaAoAcessar = async () => {
            if (!empresaId || !mesaId) return;
            
            const { data: mesaAtual } = await supabase
                .from('mesas')
                .select('status')
                .eq('id', mesaId)
                .maybeSingle();

            if (mesaAtual && mesaAtual.status !== 'ocupada') {
                await supabase
                    .from('mesas')
                    .update({ status: 'ocupada' })
                    .eq('id', mesaId);
                console.log("Status da mesa atualizado para ocupada via acesso.");
            }
        };
        ocuparMesaAoAcessar();
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
            const { data: empresaData, error: empresaError } = await supabase
                .from('empresas')
                .select('id, nome_fantasia, logo_url')
                .eq('id', empresaId)
                .maybeSingle();

            if (empresaError) throw empresaError;
            if (!empresaData) {
                setError('Restaurante não encontrado.');
                return;
            }

            setEmpresa(empresaData as Empresa);

            if (mesaId) {
                const { data: mesaData } = await supabase
                    .from('mesas')
                    .select('numero_mesa')
                    .eq('id', mesaId)
                    .maybeSingle();
                if (mesaData) setMesaNumero(mesaData.numero_mesa);
            }

            const { data: catData } = await supabase
                .from('categorias')
                .select('*')
                .eq('empresa_id', empresaId)
                .eq('ativo', true)
                .order('ordem');
            setCategorias(catData || []);

            const { data: prodData } = await supabase
                .from('produtos')
                .select('*')
                .eq('empresa_id', empresaId)
                .eq('ativo', true)
                .order('nome');
            setProdutos(prodData || []);

        } catch (err) {
            setError('Erro ao carregar o cardápio.');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMeusPedidos = async (cmdId: string) => {
        const { data } = await supabase
            .from('pedidos')
            .select('*')
            .eq('comanda_id', cmdId)
            .order('created_at', { ascending: false });
        if (data) setMeusPedidos(data);
    };

    // --- Lógica de Pedidos e Carrinho ---

    const addToCart = (produto: Produto) => {
        setCart(prev => {
            const existing = prev.find(item => item.produto.id === produto.id);
            if (existing) {
                return prev.map(item => 
                    item.produto.id === produto.id 
                        ? { ...item, quantidade: item.quantidade + 1 }
                        : item
                );
            }
            return [...prev, { produto, quantidade: 1, notas: '' }];
        });
        toast.success(`${produto.nome} adicionado ao carrinho`);
    };

    const updateCartItem = (produtoId: string, quantidade: number) => {
        if (quantidade <= 0) {
            setCart(prev => prev.filter(item => item.produto.id !== produtoId));
        } else {
            setCart(prev => prev.map(item => 
                item.produto.id === produtoId ? { ...item, quantidade } : item
            ));
        }
    };

    const handleSendOrder = async () => {
        if (cart.length === 0) {
            toast.error('Adicione itens ao carrinho');
            return;
        }

        if (!empresaId || !mesaId) {
            toast.error('Erro ao identificar mesa');
            return;
        }

        setIsSendingOrder(true);

        try {
            let currentComandaId = comandaId;
            const cartTotal = cart.reduce((sum, item) => sum + (item.produto.preco * item.quantidade), 0);

            // CORREÇÃO 2: Sempre garante que a mesa está ocupada no banco de dados antes do pedido
            await supabase.from('mesas').update({ status: 'ocupada' }).eq('id', mesaId);

            if (!currentComandaId) {
                const sessionId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
                
                const { data: newComanda, error: comandaError } = await supabase
                    .from('comandas')
                    .insert({
                        empresa_id: empresaId,
                        mesa_id: mesaId,
                        qr_code_sessao: sessionId,
                        status: 'aberta',
                        total: cartTotal,
                    })
                    .select('id')
                    .single();

                if (comandaError) throw comandaError;
                currentComandaId = newComanda.id;
                
                setComandaId(currentComandaId);
                localStorage.setItem(`comanda_${empresaId}_${mesaId}`, currentComandaId);
            }

            // Inserir os pedidos vinculados à comanda
            const pedidosToInsert = cart.map(item => ({
                produto_id: item.produto.id,
                quantidade: item.quantidade,
                preco_unitario: item.produto.preco,
                subtotal: item.produto.preco * item.quantidade,
                notas_cliente: item.notas || null,
                status_cozinha: 'pendente' as const,
                comanda_id: currentComandaId,
                empresa_id: empresaId, // Garante que o ID da empresa acompanhe o pedido
            }));

            const { error: pedidosError } = await supabase
                .from('pedidos')
                .insert(pedidosToInsert);

            if (pedidosError) throw pedidosError;

            // Se for pedido subsequente, atualiza o total da comanda
            if (comandaId) {
                const { data: comandaAtual } = await supabase
                    .from('comandas')
                    .select('total')
                    .eq('id', currentComandaId)
                    .single();

                const novoTotal = (comandaAtual?.total || 0) + cartTotal;
                await supabase.from('comandas').update({ total: novoTotal }).eq('id', currentComandaId);
            }

            toast.success('Pedido enviado com sucesso!');
            setCart([]);
            setIsCartOpen(false);
            fetchMeusPedidos(currentComandaId);

        } catch (error: any) {
            console.error('Erro no pedido:', error);
            toast.error(`Erro: ${error.message || 'Falha ao processar pedido'}`);
        } finally {
            setIsSendingOrder(false);
        }
    };

    // Renderização simplificada (Acompanhando sua estrutura anterior)
    if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
    if (error) return <div className="min-h-screen flex flex-col items-center justify-center p-6"><h1 className="text-xl">{error}</h1></div>;

    return (
        <div className="min-h-screen bg-background pb-24">
            <header className="sticky top-0 z-50 bg-primary text-primary-foreground p-4 shadow-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">{empresa?.nome_fantasia}</h1>
                        <p className="text-sm opacity-80">Mesa {mesaNumero}</p>
                    </div>
                    {meusPedidos.length > 0 && (
                        <Button variant="secondary" size="sm" onClick={() => setIsOrdersOpen(true)}>Meus Pedidos</Button>
                    )}
                </div>
            </header>

            <main className="container mx-auto px-4 py-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {produtos.filter(p => activeCategory === 'all' || p.categoria_id === activeCategory).map(produto => (
                        <Card key={produto.id} className="overflow-hidden border-0 shadow-sm">
                            <CardContent className="p-4">
                                <h3 className="font-semibold text-lg">{produto.nome}</h3>
                                <p className="text-sm text-muted-foreground">{produto.descricao}</p>
                                <div className="mt-3 flex items-center justify-between">
                                    <span className="font-bold text-primary">R$ {produto.preco.toFixed(2)}</span>
                                    <Button size="sm" onClick={() => addToCart(produto)}><Plus className="w-4 h-4 mr-1" /> Adicionar</Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </main>

            {/* Carrinho Flutuante */}
            {cart.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4">
                    <Button className="w-full h-14 text-lg shadow-xl" onClick={handleSendOrder} disabled={isSendingOrder}>
                        {isSendingOrder ? <Loader2 className="animate-spin mr-2" /> : <ShoppingCart className="mr-2" />}
                        Enviar Pedido (R$ {cart.reduce((s, i) => s + (i.produto.preco * i.quantidade), 0).toFixed(2)})
                    </Button>
                </div>
            )}
        </div>
    );
}
