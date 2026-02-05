
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { PixQRCode } from '@/components/pix/PixQRCode';
import { 
  Users, Bell, BellRing, Check, Loader2, UtensilsCrossed, RefreshCw, 
  Clock, ChefHat, CheckCircle, Truck, XCircle, Receipt, DollarSign, CreditCard, Banknote, QrCode
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type PedidoStatus = Database['public']['Enums']['pedido_status'];

type Mesa = {
  id: string;
  numero_mesa: number;
  status: 'disponivel' | 'ocupada' | 'reservada' | 'juncao' | 'solicitou_fechamento' | 'aguardando_pagamento';
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
  aguardando_pagamento: 'bg-purple-100 border-purple-500 text-purple-800 animate-pulse',
};

const mesaStatusLabels = {
  disponivel: 'Disponível',
  ocupada: 'Ocupada',
  reservada: 'Reservada',
  juncao: 'Junção',
  solicitou_fechamento: 'Fechar Conta',
  aguardando_pagamento: 'Aguardando Pag.',
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

  // Estados para "Dar Baixa" (finalização pelo garçom)
  const [darBaixaDialogOpen, setDarBaixaDialogOpen] = useState(false);
  const [selectedMesaForBaixa, setSelectedMesaForBaixa] = useState<Mesa | null>(null);
  const [baixaFormaPagamento, setBaixaFormaPagamento] = useState<'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito'>('dinheiro');
  const [baixaObservacao, setBaixaObservacao] = useState('');
  const [isProcessingBaixa, setIsProcessingBaixa] = useState(false);
  const [baixaTotalValue, setBaixaTotalValue] = useState(0);

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

  // Empresa (para obter chave PIX)
  const { data: empresa } = useQuery({
    queryKey: ['empresa', profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return null;
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .eq('id', profile.empresa_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.empresa_id,
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

  // Abrir modal "Dar Baixa" - busca total da mesa
  const handleOpenDarBaixa = async (mesa: Mesa) => {
    setSelectedMesaForBaixa(mesa);
    setBaixaFormaPagamento('dinheiro');
    setBaixaObservacao('');
    setBaixaTotalValue(0);
    setDarBaixaDialogOpen(true);

    // Buscar total dos pedidos diretamente pela mesa
    try {
      // Primeiro buscar comandas da mesa
      const { data: comandas, error: errorComandas } = await supabase
        .from('comandas')
        .select('id, status')
        .eq('mesa_id', mesa.id)
        .neq('status', 'fechada');

      console.log('[DAR BAIXA] Comandas da mesa:', comandas, 'Erro:', errorComandas);

      if (comandas && comandas.length > 0) {
        const comandaIds = comandas.map(c => c.id);
        
        // Buscar pedidos dessas comandas
        const { data: pedidos, error: errorPedidos } = await supabase
          .from('pedidos')
          .select('id, subtotal, comanda_id')
          .in('comanda_id', comandaIds);

        console.log('[DAR BAIXA] Pedidos encontrados:', pedidos, 'Erro:', errorPedidos);

        if (pedidos && pedidos.length > 0) {
          const total = pedidos.reduce((acc: number, p: any) => acc + (p.subtotal || 0), 0);
          console.log('[DAR BAIXA] Total calculado:', total);
          setBaixaTotalValue(total);
        } else {
          console.log('[DAR BAIXA] Nenhum pedido encontrado para as comandas');
        }
      } else {
        console.log('[DAR BAIXA] Nenhuma comanda encontrada para mesa:', mesa.id);
      }
    } catch (e) {
      console.error('Erro ao buscar total:', e);
    }
  };

  // Processar "Dar Baixa" - finaliza pagamento pelo garçom
  const handleProcessarBaixa = async () => {
    if (!selectedMesaForBaixa || !profile?.id) return;

    setIsProcessingBaixa(true);

    try {
      // 1. Validação de concorrência: Verificar se status ainda é válido
      const { data: mesaAtual } = await supabase
        .from('mesas')
        .select('status')
        .eq('id', selectedMesaForBaixa.id)
        .single();

      if (!mesaAtual || (mesaAtual.status !== 'solicitou_fechamento' && mesaAtual.status !== 'aguardando_pagamento' && mesaAtual.status !== 'ocupada')) {
        toast.error('Esta mesa já foi processada por outro funcionário.');
        setDarBaixaDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ['mesas-garcom', profile?.empresa_id] });
        return;
      }

      // 2. Buscar TODAS as comandas da mesa (não fechadas)
      const { data: comandas } = await supabase
        .from('comandas')
        .select('id')
        .eq('mesa_id', selectedMesaForBaixa.id)
        .neq('status', 'fechada');

      if (comandas && comandas.length > 0) {
        const comandaIds = comandas.map(c => c.id);
        
        // 3. Registrar na tabela vendas_concluidas (uma entrada por comanda ou consolidado)
        await supabase.from('vendas_concluidas').insert({
          empresa_id: profile.empresa_id,
          comanda_id: comandaIds[0], // Usa a primeira como referência
          mesa_id: selectedMesaForBaixa.id,
          valor_total: baixaTotalValue,
          valor_subtotal: baixaTotalValue,
          forma_pagamento: baixaFormaPagamento,
          processado_por: profile.id,
          tipo_processamento: 'garcom',
          observacao: baixaObservacao || null,
        });

        // 4. Fechar TODAS as comandas
        await supabase
          .from('comandas')
          .update({
            status: 'fechada',
            forma_pagamento: baixaFormaPagamento,
            total: baixaTotalValue / comandas.length, // Divide proporcionalmente
            data_fechamento: new Date().toISOString(),
          })
          .in('id', comandaIds);

        // 5. Marcar TODOS os pedidos como finalizados
        await supabase
          .from('pedidos')
          .update({ status_cozinha: 'entregue' })
          .in('comanda_id', comandaIds);
      }

      // 6. Liberar mesa
      await supabase
        .from('mesas')
        .update({ status: 'disponivel' })
        .eq('id', selectedMesaForBaixa.id);

      toast.success('Baixa realizada com sucesso! Mesa liberada.');
      setDarBaixaDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['mesas-garcom', profile?.empresa_id] });
      queryClient.invalidateQueries({ queryKey: ['comandas-abertas', profile?.empresa_id] });
    } catch (error: any) {
      console.error('Erro ao dar baixa:', error);
      toast.error(`Erro ao processar baixa: ${error.message}`);
    } finally {
      setIsProcessingBaixa(false);
    }
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {mesasFechamento.map((mesa) => {
                const displayName = getMesaDisplayName(mesa);
                return (
                  <div
                    key={mesa.id}
                    className="p-3 bg-white border-2 border-red-400 rounded-lg space-y-2"
                  >
                    <div className="text-center">
                      <span className="text-lg font-bold text-red-700">{displayName}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAtenderFechamento(mesa.id)}
                        title="Ir até a mesa"
                      >
                        <Check className="w-3 h-3 mr-1" />
                        Atender
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleOpenDarBaixa(mesa)}
                        title="Registrar pagamento"
                      >
                        <DollarSign className="w-3 h-3 mr-1" />
                        Dar Baixa
                      </Button>
                    </div>
                  </div>
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

      {/* Modal Dar Baixa */}
      <Dialog open={darBaixaDialogOpen} onOpenChange={setDarBaixaDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Dar Baixa - {selectedMesaForBaixa ? getMesaDisplayName(selectedMesaForBaixa) : ''}
            </DialogTitle>
            <DialogDescription>
              Registre o pagamento recebido pelo garçom
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Valor Total */}
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Valor Total</p>
              <p className="text-3xl font-bold text-green-600">
                R$ {baixaTotalValue.toFixed(2).replace('.', ',')}
              </p>
            </div>

            {/* Forma de Pagamento */}
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <RadioGroup
                value={baixaFormaPagamento}
                onValueChange={(v) => setBaixaFormaPagamento(v as any)}
                className="grid grid-cols-2 gap-2"
              >
                <Label
                  htmlFor="dinheiro"
                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    baixaFormaPagamento === 'dinheiro' ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                  }`}
                >
                  <RadioGroupItem value="dinheiro" id="dinheiro" />
                  <Banknote className="w-4 h-4" />
                  <span>Dinheiro</span>
                </Label>
                <Label
                  htmlFor="pix"
                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    baixaFormaPagamento === 'pix' ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                  }`}
                >
                  <RadioGroupItem value="pix" id="pix" />
                  <QrCode className="w-4 h-4" />
                  <span>PIX</span>
                </Label>
                <Label
                  htmlFor="cartao_credito"
                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    baixaFormaPagamento === 'cartao_credito' ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                  }`}
                >
                  <RadioGroupItem value="cartao_credito" id="cartao_credito" />
                  <CreditCard className="w-4 h-4" />
                  <span>Crédito</span>
                </Label>
                <Label
                  htmlFor="cartao_debito"
                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    baixaFormaPagamento === 'cartao_debito' ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                  }`}
                >
                  <RadioGroupItem value="cartao_debito" id="cartao_debito" />
                  <CreditCard className="w-4 h-4" />
                  <span>Débito</span>
                </Label>
              </RadioGroup>
            </div>

            {/* QR Code PIX - exibir quando PIX selecionado */}
            {baixaFormaPagamento === 'pix' && (
              <div className="border rounded-lg p-4 bg-muted/30">
                {empresa?.chave_pix ? (
                  <PixQRCode
                    chavePix={empresa.chave_pix}
                    valor={baixaTotalValue}
                    nomeRecebedor={empresa?.nome_fantasia || 'Restaurante'}
                    cidade={empresa?.endereco_completo?.split(',').pop()?.trim() || 'SAO PAULO'}
                    expiracaoMinutos={5}
                  />
                ) : (
                  <div className="text-center p-4 border rounded-lg bg-amber-50 text-amber-700">
                    <p className="font-medium">Chave PIX não configurada</p>
                    <p className="text-sm mt-1">Configure a chave PIX nas configurações da empresa.</p>
                  </div>
                )}
              </div>
            )}

            {/* Observação */}
            <div className="space-y-2">
              <Label htmlFor="observacao">Observação (opcional)</Label>
              <Textarea
                id="observacao"
                placeholder="Alguma anotação sobre o fechamento..."
                value={baixaObservacao}
                onChange={(e) => setBaixaObservacao(e.target.value)}
                className="h-20 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDarBaixaDialogOpen(false)}
              disabled={isProcessingBaixa}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleProcessarBaixa}
              disabled={isProcessingBaixa}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessingBaixa ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Confirmar Baixa
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
