import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  Loader2, 
  CreditCard, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  Crown,
  XCircle,
  Receipt,
  Download,
  X,
  Check,
  Settings2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Assinatura {
  id: string;
  status: string;
  periodo: string;
  data_inicio: string | null;
  data_fim: string | null;
  trial_end: string | null;
  canceled_at: string | null;
  cancel_at_period_end?: boolean;
  updated_at?: string;
  stripe_subscription_id?: string | null;
  plano_id: string | null;
  plano: {
    id: string;
    nome: string;
    slug?: string;
    preco_mensal: number;
    preco_anual: number;
    recursos: string[];
  } | null;
}

interface Pagamento {
  id: string;
  valor: number;
  status: string;
  metodo_pagamento: string;
  descricao: string;
  created_at: string;
  metadata: any;
}

export default function Assinatura() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [isCanceling, setIsCanceling] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundMotivo, setRefundMotivo] = useState('');
  const [isRequestingRefund, setIsRequestingRefund] = useState(false);
  const [isRedirectingPortal, setIsRedirectingPortal] = useState(false);

  // FUNÇÃO ADICIONADA PARA EVITAR DUPLICIDADE DE ASSINATURA
  const handlePlanChange = () => {
    if (assinatura?.stripe_subscription_id) {
      // Se já tem assinatura, manda para planos com flag de UPGRADE
      // Isso evita que o sistema crie uma nova assinatura do zero
      navigate(`/planos?upgrade=true&currentPlan=${assinatura.plano_id}&subscription_id=${assinatura.stripe_subscription_id}`);
      toast.info("Redirecionando para alteração de plano...");
    } else {
      // Fluxo normal para quem está em trial ou sem plano
      navigate('/planos');
    }
  };

  // Handler para processar sucesso do checkout (upgrade/novo plano)
  useEffect(() => {
    const handleSubscriptionSuccess = async () => {
      const subscriptionSuccess = searchParams.get('subscription');
      const planoId = searchParams.get('planoId');
      const sessionId = searchParams.get('session_id');
      const periodo = searchParams.get('periodo');
      
      if (subscriptionSuccess === 'success' && planoId && profile?.empresa_id) {
        console.log('[Assinatura] Processando sucesso do checkout:', { planoId, sessionId });
        
        try {
          if (sessionId) {
            try {
              const { error } = await supabase.functions.invoke('process-subscription', {
                body: {
                  sessionId,
                  empresaId: profile.empresa_id,
                  planoId,
                  periodo,
                },
              });
              if (error) {
                console.warn('Falha ao vincular assinatura via process-subscription:', error);
              }
            } catch (e) {
              console.warn('Erro ao chamar process-subscription:', e);
            }
          }
          toast.success('Checkout concluído! Atualizando assinatura...');
          try { localStorage.removeItem('post_subscribe_plan'); } catch (e) { void e; }
        } catch (err) {
          console.error('[Assinatura] Erro:', err);
        }
        
        // Limpar parâmetros da URL
        setSearchParams({});
        
        // Recarregar dados
        await fetchData();
      }
    };
    
    if (profile?.empresa_id) {
      handleSubscriptionSuccess();
    }
  }, [searchParams, profile?.empresa_id]);

  useEffect(() => {
    // Se auth ainda está carregando, aguardar
    if (authLoading) return;
    
    // Se não tem profile ou empresa_id, parar loading e mostrar estado vazio
    if (!profile?.empresa_id) {
      setIsLoading(false);
      return;
    }
    
    fetchData();
  }, [profile?.empresa_id, authLoading]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Buscar assinatura com plano
      const { data: assinaturaData, error: assinaturaError } = await (supabase as any)
        .from('assinaturas')
        .select('*, plano:planos(*)')
        .eq('empresa_id', profile?.empresa_id)
        .maybeSingle();

      if (!assinaturaError && assinaturaData) {
        let planoData = assinaturaData.plano;
        
        // Se não tem plano vinculado (trial inicial), buscar plano básico como referência
        if (!planoData && assinaturaData.status === 'trialing') {
          const { data: planoBasico } = await (supabase as any)
            .from('planos')
            .select('*')
            .eq('ativo', true)
            .order('ordem', { ascending: true })
            .limit(1)
            .single();
          
          planoData = planoBasico;
        }

        setAssinatura({
          ...assinaturaData,
          plano: planoData ? {
            ...planoData,
            recursos: typeof planoData.recursos === 'string' 
              ? JSON.parse(planoData.recursos) 
              : planoData.recursos || [],
          } : null,
        });
      }

      // Buscar histórico de pagamentos
      const { data: pagamentosData } = await (supabase as any)
        .from('pagamentos_assinatura')
        .select('*')
        .eq('empresa_id', profile?.empresa_id)
        .order('created_at', { ascending: false })
        .limit(10);

      setPagamentos(pagamentosData || []);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // NOVA FUNÇÃO: GERENCIAR PLANO (STRIPE PORTAL)
  const handleManageSubscription = async () => {
    setIsRedirectingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: { empresaId: profile?.empresa_id },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Não foi possível carregar o link do portal do Stripe.');
      }
    } catch (err: any) {
      console.error('Erro ao abrir portal:', err);
      toast.error(err.message || 'Erro ao abrir gerenciamento de faturas');
    } finally {
      setIsRedirectingPortal(false);
    }
  };

  const handleCancelSubscription = async () => {
    setIsCanceling(true);
    try {
      // Durante trial: cancelar imediatamente (sem cobrança)
      const isTrial = assinatura?.status === 'trialing' || assinatura?.status === 'trial';
      
      // Se tem stripe_subscription_id, cancelar via edge function
      if (assinatura?.stripe_subscription_id) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token || '';
        
        const { data, error } = await supabase.functions.invoke('cancel-subscription', {
          body: {
            subscriptionId: assinatura.stripe_subscription_id,
            cancelAtPeriodEnd: !isTrial, // Trial = cancelar imediato
            cancelImmediately: isTrial,
            empresaId: profile?.empresa_id,
          },
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (error) throw error;
        if (data?.success === false) {
          throw new Error(data?.error || data?.message || 'Erro ao cancelar assinatura');
        }
      } else {
        // Sem stripe_subscription_id: atualizar apenas no banco local
        const updatePayload = isTrial
          ? { status: 'canceled', canceled_at: new Date().toISOString() }
          : { cancel_at_period_end: true };
        
        const { error } = await (supabase as any)
          .from('assinaturas')
          .update({ ...updatePayload, updated_at: new Date().toISOString() })
          .eq('empresa_id', profile?.empresa_id);

        if (error) throw error;
      }

      toast.success(isTrial 
        ? 'Assinatura cancelada. Você será redirecionado...' 
        : 'Assinatura será cancelada ao fim do período atual'
      );
      setCancelDialogOpen(false);
      
      if (isTrial) {
        setTimeout(() => {
          window.location.href = '/admin';
        }, 1500);
      } else {
        await fetchData();
      }
    } catch (err: any) {
      console.error('Erro ao cancelar:', err);
      toast.error(err?.message || 'Erro ao cancelar assinatura');
    } finally {
      setIsCanceling(false);
    }
  };

  const handleRequestRefund = async () => {
    setIsRequestingRefund(true);
    try {
      if (!assinatura?.id) {
        toast.error('Assinatura não encontrada. Recarregue a página.');
        return;
      }
      const motivo = refundMotivo.trim();
      if (!motivo) {
        toast.error('Informe o motivo do reembolso');
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';

      const { data, error } = await supabase.functions.invoke('request-refund', {
        body: {
          tipo: 'assinatura',
          assinaturaId: assinatura.id,
          motivo,
        },
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (error) throw error;
      
      if (data?.isTrialing) {
        toast.info(data?.message || 'Durante o período de teste não há cobranças para reembolsar. Use "Cancelar Assinatura".');
      } else if (data?.noPaidPayments) {
        toast.info(data?.message || 'Não há pagamentos registrados para reembolso.');
      } else if (data?.success === false) {
        toast.error(data?.error || data?.message || 'Não foi possível processar o reembolso');
      } else {
        toast.success(data?.message || 'Solicitação de reembolso enviada');
      }
      
      setRefundDialogOpen(false);
      setRefundMotivo('');
    } catch (err: any) {
      console.error('Erro ao solicitar reembolso:', err);
      toast.error(err.message || 'Erro ao solicitar reembolso');
    } finally {
      setIsRequestingRefund(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; icon: any }> = {
      trialing: { label: 'Período de Teste', color: 'bg-blue-500', icon: Clock },
      active: { label: 'Ativa', color: 'bg-green-500', icon: CheckCircle2 },
      past_due: { label: 'Pagamento Atrasado', color: 'bg-red-500', icon: AlertTriangle },
      canceled: { label: 'Cancelada', color: 'bg-gray-500', icon: XCircle },
      unpaid: { label: 'Não Pago', color: 'bg-red-500', icon: AlertTriangle },
    };
    return configs[status] || configs.active;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const statusConfig = assinatura ? getStatusConfig(assinatura.status) : null;
  const StatusIcon = statusConfig?.icon || CheckCircle2;

  const resolveDate = (value?: any) => {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  };
  
  const trialStartDateRaw = resolveDate(assinatura?.data_inicio) || resolveDate(assinatura?.updated_at);
  const trialEndDateRaw = resolveDate(assinatura?.trial_end);
  
  const planSlug = assinatura?.plano?.slug?.toLowerCase();
  const defaultTrialDays = 14;
  
  const computedTrialEnd = (() => {
    if (trialEndDateRaw) return trialEndDateRaw;
    if (trialStartDateRaw) return new Date(trialStartDateRaw.getTime() + defaultTrialDays * 24 * 60 * 60 * 1000);
    return null;
  })();
  
  const trialDaysRemaining = computedTrialEnd
    ? Math.max(0, Math.ceil((computedTrialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : defaultTrialDays;
  
  const trialDaysTotal = computedTrialEnd && trialStartDateRaw
    ? Math.max(1, Math.ceil((computedTrialEnd.getTime() - trialStartDateRaw.getTime()) / (1000 * 60 * 60 * 24)))
    : defaultTrialDays;
  
  const trialProgress = trialDaysTotal > 0 
    ? Math.min(100, Math.max(0, ((trialDaysTotal - trialDaysRemaining) / trialDaysTotal) * 100))
    : 0;

  const isValidDate = (value?: any) => {
    if (!value) return false;
    const d = new Date(value);
    return !isNaN(d.getTime()) && d.getTime() > 0;
  };

  const formatDateBR = (value?: any) => {
    if (!isValidDate(value)) return '—';
    return format(new Date(value), 'dd/MM/yyyy', { locale: ptBR });
  };
  
  const isCanceledAtPeriodEnd = assinatura?.cancel_at_period_end === true && assinatura?.status !== 'canceled';
  
  const getNextChargeDate = () => {
    if (assinatura?.status === 'trialing') {
      if (isValidDate(assinatura?.trial_end)) {
        return formatDateBR(assinatura!.trial_end);
      }
      if (isValidDate(assinatura?.data_fim)) {
        return formatDateBR(assinatura!.data_fim);
      }
    }
    const end = assinatura?.data_fim;
    if (isValidDate(end)) return formatDateBR(end);
    const start = assinatura?.data_inicio;
    if (isValidDate(start)) {
      const base = new Date(start);
      const days = assinatura?.periodo === 'anual' ? 365 : 30;
      const fallback = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
      return formatDateBR(fallback);
    }
    const lastPayment = pagamentos && pagamentos.length > 0 ? pagamentos[0] : null;
    if (lastPayment?.created_at) {
      const base = new Date(lastPayment.created_at);
      const days = assinatura?.periodo === 'anual' ? 365 : 30;
      const fallback = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
      return formatDateBR(fallback);
    }
    if (isValidDate(assinatura?.updated_at)) {
      const base = new Date(assinatura!.updated_at as any);
      const days = assinatura?.periodo === 'anual' ? 365 : 30;
      const fallback = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
      return formatDateBR(fallback);
    }
    if (assinatura?.periodo) {
      const days = assinatura.periodo === 'anual' ? 365 : 30;
      const fallback = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      return formatDateBR(fallback);
    }
    return '—';
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Minha Assinatura</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie seu plano e pagamentos
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {!assinatura ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Crown className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-bold mb-2">Você não tem uma assinatura ativa</h2>
              <p className="text-muted-foreground mb-6">
                Escolha um plano para continuar usando todas as funcionalidades
              </p>
              <Button onClick={() => navigate('/planos')}>
                <CreditCard className="w-4 h-4 mr-2" />
                Ver Planos
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Status Card */}
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full ${statusConfig?.color} flex items-center justify-center`}>
                      <StatusIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {(() => {
                          const slug = assinatura.plano?.slug?.toLowerCase();
                          if (slug === 'bronze') return 'Plano Iniciante';
                          if (slug === 'prata') return 'Plano Profissional';
                          if (slug === 'ouro') return 'Plano Ouro (Enterprise)';
                          return assinatura.plano?.nome || 'Período de Teste';
                        })()}
                        <Badge className={statusConfig?.color}>{statusConfig?.label}</Badge>
                      </CardTitle>
                      <CardDescription>
                        {assinatura.status === 'trialing' && !assinatura.plano_id
                          ? 'Escolha um plano antes do fim do trial'
                          : assinatura.periodo === 'anual' ? 'Cobrança anual' : 'Cobrança mensal'
                        }
                      </CardDescription>
                    </div>
                  </div>
                  {assinatura.plano && (
                    <div className="md:text-right">
                      <p className="text-2xl font-bold">
                        {formatCurrency(
                          assinatura.periodo === 'anual' 
                            ? assinatura.plano?.preco_anual 
                            : assinatura.plano?.preco_mensal
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        /{assinatura.periodo === 'anual' ? 'ano' : 'mês'}
                      </p>
                    </div>
                  )}
                </div>
              </CardHeader>

              {/* Trial Progress */}
              {(assinatura.status === 'trialing' || assinatura.status === 'trial') && (
                <CardContent className="pt-0">
                  <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">Período de teste</span>
                      <span className={`text-sm font-semibold ${
                        trialDaysRemaining <= 1 
                          ? 'text-destructive' 
                          : trialDaysRemaining <= 2 
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-primary'
                      }`}>
                        {trialDaysRemaining} {trialDaysRemaining === 1 ? 'dia restante' : 'dias restantes'}
                      </span>
                    </div>
                    <Progress 
                      value={trialProgress}
                      className={`h-3 ${trialDaysRemaining <= 1 ? '[&>div]:bg-destructive' : ''}`}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      {computedTrialEnd 
                        ? `Seu período de teste termina em ${formatDateBR(computedTrialEnd)}`
                        : `Seu cartão será cobrado em ${getNextChargeDate()}`
                      }
                    </p>
                  </div>
                </CardContent>
              )}

              {/* Period Info */}
              {assinatura.status === 'active' && (
                <CardContent className="pt-0">
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>Próxima cobrança: </span>
                      <span className="font-medium">
                        {getNextChargeDate()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              )}

              {/* Cancel Info */}
              {isCanceledAtPeriodEnd && (
                <CardContent className="pt-0">
                  <div className="bg-amber-50 rounded-lg p-4 flex items-start gap-3 border border-amber-100">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-900">Cancelamento agendado</p>
                      <p className="text-sm text-amber-700">
                        Sua assinatura será cancelada em{' '}
                        {formatDateBR(assinatura.data_fim)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              )}

              <CardFooter className="flex flex-wrap gap-2 border-t pt-6 bg-muted/20">
                {/* BOTÃO GERENCIAR PLANO (STRIPE PORTAL) */}
                <Button 
                  onClick={handleManageSubscription}
                  disabled={isRedirectingPortal}
                  className="bg-primary text-primary-foreground"
                >
                  {isRedirectingPortal ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Settings2 className="w-4 h-4 mr-2" />
                  )}
                  Gerenciar Plano e Faturas
                </Button>

                <Button variant="outline" onClick={() => navigate('/planos')}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {assinatura.plano_id ? 'Trocar Plano' : 'Escolher Plano'}
                </Button>
                
                {!isCanceledAtPeriodEnd && assinatura.status !== 'canceled' && (
                  <Button variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/10" onClick={() => setCancelDialogOpen(true)}>
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancelar Assinatura
                  </Button>
                )}
                
                {['active', 'trialing', 'trial'].includes(assinatura.status) && (
                  <Button variant="ghost" onClick={() => setRefundDialogOpen(true)}>
                    <Receipt className="w-4 h-4 mr-2" />
                    Solicitar Reembolso
                  </Button>
                )}
              </CardFooter>
            </Card>

            {/* Recursos do Plano */}
            {(() => {
              const resourcesDisplay: Record<string, { label: string; included: boolean }[]> = {
                'Iniciante': [
                  { label: 'Dashboard: Básico (Vendas do dia)', included: true },
                  { label: 'Mesas: Limitado (até 10 mesas)', included: true },
                  { label: 'Delivery: Básico (WhatsApp)', included: true },
                  { label: 'Garçom (App): 1 usuário', included: true },
                  { label: 'Equipe/Empresa: Até 2 colaboradores', included: true },
                  { label: 'Cardápio: Cardápio digital responsivo', included: true },
                  { label: 'Pedidos (KDS): 1 tela', included: true },
                  { label: 'Estatísticas Delivery: Não incluso', included: false },
                  { label: 'Marketing: Não incluso', included: false },
                  { label: 'Caixa / Gestão: Fluxo de Caixa + Estoque', included: true },
                ],
                'Profissional': [
                  { label: 'Dashboard: Completo', included: true },
                  { label: 'Mesas: Ilimitado', included: true },
                  { label: 'Delivery: Integrado', included: true },
                  { label: 'Garçom (App): Até 3 usuários', included: true },
                  { label: 'Equipe/Empresa: Até 5 colaboradores', included: true },
                  { label: 'Cardápio: Cardápio digital responsivo', included: true },
                  { label: 'Pedidos (KDS): 1 tela', included: true },
                  { label: 'Estatísticas Delivery: Não incluso', included: false },
                  { label: 'Marketing: Não incluso', included: false },
                  { label: 'Caixa / Gestão: Fluxo de Caixa + Estoque', included: true },
                ],
                'Enterprise': [
                  { label: 'Dashboard: Avançado + Comparativos', included: true },
                  { label: 'Mesas: Ilimitado', included: true },
                  { label: 'Delivery: Integrado', included: true },
                  { label: 'Garçom (App): Ilimitado', included: true },
                  { label: 'Equipe/Empresa: Ilimitado', included: true },
                  { label: 'Cardápio: Cardápio digital responsivo', included: true },
                  { label: 'Pedidos (KDS): Ilimitado', included: true },
                  { label: 'Estatísticas Delivery: Incluso', included: true },
                  { label: 'Marketing: Cupons + Fidelidade', included: true },
                  { label: 'Caixa / Gestão: Fluxo de Caixa + Estoque', included: true },
                ],
              };

              const getPlanResources = (planName: string, planSlug?: string) => {
                if (!planName && !planSlug) return [];
                const slugLower = (planSlug || '').toLowerCase();
                if (slugLower === 'bronze') return resourcesDisplay['Iniciante'];
                if (slugLower === 'prata') return resourcesDisplay['Profissional'];
                if (slugLower === 'ouro') return resourcesDisplay['Enterprise'];
                if (planName in resourcesDisplay) return resourcesDisplay[planName];
                return [];
              };

              const visualResources = getPlanResources(assinatura.plano?.nome || '', assinatura.plano?.slug);
              const resourcesToShow = visualResources.length > 0 
                ? visualResources 
                : (assinatura.plano?.recursos || []).map(r => ({ label: r, included: true }));

              if (resourcesToShow.length === 0) return null;

              const getPlanDisplayTitle = () => {
                const slug = assinatura.plano?.slug?.toLowerCase();
                if (slug === 'bronze') return 'Plano Iniciante';
                if (slug === 'prata') return 'Plano Profissional';
                if (slug === 'ouro') return 'Plano Ouro (Enterprise)';
                return assinatura.plano?.nome || 'trial';
              };

              return (
                <Card>
                  <CardHeader>
                    <CardTitle>Recursos do {getPlanDisplayTitle()}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {resourcesToShow.map((recurso, index) => (
                        <div key={index} className="flex items-center gap-2">
                          {recurso.included ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                          )}
                          <span className={`text-sm ${!recurso.included ? 'text-muted-foreground' : ''}`}>
                            {recurso.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Histórico de Pagamentos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Histórico de Pagamentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pagamentos.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <p className="mb-2">Nenhum pagamento registrado</p>
                    {assinatura.status === 'trialing' && (
                      <p className="text-xs">
                        Primeiro pagamento programado para {getNextChargeDate()}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pagamentos.map((pagamento) => (
                      <div 
                        key={pagamento.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-transparent hover:border-muted-foreground/10 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            pagamento.status === 'succeeded' ? 'bg-green-100' : 
                            pagamento.status === 'trial' ? 'bg-blue-100' : 'bg-red-100'
                          }`}>
                            {pagamento.status === 'succeeded' ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : pagamento.status === 'trial' ? (
                              <Clock className="w-4 h-4 text-blue-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm md:text-base">
                              {pagamento.status === 'trial' ? 'Período de Teste' : formatCurrency(pagamento.valor)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(pagamento.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            pagamento.status === 'succeeded' ? 'default' : 
                            pagamento.status === 'trial' ? 'secondary' : 'destructive'
                          }>
                            {pagamento.status === 'succeeded' ? 'Pago' : 
                             pagamento.status === 'trial' ? 'Trial' : 'Falhou'}
                          </Badge>
                          {pagamento.metadata?.hosted_invoice_url && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => window.open(pagamento.metadata.hosted_invoice_url, '_blank')}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>

      {/* Dialog Cancelamento */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Assinatura</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar sua assinatura? Você poderá continuar usando os recursos premium até o final do período pago.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <label className="text-sm font-medium">Conte-nos o motivo (opcional):</label>
            <Textarea 
              placeholder="Ex: O plano está caro, não uso o suficiente..." 
              value={cancelMotivo}
              onChange={(e) => setCancelMotivo(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Manter Assinatura</Button>
            <Button variant="destructive" onClick={handleCancelSubscription} disabled={isCanceling}>
              {isCanceling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Reembolso */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Reembolso</DialogTitle>
            <DialogDescription>
              A solicitação de reembolso será analisada por nossa equipe. Por favor, detalhe o motivo abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <label className="text-sm font-medium">Motivo do reembolso:</label>
            <Textarea 
              placeholder="Descreva detalhadamente o porquê da solicitação..." 
              value={refundMotivo}
              onChange={(e) => setRefundMotivo(e.target.value)}
              className="min-h-[120px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>Voltar</Button>
            <Button onClick={handleRequestRefund} disabled={isRequestingRefund || !refundMotivo.trim()}>
              {isRequestingRefund ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Enviar Solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
