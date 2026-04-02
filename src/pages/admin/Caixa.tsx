import { useState, useEffect, useMemo } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';

import { db, sincronizarTudo } from '@/lib/db';

import { fecharComandaOffline, cancelarComandaOffline } from '@/lib/offlineFirstHelpers';

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

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

  ShoppingBag,

  Plus,

  Minus,

  Trash2,

} from 'lucide-react';

import { PixQRCode } from '@/components/pix/PixQRCode';

import { Switch } from '@/components/ui/switch';

import { NfceEmissionDialog } from '@/components/admin/NfceEmissionDialog';

import { Checkbox } from '@/components/ui/checkbox';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

import { printCaixaReceipt } from '@/utils/kitchenPrinter';

import { AddItemModal } from '@/components/caixa/AddItemModal';



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



  // Dados pendentes para fechar comanda após confirmação do PIX

  const [pendingPixPayment, setPendingPixPayment] = useState<{

    comandaId: string;

    formaPagamento: PaymentMethod | 'multiplo';

    formasPagamento?: PagamentoItem[];

    trocoPara?: number;

    total: number;

    mesaId?: string;

    printData?: {

      empresaNome: string;

      empresaEndereco?: string;

      empresaCnpj?: string;

      mesaNumero: number;

      nomeCliente?: string;

      itens: { nome: string; quantidade: number; precoUnitario: number; subtotal: number }[];

      subtotal: number;

      desconto?: { percentual: number; valor: number };

      taxaServico?: { percentual: number; valor: number };

      couver?: { quantidade: number; valorUnitario: number; total: number };

    };

  } | null>(null);



  // Filtros do histórico (Mesas)

  const [filterStartDate, setFilterStartDate] = useState('');

  const [filterEndDate, setFilterEndDate] = useState('');

  const [filterPaymentMethod, setFilterPaymentMethod] = useState('todas');

  const [isRefreshing, setIsRefreshing] = useState(false);



  // Estados para Monitoramento de Mesas Pendentes

  const [soundEnabled, setSoundEnabled] = useState(true);

  const [liquidacaoDialogOpen, setLiquidacaoDialogOpen] = useState(false);

  const [selectedMesaLiquidacao, setSelectedMesaLiquidacao] = useState<MesaPendente | null>(null);

  const [liquidacaoItems, setLiquidacaoItems] = useState<any[]>([]);

  const [liquidacaoTotal, setLiquidacaoTotal] = useState(0);

  const [liquidacaoComandaIds, setLiquidacaoComandaIds] = useState<string[]>([]);

  const [liquidacaoFormaPagamento, setLiquidacaoFormaPagamento] = useState<PaymentMethod>('dinheiro');

  const [isProcessingLiquidacao, setIsProcessingLiquidacao] = useState(false);



  // NFC-e emission

  const [nfceDialogOpen, setNfceDialogOpen] = useState(false);

  const [nfceComandaData, setNfceComandaData] = useState<{

    comandaId: string;

    empresaId: string;

    itens: { nome: string; ncm: string; quantidade: number; valor_unitario: number; valor_total: number }[];

    valorTotal: number;

    formaPagamento: string;

  } | null>(null);



  // Venda Avulsa (dialog com busca de produtos)

  const [vendaAvulsaOpen, setVendaAvulsaOpen] = useState(false);

  const [vendaAvulsaItens, setVendaAvulsaItens] = useState<{ nome: string; preco: number; quantidade: number; produtoId?: string }[]>([]);

  const [vendaAvulsaPagamento, setVendaAvulsaPagamento] = useState<PaymentMethod>('dinheiro');

  const [vendaAvulsaBusca, setVendaAvulsaBusca] = useState('');

  const [vendaAvulsaManualNome, setVendaAvulsaManualNome] = useState('');

  const [vendaAvulsaManualPreco, setVendaAvulsaManualPreco] = useState('');

  const [isProcessingVendaAvulsa, setIsProcessingVendaAvulsa] = useState(false);

  const [vendaAvulsaPixModalOpen, setVendaAvulsaPixModalOpen] = useState(false);



  // Modal de adicionar item (para comandas e venda avulsa via modal)

  const [addItemModalOpen, setAddItemModalOpen] = useState(false);

  const [addItemMode, setAddItemMode] = useState<'comanda' | 'avulsa'>('comanda');

  const [vendaAvulsaItems, setVendaAvulsaItems] = useState<{ produto_id: string; nome: string; preco: number; quantidade: number }[]>([]);

  const [vendaAvulsaDialogOpen, setVendaAvulsaDialogOpen] = useState(false);

  const [vendaAvulsaFormaPagamento, setVendaAvulsaFormaPagamento] = useState<PaymentMethod>('dinheiro');



  // Produtos para venda avulsa - Offline-First

  const { data: produtosCardapio = [] } = useQuery({

    queryKey: ['produtos-venda-avulsa', profile?.empresa_id],

    queryFn: async () => {

      if (!profile?.empresa_id) return [];



      // 1. Buscar do IndexedDB primeiro

      let dadosLocais: any[] = [];

      try {

        const locais = await db.produtos.where('empresa_id').equals(profile.empresa_id).toArray();

        dadosLocais = locais

          .filter((p: any) => p.ativo !== false)

          .map((p: any) => ({ id: p.id, nome: p.nome, preco: p.preco }))

          .sort((a: any, b: any) => a.nome.localeCompare(b.nome));

      } catch (err) {

        console.warn('[Offline-First] Erro ao ler produtos do IndexedDB:', err);

      }



      // 2. Se offline, retornar dados locais

      if (!navigator.onLine) {

        return dadosLocais;

      }



      // 3. Se online, buscar do Supabase

      try {

        const { data, error } = await supabase

          .from('produtos')

          .select('id, nome, preco')

          .eq('empresa_id', profile.empresa_id)

          .eq('ativo', true)

          .order('nome');

        if (!error && data) {

          return data;

        }

      } catch (err) {

        console.warn('[Offline-First] Supabase inacessível para produtos:', err);

      }



      return dadosLocais;

    },

    enabled: !!profile?.empresa_id && vendaAvulsaOpen,

  });



  const produtosFiltrados = produtosCardapio.filter((p: any) =>

    p.nome.toLowerCase().includes(vendaAvulsaBusca.toLowerCase())

  );



  const vendaAvulsaTotal = vendaAvulsaItens.reduce((acc, item) => acc + item.preco * item.quantidade, 0);



  const adicionarProdutoAvulso = (produto: { id?: string; nome: string; preco: number }) => {

    const existente = vendaAvulsaItens.findIndex(i => i.nome === produto.nome);

    if (existente >= 0) {

      const novos = [...vendaAvulsaItens];

      novos[existente].quantidade += 1;

      setVendaAvulsaItens(novos);

    } else {

      setVendaAvulsaItens([...vendaAvulsaItens, { nome: produto.nome, preco: produto.preco, quantidade: 1, produtoId: produto.id }]);

    }

  };



  const adicionarItemManual = () => {

    if (!vendaAvulsaManualNome || !vendaAvulsaManualPreco) {

      toast.error('Preencha nome e preço do item');

      return;

    }

    const preco = parseFloat(vendaAvulsaManualPreco);

    if (isNaN(preco) || preco <= 0) {

      toast.error('Preço inválido');

      return;

    }

    adicionarProdutoAvulso({ nome: vendaAvulsaManualNome, preco });

    setVendaAvulsaManualNome('');

    setVendaAvulsaManualPreco('');

  };



  const handleFinalizarVendaAvulsa = async () => {

    if (vendaAvulsaItens.length === 0) {

      toast.error('Adicione pelo menos um item');

      return;

    }

    // Se PIX selecionado, abrir modal do QR Code primeiro

    if (vendaAvulsaPagamento === 'pix') {

      setVendaAvulsaPixModalOpen(true);

      return;

    }

    await processarVendaAvulsa();

  };



  const processarVendaAvulsa = async () => {

    if (!profile?.empresa_id || !profile?.id) return;



    setIsProcessingVendaAvulsa(true);

    try {

      const vendaId = crypto.randomUUID();

      const agora = new Date().toISOString();



      const novaVenda = {

        id: vendaId,

        empresa_id: profile.empresa_id,

        comanda_id: null,

        mesa_id: null,

        valor_total: vendaAvulsaTotal,

        valor_subtotal: vendaAvulsaTotal,

        forma_pagamento: vendaAvulsaPagamento,

        processado_por: profile.id,

        tipo_processamento: 'caixa',

        criado_em: agora,

        sincronizado: 0,

      };



      // 1. Salvar no IndexedDB primeiro (Offline-First)

      try {

        await db.vendas_concluidas.put(novaVenda);

      } catch (err) {

        console.warn('[Offline-First] Erro ao salvar venda local:', err);

      }



      // 2. Se online, sincronizar

      if (navigator.onLine) {

        const { sincronizado, criado_em, ...dadosParaSync } = novaVenda;

        await supabase.from('vendas_concluidas').insert(dadosParaSync);

        await db.vendas_concluidas.update(vendaId, { sincronizado: 1 });



        // Registrar em movimentacoes_caixa se houver caixa aberto

        const { data: caixaAberto } = await supabase

          .from('caixas')

          .select('id')

          .eq('empresa_id', profile.empresa_id)

          .eq('status', 'aberto')

          .maybeSingle();



        if (caixaAberto) {

          const movId = crypto.randomUUID();

          const novaMov = {

            id: movId,

            caixa_id: caixaAberto.id,

            tipo: 'entrada',

            valor: vendaAvulsaTotal,

            forma_pagamento: vendaAvulsaPagamento,

            descricao: `Venda avulsa: ${vendaAvulsaItens.map(i => `${i.quantidade}x ${i.nome}`).join(', ')}`,

            sincronizado: 0,

          };

          await db.movimentacoes_caixa.put(novaMov);

          await supabase.from('movimentacoes_caixa').insert({

            id: movId,

            caixa_id: caixaAberto.id,

            tipo: 'entrada',

            valor: vendaAvulsaTotal,

            forma_pagamento: vendaAvulsaPagamento,

            descricao: novaMov.descricao,

          });

          await db.movimentacoes_caixa.update(movId, { sincronizado: 1 });

        }



        sincronizarTudo().catch(console.warn);

      }



      // Imprimir cupom

      printCaixaReceipt({

        empresaNome: empresa?.nome_fantasia || 'Restaurante',

        empresaEndereco: empresa?.endereco_completo || undefined,

        empresaCnpj: empresa?.cnpj || undefined,

        mesaNumero: 0,

        nomeCliente: 'Venda Avulsa',

        itens: vendaAvulsaItens.map(i => ({

          nome: i.nome,

          quantidade: i.quantidade,

          precoUnitario: i.preco,

          subtotal: i.preco * i.quantidade,

        })),

        subtotal: vendaAvulsaTotal,

        total: vendaAvulsaTotal,

        formaPagamento: vendaAvulsaPagamento,

        timestamp: new Date(),

      });



      toast.success('Venda avulsa registrada com sucesso!');

      setVendaAvulsaOpen(false);

      setVendaAvulsaPixModalOpen(false);

      setVendaAvulsaItens([]);

      setVendaAvulsaPagamento('dinheiro');

      setVendaAvulsaBusca('');

      // Refresh queries

      queryClient.invalidateQueries({ queryKey: ['comandas-fechadas', profile.empresa_id] });

    } catch (error: any) {

      console.error('Erro na venda avulsa:', error);

      toast.error(`Erro: ${error.message}`);

    } finally {

      setIsProcessingVendaAvulsa(false);

    }

  };



  /** --------- QUERIES --------- */



  // Mesas com status de fechamento pendente - Offline-First

  const { data: mesasPendentes = [] } = useQuery({

    queryKey: ['mesas-pendentes', profile?.empresa_id],

    queryFn: async () => {

      if (!profile?.empresa_id) return [];



      // 1. Buscar do local primeiro

      let dadosLocais: MesaPendente[] = [];

      try {

        const locais = await db.mesas.where('empresa_id').equals(profile.empresa_id).toArray();

        dadosLocais = locais

          .filter((m: any) => ['solicitou_fechamento', 'aguardando_pagamento'].includes(m.status))

          .map((m: any) => ({

            id: m.id,

            numero_mesa: m.numero_mesa ?? m.numero,

            status: m.status,

            nome: m.nome || null,

          })) as MesaPendente[];

      } catch (err) {

        console.warn('[Offline-First] Erro ao ler mesas do IndexedDB:', err);

      }



      // 2. Se online, buscar do Supabase

      if (navigator.onLine) {

        try {

          const { data, error } = await supabase

            .from('mesas')

            .select('id, numero_mesa, status, nome')

            .eq('empresa_id', profile.empresa_id)

            .in('status', ['solicitou_fechamento', 'aguardando_pagamento'])

            .order('numero_mesa');



          if (!error && data) {

            return data as MesaPendente[];

          }

        } catch (err) {

          console.warn('[Offline-First] Supabase inacessível para mesas pendentes:', err);

        }

      }



      return dadosLocais.sort((a, b) => a.numero_mesa - b.numero_mesa);

    },

    enabled: !!profile?.empresa_id,

    refetchInterval: navigator.onLine ? 5000 : false,

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



  // Verificar se NFC-e está totalmente configurado (todos os campos fiscais preenchidos)

  const { data: configFiscal } = useQuery({

    queryKey: ['config-fiscal-nfce', profile?.empresa_id],

    queryFn: async () => {

      if (!profile?.empresa_id) return null;

      const { data, error } = await supabase

        .from('config_fiscal')

        .select('id, api_token_nfe, modo_producao, regime_tributario, codigo_ibge_cidade, logradouro, numero, bairro, cep, uf, certificado_path, certificado_senha, csc, csc_id')

        .eq('empresa_id', profile.empresa_id)

        .maybeSingle();

      if (error) throw error;

      return data;

    },

    enabled: !!profile?.empresa_id,

  });



  // NFC-e está habilitado apenas se TODOS os campos obrigatórios estiverem preenchidos

  const nfceHabilitado = !!(

    configFiscal?.api_token_nfe &&

    configFiscal?.regime_tributario &&

    configFiscal?.codigo_ibge_cidade &&

    configFiscal?.logradouro &&

    configFiscal?.numero &&

    configFiscal?.bairro &&

    configFiscal?.cep &&

    configFiscal?.uf &&

    configFiscal?.certificado_path &&

    configFiscal?.certificado_senha &&

    configFiscal?.csc &&

    configFiscal?.csc_id

  );



  // Comandas abertas (Mesas) - Offline-First

  const {
    data: comandas = [],
    isLoading: isLoadingComandas,
  } = useQuery({
    queryKey: ['comandas-abertas', profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return [];

      // 🔥 BUSCA NO SERVIDOR LOCAL PRIMEIRO (PC DO CAIXA)
      try {
        const res = await fetch(`http://192.168.2.111:3000/api/local/status-geral`, {
          headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) {
          const { comandas: comandasLocais } = await res.json();
          if (comandasLocais && comandasLocais.length > 0) {
            const paraSync = comandasLocais.map((c: any) => ({ ...c, sincronizado: 1 }));
            await db.comandas.bulkPut(paraSync);
          }
        }
      } catch (e) {
        console.warn('[CAIXA] Servidor local offline para comandas');
      }

      // ===============================

      // HELPER: Reconstruir relacionamentos das comandas locais

      // ===============================

      const reconstruirRelacionamentos = async (comandasLocais: any[]) => {

        const [mesas, pedidos, produtos] = await Promise.all([

          db.mesas.toArray(),

          db.pedidos.toArray(),

          db.produtos.toArray()

        ]);



        const mesasMap = new Map(mesas.map((m: any) => [m.id, m]));

        const produtosMap = new Map(produtos.map((p: any) => [p.id, p]));



        return comandasLocais.map((comanda: any) => {

          const mesa = mesasMap.get(comanda.mesa_id);

          const pedidosComanda = pedidos

            .filter((p: any) => p.comanda_id === comanda.id)

            .map((p: any) => {

              const produto = produtosMap.get(p.produto_id) as any;

              return {

                id: p.id,

                quantidade: p.quantidade,

                preco_unitario: p.preco_unitario || produto?.preco || 0,

                subtotal: p.subtotal || (p.quantidade * (p.preco_unitario || produto?.preco || 0)),

                produto: produto ? { nome: produto.nome } : null

              };

            });



          return {

            ...comanda,

            mesa: mesa ? { numero_mesa: (mesa as any).numero_mesa || (mesa as any).numero } : null,

            pedidos: pedidosComanda

          };

        });

      };



      // 1. Buscar do local primeiro

      let dadosLocais: any[] = [];

      try {

        const locais = await db.comandas.where('empresa_id').equals(profile.empresa_id).toArray();

        const abertasLocais = locais.filter((c: any) => c.status === 'aberta');

        dadosLocais = await reconstruirRelacionamentos(abertasLocais);

      } catch (err) {

        console.warn('[Offline-First] Erro ao ler comandas do IndexedDB:', err);

      }



      // 2. Se online, buscar do Supabase

      if (navigator.onLine) {

        try {

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



          if (!error && data) {

            // Atualizar local

            const dadosComSync = data.map((item: any) => ({ ...item, sincronizado: 1 }));

            await db.comandas.bulkPut(dadosComSync);

            return data;

          }

        } catch (err) {

          console.warn('[Offline-First] Supabase inacessível para comandas:', err);

        }

      }



      return dadosLocais;

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

      if (filterPaymentMethod && filterPaymentMethod !== 'todas') query = query.eq('forma_pagamento', filterPaymentMethod as PaymentMethod);



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
      printData,
    }: {
      comandaId: string;
      formaPagamento: PaymentMethod | 'multiplo';
      formasPagamento?: PagamentoItem[];
      trocoPara?: number;
      total: number;
      mesaId?: string;
      printData?: {
        empresaNome: string;
        empresaEndereco?: string;
        empresaCnpj?: string;
        mesaNumero: number;
        nomeCliente?: string;
        itens: { nome: string; quantidade: number; precoUnitario: number; subtotal: number }[];
        subtotal: number;
        desconto?: { percentual: number; valor: number };
        taxaServico?: { percentual: number; valor: number };
        couver?: { quantidade: number; valorUnitario: number; total: number };
      };
    }) => {
      // 🔥 AVISA O SERVIDOR LOCAL QUE A MESA FOI PAGA
      try {
        await fetch(`http://192.168.2.111:3000/api/local/comanda/fechar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: comandaId, total: total, mesa_id: mesaId })
        });
      } catch (e) {
        console.warn('[CAIXA] Falha ao informar fechamento ao servidor local.');
      }

      // Formata as formas de pagamento para salvar no banco
      const formasPagamentoStr = formasPagamento

        ? formasPagamento.map(p => `${p.metodo}:${p.valor.toFixed(2)}`).join(',')

        : null;



      // 1. DEXIE PRIMEIRO - Fecha a comanda localmente
      const agora = new Date().toISOString();
      await db.comandas.update(comandaId, {
        status: 'fechada',
        forma_pagamento: formaPagamento === 'multiplo' ? 'dinheiro' : formaPagamento,
        troco_para: trocoPara || null,
        total,
        data_fechamento: agora,
        sincronizado: 0,
        atualizado_em: agora,
      }).catch(() => {});

      // 2. DEXIE PRIMEIRO - Libera mesa localmente
      if (mesaId) {
        await db.mesas.update(mesaId, { status: 'disponivel', mesa_juncao_id: null, sincronizado: 0, atualizado_em: agora }).catch(() => {});
      }

      // 3. SE ONLINE, sincroniza com Supabase
      if (navigator.onLine) {
        const { error } = await supabase
          .from('comandas')
          .update({
            status: 'fechada',
            forma_pagamento: formaPagamento === 'multiplo' ? 'dinheiro' : formaPagamento,
            troco_para: trocoPara || null,
            total,
            data_fechamento: agora,
          })
          .eq('id', comandaId);
        if (!error) await db.comandas.update(comandaId, { sincronizado: 1 }).catch(() => {});

        if (mesaId) {
          console.log('[CAIXA] Tentando liberar mesa:', mesaId);
          try {
            await supabase.rpc('liberar_mesa', { p_mesa_id: mesaId });
            console.log('[LIBERAR MESA] Mesa liberada com sucesso via RPC');
          } catch {
            try {
              await supabase.from('mesas').update({ status: 'disponivel', mesa_juncao_id: null }).eq('id', mesaId);
              console.log('[LIBERAR MESA] Fallback funcionou');
            } catch (e) { console.warn('[LIBERAR MESA] Fallback também falhou:', e); }
          }
          await db.mesas.update(mesaId, { sincronizado: 1 }).catch(() => {});

          // Atender chamadas de fechamento pendentes para esta mesa
          await supabase
            .from('chamadas_garcom')
            .update({ status: 'atendida', atendida_at: agora })
            .eq('mesa_id', mesaId)
            .eq('status', 'pendente');
        }
      }



      return { formaPagamento, formasPagamento, total, mesaId, trocoPara, printData };

    },

    onSuccess: (result) => {

      // invalida com as mesmas chaves (incluindo empresa_id)

      queryClient.invalidateQueries({ queryKey: ['comandas-abertas', profile?.empresa_id] });

      queryClient.invalidateQueries({ queryKey: ['comandas-fechadas', profile?.empresa_id, filterStartDate, filterEndDate, filterPaymentMethod] });

      queryClient.invalidateQueries({ queryKey: ['mesas', profile?.empresa_id] });

      queryClient.invalidateQueries({ queryKey: ['mesas-garcom', profile?.empresa_id] });

      queryClient.invalidateQueries({ queryKey: ['chamadas-garcom', profile?.empresa_id] });

      queryClient.invalidateQueries({ queryKey: ['chamadas-garcom-kds', profile?.empresa_id] });



      // Forçar atualização imediata do cache de mesas

      setTimeout(() => {

        queryClient.refetchQueries({ queryKey: ['mesas', profile?.empresa_id] });

      }, 500);



      // 🖨️ Impressão automática do cupom

      if (result.printData) {

        const formaPgtoLabel = result.formaPagamento === 'multiplo'

          ? result.formasPagamento?.map(p => `${p.metodo}: R$ ${p.valor.toFixed(2)}`).join(', ')

          : result.formaPagamento;



        printCaixaReceipt({

          ...result.printData,

          total: result.total,

          formaPagamento: formaPgtoLabel || undefined,

          troco: result.trocoPara,

          timestamp: new Date(),

        });

        toast.success('Comanda fechada e cupom enviado para impressão!');

      } else {

        toast.success('Comanda fechada com sucesso!');

      }



      // Offer NFC-e emission only if configured

      if (nfceHabilitado && result.printData && profile?.empresa_id) {

        const itensNfce = result.printData.itens.map((item: any) => ({

          nome: item.nome,

          ncm: '', // Will be fetched from product data

          quantidade: item.quantidade,

          valor_unitario: item.precoUnitario,

          valor_total: item.subtotal,

        }));

        setNfceComandaData({

          comandaId: result.mesaId || '',

          empresaId: profile.empresa_id,

          itens: itensNfce,

          valorTotal: result.total,

          formaPagamento: typeof result.formaPagamento === 'string' ? result.formaPagamento : 'dinheiro',

        });

        // Show NFC-e button via toast

        toast.info('Deseja emitir NFC-e? Clique no botão abaixo.', { duration: 8000 });

        setNfceDialogOpen(true);

      }



      // Limpa os estados da comanda

      setSelectedComanda(null);

      setFormaPagamento('');

      setTrocoPara('');

      setPagamentoMultiplo(false);

      setPagamentos([]);

      setMetodosAtivos([]);

    },

    onError: (error: any) => {

      console.error('Erro ao fechar comanda:', error);

      toast.error(`Erro ao fechar comanda: ${error.message}`);

    },

  });



  /** --------- MUTATION: cancelar comanda --------- */

  const cancelComandaMutation = useMutation({

    mutationFn: async ({ comandaId, mesaId }: { comandaId: string; mesaId?: string }) => {
      const agora = new Date().toISOString();

      // 1. DEXIE PRIMEIRO - Cancelar comanda localmente
      await db.comandas.update(comandaId, {
        status: 'cancelada',
        data_fechamento: agora,
        sincronizado: 0,
        atualizado_em: agora,
      }).catch(() => {});

      // 2. DEXIE PRIMEIRO - Liberar mesa localmente
      if (mesaId) {
        await db.mesas.update(mesaId, { status: 'disponivel', sincronizado: 0, atualizado_em: agora }).catch(() => {});
      }

      // 3. SE ONLINE, sincroniza
      if (navigator.onLine) {
        const { error } = await supabase
          .from('comandas')
          .update({ status: 'cancelada', data_fechamento: agora })
          .eq('id', comandaId);
        if (!error) await db.comandas.update(comandaId, { sincronizado: 1 }).catch(() => {});

        if (mesaId) {
          try {
            await supabase.rpc('liberar_mesa', { p_mesa_id: mesaId });
          } catch (e) {
            console.warn('[LIBERAR MESA] Erro ao liberar mesa via RPC:', e);
          }
          await db.mesas.update(mesaId, { sincronizado: 1 }).catch(() => {});
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



  // Gera os dados necessários para impressão automática do cupom

  const gerarPrintData = (comanda: any) => {

    const subtotal = calcularSubtotal(comanda);

    const descontoValor = subtotal * (discountPercent / 100);

    const subtotalComDesconto = subtotal - descontoValor;

    const taxaServicoValor = includeService ? subtotalComDesconto * (serviceCharge / 100) : 0;

    const couverTotal = includeCouver && couverAtivo ? calcularCouverTotal() : 0;



    const items = comanda.pedidos?.map((p: any) => ({

      nome: p.produto?.nome || 'Item',

      quantidade: p.quantidade || 1,

      precoUnitario: p.preco_unitario || 0,

      subtotal: p.subtotal || 0,

    })) || [];



    return {

      empresaNome: empresa?.nome_fantasia || 'Restaurante',

      empresaEndereco: empresa?.endereco_completo || undefined,

      empresaCnpj: empresa?.cnpj || undefined,

      mesaNumero: comanda.mesa?.numero_mesa || 0,

      nomeCliente: comanda.nome_cliente || undefined,

      itens: items,

      subtotal,

      desconto: discountPercent > 0 ? { percentual: discountPercent, valor: descontoValor } : undefined,

      taxaServico: includeService ? { percentual: serviceCharge, valor: taxaServicoValor } : undefined,

      couver: includeCouver && couverAtivo && couverTotal > 0

        ? { quantidade: couverQuantidade, valorUnitario: couverValorConfig, total: couverTotal }

        : undefined,

    };

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

      const pagamentosFiltrados = pagamentos.filter(p => p.valor > 0);



      // Verifica se tem PIX no pagamento múltiplo

      const temPix = pagamentosFiltrados.some(p => p.metodo === 'pix');



      if (temPix) {

        // Se tem PIX, guarda os dados e exibe o QR Code PRIMEIRO

        const valorPix = pagamentosFiltrados.find(p => p.metodo === 'pix')?.valor || 0;

        setPixValue(valorPix);

        setPendingPixPayment({

          comandaId: selectedComanda.id,

          formaPagamento: 'multiplo',

          formasPagamento: pagamentosFiltrados,

          trocoPara: trocoParaNum,

          total,

          mesaId: selectedComanda.mesa_id,

          printData: gerarPrintData(selectedComanda),

        });

        toast.info('Exibindo QR Code PIX. Após pagamento, clique em "Entendido/Fechar".');

        setShowPixModal(true);

      } else {

        // Sem PIX, fecha a comanda normalmente com impressão automática

        closeComandaMutation.mutate({

          comandaId: selectedComanda.id,

          formaPagamento: 'multiplo',

          formasPagamento: pagamentosFiltrados,

          trocoPara: trocoParaNum,

          total,

          mesaId: selectedComanda.mesa_id,

          printData: gerarPrintData(selectedComanda),

        });

      }

    } else {

      // Pagamento único

      if (!formaPagamento) {

        toast.error('Selecione a forma de pagamento');

        return;

      }

      const trocoParaNum = trocoPara ? parseFloat(trocoPara) : undefined;



      if (formaPagamento === 'pix') {

        // Se for PIX, guarda os dados e exibe o QR Code PRIMEIRO

        setPixValue(total);

        setPendingPixPayment({

          comandaId: selectedComanda.id,

          formaPagamento: 'pix' as PaymentMethod,

          trocoPara: trocoParaNum,

          total,

          mesaId: selectedComanda.mesa_id,

          printData: gerarPrintData(selectedComanda),

        });

        toast.info('Exibindo QR Code PIX. Após pagamento, clique em "Entendido/Fechar".');

        setShowPixModal(true);

      } else {

        // Não é PIX, fecha a comanda normalmente com impressão automática

        closeComandaMutation.mutate({

          comandaId: selectedComanda.id,

          formaPagamento: formaPagamento as PaymentMethod,

          trocoPara: trocoParaNum,

          total,

          mesaId: selectedComanda.mesa_id,

          printData: gerarPrintData(selectedComanda),

        });

      }

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



  // Processar liquidação da mesa pendente - Offline-First

  const handleProcessarLiquidacao = async () => {

    if (!selectedMesaLiquidacao || liquidacaoComandaIds.length === 0 || !profile?.id) return;



    setIsProcessingLiquidacao(true);

    // 🔥 AVISA O SERVIDOR LOCAL SOBRE A LIQUIDAÇÃO
    for (const comandaId of liquidacaoComandaIds) {
      try {
        await fetch(`http://192.168.2.111:3000/api/local/comanda/fechar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: comandaId,
            total: liquidacaoTotal / liquidacaoComandaIds.length,
            mesa_id: selectedMesaLiquidacao.id
          })
        });
      } catch (e) {
        console.warn('[CAIXA] Falha ao informar liquidação local');
      }
    }

    const agora = new Date().toISOString();

    const vendaId = crypto.randomUUID();



    try {

      // 1. SALVAR TUDO NO INDEXEDDB PRIMEIRO (Offline-First)



      // Venda concluída

      const novaVenda = {

        id: vendaId,

        empresa_id: profile.empresa_id,

        comanda_id: liquidacaoComandaIds[0],

        mesa_id: selectedMesaLiquidacao.id,

        valor_total: liquidacaoTotal,

        valor_subtotal: liquidacaoTotal,

        forma_pagamento: liquidacaoFormaPagamento,

        processado_por: profile.id,

        tipo_processamento: 'caixa',

        criado_em: agora,

        sincronizado: 0,

      };

      await db.vendas_concluidas.put(novaVenda);



      // Atualizar comandas localmente

      for (const comandaId of liquidacaoComandaIds) {

        await db.comandas.update(comandaId, {

          status: 'fechada',

          forma_pagamento: liquidacaoFormaPagamento,

          total: liquidacaoTotal / liquidacaoComandaIds.length,

          data_fechamento: agora,

          sincronizado: 0,

        });

      }



      // Atualizar pedidos localmente

      const pedidosLocais = await db.pedidos.where('comanda_id').anyOf(liquidacaoComandaIds).toArray();

      for (const pedido of pedidosLocais) {

        await db.pedidos.update(pedido.id, { status_cozinha: 'entregue', sincronizado: 0 });

      }



      // Liberar mesa localmente

      await db.mesas.update(selectedMesaLiquidacao.id, { status: 'disponivel', sincronizado: 0 });



      // 2. SE ONLINE, SINCRONIZAR COM SUPABASE

      if (navigator.onLine) {

        try {

          // Validação de concorrência

          const { data: mesaAtual } = await supabase

            .from('mesas')

            .select('status')

            .eq('id', selectedMesaLiquidacao.id)

            .single();



          if (mesaAtual && (mesaAtual.status === 'solicitou_fechamento' || mesaAtual.status === 'aguardando_pagamento' || mesaAtual.status === 'ocupada')) {

            // Sincronizar venda

            await supabase.from('vendas_concluidas').insert({

              id: vendaId,

              empresa_id: profile.empresa_id,

              comanda_id: liquidacaoComandaIds[0],

              mesa_id: selectedMesaLiquidacao.id,

              valor_total: liquidacaoTotal,

              valor_subtotal: liquidacaoTotal,

              forma_pagamento: liquidacaoFormaPagamento,

              processado_por: profile.id,

              tipo_processamento: 'caixa',

            });

            await db.vendas_concluidas.update(vendaId, { sincronizado: 1 });



            // Fechar comandas

            await supabase

              .from('comandas')

              .update({

                status: 'fechada',

                forma_pagamento: liquidacaoFormaPagamento,

                total: liquidacaoTotal / liquidacaoComandaIds.length,

                data_fechamento: agora,

              })

              .in('id', liquidacaoComandaIds);



            // Marcar pedidos como entregues

            await supabase

              .from('pedidos')

              .update({ status_cozinha: 'entregue' })

              .in('comanda_id', liquidacaoComandaIds);



            // Liberar mesa - DEXIE PRIMEIRO
            await db.mesas.update(selectedMesaLiquidacao.id, { status: 'disponivel', sincronizado: 0, atualizado_em: new Date().toISOString() }).catch(() => {});
            try {
              await supabase.rpc('liberar_mesa', { p_mesa_id: selectedMesaLiquidacao.id });
            } catch {
              try {
                await supabase.from('mesas').update({ status: 'disponivel' }).eq('id', selectedMesaLiquidacao.id);
              } catch (e) { console.warn('[Offline-First] Mesa sera liberada na sincronizacao:', e); }
            }



            // Marcar tudo como sincronizado

            for (const comandaId of liquidacaoComandaIds) {

              await db.comandas.update(comandaId, { sincronizado: 1 });

            }

            for (const pedido of pedidosLocais) {

              await db.pedidos.update(pedido.id, { sincronizado: 1 });

            }

            await db.mesas.update(selectedMesaLiquidacao.id, { sincronizado: 1 });

          }



          sincronizarTudo().catch(console.warn);

        } catch (syncErr) {

          console.warn('[Offline-First] Erro na sincronização (será tentado depois):', syncErr);

        }

      }



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



  // ========== ADICIONAR ITEM DE ÚLTIMA HORA À COMANDA ==========

  const handleOpenAddItem = (mode: 'comanda' | 'avulsa') => {

    setAddItemMode(mode);

    if (mode === 'avulsa') {

      setVendaAvulsaItems([]); // Limpar itens anteriores

    }

    setAddItemModalOpen(true);

  };



  const handleItemAdded = (item: { produto_id: string; nome: string; preco: number; quantidade: number }) => {

    if (addItemMode === 'comanda') {

      // Recarregar dados da comanda

      queryClient.invalidateQueries({ queryKey: ['comandas-abertas', profile?.empresa_id] });



      // Re-selecionar a comanda para atualizar a UI

      if (selectedComanda) {

        setTimeout(() => {

          const updatedComanda = comandas?.find((c: any) => c.id === selectedComanda.id);

          if (updatedComanda) {

            setSelectedComanda(updatedComanda);

          }

        }, 500);

      }

    } else {

      // Adicionar à lista de venda avulsa

      setVendaAvulsaItems(prev => {

        const existing = prev.find(i => i.produto_id === item.produto_id);

        if (existing) {

          return prev.map(i =>

            i.produto_id === item.produto_id

              ? { ...i, quantidade: i.quantidade + 1 }

              : i

          );

        }

        return [...prev, item];

      });

    }

  };



  // Total da venda avulsa (via modal AddItemModal)

  const vendaAvulsaModalTotal = useMemo(() => {

    return vendaAvulsaItems.reduce((acc, item) => acc + item.preco * item.quantidade, 0);

  }, [vendaAvulsaItems]);



  // Finalizar venda avulsa (via modal AddItemModal)

  const handleFinalizarVendaAvulsaModal = async () => {

    if (vendaAvulsaItems.length === 0) {

      toast.error('Adicione pelo menos um item');

      return;

    }



    setIsProcessingVendaAvulsa(true);



    try {

      // 1. DEXIE PRIMEIRO - Registrar venda avulsa localmente
      const vendaId = crypto.randomUUID();
      const novaVendaAvulsa = {
        id: vendaId,
        empresa_id: profile?.empresa_id,
        valor_total: vendaAvulsaModalTotal,
        valor_subtotal: vendaAvulsaModalTotal,
        forma_pagamento: vendaAvulsaFormaPagamento,
        processado_por: profile?.id,
        tipo_processamento: 'venda_avulsa',
        observacoes: `Venda avulsa: ${vendaAvulsaItems.map(i => `${i.quantidade}x ${i.nome}`).join(', ')}`,
        created_at: new Date().toISOString(),
        sincronizado: 0,
      };
      await db.vendas_concluidas.put(novaVendaAvulsa).catch((e: any) => console.warn('[Offline-First] Erro ao salvar venda avulsa local:', e));

      // 2. Supabase em background
      if (navigator.onLine) {
        try {
          const { sincronizado, ...dados } = novaVendaAvulsa;
          const { error } = await supabase.from('vendas_concluidas').insert(dados);
          if (!error) await db.vendas_concluidas.update(vendaId, { sincronizado: 1 }).catch(() => {});
        } catch (e) { console.warn('[Offline-First] Venda avulsa sera sincronizada:', e); }
      }

      toast.success('Venda avulsa registrada com sucesso!');



      // Imprimir cupom

      printCaixaReceipt({

        empresaNome: empresa?.nome_fantasia || 'Restaurante',

        empresaEndereco: empresa?.endereco_completo || undefined,

        empresaCnpj: empresa?.cnpj || undefined,

        mesaNumero: 0,

        nomeCliente: 'Venda Avulsa',

        itens: vendaAvulsaItems.map(item => ({

          nome: item.nome,

          quantidade: item.quantidade,

          precoUnitario: item.preco,

          subtotal: item.preco * item.quantidade,

        })),

        subtotal: vendaAvulsaModalTotal,

        total: vendaAvulsaModalTotal,

        formaPagamento: vendaAvulsaFormaPagamento,

        timestamp: new Date(),

      });



      // Limpar e fechar

      setVendaAvulsaItems([]);

      setVendaAvulsaDialogOpen(false);

      setAddItemModalOpen(false);

    } catch (error: any) {

      console.error('Erro ao processar venda avulsa:', error);

      toast.error(`Erro ao processar: ${error.message}`);

    } finally {

      setIsProcessingVendaAvulsa(false);

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

    // Fecha o modal primeiro

    setShowPixModal(false);



    // Se há pagamento PIX pendente, agora fecha a comanda

    if (pendingPixPayment) {

      closeComandaMutation.mutate(pendingPixPayment);

      setPendingPixPayment(null);

    } else {

      // Caso não haja pagamento pendente (caso antigo), apenas limpa o estado

      setSelectedComanda(null);

      setFormaPagamento('');

      setTrocoPara('');

      setPagamentoMultiplo(false);

      setPagamentos([]);

      setMetodosAtivos([]);

    }

  };



  const handleApplyFilters = () => {

    // refaz a query do histórico com os filtros atuais

    refetchHistorico();

  };



  const handleRefreshAll = async () => {

    setIsRefreshing(true);

    try {

      // invalida todas as queries desta página com a empresa_id atual

      await Promise.all([

        queryClient.invalidateQueries({ queryKey: ['empresa', profile?.empresa_id] }),

        queryClient.invalidateQueries({ queryKey: ['comandas-abertas', profile?.empresa_id] }),

        queryClient.invalidateQueries({ queryKey: ['comandas-fechadas', profile?.empresa_id, filterStartDate, filterEndDate, filterPaymentMethod] }),

        queryClient.invalidateQueries({ queryKey: ['pedidos-delivery-caixa', profile?.empresa_id] }),

      ]);

      toast.success('Dados atualizados!');

    } finally {

      setIsRefreshing(false);

    }

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

      {/* NFC-e Emission Dialog */}

      <NfceEmissionDialog

        open={nfceDialogOpen}

        onOpenChange={setNfceDialogOpen}

        data={nfceComandaData}

      />



      {/* Modal Venda Avulsa */}

      <Dialog open={vendaAvulsaOpen} onOpenChange={(open) => {

        setVendaAvulsaOpen(open);

        if (!open) {

          setVendaAvulsaItens([]);

          setVendaAvulsaBusca('');

          setVendaAvulsaManualNome('');

          setVendaAvulsaManualPreco('');

          setVendaAvulsaPixModalOpen(false);

        }

      }}>

        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">

          <DialogHeader>

            <DialogTitle className="flex items-center gap-2">

              <ShoppingBag className="w-5 h-5 text-green-600" />

              Venda Avulsa

            </DialogTitle>

            <DialogDescription>

              Registre vendas de itens avulsos diretamente no caixa

            </DialogDescription>

          </DialogHeader>



          <div className="space-y-4">

            {/* Busca de produtos do cardápio */}

            <div className="space-y-2">

              <Label className="text-sm font-medium">Buscar Produto do Cardápio</Label>

              <Input

                placeholder="Digite o nome do produto..."

                value={vendaAvulsaBusca}

                onChange={(e) => setVendaAvulsaBusca(e.target.value)}

              />

              {vendaAvulsaBusca && produtosFiltrados.length > 0 && (

                <ScrollArea className="h-32 border rounded-lg">

                  <div className="p-2 space-y-1">

                    {produtosFiltrados.slice(0, 10).map((p: any) => (

                      <Button

                        key={p.id}

                        variant="ghost"

                        size="sm"

                        className="w-full justify-between text-left h-auto py-2"

                        onClick={() => {

                          adicionarProdutoAvulso({ id: p.id, nome: p.nome, preco: p.preco });

                          setVendaAvulsaBusca('');

                        }}

                      >

                        <span className="truncate">{p.nome}</span>

                        <span className="text-muted-foreground ml-2">R$ {Number(p.preco).toFixed(2)}</span>

                      </Button>

                    ))}

                  </div>

                </ScrollArea>

              )}

            </div>



            <Separator />



            {/* Adicionar item manual */}

            <div className="space-y-2">

              <Label className="text-sm font-medium">Ou Adicionar Item Manual</Label>

              <div className="flex gap-2">

                <Input

                  placeholder="Nome do item"

                  value={vendaAvulsaManualNome}

                  onChange={(e) => setVendaAvulsaManualNome(e.target.value)}

                  className="flex-1"

                />

                <Input

                  placeholder="Preço"

                  type="number"

                  step="0.01"

                  value={vendaAvulsaManualPreco}

                  onChange={(e) => setVendaAvulsaManualPreco(e.target.value)}

                  className="w-24"

                />

                <Button size="icon" variant="outline" onClick={adicionarItemManual}>

                  <Plus className="w-4 h-4" />

                </Button>

              </div>

            </div>



            <Separator />



            {/* Itens adicionados */}

            <div className="space-y-2">

              <Label className="text-sm font-medium">Itens ({vendaAvulsaItens.length})</Label>

              {vendaAvulsaItens.length === 0 ? (

                <p className="text-center text-muted-foreground py-4 text-sm">Nenhum item adicionado</p>

              ) : (

                <div className="space-y-2">

                  {vendaAvulsaItens.map((item, idx) => (

                    <div key={idx} className="flex items-center justify-between p-2 border rounded-lg">

                      <div className="flex-1 min-w-0">

                        <span className="text-sm font-medium truncate block">{item.nome}</span>

                        <span className="text-xs text-muted-foreground">R$ {item.preco.toFixed(2)} un.</span>

                      </div>

                      <div className="flex items-center gap-2">

                        <Button

                          size="icon"

                          variant="ghost"

                          className="h-7 w-7"

                          onClick={() => {

                            const novos = [...vendaAvulsaItens];

                            if (novos[idx].quantidade > 1) {

                              novos[idx].quantidade -= 1;

                              setVendaAvulsaItens(novos);

                            }

                          }}

                        >

                          <Minus className="w-3 h-3" />

                        </Button>

                        <span className="text-sm font-medium w-6 text-center">{item.quantidade}</span>

                        <Button

                          size="icon"

                          variant="ghost"

                          className="h-7 w-7"

                          onClick={() => {

                            const novos = [...vendaAvulsaItens];

                            novos[idx].quantidade += 1;

                            setVendaAvulsaItens(novos);

                          }}

                        >

                          <Plus className="w-3 h-3" />

                        </Button>

                        <Button

                          size="icon"

                          variant="ghost"

                          className="h-7 w-7 text-destructive"

                          onClick={() => setVendaAvulsaItens(vendaAvulsaItens.filter((_, i) => i !== idx))}

                        >

                          <Trash2 className="w-3 h-3" />

                        </Button>

                        <span className="text-sm font-bold w-20 text-right">

                          R$ {(item.preco * item.quantidade).toFixed(2)}

                        </span>

                      </div>

                    </div>

                  ))}

                </div>

              )}

            </div>



            {/* Total */}

            {vendaAvulsaItens.length > 0 && (

              <>

                <div className="p-3 bg-green-500/10 rounded-lg flex justify-between items-center">

                  <span className="font-medium">Total</span>

                  <span className="text-xl font-bold text-green-600">R$ {vendaAvulsaTotal.toFixed(2)}</span>

                </div>



                {/* Forma de pagamento */}

                <div className="space-y-2">

                  <Label className="text-sm font-medium">Forma de Pagamento</Label>

                  <RadioGroup

                    value={vendaAvulsaPagamento}

                    onValueChange={(v) => setVendaAvulsaPagamento(v as PaymentMethod)}

                    className="grid grid-cols-2 gap-2"

                  >

                    <Label htmlFor="va-dinheiro" className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${vendaAvulsaPagamento === 'dinheiro' ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>

                      <RadioGroupItem value="dinheiro" id="va-dinheiro" />

                      <Banknote className="w-4 h-4" /> Dinheiro

                    </Label>

                    <Label htmlFor="va-pix" className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${vendaAvulsaPagamento === 'pix' ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>

                      <RadioGroupItem value="pix" id="va-pix" />

                      <QrCode className="w-4 h-4" /> PIX

                    </Label>

                    <Label htmlFor="va-credito" className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${vendaAvulsaPagamento === 'cartao_credito' ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>

                      <RadioGroupItem value="cartao_credito" id="va-credito" />

                      <CreditCard className="w-4 h-4" /> Crédito

                    </Label>

                    <Label htmlFor="va-debito" className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${vendaAvulsaPagamento === 'cartao_debito' ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>

                      <RadioGroupItem value="cartao_debito" id="va-debito" />

                      <CreditCard className="w-4 h-4" /> Débito

                    </Label>

                  </RadioGroup>

                </div>

              </>

            )}

          </div>



          <DialogFooter className="gap-2">

            <Button variant="outline" onClick={() => setVendaAvulsaOpen(false)} disabled={isProcessingVendaAvulsa}>

              Cancelar

            </Button>

            <Button

              onClick={handleFinalizarVendaAvulsa}

              disabled={isProcessingVendaAvulsa || vendaAvulsaItens.length === 0}

              className="bg-green-600 hover:bg-green-700"

            >

              {isProcessingVendaAvulsa ? (

                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...</>

              ) : (

                <><Check className="w-4 h-4 mr-2" /> Finalizar Venda</>

              )}

            </Button>

          </DialogFooter>

        </DialogContent>

      </Dialog>



      {/* Modal PIX Venda Avulsa */}

      <Dialog open={vendaAvulsaPixModalOpen} onOpenChange={setVendaAvulsaPixModalOpen}>

        <DialogContent className="max-w-md">

          <DialogHeader>

            <DialogTitle className="flex items-center gap-2">

              <QrCode className="w-5 h-5 text-green-600" />

              Pagamento PIX

            </DialogTitle>

            <DialogDescription>

              Use o QR Code ou copie a chave PIX para receber o pagamento.

            </DialogDescription>

          </DialogHeader>



          {empresa?.chave_pix ? (

            <PixQRCode

              chavePix={empresa.chave_pix}

              valor={vendaAvulsaTotal}

              nomeRecebedor={empresa.nome_fantasia || 'Restaurante'}

            />

          ) : (

            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-4 rounded-lg">

              <AlertCircle className="w-5 h-5 flex-shrink-0" />

              <span className="text-sm">Configure a chave PIX em Configurações &gt; Dados da Empresa para gerar o QR Code.</span>

            </div>

          )}



          <DialogFooter className="gap-2">

            <Button variant="outline" onClick={() => setVendaAvulsaPixModalOpen(false)}>

              Voltar

            </Button>

            <Button

              onClick={processarVendaAvulsa}

              disabled={isProcessingVendaAvulsa}

              className="bg-green-600 hover:bg-green-700"

            >

              {isProcessingVendaAvulsa ? (

                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...</>

              ) : (

                <><Check className="w-4 h-4 mr-2" /> Entendido / Fechar</>

              )}

            </Button>

          </DialogFooter>

        </DialogContent>

      </Dialog>



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

            <div className="text-center p-4 border rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">

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

            <div className="p-4 bg-green-500/10 dark:bg-green-500/20 rounded-lg">

              <div className="flex justify-between items-center">

                <span className="text-lg font-medium">Total</span>

                <span className="text-2xl font-bold text-green-600 dark:text-green-400">

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

                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${liquidacaoFormaPagamento === 'dinheiro' ? 'border-primary bg-primary/5' : 'hover:bg-muted'

                    }`}

                >

                  <RadioGroupItem value="dinheiro" id="liq-dinheiro" />

                  <Banknote className="w-4 h-4" />

                  <span>Dinheiro</span>

                </Label>

                <Label

                  htmlFor="liq-pix"

                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${liquidacaoFormaPagamento === 'pix' ? 'border-primary bg-primary/5' : 'hover:bg-muted'

                    }`}

                >

                  <RadioGroupItem value="pix" id="liq-pix" />

                  <QrCode className="w-4 h-4" />

                  <span>PIX</span>

                </Label>

                <Label

                  htmlFor="liq-credito"

                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${liquidacaoFormaPagamento === 'cartao_credito' ? 'border-primary bg-primary/5' : 'hover:bg-muted'

                    }`}

                >

                  <RadioGroupItem value="cartao_credito" id="liq-credito" />

                  <CreditCard className="w-4 h-4" />

                  <span>Crédito</span>

                </Label>

                <Label

                  htmlFor="liq-debito"

                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${liquidacaoFormaPagamento === 'cartao_debito' ? 'border-primary bg-primary/5' : 'hover:bg-muted'

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

                  <div className="text-center p-4 border rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">

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

        <Card className="border-2 border-red-500 bg-red-500/10 dark:bg-red-500/20 animate-pulse">

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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        <div>

          <h1 className="text-2xl font-bold text-foreground">Caixa</h1>

          <p className="text-muted-foreground">Gerencie pagamentos de mesas e delivery</p>

        </div>

        <div className="flex flex-wrap items-center gap-2">

          <Button onClick={() => setVendaAvulsaOpen(true)} className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto">

            <ShoppingBag className="w-4 h-4 mr-2" />

            Venda Avulsa

          </Button>

          {alertasPendentes > 0 && (

            <Badge variant="destructive" className="text-sm px-3 py-1">

              {alertasPendentes} pendente{alertasPendentes > 1 ? 's' : ''}

            </Badge>

          )}

          <Button variant="outline" disabled={isRefreshing} onClick={handleRefreshAll} className="w-full sm:w-auto">

            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />

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

                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedComanda?.id === comanda.id ? 'border-primary bg-primary/5' : 'hover:bg-muted'

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

                    <div className="flex items-center justify-between flex-wrap gap-2">

                      <CardTitle className="flex items-center gap-2">

                        <Receipt className="w-5 h-5" />

                        Mesa {selectedComanda.mesa?.numero_mesa || '-'}

                      </CardTitle>

                      <div className="flex gap-2 flex-wrap">

                        <Button

                          variant="default"

                          size="sm"

                          onClick={() => handleOpenAddItem('comanda')}

                          className="bg-green-600 hover:bg-green-700"

                        >

                          <Plus className="w-4 h-4 mr-1" />

                          Adicionar Item

                        </Button>

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

                            <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded">

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

                                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${isActive ? 'border-primary bg-primary/5' : 'hover:bg-muted'

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

                            <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded">

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

                <Select

                  value={filterPaymentMethod}

                  onValueChange={setFilterPaymentMethod}

                >

                  <SelectTrigger className="w-[180px]">

                    <SelectValue placeholder="Todas" />

                  </SelectTrigger>

                  <SelectContent>

                    <SelectItem value="todas">Todas</SelectItem>

                    <SelectItem value="dinheiro">Dinheiro</SelectItem>

                    <SelectItem value="pix">PIX</SelectItem>

                    <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>

                    <SelectItem value="cartao_debito">Cartão Débito</SelectItem>

                  </SelectContent>

                </Select>

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



      {/* Modal de Adicionar Item */}

      <AddItemModal

        open={addItemModalOpen}

        onOpenChange={(open) => {

          setAddItemModalOpen(open);

          if (!open && addItemMode === 'avulsa' && vendaAvulsaItems.length > 0) {

            // Se fechou e tem itens de venda avulsa, abrir dialog de finalização

            setVendaAvulsaDialogOpen(true);

          }

        }}

        empresaId={profile?.empresa_id || ''}

        comandaId={addItemMode === 'comanda' ? selectedComanda?.id : null}

        onItemAdded={handleItemAdded}

        mode={addItemMode}

      />



      {/* Dialog de Venda Avulsa */}

      <Dialog open={vendaAvulsaDialogOpen} onOpenChange={setVendaAvulsaDialogOpen}>

        <DialogContent className="max-w-md">

          <DialogHeader>

            <DialogTitle className="flex items-center gap-2">

              <ShoppingBag className="w-5 h-5 text-amber-600" />

              Finalizar Venda Avulsa

            </DialogTitle>

            <DialogDescription>

              Revise os itens e selecione a forma de pagamento

            </DialogDescription>

          </DialogHeader>



          <div className="space-y-4 py-2">

            {/* Itens da venda */}

            <div className="space-y-2">

              <Label>Itens</Label>

              <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">

                {vendaAvulsaItems.map((item, idx) => (

                  <div key={idx} className="p-2 flex justify-between items-center">

                    <div>

                      <p className="text-sm font-medium">{item.nome}</p>

                      <p className="text-xs text-muted-foreground">

                        {item.quantidade}x R$ {item.preco.toFixed(2)}

                      </p>

                    </div>

                    <div className="flex items-center gap-2">

                      <span className="font-medium">

                        R$ {(item.preco * item.quantidade).toFixed(2)}

                      </span>

                      <Button

                        variant="ghost"

                        size="sm"

                        className="h-6 w-6 p-0 text-red-500"

                        onClick={() => {

                          setVendaAvulsaItems(prev => prev.filter((_, i) => i !== idx));

                        }}

                      >

                        <X className="h-4 w-4" />

                      </Button>

                    </div>

                  </div>

                ))}

              </div>

              <Button

                variant="outline"

                size="sm"

                className="w-full"

                onClick={() => {

                  setVendaAvulsaDialogOpen(false);

                  setAddItemModalOpen(true);

                }}

              >

                <Plus className="w-4 h-4 mr-2" />

                Adicionar mais itens

              </Button>

            </div>



            {/* Total */}

            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">

              <div className="flex justify-between items-center">

                <span className="font-medium">Total</span>

                <span className="text-xl font-bold text-amber-700 dark:text-amber-400">

                  R$ {vendaAvulsaModalTotal.toFixed(2)}

                </span>

              </div>

            </div>



            {/* Forma de Pagamento */}

            <div className="space-y-2">

              <Label>Forma de Pagamento</Label>

              <div className="grid grid-cols-2 gap-2">

                {[

                  { value: 'dinheiro' as PaymentMethod, label: 'Dinheiro', icon: Banknote },

                  { value: 'pix' as PaymentMethod, label: 'PIX', icon: QrCode },

                  { value: 'cartao_credito' as PaymentMethod, label: 'Crédito', icon: CreditCard },

                  { value: 'cartao_debito' as PaymentMethod, label: 'Débito', icon: CreditCard },

                ].map((method) => (

                  <Button

                    key={method.value}

                    variant={vendaAvulsaFormaPagamento === method.value ? 'default' : 'outline'}

                    size="sm"

                    onClick={() => setVendaAvulsaFormaPagamento(method.value)}

                    className="h-10"

                  >

                    <method.icon className="w-4 h-4 mr-2" />

                    {method.label}

                  </Button>

                ))}

              </div>

            </div>

          </div>



          <DialogFooter className="gap-2">

            <Button

              variant="outline"

              onClick={() => setVendaAvulsaDialogOpen(false)}

              disabled={isProcessingVendaAvulsa}

            >

              Voltar

            </Button>

            <Button

              onClick={handleFinalizarVendaAvulsaModal}

              disabled={isProcessingVendaAvulsa || vendaAvulsaItems.length === 0}

              className="bg-amber-600 hover:bg-amber-700"

            >

              {isProcessingVendaAvulsa ? (

                <>

                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />

                  Processando...

                </>

              ) : (

                <>

                  <Check className="w-4 h-4 mr-2" />

                  Finalizar Venda

                </>

              )}

            </Button>

          </DialogFooter>

        </DialogContent>

      </Dialog>

    </div>

  );

}