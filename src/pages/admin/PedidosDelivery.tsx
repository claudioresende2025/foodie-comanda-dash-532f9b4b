import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { 
  Loader2, 
  Truck, 
  Clock, 
  MapPin, 
  Phone, 
  Package, 
  CheckCircle2,
  XCircle,
  ChefHat,
  Navigation
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type DeliveryStatus = 'pendente' | 'confirmado' | 'em_preparo' | 'saiu_entrega' | 'entregue' | 'cancelado';

interface PedidoDelivery {
  id: string;
  status: DeliveryStatus;
  subtotal: number;
  taxa_entrega: number;
  total: number;
  notas: string | null;
  forma_pagamento: string | null;
  created_at: string;
  endereco: {
    nome_cliente: string;
    telefone: string;
    rua: string;
    numero: string;
    bairro: string;
    cidade: string;
    estado: string;
    complemento: string | null;
    referencia: string | null;
  };
  itens: {
    id: string;
    nome_produto: string;
    quantidade: number;
    preco_unitario: number;
    subtotal: number;
    notas: string | null;
  }[];
}

const statusConfig: Record<DeliveryStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-500', icon: Clock },
  confirmado: { label: 'Confirmado', color: 'bg-blue-500', icon: CheckCircle2 },
  em_preparo: { label: 'Em Preparo', color: 'bg-orange-500', icon: ChefHat },
  saiu_entrega: { label: 'Saiu p/ Entrega', color: 'bg-purple-500', icon: Navigation },
  entregue: { label: 'Entregue', color: 'bg-green-500', icon: Package },
  cancelado: { label: 'Cancelado', color: 'bg-red-500', icon: XCircle },
};

const statusOrder: DeliveryStatus[] = ['pendente', 'confirmado', 'em_preparo', 'saiu_entrega', 'entregue'];

