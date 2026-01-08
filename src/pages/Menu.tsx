import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ChefHat, UtensilsCrossed, Search, ShoppingCart, Plus, Minus, Trash2, Clock, CheckCircle2, X, Bell, Volume2, Printer } from 'lucide-react';
// A LINHA ABAIXO ESTÁ COMENTADA PARA EVITAR O REFERENCE ERROR
//import { triggerKitchenPrint } from '@/utils/kitchenPrinter';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

// --- Tipos de Dados (Types) ---

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

// NOVO TIPO: Estrutura simplificada para ser enviada à RPC (jsonb)
type RpcItem = {
    produto_id: string;
    quantidade: number;
    preco_unitario: number;
    subtotal: number;
};

// --- Configuração de Status ---

const statusConfig = {
	pendente: { label: 'Aguardando', color: 'bg-yellow-500', icon: Clock },
	preparando: { label: 'Preparando', color: 'bg-blue-500', icon: ChefHat },
	pronto: { label: 'Pronto', color: 'bg-green-500', icon: CheckCircle2 },
	entregue: { label: 'Entregue', color: 'bg-gray-500', icon: CheckCircle2 },
	cancelado: { label: 'Cancelado', color: 'bg-red-500', icon: X },
};

// --- Função de Som - Melhorada ---

const playNotificationSound = () => {
	try {
		const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
		if (!AudioContextClass) return;
		
		const audioContext = new AudioContextClass();
		
		// Resume if suspended
		if (audioContext.state === 'suspended') {
			audioContext.resume();
		}
		
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
		
		// Second beep
		setTimeout(() => {
			try {
				const osc2 = audioContext.createOscillator();
				const gain2 = audioContext.createGain();
				osc2.connect(gain2);
				gain2.connect(audioContext.destination);
				osc2.frequency.value = 1000;
				osc2.type = 'sine';
				gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
				gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
				osc2.start(audioContext.currentTime);
				osc2.stop(audioContext.currentTime + 0.5);
			} catch (e) {}
		}, 200);
	} catch (e) {
		console.log('Audio not supported');
	}
};

