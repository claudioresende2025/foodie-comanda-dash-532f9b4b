import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, ArrowLeft, Clock, CheckCircle2, Truck, Package, 
  XCircle, MapPin, Phone, User, Receipt, Store 
} from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type DeliveryStatus = Database['public']['Enums']['delivery_status'];

const statusConfig: Record<DeliveryStatus, { 
  label: string; 
  color: string; 
  bgColor: string;
  icon: any;
  message: string;
}> = {
  pendente: { 
    label: 'Aguardando Confirmação', 
    color: 'text-yellow-600', 
    bgColor: 'bg-yellow-100',
    icon: Clock,
    message: 'Seu pedido foi recebido e está aguardando confirmação do restaurante.'
  },
  confirmado: { 
    label: 'Confirmado', 
    color: 'text-blue-600', 
    bgColor: 'bg-blue-100',
    icon: CheckCircle2,
    message: 'O restaurante confirmou seu pedido e em breve começará o preparo.'
  },
  em_preparo: { 
    label: 'Em Preparo', 
    color: 'text-orange-600', 
    bgColor: 'bg-orange-100',
    icon: Package,
    message: 'Seu pedido está sendo preparado com carinho!'
  },
  saiu_entrega: { 
    label: 'Saiu para Entrega', 
    color: 'text-purple-600', 
    bgColor: 'bg-purple-100',
    icon: Truck,
    message: 'Seu pedido saiu para entrega! Em breve chegará até você.'
  },
  entregue: { 
    label: 'Entregue', 
    color: 'text-green-600', 
    bgColor: 'bg-green-100',
    icon: CheckCircle2,
    message: 'Pedido entregue! Bom apetite!'
  },
  cancelado: { 
    label: 'Cancelado', 
    color: 'text-red-600', 
    bgColor: 'bg-red-100',
    icon: XCircle,
    message: 'Este pedido foi cancelado.'
  },
};

const statusOrder: DeliveryStatus[] = ['pendente', 'confirmado', 'em_preparo', 'saiu_entrega', 'entregue'];

export default function DeliveryTracking() {
  const { pedidoId } = useParams<{ pedidoId: string }>();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState<any>(null);
  const [empresa, setEmpresa] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPedido = useCallback(async () => {
    if (!pedidoId) return;
    try {
      const { data, error } = await supabase
        .from('pedidos_delivery')
        .select(`
          *,
          endereco:enderecos_cliente(*),
          itens:itens_delivery(*)
        `)
        .eq('id', pedidoId)
        .single();

      if (error) throw error;
      if (!data) {
        setError('Pedido não encontrado');
        setIsLoading(false);
        return;
      }

      setPedido(data);

      // Fetch empresa
      const { data: empresaData } = await supabase
        .from('empresas')
        .select('nome_fantasia, logo_url, endereco_completo')
        .eq('id', data.empresa_id)
        .single();

      setEmpresa(empresaData);
    } catch (err) {
      console.error('Error fetching pedido:', err);
      setError('Erro ao carregar pedido');
    } finally {
      setIsLoading(false);
    }
  }, [pedidoId]);

  useEffect(() => {
    fetchPedido();
  }, [fetchPedido]);

  // Realtime subscription
  useEffect(() => {
    if (!pedidoId) return;

    const channel = supabase
      .channel(`pedido-${pedidoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pedidos_delivery',
          filter: `id=eq.${pedidoId}`,
        },
        (payload) => {
          setPedido((prev: any) => ({ ...prev, ...payload.new }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pedidoId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !pedido) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Receipt className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-xl font-semibold text-foreground">{error || 'Pedido não encontrado'}</h1>
        <Button onClick={() => navigate('/delivery')} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  const currentStatus = pedido.status as DeliveryStatus;
  const StatusIcon = statusConfig[currentStatus]?.icon || Clock;
  const currentIndex = statusOrder.indexOf(currentStatus);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/delivery')}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Acompanhar Pedido</h1>
              <p className="text-sm text-primary-foreground/80">
                #{pedido.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Status Card */}
        <Card>
          <CardContent className="p-6">
            <div className={`flex items-center gap-4 p-4 rounded-lg ${statusConfig[currentStatus]?.bgColor}`}>
              <div className={`p-3 rounded-full bg-white ${statusConfig[currentStatus]?.color}`}>
                <StatusIcon className="w-8 h-8" />
              </div>
              <div>
                <h2 className={`text-xl font-bold ${statusConfig[currentStatus]?.color}`}>
                  {statusConfig[currentStatus]?.label}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {statusConfig[currentStatus]?.message}
                </p>
              </div>
            </div>

            {/* Progress Steps */}
            {currentStatus !== 'cancelado' && (
              <div className="mt-6">
                <div className="flex items-center justify-between relative">
                  {statusOrder.map((status, index) => {
                    const isActive = index <= currentIndex;
                    const Icon = statusConfig[status].icon;
                    
                    return (
                      <div key={status} className="flex flex-col items-center z-10">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className={`text-xs mt-2 text-center max-w-[60px] ${
                          isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
                        }`}>
                          {statusConfig[status].label.split(' ')[0]}
                        </span>
                      </div>
                    );
                  })}
                  
                  {/* Progress line */}
                  <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted -z-0 mx-5">
                    <div 
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${(currentIndex / (statusOrder.length - 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Restaurant Info */}
        {empresa && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {empresa.logo_url ? (
                  <img
                    src={empresa.logo_url}
                    alt={empresa.nome_fantasia}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Store className="w-6 h-6 text-primary" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold">{empresa.nome_fantasia}</h3>
                  {empresa.endereco_completo && (
                    <p className="text-sm text-muted-foreground">{empresa.endereco_completo}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delivery Address */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Endereço de Entrega
            </h3>
            <div className="space-y-1 text-sm">
              <p className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                {pedido.endereco?.nome_cliente}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                {pedido.endereco?.telefone}
              </p>
              <p className="mt-2">
                {pedido.endereco?.rua}, {pedido.endereco?.numero}
                {pedido.endereco?.complemento && ` - ${pedido.endereco.complemento}`}
              </p>
              <p>{pedido.endereco?.bairro} - {pedido.endereco?.cidade}/{pedido.endereco?.estado}</p>
              {pedido.endereco?.referencia && (
                <p className="text-muted-foreground">Ref: {pedido.endereco.referencia}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" />
              Itens do Pedido
            </h3>
            <div className="space-y-2">
              {pedido.itens?.map((item: any) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.quantidade}x {item.nome_produto}</span>
                  <span>R$ {item.subtotal?.toFixed(2)}</span>
                </div>
              ))}
            </div>
            
            <Separator className="my-3" />
            
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>R$ {pedido.subtotal?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxa de Entrega</span>
                <span>{pedido.taxa_entrega > 0 ? `R$ ${pedido.taxa_entrega?.toFixed(2)}` : 'Grátis'}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2">
                <span>Total</span>
                <span className="text-primary">R$ {pedido.total?.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Time */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Pedido realizado em</span>
              <span>{new Date(pedido.created_at).toLocaleString('pt-BR')}</span>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
