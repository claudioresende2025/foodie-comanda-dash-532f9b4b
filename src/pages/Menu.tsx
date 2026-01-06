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
}
