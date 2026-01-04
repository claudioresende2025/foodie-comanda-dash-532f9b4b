import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Download
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
  plano: {
    id: string;
    nome: string;
    preco_mensal: number;
    preco_anual: number;
    recursos: string[];
  };
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
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [isCanceling, setIsCanceling] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundMotivo, setRefundMotivo] = useState('');
  const [isRequestingRefund, setIsRequestingRefund] = useState(false);

  useEffect(() => {
    if (profile?.empresa_id) {
      fetchData();
    }
  }, [profile?.empresa_id]);

  const fetchData = async () => {
    try {
      // Buscar assinatura
      const { data: assinaturaData, error: assinaturaError } = await (supabase as any)
        .from('assinaturas')
        .select('*, plano:planos(*)')
        .eq('empresa_id', profile?.empresa_id)
        .single();

      if (!assinaturaError && assinaturaData) {
        setAssinatura({
          ...assinaturaData,
          plano: {
            ...assinaturaData.plano,
            recursos: typeof assinaturaData.plano?.recursos === 'string' 
              ? JSON.parse(assinaturaData.plano.recursos) 
              : assinaturaData.plano?.recursos || [],
          },
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
      const { data, error } = await supabase.functions.invoke('request-refund', {
        body: {
          tipo: 'assinatura',
          assinaturaId: assinatura?.id,
          motivo: refundMotivo,
        },
      });

      if (error) throw error;

      toast.success(data.message || 'Solicitação de reembolso enviada');
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
                        Plano {assinatura.plano?.nome}
                        <Badge className={statusConfig?.color}>{statusConfig?.label}</Badge>
                      </CardTitle>
                      <CardDescription>
                        {assinatura.periodo === 'anual' ? 'Cobrança anual' : 'Cobrança mensal'}
                      </CardDescription>
                    </div>
                  </div>
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
                    <Progress value={(7 - trialDaysRemaining) / 7 * 100} className="h-2" />
                    <p className="text-xs text-blue-600 mt-2">
                      Seu cartão será cobrado em {format(new Date(assinatura.trial_end), 'dd/MM/yyyy', { locale: ptBR })}
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
                        {format(new Date(assinatura.current_period_end), 'dd/MM/yyyy', { locale: ptBR })}
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
                        {format(new Date(assinatura.current_period_end), 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              )}

              <CardFooter className="flex gap-2">
                <Button variant="outline" onClick={() => navigate('/planos')}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Trocar Plano
                </Button>
                {!assinatura.cancel_at_period_end && assinatura.status !== 'canceled' && (
                  <Button variant="outline" onClick={() => setCancelDialogOpen(true)}>
                    Cancelar Assinatura
                  </Button>
                )}
                {assinatura.status === 'active' && (
                  <Button variant="outline" onClick={() => setRefundDialogOpen(true)}>
                    Solicitar Reembolso
                  </Button>
                )}
              </CardFooter>
            </Card>

            {/* Recursos do Plano */}
            <Card>
              <CardHeader>
                <CardTitle>Recursos do seu plano</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-3">
                  {assinatura.plano?.recursos?.map((recurso, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{recurso}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

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
