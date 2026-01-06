import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ShoppingCart, Plus, Minus, Clock, CheckCircle2, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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
<<<<<<< HEAD
	// ... Tipos
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
		const [meusPedidos, setMeusPedidos] = useState<any[]>([]);
		const [isOrdersOpen, setIsOrdersOpen] = useState(false);
		const [isSendingOrder, setIsSendingOrder] = useState(false);
		const [isCallingWaiter, setIsCallingWaiter] = useState(false);
		const [waiterCallPending, setWaiterCallPending] = useState(false);
		const [soundEnabled, setSoundEnabled] = useState(true);

		useEffect(() => {
			if (empresaId) fetchMenuData();
		}, [empresaId, mesaId]);

		useEffect(() => {
			const ocuparMesa = async () => {
				if (!empresaId || !mesaId) return;
				const { data, error } = await supabase
					.from('mesas')
					.select('status')
					.eq('id', mesaId)
					.maybeSingle();
				if (!error && data && data.status === 'disponivel') {
					await supabase
						.from('mesas')
						.update({ status: 'ocupada' })
						.eq('id', mesaId);
				}
			};
			ocuparMesa();
		}, [empresaId, mesaId]);

		useEffect(() => {
			const savedComandaId = localStorage.getItem(`comanda_${empresaId}_${mesaId}`);
			if (savedComandaId) {
				setComandaId(savedComandaId);
				fetchMeusPedidos(savedComandaId);
			}
		}, [empresaId, mesaId]);

		// ... (outros useEffect de waiter, pedidos, etc. podem ser integrados aqui)

		const fetchMenuData = async () => {
			try {
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
					if (mesaData) setMesaNumero(mesaData.numero_mesa);
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
				setError('Erro ao carregar o cardápio.');
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
			if (!error && data) setMeusPedidos(data);
		};

		const addToCart = (produto: Produto) => {
			setCart(prev => {
				const existing = prev.find(item => item.produto.id === produto.id);
				if (existing) {
					return prev.map(item => item.produto.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item);
				}
				return [...prev, { produto, quantidade: 1, notas: '' }];
			});
		};

		const updateCartItem = (produtoId: string, quantidade: number) => {
			if (quantidade <= 0) {
				setCart(prev => prev.filter(item => item.produto.id !== produtoId));
			} else {
				setCart(prev => prev.map(item => item.produto.id === produtoId ? { ...item, quantidade } : item));
			}
		};

		const cartTotal = cart.reduce((sum, item) => sum + (item.produto.preco * item.quantidade), 0);
		const cartItemCount = cart.reduce((sum, item) => sum + item.quantidade, 0);

		const handleSendOrder = async () => {
			if (cart.length === 0) return;
			setIsSendingOrder(true);
			try {
				let currentComandaId = comandaId;
				const totalPedido = cart.reduce((acc, item) => acc + (item.produto.preco * item.quantidade), 0);
				await supabase.from('mesas').update({ status: 'ocupada' }).eq('id', mesaId);
				if (!currentComandaId) {
					const { data: novaComanda, error: errC } = await supabase
						.from('comandas')
						.insert({ empresa_id: empresaId, mesa_id: mesaId, status: 'aberta', total: totalPedido })
						.select().single();
					if (errC) throw errC;
					currentComandaId = novaComanda.id;
					setComandaId(novaComanda.id);
				} else {
					const { data: atual } = await supabase.from('comandas').select('total').eq('id', currentComandaId).single();
					await supabase.from('comandas').update({ total: (atual?.total || 0) + totalPedido }).eq('id', currentComandaId);
				}
				const pedidosData = cart.map(item => ({
					comanda_id: currentComandaId,
					produto_id: item.produto.id,
					quantidade: item.quantidade,
					preco_unitario: item.produto.preco,
					subtotal: item.produto.preco * item.quantidade,
					status_cozinha: 'pendente',
					notas_cliente: item.notas || null,
				}));
				const { error: errP } = await supabase.from('pedidos').insert(pedidosData);
				if (errP) throw errP;
				toast.success('Pedido enviado com sucesso!');
				setCart([]);
				setIsCartOpen(false);
				fetchMeusPedidos(currentComandaId);
			} catch (error: any) {
				toast.error('Erro ao enviar: ' + error.message);
			} finally {
				setIsSendingOrder(false);
			}
		};

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

		// Renderização principal (grid cards, carrinho, pedidos, etc)
		return (
			<div className="min-h-screen bg-background pb-24">
				{/* Header */}
				<header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
					<div className="container mx-auto px-4 py-4">
						<div className="flex items-center gap-4">
							{empresa?.logo_url ? (
								<img src={empresa.logo_url} alt={empresa.nome_fantasia} className="w-12 h-12 rounded-full object-cover bg-white" />
							) : (
								<div className="w-12 h-12 rounded-full bg-primary-foreground/20 flex items-center justify-center">
									<UtensilsCrossed className="w-6 h-6" />
								</div>
							)}
							<div className="flex-1">
								<h1 className="text-xl font-bold">{empresa?.nome_fantasia}</h1>
								{mesaNumero && <p className="text-sm text-primary-foreground/80">Mesa {mesaNumero}</p>}
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

				{/* Products Grid - Cards quadrados estilo vitrine */}
				<main className="container mx-auto px-2 py-6">
					{produtos.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-12">
							<ChefHat className="w-16 h-16 text-muted-foreground mb-4" />
							<p className="text-muted-foreground">
								{searchQuery ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}
							</p>
						</div>
					) : (
						<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
							{produtos
								.filter(p => {
									const matchesCategory = activeCategory === 'all' || p.categoria_id === activeCategory;
									const matchesSearch = searchQuery === '' ||
										p.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
										(p.descricao && p.descricao.toLowerCase().includes(searchQuery.toLowerCase()));
									return matchesCategory && matchesSearch;
								})
								.map((produto) => {
									const cartItem = cart.find(item => item.produto.id === produto.id);
									return (
										<Card key={produto.id} className="flex flex-col justify-between rounded-2xl shadow-md border border-muted bg-card h-[320px] min-h-[320px] max-h-[340px]">
											<div className="flex-1 flex items-center justify-center bg-muted/60" style={{ minHeight: 160 }}>
												{produto.imagem_url ? (
													<img
														src={produto.imagem_url}
														alt={produto.nome}
														className="w-24 h-24 object-cover rounded-xl shadow-sm"
													/>
												) : (
													<div className="w-24 h-24 flex items-center justify-center rounded-xl bg-muted">
														<ChefHat className="w-12 h-12 text-muted-foreground/30" />
													</div>
												)}
											</div>
											<CardContent className="p-4 flex flex-col flex-1 justify-between">
												<div>
													<h3 className="font-semibold text-foreground text-base mb-1 line-clamp-1">{produto.nome}</h3>
													{produto.descricao && (
														<p className="text-xs text-muted-foreground mb-2 line-clamp-2">
															{produto.descricao}
														</p>
													)}
												</div>
												<div className="flex items-end justify-between mt-2">
													<span className="text-lg font-bold text-primary">
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
														<Button size="icon" className="h-8 w-8" onClick={() => addToCart(produto)}>
															<Plus className="w-4 h-4" />
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
														onChange={(e) => setCart(prev => prev.map(ci => ci.produto.id === item.produto.id ? { ...ci, notas: e.target.value } : ci))}
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
=======
    const { empresaId, mesaId } = useParams<{ empresaId: string; mesaId: string }>();
    const [empresa, setEmpresa] = useState<any>(null);
    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [mesaNumero, setMesaNumero] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [comandaId, setComandaId] = useState<string | null>(null);
    const [isSendingOrder, setIsSendingOrder] = useState(false);

    useEffect(() => {
        if (empresaId) fetchMenuData();
    }, [empresaId, mesaId]);

    // Sincroniza status da mesa para "ocupada" ao abrir
    useEffect(() => {
        const ocuparMesa = async () => {
            if (mesaId) {
                await supabase.from('mesas').update({ status: 'ocupada' }).eq('id', mesaId);
            }
        };
        ocuparMesa();
    }, [mesaId]);

    const fetchMenuData = async () => {
        try {
            const { data: emp } = await supabase.from('empresas').select('*').eq('id', empresaId).single();
            setEmpresa(emp);

            const { data: mesa } = await supabase.from('mesas').select('numero_mesa').eq('id', mesaId).single();
            if (mesa) setMesaNumero(mesa.numero_mesa);

            const { data: prods } = await supabase.from('produtos').select('*').eq('empresa_id', empresaId).eq('ativo', true);
            setProdutos(prods || []);
        } finally {
            setIsLoading(false);
        }
    };

    const addToCart = (produto: Produto) => {
        setCart(prev => {
            const existing = prev.find(item => item.produto.id === produto.id);
            if (existing) {
                return prev.map(item => item.produto.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item);
            }
            return [...prev, { produto, quantidade: 1, notas: '' }];
        });
    };

    const updateQuantity = (produtoId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.produto.id === produtoId) {
                const newQty = Math.max(0, item.quantidade + delta);
                return { ...item, quantidade: newQty };
            }
            return item;
        }).filter(item => item.quantidade > 0));
    };

    const handleSendOrder = async () => {
        if (cart.length === 0 || isSendingOrder) return;
        setIsSendingOrder(true);

        try {
            let currentComandaId = comandaId;
            const totalPedido = cart.reduce((acc, item) => acc + (item.produto.preco * item.quantidade), 0);

            // 1. Garantir que a mesa está ocupada
            await supabase.from('mesas').update({ status: 'ocupada' }).eq('id', mesaId);

            // 2. Criar ou buscar comanda
            if (!currentComandaId) {
                const { data: novaComanda, error: errC } = await supabase
                    .from('comandas')
                    .insert({ 
                        empresa_id: empresaId, 
                        mesa_id: mesaId, 
                        status: 'aberta', 
                        total: totalPedido 
                    })
                    .select().single();
                if (errC) throw errC;
                currentComandaId = novaComanda.id;
                setComandaId(novaComanda.id);
            } else {
                const { data: atual } = await supabase.from('comandas').select('total').eq('id', currentComandaId).single();
                await supabase.from('comandas').update({ total: (atual?.total || 0) + totalPedido }).eq('id', currentComandaId);
            }

            // 3. Inserir Pedidos (CORREÇÃO: Removido empresa_id da tabela pedidos)
            const pedidosData = cart.map(item => ({
                comanda_id: currentComandaId,
                produto_id: item.produto.id,
                quantidade: item.quantidade,
                preco_unitario: item.produto.preco,
                subtotal: item.produto.preco * item.quantidade,
                status_cozinha: 'pendente'
            }));

            const { error: errP } = await supabase.from('pedidos').insert(pedidosData);
            if (errP) throw errP;

            toast.success('Pedido enviado com sucesso!');
            setCart([]);
        } catch (error: any) {
            toast.error('Erro ao enviar: ' + error.message);
        } finally {
            setIsSendingOrder(false);
        }
    };

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="min-h-screen bg-gray-50 pb-32">
            <header className="bg-green-600 text-white p-4 sticky top-0 z-10">
                <h1 className="text-xl font-bold">{empresa?.nome_fantasia}</h1>
                <p>Mesa {mesaNumero}</p>
            </header>

            <main className="p-4 space-y-4">
                {produtos.map(produto => {
                    const cartItem = cart.find(i => i.produto.id === produto.id);
                    return (
                        <Card key={produto.id} className="border-none shadow-md">
                            <CardContent className="p-4 flex justify-between items-center">
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-800">{produto.nome}</h3>
                                    <p className="text-sm text-gray-500">{produto.descricao}</p>
                                    <p className="text-green-600 font-bold mt-1">R$ {produto.preco.toFixed(2)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {cartItem ? (
                                        <div className="flex items-center bg-gray-100 rounded-lg p-1 border">
                                            <Button variant="ghost" size="icon" onClick={() => updateQuantity(produto.id, -1)}><Minus className="h-4 w-4" /></Button>
                                            <span className="w-8 text-center font-bold">{cartItem.quantidade}</span>
                                            <Button variant="ghost" size="icon" onClick={() => updateQuantity(produto.id, 1)}><Plus className="h-4 w-4" /></Button>
                                        </div>
                                    ) : (
                                        <Button className="bg-green-600 hover:bg-green-700" onClick={() => addToCart(produto)}>
                                            <Plus className="w-4 h-4 mr-1" /> Adicionar
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </main>

            {cart.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
                    <Button className="w-full h-12 bg-green-600 text-lg" onClick={handleSendOrder} disabled={isSendingOrder}>
                        <ShoppingCart className="mr-2" /> Enviar Pedido (R$ {cart.reduce((acc, i) => acc + (i.produto.preco * i.quantidade), 0).toFixed(2)})
                    </Button>
                </div>
            )}
        </div>
    );
>>>>>>> 7d4628b928a568d659d6c44d8756ef31ab6b64da
}
