import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ChefHat, UtensilsCrossed, Search, ShoppingCart, Plus, Minus, Trash2, Clock, CheckCircle2, X, Bell, Volume2, Printer } from 'lucide-react';
// import { triggerKitchenPrint } from '@/utils/kitchenPrinter';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

// --- Tipos de Dados ---
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

const playNotificationSound = () => {
	try {
		const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
		if (!AudioContextClass) return;
		const audioContext = new AudioContextClass();
		if (audioContext.state === 'suspended') audioContext.resume();
		const oscillator = audioContext.createOscillator();
		const gainNode = audioContext.createGain();
		oscillator.connect(gainNode);
		gainNode.connect(audioContext.destination);
		oscillator.frequency.value = 800;
		oscillator.type = 'sine';
		gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
		gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
		oscillator.start(audioContext.currentTime);
		oscillator.stop(audioContext.currentTime + 0.5);
	} catch (e) { console.log('Audio error'); }
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

	useEffect(() => { if (empresaId) fetchMenuData(); }, [empresaId, mesaId]);
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
		} catch (err) { setError('Erro ao carregar dados'); } finally { setIsLoading(false); }
	};

	const fetchMeusPedidos = async (id: string) => {
		const { data } = await supabase.from('pedidos').select('*').eq('comanda_id', id).order('created_at', { ascending: false });
		setMeusPedidos(data || []);
	};

    // --- CORREÇÃO DO ENVIO (CAIXA E STATUS) ---
	const handleSendOrder = async () => {
		if (cart.length === 0) return toast.error('Carrinho vazio');
		setIsSendingOrder(true);
		try {
			let currentComandaId = comandaId;

			// 1. Abre comanda ou recupera a existente somando valores
			if (!currentComandaId) {
				const { data: newCmd } = await supabase.from('comandas').insert({
					empresa_id: empresaId, mesa_id: mesaId, status: 'aberta', total: cartTotal
				}).select().single();
				currentComandaId = newCmd.id;
				setComandaId(currentComandaId);
				localStorage.setItem(`comanda_${empresaId}_${mesaId}`, currentComandaId);
			} else {
				const { data: cmdAtual } = await supabase.from('comandas').select('total').eq('id', currentComandaId).single();
				await supabase.from('comandas').update({ total: (cmdAtual?.total || 0) + cartTotal }).eq('id', currentComandaId);
			}

			// 2. Insere os itens do pedido
			const pedidos = cart.map(item => ({
				comanda_id: currentComandaId,
				produto_id: item.produto.id,
				quantidade: item.quantidade,
				preco_unitario: item.produto.preco,
				status_cozinha: 'pendente'
			}));
			await supabase.from('pedidos').insert(pedidos);

			// 3. FORÇA STATUS DA MESA COMO OCUPADA
			await supabase.from('mesas').update({ status: 'occupied' }).eq('id', mesaId);

			toast.success('Pedido enviado!');
			setCart([]);
			setIsCartOpen(false);
			fetchMeusPedidos(currentComandaId);
		} catch (err) { toast.error('Erro ao processar'); } finally { setIsSendingOrder(false); }
	};

	const addToCart = (p: Produto) => {
		setCart(prev => {
			const exist = prev.find(i => i.produto.id === p.id);
			if (exist) return prev.map(i => i.produto.id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i);
			return [...prev, { produto: p, quantidade: 1, notas: '' }];
		});
	};

    // AQUI CONTINUA TODO O SEU DESIGN ORIGINAL (SEARCH, CATEGORIAS, CARDS, FOOTER, ETC)
    // Omitindo a repetição visual para caber na resposta, mas no seu arquivo
    // você deve manter todas as linhas de HTML/JSX que já existiam.

	const cartTotal = cart.reduce((acc, item) => acc + (item.produto.preco * item.quantidade), 0);
    const filteredProducts = produtos.filter(p => p.nome.toLowerCase().includes(searchQuery.toLowerCase()));

	return (
		<div className="min-h-screen bg-background pb-24">
            {/* TODO O SEU HEADER ORIGINAL AQUI */}
            <header className="sticky top-0 z-50 bg-primary text-primary-foreground p-4 shadow-lg">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold">{empresa?.nome_fantasia || 'Menu'}</h1>
                    <Badge variant="secondary">Mesa {mesaNumero}</Badge>
                </div>
            </header>

            {/* TODO O SEU BUSCADOR E CATEGORIAS ORIGINAIS AQUI */}
            <div className="p-4">
                <Input 
                    placeholder="Buscar..." 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="mb-4"
                />
            </div>

            <main className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                {filteredProducts.map(produto => (
                    <Card key={produto.id} className="overflow-hidden">
                        <CardContent className="p-4 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold">{produto.nome}</h3>
                                <p className="text-primary font-bold">R$ {produto.preco.toFixed(2)}</p>
                            </div>
                            <Button onClick={() => addToCart(produto)} size="sm">
                                <Plus className="w-4 h-4" />
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </main>

            {/* TODO O SEU CARRINHO (SHEET) E BOTAO DE CHAMAR GARÇOM AQUI */}
            {cart.length > 0 && (
                <div className="fixed bottom-4 left-4 right-4 z-50">
                    <Button className="w-full h-14" onClick={() => setIsCartOpen(true)}>
                        Ver Carrinho - R$ {cartTotal.toFixed(2)}
                    </Button>
                </div>
            )}

            <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
                <SheetContent side="bottom" className="h-[80vh]">
                    <ScrollArea className="h-full p-4">
                        {cart.map(item => (
                            <div key={item.produto.id} className="flex justify-between mb-4 border-b pb-2">
                                <span>{item.quantidade}x {item.produto.nome}</span>
                                <span>R$ {(item.produto.preco * item.quantidade).toFixed(2)}</span>
                            </div>
                        ))}
                        <Button className="w-full mt-4" onClick={handleSendOrder} disabled={isSendingOrder}>
                            {isSendingOrder ? <Loader2 className="animate-spin" /> : 'Confirmar Pedido'}
                        </Button>
                    </ScrollArea>
                </SheetContent>
            </Sheet>
		</div>
	);
}
