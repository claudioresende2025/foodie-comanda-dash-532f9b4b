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
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Assinatura {
  id: string;
  status: string;
  periodo: string;
  trial_start: string;
  trial_end: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  updated_at?: string;
  plano_id: string | null;
  plano: {
    id: string;
    nome: string;
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

  // Handler para processar sucesso do checkout (upgrade/novo plano)
  useEffect(() => {
    const handleSubscriptionSuccess = async () => {
      const subscriptionSuccess = searchParams.get('subscription');
      const planoId = searchParams.get('planoId');
      const sessionId = searchParams.get('session_id');
      
      if (subscriptionSuccess === 'success' && planoId && profile?.empresa_id) {
        console.log('[Assinatura] Processando sucesso do checkout:', { planoId, sessionId });
        
        try {
          // Atualizar a assinatura com o novo plano
          const { error } = await (supabase as any)
            .from('assinaturas')
            .update({
              plano_id: planoId,
              status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('empresa_id', profile.empresa_id);

          if (error) {
            console.error('[Assinatura] Erro ao atualizar plano:', error);
            toast.error('Erro ao atualizar plano. Entre em contato com o suporte.');
          } else {
            toast.success('Plano atualizado com sucesso!');
            // Limpar localStorage
            try {
              localStorage.removeItem('post_subscribe_plan');
            } catch (e) {}
          }
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
      // Buscar assinatura com plano (usar maybeSingle para não lançar erro se não existir)
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

  const handleCancelSubscription = async () => {
    setIsCanceling(true);
    try {
      // TODO: Implementar cancelamento via Stripe
      const { error } = await (supabase as any)
        .from('assinaturas')
        .update({
          cancel_at_period_end: true,
          updated_at: new Date().toISOString(),
        })
        .eq('empresa_id', profile?.empresa_id);

      if (error) throw error;

      toast.success('Assinatura será cancelada ao fim do período atual');
      setCancelDialogOpen(false);
      await fetchData();
    } catch (err) {
      console.error('Erro ao cancelar:', err);
      toast.error('Erro ao cancelar assinatura');
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
      if (data?.success === false) {
        toast.error(data?.error || data?.message || 'Não foi possível registrar a solicitação de reembolso');
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

  // Calcular dias restantes do trial
  const trialDaysRemaining = assinatura?.trial_end 
    ? Math.max(0, Math.ceil((new Date(assinatura.trial_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
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
  
  const getNextChargeDate = () => {
    const end = assinatura?.current_period_end;
    if (isValidDate(end)) return formatDateBR(end);
    const start = assinatura?.current_period_start;
    if (isValidDate(start)) {
      const base = new Date(start);
      const days = assinatura?.periodo === 'anual' ? 365 : 30;
      const fallback = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
      return formatDateBR(fallback);
    }
    // Fallback: usar último pagamento registrado
    const lastPayment = pagamentos && pagamentos.length > 0 ? pagamentos[0] : null;
    if (lastPayment?.created_at) {
      const base = new Date(lastPayment.created_at);
      const days = assinatura?.periodo === 'anual' ? 365 : 30;
      const fallback = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
      return formatDateBR(fallback);
    }
    // Outro fallback: usar updated_at da assinatura
    if (isValidDate(assinatura?.updated_at)) {
      const base = new Date(assinatura!.updated_at as any);
      const days = assinatura?.periodo === 'anual' ? 365 : 30;
      const fallback = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
      return formatDateBR(fallback);
    }
    // Fallback final: estimativa a partir de hoje, para não ficar vazio
    if (assinatura?.periodo) {
      const days = assinatura.periodo === 'anual' ? 365 : 30;
      const fallback = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      return formatDateBR(fallback);
    }
    return '—';
  };

  return (
    <div className="min-h-screen bg-background">
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full ${statusConfig?.color} flex items-center justify-center`}>
                      <StatusIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {assinatura.plano?.nome ? `Plano ${assinatura.plano.nome}` : 'Período de Teste'}
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
                    <div className="text-right">
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
              {assinatura.status === 'trialing' && (
                <CardContent className="pt-0">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-900">Período de teste</span>
                      <span className="text-sm text-blue-700">
                        {trialDaysRemaining} {trialDaysRemaining === 1 ? 'dia' : 'dias'} restantes
                      </span>
                    </div>
                    <Progress value={(3 - trialDaysRemaining) / 3 * 100} className="h-2" />
                    <p className="text-xs text-blue-600 mt-2">
                      Seu cartão será cobrado em {formatDateBR(assinatura.trial_end)}
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
              {assinatura.cancel_at_period_end && (
                <CardContent className="pt-0">
                  <div className="bg-amber-50 rounded-lg p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-900">Cancelamento agendado</p>
                      <p className="text-sm text-amber-700">
                        Sua assinatura será cancelada em{' '}
                        {formatDateBR(assinatura.current_period_end)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              )}

              <CardFooter className="flex gap-2">
                <Button variant="outline" onClick={() => navigate('/planos')}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {assinatura.plano_id ? 'Trocar Plano' : 'Escolher Plano'}
                </Button>
                {!assinatura.cancel_at_period_end && assinatura.status !== 'canceled' && assinatura.plano_id && (
                  <Button variant="outline" onClick={() => setCancelDialogOpen(true)}>
                    Cancelar Assinatura
                  </Button>
                )}
                {assinatura.status === 'active' && pagamentos.length > 0 && (
                  <Button variant="outline" onClick={() => setRefundDialogOpen(true)}>
                    Solicitar Reembolso
                  </Button>
                )}
              </CardFooter>
            </Card>

            {/* Recursos do Plano */}
            {(() => {
              const resourcesDisplay: Record<string, { label: string; included: boolean }[]> = {
                'Básico': [
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

              const getPlanResources = (planName: string) => {
                if (!planName) return [];
                const nameLower = planName.toLowerCase();
                if (nameLower.includes('básico') || nameLower.includes('bronze') || nameLower.includes('basico')) return resourcesDisplay['Básico'];
                if (nameLower.includes('profissional') || nameLower.includes('prata')) return resourcesDisplay['Profissional'];
                if (nameLower.includes('enterprise') || nameLower.includes('ouro')) return resourcesDisplay['Enterprise'];
                return [];
              };

              const visualResources = getPlanResources(assinatura.plano?.nome || '');
              const resourcesToShow = visualResources.length > 0 
                ? visualResources 
                : (assinatura.plano?.recursos || []).map(r => ({ label: r, included: true }));

              if (resourcesToShow.length === 0) return null;

              return (
                <Card>
                  <CardHeader>
                    <CardTitle>Recursos {assinatura.plano_id ? 'do seu plano' : 'inclusos no trial'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-3">
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
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum pagamento registrado
                  </p>
                ) : (
                  <div className="space-y-3">
                    {pagamentos.map((pagamento) => (
                      <div 
                        key={pagamento.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            pagamento.status === 'succeeded' ? 'bg-green-100' : 'bg-red-100'
                          }`}>
                            {pagamento.status === 'succeeded' ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{formatCurrency(pagamento.valor)}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(pagamento.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={pagamento.status === 'succeeded' ? 'default' : 'destructive'}>
                            {pagamento.status === 'succeeded' ? 'Pago' : 'Falhou'}
                          </Badge>
                          {pagamento.metadata?.hosted_invoice_url && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="ml-2"
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

      {/* Dialog Cancelar */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
            <AlertDialogDescription>
              Sua assinatura continuará ativa até o fim do período atual. 
              Após isso, você perderá acesso às funcionalidades premium.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Por que está cancelando? (opcional)"
              value={cancelMotivo}
              onChange={(e) => setCancelMotivo(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelSubscription}
              disabled={isCanceling}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isCanceling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Reembolso */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Reembolso</DialogTitle>
            <DialogDescription>
              Você pode solicitar reembolso em até 7 dias após o pagamento.
              O valor será estornado para o mesmo método de pagamento.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Descreva o motivo da solicitação"
              value={refundMotivo}
              onChange={(e) => setRefundMotivo(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleRequestRefund}
              disabled={isRequestingRefund || !refundMotivo.trim()}
            >
              {isRequestingRefund && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enviar Solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
