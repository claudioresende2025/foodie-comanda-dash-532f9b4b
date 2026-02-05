
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Users, Bell, BellRing, Check, Loader2, UtensilsCrossed, RefreshCw, 
  Clock, ChefHat, CheckCircle, Truck, XCircle, Receipt
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type PedidoStatus = Database['public']['Enums']['pedido_status'];

type Mesa = {
  id: string;
  numero_mesa: number;
  status: 'disponivel' | 'ocupada' | 'reservada' | 'juncao' | 'solicitou_fechamento';
  capacidade: number;
  mesa_juncao_id: string | null;
  nome?: string | null;
};

type ChamadaGarcom = {
  id: string;
  mesa_id: string;
  status: string;
  created_at: string;
  mesa?: { id?: string; numero_mesa: number; nome?: string | null };
};

// Cores de status para mesas
const mesaStatusColors = {
  disponivel: 'bg-white border-green-500 text-foreground',
  ocupada: 'bg-white border-orange-500 text-foreground',
  reservada: 'bg-white border-yellow-500 text-foreground',
  juncao: 'bg-white border-blue-500 text-foreground',
  solicitou_fechamento: 'bg-red-100 border-red-500 text-red-800 animate-pulse',
};

const mesaStatusLabels = {
  disponivel: 'Disponível',
  ocupada: 'Ocupada',
  reservada: 'Reservada',
  juncao: 'Junção',
  solicitou_fechamento: 'Fechar Conta',
};

// Config de status para pedidos (igual ao KDS)
const statusConfig: Record<PedidoStatus, { label: string; color: string; icon: React.ElementType }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-500', icon: Clock },
  preparando: { label: 'Preparando', color: 'bg-blue-500', icon: ChefHat },
  pronto: { label: 'Pronto', color: 'bg-green-500', icon: CheckCircle },
  entregue: { label: 'Entregue', color: 'bg-gray-500', icon: Truck },
  cancelado: { label: 'Cancelado', color: 'bg-red-500', icon: XCircle },
};

// Som de notificação
const playNotificationSound = () => {
  try {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    if (audioContext.state === 'suspended') audioContext.resume();

    const beep = (freq: number, durMs: number, delay: number = 0) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const startTime = audioContext.currentTime + delay;
      gain.gain.setValueAtTime(0.5, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + durMs / 1000);
      osc.start(startTime);
      osc.stop(startTime + durMs / 1000);
    };

    beep(800, 200, 0);
    beep(1000, 200, 0.25);
    beep(800, 200, 0.5);
    beep(1000, 300, 0.75);
  } catch (e) {
    console.log('Audio error:', e);
  }
};

