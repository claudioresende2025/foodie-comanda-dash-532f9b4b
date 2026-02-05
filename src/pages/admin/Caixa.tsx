import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Search,
  Receipt,
  Users,
  Printer,
  Loader2,
  Percent,
  DollarSign,
  Check,
  QrCode,
  Truck,
  Filter,
  RefreshCw,
  Music,
  Bell,
  AlertCircle,
  CreditCard,
  Banknote,
  X,
} from 'lucide-react';
import { PixQRCode } from '@/components/pix/PixQRCode';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { printCaixaReceipt } from '@/utils/kitchenPrinter';

type PaymentMethod = 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito';
type CaixaTab = 'mesas' | 'delivery';
type MesaStatus = 'disponivel' | 'ocupada' | 'reservada' | 'juncao' | 'solicitou_fechamento' | 'aguardando_pagamento';

type PagamentoItem = {
  metodo: PaymentMethod;
  valor: number;
};

type MesaPendente = {
  id: string;
  numero_mesa: number;
  status: MesaStatus;
  nome?: string | null;
};

// Som de notificação para alertas
const playNotificationSound = () => {
  try {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioContext = new AudioContextClass();
    if (audioContext.state === 'suspended') audioContext.resume();

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.value = 600;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.log('Audio error:', e);
  }
};

