
import { useState } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
} from 'lucide-react';
import { PixQRCode } from '@/components/pix/PixQRCode';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

type PaymentMethod = 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito';
type CaixaTab = 'mesas' | 'delivery';

type PagamentoItem = {
  metodo: PaymentMethod;
  valor: number;
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

  /** --------- QUERIES --------- */

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

  const handlePrint = () => {
    window.print();
    toast.success('Comprovante enviado para impressão');
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

          <PixQRCode
            chavePix={empresa?.chave_pix || ''}
            valor={pixValue}
            nomeRecebedor={empresa?.nome_fantasia || 'Restaurante'}
            cidade={empresa?.endereco_completo?.split(',').pop()?.trim() || 'SAO PAULO'}
          />

          <Button onClick={handleClosePixModal} className="w-full">
            Entendido / Fechar
          </Button>
        </DialogContent>
      </Dialog>

      {/* Header com botão de atualizar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Caixa</h1>
          <p className="text-muted-foreground">Gerencie pagamentos de mesas e delivery</p>
        </div>
        <Button variant="outline" onClick={handleRefreshAll}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
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
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Receipt className="w-5 h-5" />
                        Mesa {selectedComanda.mesa?.numero_mesa || '-'}
                      </CardTitle>
                      <Button variant="outline" size="sm" onClick={() => window.print()}>
                        <Printer className="w-4 h-4 mr-2" />
                        Imprimir
                      </Button>
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