export default function Garcom() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundIntervalRef, setSoundIntervalRef] = useState<NodeJS.Timeout | null>(null);
  const [activeTab, setActiveTab] = useState<PedidoStatus>('pendente');

  // ========== QUERIES ==========

  // Mesas
  const { data: mesas = [], isLoading: isLoadingMesas } = useQuery({
    queryKey: ['mesas-garcom', profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return [];
      const { data, error } = await supabase
        .from('mesas')
        .select('*')
        .eq('empresa_id', profile.empresa_id)
        .order('numero_mesa', { ascending: true });
      if (error) throw error;
      return data as Mesa[];
    },
    enabled: !!profile?.empresa_id,
    staleTime: 30000,
  });

  // Chamadas de garçom
  const { data: chamadas = [], refetch: refetchChamadas } = useQuery({
    queryKey: ['chamadas-garcom', profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return [];
      const { data, error } = await supabase
        .from('chamadas_garcom')
        .select(`*, mesa:mesas(id, numero_mesa)`)
        .eq('empresa_id', profile.empresa_id)
        .eq('status', 'pendente')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ChamadaGarcom[];
    },
    enabled: !!profile?.empresa_id,
    staleTime: 5000,
    refetchInterval: 10000,
  });

  // Pedidos (para ver status de todos os pedidos)
  const { data: pedidos = [], refetch: refetchPedidos } = useQuery({
    queryKey: ['pedidos-garcom', profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return [];
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          *,
          produto:produtos(nome, preco),
          comanda:comandas!inner(
            id,
            nome_cliente,
            empresa_id,
            mesa:mesas(numero_mesa)
          )
        `)
        .eq('comanda.empresa_id', profile.empresa_id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.empresa_id,
    staleTime: 3000,
    refetchInterval: 8000,
  });

  // ========== MUTATIONS ==========

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PedidoStatus }) => {
      const { error } = await supabase.from('pedidos').update({ status_cozinha: status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-garcom', profile?.empresa_id] });
      toast.success('Status atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });

  // ========== HELPERS ==========

  const getMesaDisplayName = (mesa: Mesa): string => {
    const baseName = (mesa.nome && mesa.nome.trim().length > 0) ? mesa.nome.trim() : `Mesa ${mesa.numero_mesa}`;
    const mergedChildren = mesas.filter(m => m.mesa_juncao_id === mesa.id);
    if (mergedChildren.length > 0) {
      const numbers = [mesa.numero_mesa, ...mergedChildren.map(m => m.numero_mesa)].sort((a, b) => a - b);
      return `Mesa ${numbers.join(' + ')}`;
    }
    if (mesa.mesa_juncao_id) {
      const masterMesa = mesas.find(m => m.id === mesa.mesa_juncao_id);
      if (masterMesa) {
        const allMerged = mesas.filter(m => m.mesa_juncao_id === mesa.mesa_juncao_id);
        const numbers = [masterMesa.numero_mesa, ...allMerged.map(m => m.numero_mesa)].sort((a, b) => a - b);
        return `Mesa ${numbers.join(' + ')}`;
      }
    }
    return baseName;
  };

  const getMesaDisplayNameById = (mesaId?: string) => {
    if (!mesaId) return 'Mesa ?';
    const mesa = mesas.find(m => m.id === mesaId);
    return mesa ? getMesaDisplayName(mesa) : 'Mesa ?';
  };

  const getNextStatus = (current: PedidoStatus): PedidoStatus | null => {
    const flow: Record<PedidoStatus, PedidoStatus | null> = {
      pendente: 'preparando',
      preparando: 'pronto',
      pronto: 'entregue',
      entregue: null,
      cancelado: null,
    };
    return flow[current];
  };

  const filteredPedidos = useMemo(() => {
    return pedidos?.filter((p) => p.status_cozinha === activeTab) || [];
  }, [pedidos, activeTab]);

  const countByStatus = (status: PedidoStatus) => pedidos?.filter((p) => p.status_cozinha === status).length || 0;

  // Mesas visíveis (oculta as marcadas como 'juncao')
  const visibleMesas = mesas.filter(mesa => mesa.status !== 'juncao');

  // Mesas que solicitaram fechamento de conta
  const mesasFechamento = useMemo(() => {
    return mesas.filter(mesa => mesa.status === 'solicitou_fechamento');
  }, [mesas]);

  // ========== EFFECTS ==========

  // Som contínuo enquanto houver chamadas pendentes
  useEffect(() => {
    if (soundIntervalRef) {
      clearInterval(soundIntervalRef);
      setSoundIntervalRef(null);
    }

    // Tocar som quando houver chamadas pendentes OU mesas solicitando fechamento
    const hasAlerts = chamadas.length > 0 || mesasFechamento.length > 0;
    
    if (hasAlerts && soundEnabled) {
      playNotificationSound();
      const interval = setInterval(() => {
        playNotificationSound();
      }, 5000);
      setSoundIntervalRef(interval);
      return () => clearInterval(interval);
    }

    return () => {
      if (soundIntervalRef) clearInterval(soundIntervalRef);
    };
  }, [chamadas.length, mesasFechamento.length, soundEnabled]);

  // Realtime subscriptions
  useEffect(() => {
    if (!profile?.empresa_id) return;

    const channelChamadas = supabase
      .channel('garcom-chamadas')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chamadas_garcom', filter: `empresa_id=eq.${profile.empresa_id}` },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            if (soundEnabled) playNotificationSound();
            toast.info(`Nova chamada recebida!`, { duration: 5000 });
          }
          queryClient.invalidateQueries({ queryKey: ['chamadas-garcom', profile?.empresa_id] });
        }
      )
      .subscribe();

    const channelMesas = supabase
      .channel('garcom-mesas')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mesas', filter: `empresa_id=eq.${profile.empresa_id}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['mesas-garcom', profile?.empresa_id] });
          
          // Notificar quando uma mesa solicitar fechamento de conta
          if (payload.eventType === 'UPDATE') {
            const newStatus = (payload.new as any).status;
            const numeroMesa = (payload.new as any).numero_mesa;
            if (newStatus === 'solicitou_fechamento') {
              if (soundEnabled) playNotificationSound();
              toast.warning(`🧾 Mesa ${numeroMesa} solicitou fechamento de conta!`, { 
                duration: 10000,
                important: true 
              });
            }
          }
        }
      )
      .subscribe();

    const channelPedidos = supabase
      .channel('garcom-pedidos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['pedidos-garcom', profile.empresa_id] });
          if (payload.eventType === 'UPDATE') {
            const newStatus = (payload.new as any).status_cozinha;
            if (newStatus === 'pronto' && soundEnabled) {
              playNotificationSound();
              toast.success('🔔 Pedido pronto para entregar!', { duration: 5000 });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelChamadas);
      supabase.removeChannel(channelMesas);
      supabase.removeChannel(channelPedidos);
    };
  }, [profile?.empresa_id, soundEnabled, queryClient]);

  // ========== HANDLERS ==========

  const handleAtenderChamada = async (chamadaId: string) => {
    const { error } = await supabase
      .from('chamadas_garcom')
      .update({ status: 'atendida', atendida_at: new Date().toISOString() })
      .eq('id', chamadaId);

    if (error) {
      toast.error('Erro ao atender chamada');
    } else {
      toast.success('Chamada atendida!');
      queryClient.invalidateQueries({ queryKey: ['chamadas-garcom', profile?.empresa_id] });
      refetchChamadas();
    }
  };

  // Atender solicitação de fechamento - volta mesa para ocupada
  const handleAtenderFechamento = async (mesaId: string) => {
    const { error } = await supabase
      .from('mesas')
      .update({ status: 'ocupada' })
      .eq('id', mesaId);

    if (error) {
      toast.error('Erro ao atender solicitação');
    } else {
      toast.success('Solicitação de fechamento atendida!');
      queryClient.invalidateQueries({ queryKey: ['mesas-garcom', profile?.empresa_id] });
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['mesas-garcom', profile?.empresa_id] });
    queryClient.invalidateQueries({ queryKey: ['chamadas-garcom', profile?.empresa_id] });
    queryClient.invalidateQueries({ queryKey: ['pedidos-garcom', profile?.empresa_id] });
  };

  // ========== RENDER ==========

  if (isLoadingMesas) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2 md:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Painel do Garçom</h1>
          <p className="text-muted-foreground">Visão otimizada para tablet</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button
            variant={soundEnabled ? 'default' : 'outline'}
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? <Bell className="w-4 h-4 mr-2" /> : <Bell className="w-4 h-4 mr-2 opacity-50" />}
            Som {soundEnabled ? 'Ativado' : 'Desativado'}
          </Button>
        </div>
      </div>

      {/* Chamadas Pendentes */}
      {chamadas.length > 0 && (
        <Card className="border-2 border-orange-500 bg-orange-50 animate-pulse">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <BellRing className="w-5 h-5" />
              Chamadas Pendentes ({chamadas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {chamadas.map((chamada) => {
                const displayName = getMesaDisplayNameById(chamada.mesa_id);
                return (
                  <Button
                    key={chamada.id}
                    variant="destructive"
                    className="h-20 flex flex-col gap-1"
                    onClick={() => handleAtenderChamada(chamada.id)}
                    title={`Atender ${displayName}`}
                  >
                    <span className="text-lg font-bold">{displayName}</span>
                    <span className="text-xs flex items-center gap-1">
                      <Check className="w-3 h-3" /> Atender
                    </span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mesas Solicitando Fechamento de Conta */}
      {mesasFechamento.length > 0 && (
        <Card className="border-2 border-red-500 bg-red-50 animate-pulse">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Receipt className="w-5 h-5" />
              Fechamento de Conta ({mesasFechamento.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {mesasFechamento.map((mesa) => {
                const displayName = getMesaDisplayName(mesa);
                return (
                  <Button
                    key={mesa.id}
                    className="h-20 flex flex-col gap-1 bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => handleAtenderFechamento(mesa.id)}
                    title={`Atender ${displayName}`}
                  >
                    <span className="text-lg font-bold">{displayName}</span>
                    <span className="text-xs flex items-center gap-1">
                      <Check className="w-3 h-3" /> Atender
                    </span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legenda de status das mesas */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(mesaStatusLabels)
          .filter(([key]) => key !== 'juncao')
          .map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded border-2 ${mesaStatusColors[key as keyof typeof mesaStatusColors].split(' ').slice(0, 2).join(' ')}`} />
              <span className="text-sm text-muted-foreground">{label}</span>
            </div>
          ))}
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 bg-blue-100 border-blue-500" />
          <span className="text-sm text-muted-foreground">Mesas Juntas</span>
        </div>
      </div>

      {/* Grid de Mesas */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
        {visibleMesas.map((mesa) => {
          const displayName = getMesaDisplayName(mesa);
          const hasMergedChildren = mesas.some(m => m.mesa_juncao_id === mesa.id);

          return (
            <Card
              key={mesa.id}
              className={`transition-all hover:scale-105 cursor-pointer border-2 ${mesaStatusColors[mesa.status]} min-w-[100px]`}
              title={displayName}
            >
              <CardContent className="p-3 text-center">
                <div className="flex flex-col items-center gap-1">
                  <UtensilsCrossed className="w-6 h-6 opacity-70" />
                  <span className="text-sm md:text-lg font-bold whitespace-nowrap">
                    {displayName}
                  </span>
                  <span className="text-xs opacity-80">
                    {mesa.capacidade} lug.
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1 py-0 mt-1"
                  >
                    {hasMergedChildren ? 'Juntas' : mesaStatusLabels[mesa.status]}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {visibleMesas.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma mesa cadastrada</p>
          </CardContent>
        </Card>
      )}

      {/* Separador */}
      <div className="border-t pt-6">
        <h2 className="text-xl font-bold text-foreground mb-4">Acompanhamento de Pedidos</h2>
      </div>

      {/* Tabs de Pedidos (igual ao KDS) */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PedidoStatus)}>
        <TabsList className="grid w-full grid-cols-4 h-auto">
          {(['pendente', 'preparando', 'pronto', 'entregue'] as PedidoStatus[]).map((status) => {
            const config = statusConfig[status];
            const count = countByStatus(status);
            return (
              <TabsTrigger
                key={status}
                value={status}
                className="relative flex flex-col sm:flex-row items-center gap-1 py-2 px-1 sm:px-3 text-xs sm:text-sm"
              >
                <config.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{config.label}</span>
                {count > 0 && (
                  <Badge
                    variant="secondary"
                    className="absolute -top-1 -right-1 sm:relative sm:top-0 sm:right-0 sm:ml-1 h-5 w-5 flex items-center justify-center text-[10px] sm:text-xs"
                  >
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {(['pendente', 'preparando', 'pronto', 'entregue'] as PedidoStatus[]).map((status) => (
          <TabsContent key={status} value={status} className="mt-6">
            {filteredPedidos.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-muted-foreground">
                    Nenhum pedido {statusConfig[status].label.toLowerCase()}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredPedidos.map((pedido) => {
                  const StatusIcon = statusConfig[pedido.status_cozinha as PedidoStatus].icon;
                  const nextStatus = getNextStatus(pedido.status_cozinha as PedidoStatus);

                  return (
                    <Card key={pedido.id} className="relative overflow-hidden">
                      <div
                        className={`absolute top-0 left-0 right-0 h-1 ${statusConfig[pedido.status_cozinha as PedidoStatus].color}`}
                      />
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">Mesa {pedido.comanda?.mesa?.numero_mesa || '-'}</CardTitle>
                          <Badge variant="outline" className="text-xs">
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig[pedido.status_cozinha as PedidoStatus].label}
                          </Badge>
                        </div>
                        {pedido.comanda?.nome_cliente && (
                          <p className="text-sm text-muted-foreground">{pedido.comanda.nome_cliente}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(pedido.created_at).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{pedido.produto?.nome || 'Produto não encontrado'}</span>
                            <Badge variant="secondary">x{pedido.quantidade}</Badge>
                          </div>
                          {pedido.notas_cliente && (
                            <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                              📝 {pedido.notas_cliente}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {nextStatus && (
                            <Button
                              className="flex-1"
                              onClick={() => updateStatusMutation.mutate({ id: pedido.id, status: nextStatus })}
                              disabled={updateStatusMutation.isPending}
                            >
                              {updateStatusMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : null}
                              {statusConfig[nextStatus].label}
                            </Button>
                          )}
                          {pedido.status_cozinha !== 'cancelado' && pedido.status_cozinha !== 'entregue' && (
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => updateStatusMutation.mutate({ id: pedido.id, status: 'cancelado' })}
                              disabled={updateStatusMutation.isPending}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