export default function PedidosDelivery() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPedido, setSelectedPedido] = useState<PedidoDelivery | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const { data: pedidos, isLoading, error: queryError } = useQuery({
    queryKey: ['pedidos-delivery', profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) {
        console.log('[PedidosDelivery] No empresa_id found in profile');
        return [];
      }

      console.log('[PedidosDelivery] Fetching orders for empresa:', profile.empresa_id);

      const { data, error } = await supabase
        .from('pedidos_delivery')
        .select(`
          id,
          status,
          subtotal,
          taxa_entrega,
          total,
          notas,
          forma_pagamento,
          created_at,
          enderecos_cliente!pedidos_delivery_endereco_id_fkey (
            nome_cliente,
            telefone,
            rua,
            numero,
            bairro,
            cidade,
            estado,
            complemento,
            referencia
          ),
          itens_delivery!itens_delivery_pedido_delivery_id_fkey (
            id,
            nome_produto,
            quantidade,
            preco_unitario,
            subtotal,
            notas
          )
        `)
        .eq('empresa_id', profile.empresa_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[PedidosDelivery] Query error:', error);
        throw error;
      }

      console.log('[PedidosDelivery] Found orders:', data?.length || 0);

      return (data || []).map((p: any) => ({
        ...p,
        endereco: p.enderecos_cliente,
        itens: p.itens_delivery || [],
      })) as PedidoDelivery[];
    },
    enabled: !!profile?.empresa_id,
    refetchInterval: 10000,
  });

  // Debug logging
  useEffect(() => {
    console.log('[PedidosDelivery] Profile:', profile);
    console.log('[PedidosDelivery] Loading:', isLoading);
    console.log('[PedidosDelivery] Query Error:', queryError);
    console.log('[PedidosDelivery] Pedidos:', pedidos);
  }, [profile, isLoading, queryError, pedidos]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ pedidoId, newStatus }: { pedidoId: string; newStatus: DeliveryStatus }) => {
      const { error } = await supabase
        .from('pedidos_delivery')
        .update({ status: newStatus })
        .eq('id', pedidoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-delivery'] });
      toast.success('Status atualizado!');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao atualizar status');
    },
  });

  const handleStatusChange = (pedidoId: string, currentStatus: DeliveryStatus) => {
    const currentIndex = statusOrder.indexOf(currentStatus);
    if (currentIndex < statusOrder.length - 1) {
      const newStatus = statusOrder[currentIndex + 1];
      updateStatusMutation.mutate({ pedidoId, newStatus });
    }
  };

  const handleCancelPedido = (pedidoId: string) => {
    updateStatusMutation.mutate({ pedidoId, newStatus: 'cancelado' });
  };

  const getNextStatusLabel = (currentStatus: DeliveryStatus): string | null => {
    const currentIndex = statusOrder.indexOf(currentStatus);
    if (currentIndex < statusOrder.length - 1) {
      return statusConfig[statusOrder[currentIndex + 1]].label;
    }
    return null;
  };

  const openPedidoDetails = (pedido: PedidoDelivery) => {
    setSelectedPedido(pedido);
    setIsSheetOpen(true);
  };

  // Mostrar loading apenas se profile ainda está carregando
  if (isLoading && profile?.empresa_id) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando pedidos...</span>
      </div>
    );
  }

  // Se não tem empresa_id, mostrar mensagem
  if (!profile?.empresa_id) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Truck className="w-16 h-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium">Configuração pendente</h3>
        <p className="text-muted-foreground">Configure sua empresa para ver os pedidos de delivery</p>
      </div>
    );
  }

  // Se houve erro na query
  if (queryError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <XCircle className="w-16 h-16 text-destructive/50 mb-4" />
        <h3 className="text-lg font-medium">Erro ao carregar pedidos</h3>
        <p className="text-muted-foreground">{(queryError as Error).message}</p>
      </div>
    );
  }

  const pedidosAtivos = pedidos?.filter(p => !['entregue', 'cancelado'].includes(p.status)) || [];
  const pedidosFinalizados = pedidos?.filter(p => ['entregue', 'cancelado'].includes(p.status)) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pedidos Delivery</h1>
          <p className="text-muted-foreground">Gerencie os pedidos de entrega</p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          <Truck className="w-5 h-5 mr-2" />
          {pedidosAtivos.length} ativos
        </Badge>
      </div>

      {pedidosAtivos.length === 0 && pedidosFinalizados.length === 0 ? (
        <Card className="p-12 text-center">
          <Truck className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">Nenhum pedido ainda</h3>
          <p className="text-muted-foreground">Os pedidos de delivery aparecerão aqui</p>
        </Card>
      ) : (
        <>
          {/* Pedidos Ativos */}
          {pedidosAtivos.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Pedidos Ativos ({pedidosAtivos.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pedidosAtivos.map((pedido) => {
                  const StatusIcon = statusConfig[pedido.status].icon;
                  const nextStatus = getNextStatusLabel(pedido.status);

                  return (
                    <Card key={pedido.id} className="overflow-hidden">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            #{pedido.id.slice(0, 8)}
                          </CardTitle>
                          <Badge className={`${statusConfig[pedido.status].color} text-white`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig[pedido.status].label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(pedido.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                          <span className="line-clamp-2">
                            {pedido.endereco?.rua}, {pedido.endereco?.numero} - {pedido.endereco?.bairro}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span>{pedido.endereco?.telefone}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="font-bold text-lg text-primary">
                            R$ {pedido.total.toFixed(2)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {pedido.itens.length} item(s)
                          </span>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => openPedidoDetails(pedido)}
                          >
                            Detalhes
                          </Button>
                          {nextStatus && (
                            <Button 
                              size="sm" 
                              className="flex-1"
                              onClick={() => handleStatusChange(pedido.id, pedido.status)}
                              disabled={updateStatusMutation.isPending}
                            >
                              {updateStatusMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                nextStatus
                              )}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pedidos Finalizados */}
          {pedidosFinalizados.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Pedidos Finalizados ({pedidosFinalizados.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pedidosFinalizados.slice(0, 6).map((pedido) => {
                  const StatusIcon = statusConfig[pedido.status].icon;

                  return (
                    <Card key={pedido.id} className="overflow-hidden opacity-75">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            #{pedido.id.slice(0, 8)}
                          </CardTitle>
                          <Badge className={`${statusConfig[pedido.status].color} text-white`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig[pedido.status].label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(pedido.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-primary">
                            R$ {pedido.total.toFixed(2)}
                          </span>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openPedidoDetails(pedido)}
                          >
                            Ver
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Sheet de Detalhes */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Pedido #{selectedPedido?.id.slice(0, 8)}</SheetTitle>
          </SheetHeader>
          
          {selectedPedido && (
            <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-4">
              <div className="space-y-6">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <Badge className={`${statusConfig[selectedPedido.status].color} text-white px-3 py-1`}>
                    {statusConfig[selectedPedido.status].label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(selectedPedido.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>

                <Separator />

                {/* Cliente */}
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Entrega
                  </h3>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                    <p className="font-medium">{selectedPedido.endereco?.nome_cliente}</p>
                    <p>{selectedPedido.endereco?.rua}, {selectedPedido.endereco?.numero}</p>
                    {selectedPedido.endereco?.complemento && (
                      <p>{selectedPedido.endereco.complemento}</p>
                    )}
                    <p>{selectedPedido.endereco?.bairro} - {selectedPedido.endereco?.cidade}/{selectedPedido.endereco?.estado}</p>
                    {selectedPedido.endereco?.referencia && (
                      <p className="text-muted-foreground">Ref: {selectedPedido.endereco.referencia}</p>
                    )}
                    <div className="flex items-center gap-2 pt-2">
                      <Phone className="w-4 h-4" />
                      <span>{selectedPedido.endereco?.telefone}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Itens */}
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Itens do Pedido
                  </h3>
                  <div className="space-y-2">
                    {selectedPedido.itens.map((item) => (
                      <div key={item.id} className="flex justify-between items-start bg-muted/50 rounded-lg p-3">
                        <div className="flex-1">
                          <p className="font-medium">{item.quantidade}x {item.nome_produto}</p>
                          {item.notas && (
                            <p className="text-xs text-muted-foreground">{item.notas}</p>
                          )}
                        </div>
                        <span className="font-medium">R$ {item.subtotal.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedPedido.notas && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h3 className="font-semibold">Observações</h3>
                      <p className="text-sm bg-muted/50 rounded-lg p-3">{selectedPedido.notas}</p>
                    </div>
                  </>
                )}

                <Separator />

                {/* Totais */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>R$ {selectedPedido.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Taxa de entrega</span>
                    <span>R$ {selectedPedido.taxa_entrega.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total</span>
                    <span className="text-primary">R$ {selectedPedido.total.toFixed(2)}</span>
                  </div>
                  {selectedPedido.forma_pagamento && (
                    <p className="text-sm text-muted-foreground">
                      Pagamento: {selectedPedido.forma_pagamento === 'pix' ? 'PIX' : 'Cartão'}
                    </p>
                  )}
                </div>

                {/* Ações */}
                {!['entregue', 'cancelado'].includes(selectedPedido.status) && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      {getNextStatusLabel(selectedPedido.status) && (
                        <Button 
                          className="w-full"
                          onClick={() => {
                            handleStatusChange(selectedPedido.id, selectedPedido.status);
                            setIsSheetOpen(false);
                          }}
                          disabled={updateStatusMutation.isPending}
                        >
                          {updateStatusMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          Avançar para: {getNextStatusLabel(selectedPedido.status)}
                        </Button>
                      )}
                      <Button 
                        variant="destructive" 
                        className="w-full"
                        onClick={() => {
                          handleCancelPedido(selectedPedido.id);
                          setIsSheetOpen(false);
                        }}
                        disabled={updateStatusMutation.isPending}
                      >
                        Cancelar Pedido
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