export default function Caixa() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Carrega configurações do localStorage
  const getSettings = () => {
    const saved = localStorage.getItem('fcd-settings');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      taxaServicoAtiva: true,
      taxaServicoPercentual: 10,
      couverAtivo: false,
      couverValor: 0,
    };
  };

  const savedSettings = getSettings();

  // UI states
  const [activeTab, setActiveTab] = useState<CaixaTab>('mesas');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedComanda, setSelectedComanda] = useState<any>(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [serviceCharge, setServiceCharge] = useState(savedSettings.taxaServicoPercentual || 10);
  const [includeService, setIncludeService] = useState(savedSettings.taxaServicoAtiva !== false);
  const [includeCouver, setIncludeCouver] = useState(false);
  const [couverQuantidade, setCouverQuantidade] = useState(1);
  const [couverValorConfig] = useState(savedSettings.couverValor || 0);
  const [couverAtivo] = useState(savedSettings.couverAtivo || false);
  const [formaPagamento, setFormaPagamento] = useState<PaymentMethod | ''>('');
  const [trocoPara, setTrocoPara] = useState('');
  
  // Pagamento múltiplo
  const [pagamentoMultiplo, setPagamentoMultiplo] = useState(false);
  const [pagamentos, setPagamentos] = useState<PagamentoItem[]>([]);
  const [metodosAtivos, setMetodosAtivos] = useState<PaymentMethod[]>([]);

  // PIX modal
  const [showPixModal, setShowPixModal] = useState(false);
  const [pixValue, setPixValue] = useState(0);

  // Filtros do histórico (Mesas)
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('');

  // Estados para Monitoramento de Mesas Pendentes
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [liquidacaoDialogOpen, setLiquidacaoDialogOpen] = useState(false);
  const [selectedMesaLiquidacao, setSelectedMesaLiquidacao] = useState<MesaPendente | null>(null);
  const [liquidacaoItems, setLiquidacaoItems] = useState<any[]>([]);
  const [liquidacaoTotal, setLiquidacaoTotal] = useState(0);
  const [liquidacaoComandaIds, setLiquidacaoComandaIds] = useState<string[]>([]);
  const [liquidacaoFormaPagamento, setLiquidacaoFormaPagamento] = useState<PaymentMethod>('dinheiro');
  const [isProcessingLiquidacao, setIsProcessingLiquidacao] = useState(false);

  /** --------- QUERIES --------- */

  // Mesas com status de fechamento pendente
  const { data: mesasPendentes = [] } = useQuery({
    queryKey: ['mesas-pendentes', profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return [];
      const { data, error } = await supabase
        .from('mesas')
        .select('id, numero_mesa, status, nome')
        .eq('empresa_id', profile.empresa_id)
        .in('status', ['solicitou_fechamento', 'aguardando_pagamento'])
        .order('numero_mesa');
      if (error) throw error;
      return data as MesaPendente[];
    },
    enabled: !!profile?.empresa_id,
    refetchInterval: 5000,
  });

  // Empresa
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
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  // Comandas abertas (Mesas)
  const {
    data: comandas = [],
    isLoading: isLoadingComandas,
  } = useQuery({
    queryKey: ['comandas-abertas', profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return [];
      const { data, error } = await supabase
        .from('comandas')
        .select(`
          *,
          mesa:mesas(numero_mesa),
          pedidos(id, quantidade, preco_unitario, subtotal, produto:produtos(nome))
        `)
        .eq('empresa_id', profile.empresa_id)
        .eq('status', 'aberta')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.empresa_id,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  // Histórico de Mesas (com filtros)
  const {
    data: historicoComandas = [],
    isLoading: isLoadingHistorico,
    refetch: refetchHistorico,
  } = useQuery({
    queryKey: ['comandas-fechadas', profile?.empresa_id, filterStartDate, filterEndDate, filterPaymentMethod],
    queryFn: async () => {
      if (!profile?.empresa_id) return [];
      let query = supabase
        .from('comandas')
        .select('*, mesa:mesas(numero_mesa)')
        .eq('empresa_id', profile.empresa_id)
        .eq('status', 'fechada');

      if (filterStartDate) query = query.gte('data_fechamento', filterStartDate);
      if (filterEndDate) query = query.lte('data_fechamento', filterEndDate);
      if (filterPaymentMethod) query = query.eq('forma_pagamento', filterPaymentMethod as PaymentMethod);

      const { data, error } = await query.order('data_fechamento', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.empresa_id,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  // Delivery
  const {
    data: pedidosDelivery = [],
    isLoading: isLoadingDelivery,
  } = useQuery({
    queryKey: ['pedidos-delivery-caixa', profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return [];
      const { data, error } = await supabase
        .from('pedidos_delivery')
        .select(`
          *,
          endereco:enderecos_cliente(nome_cliente, telefone),
          itens:itens_delivery(nome_produto, quantidade, subtotal)
        `)
        .eq('empresa_id', profile.empresa_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.empresa_id,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });

  /** --------- REALTIME & SOUND EFFECTS --------- */

  // Realtime subscription para mesas
  useEffect(() => {
    if (!profile?.empresa_id) return;

    const channel = supabase
      .channel('caixa-mesas-monitor')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mesas', filter: `empresa_id=eq.${profile.empresa_id}` },
        (payload) => {
          const newStatus = (payload.new as any).status;
          const numeroMesa = (payload.new as any).numero_mesa;
          
          // Notificar quando mesa solicitar fechamento
          if (newStatus === 'solicitou_fechamento' || newStatus === 'aguardando_pagamento') {
            if (soundEnabled) playNotificationSound();
            toast.warning(`💰 Mesa ${numeroMesa} aguardando fechamento!`, { duration: 8000 });
          }
          
          queryClient.invalidateQueries({ queryKey: ['mesas-pendentes', profile.empresa_id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.empresa_id, soundEnabled, queryClient]);

  // Computed: alertas pendentes
  const alertasPendentes = useMemo(() => {
    return mesasPendentes?.length || 0;
  }, [mesasPendentes]);

  /** --------- MUTATION: fechar comanda --------- */

  const closeComandaMutation = useMutation({
    mutationFn: async ({
      comandaId,
      formaPagamento,
      formasPagamento,
      trocoPara,
      total,
      mesaId,
    }: {
      comandaId: string;
      formaPagamento: PaymentMethod | 'multiplo';
      formasPagamento?: PagamentoItem[];
      trocoPara?: number;
      total: number;
      mesaId?: string;
    }) => {
      // Formata as formas de pagamento para salvar no banco
      const formasPagamentoStr = formasPagamento 
        ? formasPagamento.map(p => `${p.metodo}:${p.valor.toFixed(2)}`).join(',')
        : null;
      
      // 1. Fecha a comanda
      const { error } = await supabase
        .from('comandas')
        .update({
          status: 'fechada',
          forma_pagamento: formaPagamento === 'multiplo' ? 'dinheiro' : formaPagamento,
          troco_para: trocoPara || null,
          total,
          data_fechamento: new Date().toISOString(),
        })
        .eq('id', comandaId);
      if (error) throw error;
      
      // 2. Atualiza o status da mesa para disponível e desfaz junção se necessário
      // NOTA: O trigger 'update_mesa_status_on_comanda' também libera a mesa quando o status muda para 'fechada',
      // mas mantemos este código para garantir que junções sejam desfeitas corretamente
      if (mesaId) {
        // Busca informações da mesa
        const { data: mesaData } = await supabase
          .from('mesas')
          .select('id, mesa_juncao_id')
          .eq('id', mesaId)
          .single();

        if (mesaData?.mesa_juncao_id) {
          // Mesa filha: libera só ela
          await supabase
            .from('mesas')
            .update({ status: 'disponivel', mesa_juncao_id: null })
            .eq('id', mesaId);
        } else {
          // Mesa principal: libera todas as mesas da junção (inclusive ela) e desfaz junção
          const { data: mesasJuncao } = await supabase
            .from('mesas')
            .select('id')
            .or(`id.eq.${mesaId},mesa_juncao_id.eq.${mesaId}`);

          if (mesasJuncao && mesasJuncao.length > 0) {
            await supabase
              .from('mesas')
              .update({ status: 'disponivel', mesa_juncao_id: null })
              .in('id', mesasJuncao.map(m => m.id));
          }
        }
      }
      
      return { formaPagamento, formasPagamento, total, mesaId };
    },
    onSuccess: (result) => {
      // invalida com as mesmas chaves (incluindo empresa_id)
      queryClient.invalidateQueries({ queryKey: ['comandas-abertas', profile?.empresa_id] });
      queryClient.invalidateQueries({ queryKey: ['comandas-fechadas', profile?.empresa_id, filterStartDate, filterEndDate, filterPaymentMethod] });
      queryClient.invalidateQueries({ queryKey: ['mesas', profile?.empresa_id] });
      queryClient.invalidateQueries({ queryKey: ['mesas-garcom', profile?.empresa_id] });

      // Verifica se algum dos pagamentos é PIX
      const temPix = result.formaPagamento === 'pix' || 
        result.formasPagamento?.some(p => p.metodo === 'pix');
      
      if (temPix) {
        const valorPix = result.formasPagamento 
          ? result.formasPagamento.find(p => p.metodo === 'pix')?.valor || 0
          : result.total;
        setPixValue(valorPix);
        setShowPixModal(true);
        toast.success('Comanda fechada! Exibindo QR Code PIX.');
      } else {
        setSelectedComanda(null);
        setFormaPagamento('');
        setTrocoPara('');
        toast.success('Comanda fechada com sucesso!');
      }
    },
    onError: (error: any) => {
      console.error('Erro ao fechar comanda:', error);
      toast.error(`Erro ao fechar comanda: ${error.message}`);
    },
  });

  /** --------- MUTATION: cancelar comanda --------- */
  const cancelComandaMutation = useMutation({
    mutationFn: async ({ comandaId, mesaId }: { comandaId: string; mesaId?: string }) => {
      // 1. Atualizar comanda para status 'cancelada'
      const { error } = await supabase
        .from('comandas')
        .update({ status: 'cancelada', data_fechamento: new Date().toISOString() })
        .eq('id', comandaId);
      if (error) throw error;
      
      // 2. Liberar mesa (e mesas juntas, se houver)
      if (mesaId) {
        const { data: mesaData } = await supabase
          .from('mesas')
          .select('id, mesa_juncao_id')
          .eq('id', mesaId)
          .single();

        if (mesaData?.mesa_juncao_id) {
          // Mesa filha: libera só ela
          await supabase
            .from('mesas')
            .update({ status: 'disponivel', mesa_juncao_id: null })
            .eq('id', mesaId);
        } else {
          // Mesa principal: libera todas as mesas da junção
          const { data: mesasJuncao } = await supabase
            .from('mesas')
            .select('id')
            .or(`id.eq.${mesaId},mesa_juncao_id.eq.${mesaId}`);

          if (mesasJuncao && mesasJuncao.length > 0) {
            await supabase
              .from('mesas')
              .update({ status: 'disponivel', mesa_juncao_id: null })
              .in('id', mesasJuncao.map(m => m.id));
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comandas-abertas', profile?.empresa_id] });
      queryClient.invalidateQueries({ queryKey: ['mesas', profile?.empresa_id] });
      queryClient.invalidateQueries({ queryKey: ['mesas-garcom', profile?.empresa_id] });
      setSelectedComanda(null);
      toast.success('Comanda cancelada e mesa liberada!');
    },
    onError: (error: any) => {
      console.error('Erro ao cancelar comanda:', error);
      toast.error(`Erro ao cancelar comanda: ${error.message}`);
    },
  });

  // Nota: A proteção de rota é tratada pelo AdminLayout
  // Remomos a verificação duplicada aqui para evitar redirecionamentos em loop durante reload

  /** --------- HELPERS --------- */

  const calcularSubtotal = (comanda: any) =>
    comanda.pedidos?.reduce((acc: number, p: any) => acc + (p.subtotal || 0), 0) || 0;

  const calcularCouverTotal = () => {
    if (!includeCouver || !couverAtivo) return 0;
    return couverValorConfig * couverQuantidade;
  };

  const calcularTotal = (comanda: any) => {
    const subtotal = calcularSubtotal(comanda);
    const desconto = subtotal * (discountPercent / 100);
    const subtotalComDesconto = subtotal - desconto;
    const taxaServico = includeService ? subtotalComDesconto * (serviceCharge / 100) : 0;
    const couverTotal = calcularCouverTotal();
    return subtotalComDesconto + taxaServico + couverTotal;
  };

  const filteredComandas =
    comandas?.filter((c: any) => {
      const mesaNum = c.mesa?.numero_mesa?.toString() || '';
      const clienteNome = c.nome_cliente?.toLowerCase() || '';
      const search = searchTerm.toLowerCase();
      return mesaNum.includes(search) || clienteNome.includes(search) || c.id.includes(search);
    }) || [];

  const handleSelectComanda = (comanda: any) => {
    setSelectedComanda(comanda);
    setDiscountPercent(0);
    setIncludeService(savedSettings.taxaServicoAtiva !== false);
    setIncludeCouver(false);
    setCouverQuantidade(1);
    setFormaPagamento('');
    setTrocoPara('');
    // Reset pagamento múltiplo
    setPagamentoMultiplo(false);
    setPagamentos([]);
    setMetodosAtivos([]);
  };

  // Funções para pagamento múltiplo
  const toggleMetodoPagamento = (metodo: PaymentMethod) => {
    if (metodosAtivos.includes(metodo)) {
      setMetodosAtivos(metodosAtivos.filter(m => m !== metodo));
      setPagamentos(pagamentos.filter(p => p.metodo !== metodo));
    } else {
      setMetodosAtivos([...metodosAtivos, metodo]);
      setPagamentos([...pagamentos, { metodo, valor: 0 }]);
    }
  };

  const atualizarValorPagamento = (metodo: PaymentMethod, valor: number) => {
    setPagamentos(pagamentos.map(p => 
      p.metodo === metodo ? { ...p, valor } : p
    ));
  };

  const getTotalPagamentos = () => {
    return pagamentos.reduce((acc, p) => acc + p.valor, 0);
  };

  const getValorRestante = () => {
    if (!selectedComanda) return 0;
    return calcularTotal(selectedComanda) - getTotalPagamentos();
  };

  const handleFinalizarPagamento = () => {
    if (!selectedComanda) return;
    
    const total = calcularTotal(selectedComanda);
    
    if (pagamentoMultiplo) {
      // Validação para pagamento múltiplo
      if (metodosAtivos.length < 2) {
        toast.error('Selecione pelo menos 2 formas de pagamento');
        return;
      }
      
      const totalPagamentos = getTotalPagamentos();
      if (Math.abs(totalPagamentos - total) > 0.01) {
        toast.error(`A soma dos pagamentos (R$ ${totalPagamentos.toFixed(2)}) deve ser igual ao total (R$ ${total.toFixed(2)})`);
        return;
      }
      
      const trocoParaNum = trocoPara ? parseFloat(trocoPara) : undefined;
      closeComandaMutation.mutate({
        comandaId: selectedComanda.id,
        formaPagamento: 'multiplo',
        formasPagamento: pagamentos.filter(p => p.valor > 0),
        trocoPara: trocoParaNum,
        total,
        mesaId: selectedComanda.mesa_id,
      });
    } else {
      // Pagamento único
      if (!formaPagamento) {
        toast.error('Selecione a forma de pagamento');
        return;
      }
      const trocoParaNum = trocoPara ? parseFloat(trocoPara) : undefined;
      closeComandaMutation.mutate({
        comandaId: selectedComanda.id,
        formaPagamento: formaPagamento as PaymentMethod,
        trocoPara: trocoParaNum,
        total,
        mesaId: selectedComanda.mesa_id,
      });
    }
  };

  // ========== LIQUIDAÇÃO DE MESAS PENDENTES ==========

  // Abrir modal de liquidação para mesa pendente
  const handleOpenLiquidacao = async (mesa: MesaPendente) => {
    setSelectedMesaLiquidacao(mesa);
    setLiquidacaoFormaPagamento('dinheiro');
    setLiquidacaoItems([]);
    setLiquidacaoTotal(0);
    setLiquidacaoComandaIds([]);
    setLiquidacaoDialogOpen(true);

    // Buscar dados com queries separadas para evitar problemas de relacionamento
    try {
      // Primeiro buscar comandas da mesa
      const { data: comandas, error: errorComandas } = await supabase
        .from('comandas')
        .select('id, status, nome_cliente')
        .eq('mesa_id', mesa.id)
        .neq('status', 'fechada');

      console.log('[LIQUIDACAO] Comandas da mesa:', comandas, 'Erro:', errorComandas);

      if (comandas && comandas.length > 0) {
        const comandaIds = comandas.map(c => c.id);
        setLiquidacaoComandaIds(comandaIds);
        
        // Buscar pedidos dessas comandas
        const { data: pedidos, error: errorPedidos } = await supabase
          .from('pedidos')
          .select('id, quantidade, preco_unitario, subtotal, comanda_id, produto:produtos(nome)')
          .in('comanda_id', comandaIds);

        console.log('[LIQUIDACAO] Pedidos encontrados:', pedidos, 'Erro:', errorPedidos);

        if (pedidos && pedidos.length > 0) {
          setLiquidacaoItems(pedidos);
          const total = pedidos.reduce((acc: number, p: any) => acc + (p.subtotal || 0), 0);
          console.log('[LIQUIDACAO] Total calculado:', total);
          setLiquidacaoTotal(total);
        } else {
          console.log('[LIQUIDACAO] Nenhum pedido encontrado para as comandas');
        }
      } else {
        console.log('[LIQUIDACAO] Nenhuma comanda encontrada para mesa:', mesa.id);
      }
    } catch (e) {
      console.error('Erro ao buscar dados:', e);
      toast.error('Erro ao carregar dados da mesa');
    }
  };

  // Processar liquidação da mesa pendente
  const handleProcessarLiquidacao = async () => {
    if (!selectedMesaLiquidacao || liquidacaoComandaIds.length === 0 || !profile?.id) return;

    setIsProcessingLiquidacao(true);

    try {
      // 1. Validação de concorrência
      const { data: mesaAtual } = await supabase
        .from('mesas')
        .select('status')
        .eq('id', selectedMesaLiquidacao.id)
        .single();

      if (!mesaAtual || (mesaAtual.status !== 'solicitou_fechamento' && mesaAtual.status !== 'aguardando_pagamento')) {
        toast.error('Esta mesa já foi processada por outro funcionário.');
        setLiquidacaoDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ['mesas-pendentes', profile?.empresa_id] });
        return;
      }

      // 2. Registrar na tabela vendas_concluidas (usando a primeira comanda como referência)
      await supabase.from('vendas_concluidas').insert({
        empresa_id: profile.empresa_id,
        comanda_id: liquidacaoComandaIds[0],
        mesa_id: selectedMesaLiquidacao.id,
        valor_total: liquidacaoTotal,
        valor_subtotal: liquidacaoTotal,
        forma_pagamento: liquidacaoFormaPagamento,
        processado_por: profile.id,
        tipo_processamento: 'caixa',
      });

      // 3. Fechar TODAS as comandas
      await supabase
        .from('comandas')
        .update({
          status: 'fechada',
          forma_pagamento: liquidacaoFormaPagamento,
          total: liquidacaoTotal / liquidacaoComandaIds.length,
          data_fechamento: new Date().toISOString(),
        })
        .in('id', liquidacaoComandaIds);

      // 4. Marcar TODOS os pedidos como finalizados
      await supabase
        .from('pedidos')
        .update({ status_cozinha: 'entregue' })
        .in('comanda_id', liquidacaoComandaIds);

      // 5. Liberar mesa
      await supabase
        .from('mesas')
        .update({ status: 'disponivel' })
        .eq('id', selectedMesaLiquidacao.id);

      toast.success(`Mesa ${selectedMesaLiquidacao.numero_mesa} liberada com sucesso!`);
      setLiquidacaoDialogOpen(false);
      
      // Atualizar todas as queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['mesas-pendentes', profile?.empresa_id] });
      queryClient.invalidateQueries({ queryKey: ['comandas-abertas', profile?.empresa_id] });
      queryClient.invalidateQueries({ queryKey: ['mesas', profile?.empresa_id] });
    } catch (error: any) {
      console.error('Erro ao processar liquidação:', error);
      toast.error(`Erro ao processar: ${error.message}`);
    } finally {
      setIsProcessingLiquidacao(false);
    }
  };

  const handlePrint = () => {
    if (!selectedComanda) {
      toast.error('Nenhuma comanda selecionada para impressão');
      return;
    }

    const subtotal = calcularSubtotal(selectedComanda);
    const total = calcularTotal(selectedComanda);
    const descontoValor = subtotal * (discountPercent / 100);
    const subtotalComDesconto = subtotal - descontoValor;
    const taxaServicoValor = includeService ? subtotalComDesconto * (serviceCharge / 100) : 0;
    const couverTotal = includeCouver && couverAtivo ? calcularCouverTotal() : 0;

    const items = selectedComanda.pedidos?.map((p: any) => ({
      nome: p.produto?.nome || 'Item',
      quantidade: p.quantidade || 1,
      precoUnitario: p.preco_unitario || 0,
      subtotal: p.subtotal || 0,
    })) || [];

    printCaixaReceipt({
      empresaNome: empresa?.nome_fantasia || 'Restaurante',
      empresaEndereco: empresa?.endereco_completo || undefined,
      empresaCnpj: empresa?.cnpj || undefined,
      mesaNumero: selectedComanda.mesa?.numero_mesa || 0,
      nomeCliente: selectedComanda.nome_cliente || undefined,
      itens: items,
      subtotal,
      desconto: discountPercent > 0 ? { percentual: discountPercent, valor: descontoValor } : undefined,
      taxaServico: includeService ? { percentual: serviceCharge, valor: taxaServicoValor } : undefined,
      couver: includeCouver && couverAtivo && couverTotal > 0 
        ? { quantidade: couverQuantidade, valorUnitario: couverValorConfig, total: couverTotal } 
        : undefined,
      total,
      formaPagamento: formaPagamento || undefined,
      troco: trocoPara ? parseFloat(trocoPara) : undefined,
      timestamp: new Date(),
    });

    toast.success('Cupom enviado para impressão');
  };

  const handleClosePixModal = () => {
    setShowPixModal(false);
    setSelectedComanda(null);
    setFormaPagamento('');
    setTrocoPara('');
    setPagamentoMultiplo(false);
    setPagamentos([]);
    setMetodosAtivos([]);
  };

  const handleApplyFilters = () => {
    // refaz a query do histórico com os filtros atuais
    refetchHistorico();
  };

  const handleRefreshAll = () => {
    // invalida todas as queries desta página com a empresa_id atual
    queryClient.invalidateQueries({ queryKey: ['empresa', profile?.empresa_id] });
    queryClient.invalidateQueries({ queryKey: ['comandas-abertas', profile?.empresa_id] });
    queryClient.invalidateQueries({ queryKey: ['comandas-fechadas', profile?.empresa_id, filterStartDate, filterEndDate, filterPaymentMethod] });
    queryClient.invalidateQueries({ queryKey: ['pedidos-delivery-caixa', profile?.empresa_id] });
  };

  /** --------- RENDER --------- */

  const isLoadingPage = isLoadingComandas && activeTab === 'mesas';

  if (isLoadingPage) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* PIX Modal */}
      <Dialog open={showPixModal} onOpenChange={setShowPixModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" />
              Pagamento PIX - R$ {pixValue.toFixed(2)}
            </DialogTitle>
            <DialogDescription>
              Use o aplicativo do seu banco para ler o QR Code ou copie a chave PIX.
            </DialogDescription>
          </DialogHeader>

          {empresa?.chave_pix ? (
            <PixQRCode
              chavePix={empresa.chave_pix}
              valor={pixValue}
              nomeRecebedor={empresa?.nome_fantasia || 'Restaurante'}
              cidade={empresa?.endereco_completo?.split(',').pop()?.trim() || 'SAO PAULO'}
            />
          ) : (
            <div className="text-center p-4 border rounded-lg bg-amber-50 text-amber-700">
              <p className="font-medium">Chave PIX não configurada</p>
              <p className="text-sm mt-1">Configure a chave PIX nas configurações da empresa.</p>
            </div>
          )}

          <Button onClick={handleClosePixModal} className="w-full">
            Entendido / Fechar
          </Button>
        </DialogContent>
      </Dialog>

      {/* Modal de Liquidação de Mesa Pendente */}
      <Dialog open={liquidacaoDialogOpen} onOpenChange={setLiquidacaoDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Finalizar Conta - Mesa {selectedMesaLiquidacao?.numero_mesa}
            </DialogTitle>
            <DialogDescription>
              Confirme os itens e selecione a forma de pagamento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Resumo dos itens */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Itens do Pedido</Label>
              <ScrollArea className="h-32 border rounded-lg p-2">
                {liquidacaoItems.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Nenhum item encontrado</p>
                ) : (
                  <div className="space-y-2">
                    {liquidacaoItems.map((item: any) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>{item.quantidade}x {item.produto?.nome || 'Item'}</span>
                        <span className="font-medium">R$ {(item.subtotal || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Valor Total */}
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium">Total</span>
                <span className="text-2xl font-bold text-green-600">
                  R$ {liquidacaoTotal.toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>

            {/* Forma de Pagamento */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Forma de Pagamento</Label>
              <RadioGroup
                value={liquidacaoFormaPagamento}
                onValueChange={(v) => setLiquidacaoFormaPagamento(v as PaymentMethod)}
                className="grid grid-cols-2 gap-2"
              >
                <Label
                  htmlFor="liq-dinheiro"
                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    liquidacaoFormaPagamento === 'dinheiro' ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                  }`}
                >
                  <RadioGroupItem value="dinheiro" id="liq-dinheiro" />
                  <Banknote className="w-4 h-4" />
                  <span>Dinheiro</span>
                </Label>
                <Label
                  htmlFor="liq-pix"
                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    liquidacaoFormaPagamento === 'pix' ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                  }`}
                >
                  <RadioGroupItem value="pix" id="liq-pix" />
                  <QrCode className="w-4 h-4" />
                  <span>PIX</span>
                </Label>
                <Label
                  htmlFor="liq-credito"
                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    liquidacaoFormaPagamento === 'cartao_credito' ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                  }`}
                >
                  <RadioGroupItem value="cartao_credito" id="liq-credito" />
                  <CreditCard className="w-4 h-4" />
                  <span>Crédito</span>
                </Label>
                <Label
                  htmlFor="liq-debito"
                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    liquidacaoFormaPagamento === 'cartao_debito' ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                  }`}
                >
                  <RadioGroupItem value="cartao_debito" id="liq-debito" />
                  <CreditCard className="w-4 h-4" />
                  <span>Débito</span>
                </Label>
              </RadioGroup>
            </div>

            {/* QR Code PIX - exibir quando PIX selecionado */}
            {liquidacaoFormaPagamento === 'pix' && (
              <div className="border rounded-lg p-4 bg-muted/30">
                {empresa?.chave_pix ? (
                  <PixQRCode
                    chavePix={empresa.chave_pix}
                    valor={liquidacaoTotal}
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
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setLiquidacaoDialogOpen(false)}
              disabled={isProcessingLiquidacao}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleProcessarLiquidacao}
              disabled={isProcessingLiquidacao || liquidacaoItems.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessingLiquidacao ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Confirmar Pagamento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alerta de Mesas Pendentes */}
      {mesasPendentes.length > 0 && (
        <Card className="border-2 border-red-500 bg-red-50 animate-pulse">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="w-5 h-5" />
                Mesas Aguardando Fechamento ({mesasPendentes.length})
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="text-red-600"
              >
                <Bell className={`w-4 h-4 ${soundEnabled ? '' : 'opacity-50'}`} />
                <span className="ml-1 text-xs">{soundEnabled ? 'Som On' : 'Som Off'}</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {mesasPendentes.map((mesa) => (
                <Button
                  key={mesa.id}
                  variant="destructive"
                  className="h-16 flex flex-col gap-1"
                  onClick={() => handleOpenLiquidacao(mesa)}
                >
                  <DollarSign className="w-5 h-5" />
                  <span className="font-bold">Mesa {mesa.numero_mesa}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header com botão de atualizar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Caixa</h1>
          <p className="text-muted-foreground">Gerencie pagamentos de mesas e delivery</p>
        </div>
        <div className="flex gap-2">
          {alertasPendentes > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              {alertasPendentes} pendente{alertasPendentes > 1 ? 's' : ''}
            </Badge>
          )}
          <Button variant="outline" onClick={handleRefreshAll}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CaixaTab)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="mesas" className="flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Mesas
          </TabsTrigger>
          <TabsTrigger value="delivery" className="flex items-center gap-2">
            <Truck className="w-4 h-4" />
            Delivery
          </TabsTrigger>
        </TabsList>

        {/* Tab Mesas */}
        <TabsContent value="mesas" className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Lista de Comandas Abertas */}
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Comandas Abertas</CardTitle>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por mesa, cliente ou ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {filteredComandas.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">Nenhuma comanda encontrada</p>
                  ) : (
                    filteredComandas.map((comanda: any) => (
                      <div
                        key={comanda.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedComanda?.id === comanda.id ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                        }`}
                        onClick={() => handleSelectComanda(comanda)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Mesa {comanda.mesa?.numero_mesa || '-'}</p>
                            {comanda.nome_cliente && (
                              <p className="text-sm text-muted-foreground">{comanda.nome_cliente}</p>
                            )}
                          </div>
                          <Badge variant="secondary">R$ {calcularSubtotal(comanda).toFixed(2)}</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Detalhes da Comanda */}
            <div className="lg:col-span-2">
              {selectedComanda ? (
                <Card className="printable-receipt">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Receipt className="w-5 h-5" />
                        Mesa {selectedComanda.mesa?.numero_mesa || '-'}
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handlePrint}>
                          <Printer className="w-4 h-4 mr-2" />
                          Imprimir
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => {
                            if (confirm('Tem certeza que deseja cancelar esta comanda? A mesa será liberada.')) {
                              cancelComandaMutation.mutate({
                                comandaId: selectedComanda.id,
                                mesaId: selectedComanda.mesa_id
                              });
                            }
                          }}
                          disabled={cancelComandaMutation.isPending}
                        >
                          {cancelComandaMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Cancelar'
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Itens do Pedido */}
                    <div className="space-y-2">
                      <h3 className="font-medium">Itens do Pedido</h3>
                      <div className="border rounded-lg divide-y">
                        {selectedComanda.pedidos?.map((pedido: any) => (
                          <div key={pedido.id} className="p-3 flex justify-between items-center">
                            <div>
                              <p className="font-medium">{pedido.produto?.nome || 'Item'}</p>
                              <p className="text-sm text-muted-foreground">
                                {pedido.quantidade}x R$ {pedido.preco_unitario?.toFixed(2)}
                              </p>
                            </div>
                            <p className="font-medium">R$ {pedido.subtotal?.toFixed(2)}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* Taxa de Serviço e Couver */}
                    <div className="space-y-4">
                      <h3 className="font-medium flex items-center gap-2">
                        <Percent className="w-4 h-4" />
                        Taxas Adicionais
                      </h3>
                      
                      {/* Taxa de Serviço */}
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={includeService}
                            onCheckedChange={setIncludeService}
                          />
                          <div>
                            <p className="font-medium">Taxa de Serviço</p>
                            <p className="text-sm text-muted-foreground">Gorjeta do garçom</p>
                          </div>
                        </div>
                        {includeService && (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={serviceCharge}
                              onChange={(e) => setServiceCharge(parseFloat(e.target.value) || 0)}
                              className="w-20 text-center"
                            />
                            <span className="text-sm text-muted-foreground">%</span>
                          </div>
                        )}
                      </div>

                      {/* Couver Musical */}
                      {couverAtivo && couverValorConfig > 0 && (
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={includeCouver}
                              onCheckedChange={setIncludeCouver}
                            />
                            <div>
                              <p className="font-medium flex items-center gap-2">
                                <Music className="w-4 h-4" />
                                Couver Musical
                              </p>
                              <p className="text-sm text-muted-foreground">
                                R$ {couverValorConfig.toFixed(2)} por pessoa
                              </p>
                            </div>
                          </div>
                          {includeCouver && (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCouverQuantidade(Math.max(1, couverQuantidade - 1))}
                              >
                                -
                              </Button>
                              <span className="w-8 text-center font-medium">{couverQuantidade}</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCouverQuantidade(couverQuantidade + 1)}
                              >
                                +
                              </Button>
                              <span className="text-sm text-muted-foreground ml-2">pessoas</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Forma de Pagamento */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Forma de Pagamento</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Pagamento múltiplo</span>
                          <Switch
                            checked={pagamentoMultiplo}
                            onCheckedChange={(checked) => {
                              setPagamentoMultiplo(checked);
                              if (!checked) {
                                setPagamentos([]);
                                setMetodosAtivos([]);
                              } else {
                                setFormaPagamento('');
                              }
                            }}
                          />
                        </div>
                      </div>
                      
                      {!pagamentoMultiplo ? (
                        // Pagamento único
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { value: 'dinheiro', label: 'Dinheiro', icon: DollarSign },
                              { value: 'pix', label: 'PIX', icon: QrCode },
                              { value: 'cartao_credito', label: 'Crédito', icon: Receipt },
                              { value: 'cartao_debito', label: 'Débito', icon: Receipt },
                            ].map((method) => (
                              <Button
                                key={method.value}
                                variant={formaPagamento === method.value ? 'default' : 'outline'}
                                onClick={() => setFormaPagamento(method.value as PaymentMethod)}
                                className="h-12"
                              >
                                <method.icon className="w-4 h-4 mr-2" />
                                {method.label}
                              </Button>
                            ))}
                          </div>

                          {formaPagamento === 'dinheiro' && (
                            <div className="space-y-2">
                              <Label>Troco para (R$)</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Valor recebido"
                                value={trocoPara}
                                onChange={(e) => setTrocoPara(e.target.value)}
                              />
                              {trocoPara && parseFloat(trocoPara) >= calcularTotal(selectedComanda) && (
                                <p className="text-sm text-green-600">
                                  Troco: R${' '}
                                  {(parseFloat(trocoPara) - calcularTotal(selectedComanda)).toFixed(2)}
                                </p>
                              )}
                            </div>
                          )}

                          {formaPagamento === 'pix' && !empresa?.chave_pix && (
                            <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                              ⚠️ Chave PIX não cadastrada. Configure em Configurações {'>'} Empresa.
                            </p>
                          )}
                        </>
                      ) : (
                        // Pagamento múltiplo
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            Selecione as formas de pagamento e informe os valores
                          </p>
                          
                          <div className="space-y-3">
                            {[
                              { value: 'dinheiro' as PaymentMethod, label: 'Dinheiro', icon: DollarSign },
                              { value: 'pix' as PaymentMethod, label: 'PIX', icon: QrCode },
                              { value: 'cartao_credito' as PaymentMethod, label: 'Crédito', icon: Receipt },
                              { value: 'cartao_debito' as PaymentMethod, label: 'Débito', icon: Receipt },
                            ].map((method) => {
                              const isActive = metodosAtivos.includes(method.value);
                              const pagamento = pagamentos.find(p => p.metodo === method.value);
                              
                              return (
                                <div key={method.value} className="space-y-2">
                                  <div 
                                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                                      isActive ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                                    }`}
                                    onClick={() => toggleMetodoPagamento(method.value)}
                                  >
                                    <div className="flex items-center gap-3">
                                      <Checkbox 
                                        checked={isActive}
                                        onCheckedChange={() => toggleMetodoPagamento(method.value)}
                                      />
                                      <method.icon className="w-4 h-4" />
                                      <span className="font-medium">{method.label}</span>
                                    </div>
                                  </div>
                                  
                                  {isActive && (
                                    <div className="ml-8 flex items-center gap-2">
                                      <Label className="text-sm">Valor:</Label>
                                      <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                                        <Input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={pagamento?.valor || ''}
                                          onChange={(e) => atualizarValorPagamento(method.value, parseFloat(e.target.value) || 0)}
                                          className="pl-10"
                                          placeholder="0.00"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          
                          {/* Resumo do pagamento múltiplo */}
                          {metodosAtivos.length > 0 && (
                            <div className="p-3 bg-muted rounded-lg space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>Total da conta:</span>
                                <span className="font-medium">R$ {calcularTotal(selectedComanda).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Soma dos pagamentos:</span>
                                <span className={`font-medium ${Math.abs(getValorRestante()) < 0.01 ? 'text-green-600' : 'text-amber-600'}`}>
                                  R$ {getTotalPagamentos().toFixed(2)}
                                </span>
                              </div>
                              {Math.abs(getValorRestante()) > 0.01 && (
                                <div className="flex justify-between text-sm text-amber-600">
                                  <span>{getValorRestante() > 0 ? 'Falta:' : 'Excesso:'}</span>
                                  <span className="font-medium">R$ {Math.abs(getValorRestante()).toFixed(2)}</span>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {metodosAtivos.includes('dinheiro') && (
                            <div className="space-y-2">
                              <Label>Troco para (R$)</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Valor recebido em dinheiro"
                                value={trocoPara}
                                onChange={(e) => setTrocoPara(e.target.value)}
                              />
                              {trocoPara && pagamentos.find(p => p.metodo === 'dinheiro') && (
                                <p className="text-sm text-green-600">
                                  Troco: R${' '}
                                  {(parseFloat(trocoPara) - (pagamentos.find(p => p.metodo === 'dinheiro')?.valor || 0)).toFixed(2)}
                                </p>
                              )}
                            </div>
                          )}
                          
                          {metodosAtivos.includes('pix') && !empresa?.chave_pix && (
                            <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                              ⚠️ Chave PIX não cadastrada. Configure em Configurações {'>'} Empresa.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Resumo e Botão */}
                    <div className="space-y-4">
                      <div className="p-4 bg-muted rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Subtotal</span>
                          <span>R$ {calcularSubtotal(selectedComanda).toFixed(2)}</span>
                        </div>
                        {discountPercent > 0 && (
                          <div className="flex justify-between text-sm text-red-600">
                            <span>Desconto ({discountPercent}%)</span>
                            <span>
                              - R${' '}
                              {(calcularSubtotal(selectedComanda) * discountPercent / 100).toFixed(2)}
                            </span>
                          </div>
                        )}
                        {includeService && (
                          <div className="flex justify-between text-sm text-green-600">
                            <span>Taxa de Serviço ({serviceCharge}%)</span>
                            <span>
                              + R${' '}
                              {(
                                (calcularSubtotal(selectedComanda) * (1 - discountPercent / 100)) *
                                serviceCharge /
                                100
                              ).toFixed(2)}
                            </span>
                          </div>
                        )}
                        {includeCouver && couverAtivo && (
                          <div className="flex justify-between text-sm text-blue-600">
                            <span>Couver Musical ({couverQuantidade}x)</span>
                            <span>
                              + R$ {calcularCouverTotal().toFixed(2)}
                            </span>
                          </div>
                        )}
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                          <span>Total</span>
                          <span>R$ {calcularTotal(selectedComanda).toFixed(2)}</span>
                        </div>
                      </div>

                      <Button
                        className="w-full h-12 text-lg"
                        onClick={handleFinalizarPagamento}
                        disabled={closeComandaMutation.isPending}
                      >
                        {closeComandaMutation.isPending ? (
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        ) : (
                          <Check className="w-5 h-5 mr-2" />
                        )}
                        Finalizar Pagamento
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Receipt className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Selecione uma comanda para visualizar</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Histórico de Comandas (com filtros) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Histórico de Comandas
              </CardTitle>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-4">
                <Input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                />
                <Input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                />
                <select
                  className="border rounded px-2 py-1"
                  value={filterPaymentMethod}
                  onChange={(e) => setFilterPaymentMethod(e.target.value)}
                >
                  <option value="">Todas</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="pix">PIX</option>
                  <option value="cartao_credito">Cartão Crédito</option>
                  <option value="cartao_debito">Cartão Débito</option>
                </select>
                <Button onClick={handleApplyFilters}>Aplicar Filtros</Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingHistorico ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : !historicoComandas || historicoComandas.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Nenhuma comanda fechada encontrada
                </p>
              ) : (
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {historicoComandas.map((comanda: any) => (
                    <div key={comanda.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs">
                          #{comanda.id.slice(0, 8).toUpperCase()}
                        </span>
                        <Badge variant="secondary">
                          {comanda.forma_pagamento
                            ? comanda.forma_pagamento
                                .replace('cartao_', 'cartão ')
                                .replace('_', ' ')
                                .toUpperCase()
                            : 'N/A'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <p className="text-sm">
                          Mesa {comanda.mesa?.numero_mesa || '-'}
                        </p>
                        <p className="font-bold text-primary">
                          R$ {comanda.total?.toFixed(2)}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(comanda.data_fechamento).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Delivery */}
        <TabsContent value="delivery" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Pedidos Delivery
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingDelivery ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : !pedidosDelivery || pedidosDelivery.length === 0 ? (
                <div className="text-center py-12">
                  <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum pedido delivery encontrado</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Resumo de faturamento Delivery */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="pt-4">
                        <p className="text-sm text-green-700">Entregues</p>
                        <p className="text-2xl font-bold text-green-700">
                          R${' '}
                          {pedidosDelivery
                            .filter((p: any) => p.status === 'entregue')
                            .reduce((acc: number, p: any) => acc + (p.total || 0), 0)
                            .toFixed(2)}
                        </p>
                        <p className="text-xs text-green-600">
                          {pedidosDelivery.filter((p: any) => p.status === 'entregue').length} pedidos
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-yellow-50 border-yellow-200">
                      <CardContent className="pt-4">
                        <p className="text-sm text-yellow-700">Em Andamento</p>
                        <p className="text-2xl font-bold text-yellow-700">
                          R${' '}
                          {pedidosDelivery
                            .filter((p: any) => !['entregue', 'cancelado'].includes(p.status))
                            .reduce((acc: number, p: any) => acc + (p.total || 0), 0)
                            .toFixed(2)}
                        </p>
                        <p className="text-xs text-yellow-600">
                          {
                            pedidosDelivery.filter(
                              (p: any) => !['entregue', 'cancelado'].includes(p.status)
                            ).length
                          }{' '}
                          pedidos
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="pt-4">
                        <p className="text-sm text-blue-700">Total Geral</p>
                        <p className="text-2xl font-bold text-blue-700">
                          R${' '}
                          {pedidosDelivery
                            .filter((p: any) => p.status !== 'cancelado')
                            .reduce((acc: number, p: any) => acc + (p.total || 0), 0)
                            .toFixed(2)}
                        </p>
                        <p className="text-xs text-blue-600">
                          {pedidosDelivery.filter((p: any) => p.status !== 'cancelado').length} pedidos
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Separator />

                  {/* Histórico de Pedidos Delivery */}
                  <div className="space-y-3">
                    <h3 className="font-medium">Histórico de Pedidos</h3>
                    <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                      {pedidosDelivery.map((pedido: any) => (
                        <div key={pedido.id} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">
                                #{pedido.id.slice(0, 8).toUpperCase()}
                              </span>
                              <Badge
                                variant={
                                  pedido.status === 'entregue'
                                    ? 'default'
                                    : pedido.status === 'cancelado'
                                    ? 'destructive'
                                    : 'secondary'
                                }
                              >
                                {pedido.status === 'pendente' && 'Pendente'}
                                {pedido.status === 'confirmado' && 'Confirmado'}
                                {pedido.status === 'em_preparo' && 'Em Preparo'}
                                {pedido.status === 'saiu_entrega' && 'Saiu p/ Entrega'}
                                {pedido.status === 'entregue' && 'Entregue'}
                                {pedido.status === 'cancelado' && 'Cancelado'}
                              </Badge>
                            </div>
                            <span className="font-bold text-primary">R$ {pedido.total?.toFixed(2)}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <p>
                              {pedido.endereco?.nome_cliente} • {pedido.endereco?.telefone}
                            </p>
                            <p className="text-xs">
                              {new Date(pedido.created_at).toLocaleString('pt-BR')}
                              {' • '}
                              {pedido.forma_pagamento === 'pix' && 'PIX'}
                              {pedido.forma_pagamento === 'cartao_credito' && 'Cartão Crédito'}
                              {pedido.forma_pagamento === 'cartao_debito' && 'Cartão Débito'}
                              {pedido.forma_pagamento === 'dinheiro' && 'Dinheiro'}
                            </p>
                            <p className="text-xs mt-1">{pedido.itens?.length || 0} itens</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
