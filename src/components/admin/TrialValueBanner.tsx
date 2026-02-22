import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TrendingUp, Clock, Zap, ShoppingBag, DollarSign } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function TrialValueBanner() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const empresaId = profile?.empresa_id;

  // Fetch subscription
  const { data: assinatura } = useQuery({
    queryKey: ['assinatura-trial', empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      const { data } = await (supabase as any)
        .from('assinaturas')
        .select('status, trial_end, data_inicio')
        .eq('empresa_id', empresaId)
        .single();
      return data;
    },
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch metrics
  const { data: metrics } = useQuery({
    queryKey: ['trial-metrics', empresaId],
    queryFn: async () => {
      if (!empresaId) return { pedidos: 0, faturamento: 0 };
      const [pedidosRes, comandasRes] = await Promise.all([
        supabase.from('comandas').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId),
        supabase.from('comandas').select('total').eq('empresa_id', empresaId).eq('status', 'fechada'),
      ]);
      const faturamento = (comandasRes.data || []).reduce((sum, c) => sum + (c.total || 0), 0);
      return { pedidos: pedidosRes.count || 0, faturamento };
    },
    enabled: !!empresaId,
    staleTime: 60 * 1000,
  });

  const isTrial = assinatura?.status === 'trialing' || assinatura?.status === 'trial';
  if (!isTrial || !assinatura) return null;

  const trialEnd = assinatura.trial_end ? new Date(assinatura.trial_end) : null;
  const now = new Date();
  const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : null;
  const isUrgent = daysLeft !== null && daysLeft <= 3;

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <Card className={`shadow-fcd border-0 ${isUrgent ? 'bg-accent/10 border-accent/30' : 'bg-primary/5 border-primary/20'}`}>
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            {isUrgent ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-accent" />
                  <h3 className="font-bold text-lg text-accent">
                    {daysLeft === 0 ? 'Seu trial expira hoje!' : `Seu trial expira em ${daysLeft} dia${daysLeft > 1 ? 's' : ''}!`}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Não perca seus dados e configurações. Assine agora e continue operando sem interrupção.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-lg">Você está no período de teste gratuito</h3>
                </div>
                <div className="flex flex-wrap gap-4 mt-2">
                  <div className="flex items-center gap-1.5 text-sm">
                    <ShoppingBag className="w-4 h-4 text-primary" />
                    <span className="font-medium">{metrics?.pedidos || 0}</span>
                    <span className="text-muted-foreground">pedidos gerenciados</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <DollarSign className="w-4 h-4 text-primary" />
                    <span className="font-medium">{formatCurrency(metrics?.faturamento || 0)}</span>
                    <span className="text-muted-foreground">em vendas</span>
                  </div>
                  {daysLeft !== null && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{daysLeft} dias restantes</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <Button 
            onClick={() => navigate('/planos')}
            className={isUrgent ? 'bg-accent hover:bg-accent/90' : ''}
          >
            <Zap className="w-4 h-4 mr-2" />
            {isUrgent ? 'Assinar Agora' : 'Ver Planos'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