// --- Componente Principal ---

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

	// --- Efeitos e Fetch de Dados ---

	useEffect(() => {
		if (empresaId) {
			fetchMenuData();
		}
	}, [empresaId, mesaId]);

	// Check for existing comanda in localStorage
	useEffect(() => {
		const savedComandaId = localStorage.getItem(`comanda_${empresaId}_${mesaId}`);
		if (savedComandaId) {
			setComandaId(savedComandaId);
			fetchMeusPedidos(savedComandaId);
		}
	}, [empresaId, mesaId]);

	// Check for pending waiter call
	useEffect(() => {
		if (!empresaId || !mesaId) return;
		
		const checkPendingCall = async () => {
			const { data } = await supabase
				.from('chamadas_garcom')
				.select('id')
				.eq('empresa_id', empresaId)
				.eq('mesa_id', mesaId)
				.eq('status', 'pendente')
				.maybeSingle();
			
			setWaiterCallPending(!!data);
		};
		
		checkPendingCall();
	}, [empresaId, mesaId]);

	// Realtime subscription for order status updates
	useEffect(() => {
		if (!comandaId) return;

		const channel = supabase
			.channel('pedidos-realtime')
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'pedidos',
					filter: `comanda_id=eq.${comandaId}`
				},
				(payload) => {
					console.log('Pedido update:', payload);
					if (payload.eventType === 'UPDATE') {
						const newPedido = payload.new as Pedido;
						setMeusPedidos(prev => 
							prev.map(p => p.id === newPedido.id ? { ...p, ...newPedido } : p)
						);
						
						const status = newPedido.status_cozinha;
						if (status === 'preparando') {
							toast.info('Seu pedido está sendo preparado!');
						} else if (status === 'pronto') {
							// Play sound notification
							if (soundEnabled) {
								playNotificationSound();
							}
							toast.success('🔔 Seu pedido está pronto!', {
								duration: 10000,
								description: 'Aguarde o garçom trazer seu pedido',
							});
						}
					} else if (payload.eventType === 'INSERT') {
						setMeusPedidos(prev => [...prev, payload.new as Pedido]);
					}
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [comandaId, soundEnabled]);

	// Realtime for waiter call status
	useEffect(() => {
		if (!empresaId || !mesaId) return;

		const channel = supabase
			.channel('chamadas-realtime')
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'chamadas_garcom',
					filter: `mesa_id=eq.${mesaId}`
				},
				(payload) => {
					if (payload.eventType === 'UPDATE' && payload.new.status === 'atendida') {
						setWaiterCallPending(false);
						toast.success('O garçom está a caminho!');
					}
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [empresaId, mesaId]);

	const fetchMenuData = async () => {
		try {
			// Busca empresa diretamente - RLS policy permite acesso público
			const { data: empresaData, error: empresaError } = await supabase
				.from('empresas')
				.select('id, nome_fantasia, logo_url')
				.eq('id', empresaId)
				.maybeSingle();

			if (empresaError) throw empresaError;

			if (!empresaData) {
				setError('Restaurante não encontrado. Verifique o link e tente novamente.');
				setIsLoading(false);
				return;
			}

			setEmpresa(empresaData as Empresa);

			if (mesaId) {
				const { data: mesaData } = await supabase
					.from('mesas')
					.select('numero_mesa')
					.eq('id', mesaId)
					.maybeSingle();

				if (mesaData) {
					setMesaNumero(mesaData.numero_mesa);
				}
			}

			const { data: catData, error: catError } = await supabase
				.from('categorias')
				.select('*')
				.eq('empresa_id', empresaId)
				.eq('ativo', true)
				.order('ordem');

			if (catError) throw catError;
			setCategorias(catData || []);

			const { data: prodData, error: prodError } = await supabase
				.from('produtos')
				.select('*')
				.eq('empresa_id', empresaId)
				.eq('ativo', true)
				.order('nome');

			if (prodError) throw prodError;
			setProdutos(prodData || []);

		} catch (err) {
			console.error('Error fetching menu:', err);
			const errorMessage = (err as Error)?.message || 'Erro ao carregar o cardápio.';
			setError(errorMessage);
		} finally {
			setIsLoading(false);
		}
	};

	const fetchMeusPedidos = async (cmdId: string) => {
		const { data, error } = await supabase
			.from('pedidos')
			.select('*')
			.eq('comanda_id', cmdId)
			.order('created_at', { ascending: false });

		if (!error && data) {
			setMeusPedidos(data);
		}
	};

	const handleCallWaiter = async () => {
		if (!empresaId || !mesaId) {
			toast.error('Erro ao identificar mesa');
			return;
		}

		if (waiterCallPending) {
			toast.info('Já existe uma chamada pendente');
			return;
		}

		setIsCallingWaiter(true);

		try {
			console.log('[WAITER CALL] Attempting to call waiter:', { empresaId, mesaId, comandaId });
			
			const { data, error } = await supabase
				.from('chamadas_garcom')
				.insert({
					empresa_id: empresaId,
					mesa_id: mesaId,
					comanda_id: comandaId,
					status: 'pendente'
				})
				.select()
				.single();

			if (error) {
				console.error('[WAITER CALL ERROR]', error);
				// Provide more specific error messages
				if (error.code === '42501' || error.message?.includes('policy')) {
					toast.error('Permissão negada. Contate o restaurante.');
				} else if (error.code === '23503') {
					toast.error('Mesa não encontrada.');
				} else {
					toast.error(`Erro ao chamar garçom: ${error.message || 'Erro desconhecido'}`);
				}
				return;
			}

			console.log('[WAITER CALL SUCCESS]', data);
			setWaiterCallPending(true);
			toast.success('Garçom chamado! Aguarde um momento.');
		} catch (err) {
			console.error('[WAITER CALL EXCEPTION]', err);
			toast.error('Erro ao chamar garçom. Tente novamente.');
		} finally {
			setIsCallingWaiter(false);
		}
	};

	// --- Lógica de Carrinho ---

	const filteredProducts = produtos.filter(p => {
		const matchesCategory = activeCategory === 'all' || p.categoria_id === activeCategory;
		const matchesSearch = searchQuery === '' || 
			p.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
			(p.descricao && p.descricao.toLowerCase().includes(searchQuery.toLowerCase()));
		return matchesCategory && matchesSearch;
	});

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

	const updateCartNotes = (produtoId: string, notas: string) => {
		setCart(prev => prev.map(item => 
			item.produto.id === produtoId ? { ...item, notas } : item
		));
	};

	const cartTotal = cart.reduce((sum, item) => sum + (item.produto.preco * item.quantidade), 0);
	const cartItemCount = cart.reduce((sum, item) => sum + item.quantidade, 0);


	// #################################################################
	// # FUNÇÃO handleSendOrder CORRIGIDA (RPC, RLS e TRATAMENTO DE ERRO) #
	// #################################################################

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
            let totalUpdateNeeded = false;

			// 1. Prepara os dados do carrinho
			const itemsToSend = cart.map(item => ({
				produto_id: item.produto.id,
				quantidade: item.quantidade,
				preco_unitario: item.produto.preco,
				subtotal: item.produto.preco * item.quantidade,
				notas_cliente: item.notas || null,
				status_cozinha: 'pendente' as const,
                comanda_id: currentComandaId,
			}));

			// 2. ABERTURA DE COMANDA (Se comanda não existe)
			if (!currentComandaId) {
				// Gera ID de sessão
				const sessionId = crypto.randomUUID ? crypto.randomUUID() : 
					`${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
				
				// Criar comanda manualmente
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
				
				// Atualizar mesa para ocupada
				await supabase
					.from('mesas')
					.update({ status: 'ocupada' })
					.eq('id', mesaId);
				
				// Inserir os pedidos
				const pedidosToInsert = itemsToSend.map(item => ({
					...item,
					comanda_id: currentComandaId,
				}));
				
				const { error: pedidosError } = await supabase
					.from('pedidos')
					.insert(pedidosToInsert);

				if (pedidosError) throw pedidosError;
				
				setComandaId(currentComandaId);
				localStorage.setItem(`comanda_${empresaId}_${mesaId}`, currentComandaId);
                
                // A RPC já inseriu os pedidos e atualizou o total.

			} else {
                // 3. PEDIDOS SUBSEQUENTES (Se comanda já existe)
                
                // Insere os novos pedidos diretamente na tabela 'pedidos'
                const subsequentPedidos = itemsToSend.map(item => ({
                    ...item,
                    comanda_id: currentComandaId,
                }));
                
                const { error: pedidosError } = await supabase
                    .from('pedidos')
                    .insert(subsequentPedidos);

                if (pedidosError) throw pedidosError;
                
                totalUpdateNeeded = true;
			}
            
            // 4. ATUALIZAÇÃO DO TOTAL (apenas para pedidos subsequentes)
            if (totalUpdateNeeded) {
                const { data: comandaData, error: totalError } = await supabase
                    .from('comandas')
                    .select('total')
                    .eq('id', currentComandaId)
                    .single();
                    
                if (totalError) throw totalError;

                const currentTotal = comandaData?.total || 0;
                const newPedidosTotal = currentTotal + cartTotal;
                
                await supabase
                    .from('comandas')
                    .update({ total: newPedidosTotal })
                    .eq('id', currentComandaId);
            }

			// 5. Ações de Conclusão
			// O bloco de impressão da cozinha foi comentado para evitar o ReferenceError
			/*
			if (mesaNumero) {
				triggerKitchenPrint(mesaNumero, cart);
			}
			*/

			toast.success('Pedido enviado com sucesso!');
			setCart([]);
			setIsCartOpen(false);
			fetchMeusPedidos(currentComandaId);

		} catch (error) {
			
			// 💡 CORREÇÃO AQUI: Tenta extrair a mensagem de erro do Supabase
			const errorMessage = 
				(error as any)?.message || 
				(error as any)?.error_description || 
				'Erro desconhecido ao enviar pedido. (Detalhes no console)';

			console.error('Error sending order (detailed):', error);
			// Mensagem mais informativa
			toast.error(`Erro ao enviar pedido: ${errorMessage}`);
            
		} finally {
			setIsSendingOrder(false);
		}
	};
	// #################################################################


	// --- Renderização de UI ---

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<Loader2 className="w-8 h-8 animate-spin text-primary" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
				<UtensilsCrossed className="w-16 h-16 text-muted-foreground mb-4" />
				<h1 className="text-xl font-semibold text-foreground">{error}</h1>
				<p className="text-muted-foreground mt-2">Verifique o link e tente novamente</p>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background pb-24">
			{/* Header */}
			<header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
				<div className="container mx-auto px-4 py-4">
					<div className="flex items-center gap-4">
						{empresa?.logo_url ? (
							<img
								src={empresa.logo_url}
								alt={empresa.nome_fantasia}
								className="w-12 h-12 rounded-full object-cover bg-white"
							/>
						) : (
							<div className="w-12 h-12 rounded-full bg-primary-foreground/20 flex items-center justify-center">
								<UtensilsCrossed className="w-6 h-6" />
							</div>
						)}
						<div className="flex-1">
							<h1 className="text-xl font-bold">{empresa?.nome_fantasia}</h1>
							{mesaNumero && (
								<p className="text-sm text-primary-foreground/80">Mesa {mesaNumero}</p>
							)}
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="secondary"
								size="icon"
								onClick={() => setSoundEnabled(!soundEnabled)}
								title={soundEnabled ? 'Som ativado' : 'Som desativado'}
							>
								<Volume2 className={`w-4 h-4 ${!soundEnabled && 'opacity-50'}`} />
							</Button>
							{meusPedidos.length > 0 && (
								<Button 
									variant="secondary" 
									size="sm"
									onClick={() => setIsOrdersOpen(true)}
								>
									Pedidos
								</Button>
							)}
						</div>
					</div>
				</div>
			</header>

			{/* Search Bar */}
			<div className="sticky top-[72px] z-40 bg-card border-b border-border shadow-sm">
				<div className="container mx-auto px-4 py-3">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
						<Input
							placeholder="Buscar produtos..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-10"
						/>
					</div>
				</div>
			</div>

			{/* Categories Navigation */}
			<div className="sticky top-[136px] z-30 bg-card border-b border-border shadow-sm">
				<div className="container mx-auto px-4">
					<div className="overflow-x-auto scrollbar-hide">
						<div className="flex gap-2 py-3">
							<button
								onClick={() => setActiveCategory('all')}
								className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
									activeCategory === 'all'
										? 'bg-primary text-primary-foreground'
										: 'bg-muted text-muted-foreground hover:bg-muted/80'
								}`}
							>
								Todos
							</button>
							{categorias.map((cat) => (
								<button
									key={cat.id}
									onClick={() => setActiveCategory(cat.id)}
									className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
										activeCategory === cat.id
											? 'bg-primary text-primary-foreground'
											: 'bg-muted text-muted-foreground hover:bg-muted/80'
									}`}
								>
									{cat.nome}
								</button>
							))}
						</div>
					</div>
				</div>
			</div>

			{/* Products Grid */}
			<main className="container mx-auto px-4 py-6">
				{filteredProducts.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-12">
						<ChefHat className="w-16 h-16 text-muted-foreground mb-4" />
						<p className="text-muted-foreground">
							{searchQuery ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{filteredProducts.map((produto) => {
							const cartItem = cart.find(item => item.produto.id === produto.id);
							return (
								<Card key={produto.id} className="overflow-hidden border-0 shadow-fcd">
									<div className="aspect-video bg-muted relative">
										{produto.imagem_url ? (
											<img
												src={produto.imagem_url}
												alt={produto.nome}
												className="w-full h-full object-cover"
											/>
										) : (
											<div className="w-full h-full flex items-center justify-center">
												<ChefHat className="w-12 h-12 text-muted-foreground/30" />
											</div>
										)}
									</div>
									<CardContent className="p-4">
										<h3 className="font-semibold text-foreground text-lg">{produto.nome}</h3>
										{produto.descricao && (
											<p className="text-sm text-muted-foreground mt-1 line-clamp-2">
												{produto.descricao}
											</p>
										)}
										<div className="mt-3 flex items-center justify-between">
											<span className="text-xl font-bold text-primary">
												R$ {produto.preco.toFixed(2).replace('.', ',')}
											</span>
											{cartItem ? (
												<div className="flex items-center gap-2">
													<Button 
														size="icon" 
														variant="outline"
														className="h-8 w-8"
														onClick={() => updateCartItem(produto.id, cartItem.quantidade - 1)}
													>
														<Minus className="w-4 h-4" />
													</Button>
													<span className="w-8 text-center font-semibold">{cartItem.quantidade}</span>
													<Button 
														size="icon" 
														className="h-8 w-8"
														onClick={() => updateCartItem(produto.id, cartItem.quantidade + 1)}
													>
														<Plus className="w-4 h-4" />
													</Button>
												</div>
											) : (
												<Button size="sm" onClick={() => addToCart(produto)}>
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

			{/* Call Waiter Button - Fixed */}
			<Button
				onClick={handleCallWaiter}
				disabled={isCallingWaiter || waiterCallPending}
				className={`fixed bottom-24 right-4 z-50 h-14 w-14 rounded-full shadow-lg ${
					waiterCallPending ? 'bg-yellow-500 hover:bg-yellow-600' : ''
				}`}
				size="icon"
			>
				{isCallingWaiter ? (
					<Loader2 className="w-6 h-6 animate-spin" />
				) : (
					<Bell className={`w-6 h-6 ${waiterCallPending && 'animate-pulse'}`} />
				)}
			</Button>
			{waiterCallPending && (
				<span className="fixed bottom-20 right-4 z-50 text-xs text-yellow-600 font-medium bg-yellow-100 px-2 py-1 rounded">
					Chamando...
				</span>
			)}

			{/* Floating Cart Button */}
			{cart.length > 0 && (
				<div className="fixed bottom-4 left-4 right-20 z-50">
					<Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
						<SheetTrigger asChild>
							<Button className="w-full h-14 text-lg shadow-lg">
								<ShoppingCart className="w-5 h-5 mr-2" />
								Ver Carrinho ({cartItemCount})
								<span className="ml-auto">R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
							</Button>
						</SheetTrigger>
						<SheetContent side="bottom" className="h-[85vh]">
							<SheetHeader>
								<SheetTitle>Seu Carrinho</SheetTitle>
							</SheetHeader>
							<ScrollArea className="h-[calc(100%-140px)] mt-4">
								<div className="space-y-4 pr-4">
									{cart.map((item) => (
										<div key={item.produto.id} className="flex gap-3 p-3 bg-muted rounded-lg">
											<div className="w-16 h-16 bg-background rounded-md overflow-hidden flex-shrink-0">
												{item.produto.imagem_url ? (
													<img 
														src={item.produto.imagem_url} 
														alt={item.produto.nome}
														className="w-full h-full object-cover"
													/>
												) : (
													<div className="w-full h-full flex items-center justify-center">
														<ChefHat className="w-6 h-6 text-muted-foreground/30" />
													</div>
												)}
											</div>
											<div className="flex-1 min-w-0">
												<h4 className="font-medium text-sm">{item.produto.nome}</h4>
												<p className="text-primary font-semibold text-sm">
													R$ {(item.produto.preco * item.quantidade).toFixed(2).replace('.', ',')}
												</p>
												<div className="flex items-center gap-2 mt-2">
													<Button 
														size="icon" 
														variant="outline"
														className="h-7 w-7"
														onClick={() => updateCartItem(item.produto.id, item.quantidade - 1)}
													>
														{item.quantidade === 1 ? <Trash2 className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
													</Button>
													<span className="w-6 text-center text-sm font-semibold">{item.quantidade}</span>
													<Button 
														size="icon" 
														className="h-7 w-7"
														onClick={() => updateCartItem(item.produto.id, item.quantidade + 1)}
													>
														<Plus className="w-3 h-3" />
													</Button>
												</div>
												<Textarea
													placeholder="Observações (ex: sem cebola)"
													value={item.notas}
													onChange={(e) => updateCartNotes(item.produto.id, e.target.value)}
													className="mt-2 text-xs h-16 resize-none"
												/>
											</div>
										</div>
									))}
								</div>
							</ScrollArea>
							<div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t">
								<div className="flex justify-between items-center mb-3">
									<span className="font-medium">Total</span>
									<span className="text-xl font-bold text-primary">
										R$ {cartTotal.toFixed(2).replace('.', ',')}
									</span>
								</div>
								<Button 
									className="w-full h-12 text-lg" 
									onClick={handleSendOrder}
									disabled={isSendingOrder}
								>
									{isSendingOrder ? (
										<Loader2 className="w-5 h-5 animate-spin mr-2" />
									) : null}
									Enviar Pedido
								</Button>
							</div>
						</SheetContent>
					</Sheet>
				</div>
			)}

			{/* Orders Sheet */}
			<Sheet open={isOrdersOpen} onOpenChange={setIsOrdersOpen}>
				<SheetContent side="right" className="w-full sm:max-w-md">
					<SheetHeader>
						<SheetTitle>Meus Pedidos</SheetTitle>
					</SheetHeader>
					<ScrollArea className="h-[calc(100vh-100px)] mt-4">
						<div className="space-y-3 pr-4">
							{meusPedidos.map((pedido) => {
								const produto = produtos.find(p => p.id === pedido.produto_id);
								const status = statusConfig[pedido.status_cozinha];
								const StatusIcon = status.icon;
								return (
									<div key={pedido.id} className="p-3 bg-muted rounded-lg">
										<div className="flex items-start justify-between">
											<div>
												<h4 className="font-medium">{produto?.nome || 'Produto'}</h4>
												<p className="text-sm text-muted-foreground">
													Qtd: {pedido.quantidade}
												</p>
												{pedido.notas_cliente && (
													<p className="text-xs text-muted-foreground mt-1">
														Obs: {pedido.notas_cliente}
													</p>
												)}
											</div>
											<Badge className={`${status.color} text-white flex items-center gap-1`}>
												<StatusIcon className="w-3 h-3" />
												{status.label}
											</Badge>
										</div>
									</div>
								);
							})}
							{meusPedidos.length === 0 && (
								<p className="text-center text-muted-foreground py-8">
									Nenhum pedido ainda
								</p>
							)}
						</div>
					</ScrollArea>
				</SheetContent>
			</Sheet>

			{/* Footer */}
			<footer className="bg-muted py-6 mt-8">
				<div className="container mx-auto px-4 text-center">
					<p className="text-sm text-muted-foreground">
						Cardápio digital - {empresa?.nome_fantasia}
					</p>
				</div>
			</footer>
		</div>
	);
}
