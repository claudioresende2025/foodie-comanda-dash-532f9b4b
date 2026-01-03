import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Package, Clock, CheckCircle, Truck, ChefHat, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BottomNavigation } from '@/components/delivery/BottomNavigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type DeliveryStatus = 'pendente' | 'confirmado' | 'em_preparo' | 'saiu_entrega' | 'entregue' | 'cancelado';

const statusConfig: Record<DeliveryStatus, { label: string; color: string; icon: any }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  confirmado: { label: 'Confirmado', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  em_preparo: { label: 'Em Preparo', color: 'bg-orange-100 text-orange-800', icon: ChefHat },
  saiu_entrega: { label: 'Saiu para Entrega', color: 'bg-purple-100 text-purple-800', icon: Truck },
  entregue: { label: 'Entregue', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: Clock },
};

interface Pedido {
  id: string;
  created_at: string;
  status: DeliveryStatus;
  total: number;
  empresa: { nome_fantasia: string; logo_url: string | null } | null;
  itens: { nome_produto: string; quantidade: number }[];
}

export default function DeliveryOrders() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/delivery/auth', { state: { from: '/delivery/orders' } });
      return;
    }
    setUser(session.user);
    fetchPedidos(session.user.id);
  };

  const fetchPedidos = async (userId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('pedidos_delivery')
        .select(`
          id,
          created_at,
          status,
          total,
          empresa:empresas(nome_fantasia, logo_url),
          itens:itens_delivery(nome_produto, quantidade)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPedidos(data as any[] || []);
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const pedidosEmAndamento = pedidos.filter(p => 
    !['entregue', 'cancelado'].includes(p.status)
  );
  
  const pedidosFinalizados = pedidos.filter(p => 
    ['entregue', 'cancelado'].includes(p.status)
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-4 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => navigate('/delivery')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-bold">Meus Pedidos</h1>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => user && fetchPedidos(user.id)}
          >
            <RefreshCw className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto space-y-6">
        {pedidos.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Nenhum pedido ainda</h2>
            <p className="text-muted-foreground mb-6">
              Seus pedidos aparecerão aqui
            </p>
            <Button onClick={() => navigate('/delivery')}>
              Fazer Primeiro Pedido
            </Button>
          </div>
        ) : (
          <>
            {/* Pedidos em Andamento */}
            {pedidosEmAndamento.length > 0 && (
              <section>
                <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Em Andamento ({pedidosEmAndamento.length})
                </h2>
                <div className="space-y-3">
                  {pedidosEmAndamento.map((pedido) => (
                    <PedidoCard 
                      key={pedido.id} 
                      pedido={pedido} 
                      onClick={() => navigate(`/delivery/tracking/${pedido.id}`)} 
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Pedidos Finalizados */}
            {pedidosFinalizados.length > 0 && (
              <section>
                <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Finalizados ({pedidosFinalizados.length})
                </h2>
                <div className="space-y-3">
                  {pedidosFinalizados.map((pedido) => (
                    <PedidoCard 
                      key={pedido.id} 
                      pedido={pedido} 
                      onClick={() => navigate(`/delivery/tracking/${pedido.id}`)} 
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
}

function PedidoCard({ pedido, onClick }: { pedido: Pedido; onClick: () => void }) {
  const status = statusConfig[pedido.status] || statusConfig.pendente;
  const StatusIcon = status.icon;
  
  const itensResumo = pedido.itens
    .slice(0, 2)
    .map(i => `${i.quantidade}x ${i.nome_produto}`)
    .join(', ');
  const maisItens = pedido.itens.length > 2 ? ` +${pedido.itens.length - 2}` : '';

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
      style={{ borderLeftColor: pedido.status === 'entregue' ? '#22c55e' : pedido.status === 'cancelado' ? '#ef4444' : '#3b82f6' }}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold truncate">
                {pedido.empresa?.nome_fantasia || 'Restaurante'}
              </span>
              <Badge className={`${status.color} text-xs shrink-0`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {status.label}
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground truncate">
              {itensResumo}{maisItens}
            </p>
            
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">
                {format(new Date(pedido.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </span>
              <span className="font-bold text-primary">
                R$ {pedido.total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
