import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface SubscriptionStatus {
  blocked: boolean;
  status: string;
  reason?: string;
  trial_ends_at?: string;
  days_remaining?: number;
}

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { status, isLoading, isBlocked, reason } = useSubscription();

  // Se ainda está carregando auth ou subscription, mostra loading
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Se não está logado, deixa passar (AuthContext vai redirecionar)
  if (!user) {
    return <>{children}</>;
  }

  // Se está bloqueado, redireciona para página de bloqueio
  if (isBlocked) {
    return (
      <BlockedAccessContent 
        reason={reason || 'Sua assinatura não está ativa'} 
        status={status.status}
        onRenew={() => navigate('/planos')}
      />
    );
  }

  return <>{children}</>;
}

// Componente de tela de bloqueio inline
function BlockedAccessContent({ 
  reason, 
  status, 
  onRenew 
}: { 
  reason: string; 
  status: string;
  onRenew: () => void;
}) {
  const { signOut } = useAuth();
  
  const getStatusMessage = () => {
    switch (status) {
      case 'canceled':
        return {
          title: 'Assinatura Cancelada',
          description: 'Sua assinatura foi cancelada. Para continuar utilizando o sistema, escolha um novo plano.',
          icon: '🚫'
        };
      case 'expired':
        return {
          title: 'Assinatura Expirada',
          description: 'Sua assinatura expirou. Renove seu plano para continuar tendo acesso ao sistema.',
          icon: '⏰'
        };
      case 'past_due':
        return {
          title: 'Pagamento Pendente',
          description: 'Existe um pagamento pendente na sua assinatura. Regularize para continuar usando o sistema.',
          icon: '💳'
        };
      case 'refunded':
        return {
          title: 'Reembolso Processado',
          description: 'Um reembolso foi processado para sua conta. Para continuar utilizando o sistema, escolha um novo plano.',
          icon: '💰'
        };
      case 'no_subscription':
        return {
          title: 'Sem Assinatura Ativa',
          description: 'Você ainda não possui uma assinatura ativa. Escolha um plano para começar.',
          icon: '📋'
        };
      default:
        return {
          title: 'Acesso Bloqueado',
          description: reason,
          icon: '🔒'
        };
    }
  };

  const { title, description, icon } = getStatusMessage();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-md w-full bg-card rounded-xl shadow-lg p-8 text-center space-y-6">
        <div className="text-6xl">{icon}</div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>

        <div className="space-y-3 pt-4">
          <button
            onClick={onRenew}
            className="w-full bg-primary text-primary-foreground py-3 px-6 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Ver Planos Disponíveis
          </button>
          
          <button
            onClick={() => signOut()}
            className="w-full bg-muted text-muted-foreground py-3 px-6 rounded-lg font-medium hover:bg-muted/80 transition-colors"
          >
            Sair da Conta
          </button>
        </div>

        <p className="text-xs text-muted-foreground pt-4">
          Precisa de ajuda? Entre em contato com nosso suporte.
        </p>
      </div>
    </div>
  );
}

// Hook para verificar status da assinatura
export function useSubscription() {
  const { user, profile } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>({ blocked: false, status: 'loading' });
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscriptionStatus = useCallback(async () => {
    // Se não tem usuário, não bloqueia (deixa AuthContext lidar)
    if (!user) {
      setStatus({ blocked: false, status: 'no_user' });
      setIsLoading(false);
      return;
    }

    // Verifica se é super admin (nunca bloqueia)
    try {
      const { data: superAdmin } = await supabase
        .from('super_admins')
        .select('id')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .maybeSingle();

      if (superAdmin) {
        setStatus({ blocked: false, status: 'super_admin' });
        setIsLoading(false);
        return;
      }
    } catch (e) {
      // Ignora erro - continua verificação normal
    }

    // Se não tem empresa, não bloqueia ainda (pode estar em onboarding)
    if (!profile?.empresa_id) {
      setStatus({ blocked: false, status: 'no_company' });
      setIsLoading(false);
      return;
    }

    try {
      // Busca assinatura da empresa
      const { data: assinatura, error } = await supabase
        .from('assinaturas')
        .select('status, data_fim, trial_fim, canceled_at')
        .eq('empresa_id', profile.empresa_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar assinatura:', error);
        // Em caso de erro, não bloqueia (fail-open)
        setStatus({ blocked: false, status: 'error' });
        setIsLoading(false);
        return;
      }

      // Sem assinatura = bloqueado
      if (!assinatura) {
        setStatus({ 
          blocked: true, 
          status: 'no_subscription', 
          reason: 'Você ainda não possui uma assinatura ativa.' 
        });
        setIsLoading(false);
        return;
      }

      const now = new Date();
      
      // Status cancelado = bloqueado
      if (assinatura.status === 'canceled') {
        setStatus({ 
          blocked: true, 
          status: 'canceled', 
          reason: 'Sua assinatura foi cancelada.' 
        });
        setIsLoading(false);
        return;
      }

      // Status past_due com data_fim expirada = bloqueado
      if (assinatura.status === 'past_due') {
        const dataFim = assinatura.data_fim ? new Date(assinatura.data_fim) : null;
        if (dataFim && dataFim < now) {
          setStatus({ 
            blocked: true, 
            status: 'expired', 
            reason: 'Sua assinatura expirou.' 
          });
          setIsLoading(false);
          return;
        }
      }

      // Trial expirado sem assinatura ativa = bloqueado
      if (assinatura.status === 'trial') {
        const trialFim = assinatura.trial_fim ? new Date(assinatura.trial_fim) : null;
        if (trialFim && trialFim < now) {
          setStatus({ 
            blocked: true, 
            status: 'expired', 
            reason: 'Seu período de teste expirou.' 
          });
          setIsLoading(false);
          return;
        }
        
        // Calcula dias restantes do trial
        if (trialFim) {
          const daysRemaining = Math.ceil((trialFim.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          setStatus({ 
            blocked: false, 
            status: 'trial',
            trial_ends_at: assinatura.trial_fim,
            days_remaining: daysRemaining
          });
          setIsLoading(false);
          return;
        }
      }

      // Verifica reembolsos aprovados
      const { data: reembolsos } = await supabase
        .from('reembolsos')
        .select('id, status')
        .eq('empresa_id', profile.empresa_id)
        .eq('tipo', 'assinatura')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1);

      if (reembolsos && reembolsos.length > 0) {
        // Verifica se a assinatura atual é posterior ao reembolso
        // Se não há assinatura ativa após reembolso, bloqueia
        if (assinatura.status !== 'active') {
          setStatus({ 
            blocked: true, 
            status: 'refunded', 
            reason: 'Um reembolso foi processado. Escolha um novo plano para continuar.' 
          });
          setIsLoading(false);
          return;
        }
      }

      // Assinatura ativa = liberado
      if (assinatura.status === 'active') {
        setStatus({ blocked: false, status: 'active' });
        setIsLoading(false);
        return;
      }

      // Qualquer outro status = liberado (fail-open)
      setStatus({ blocked: false, status: assinatura.status });
      setIsLoading(false);
    } catch (e) {
      console.error('Erro ao verificar assinatura:', e);
      // Em caso de erro, não bloqueia
      setStatus({ blocked: false, status: 'error' });
      setIsLoading(false);
    }
  }, [user, profile?.empresa_id]);

  useEffect(() => {
    fetchSubscriptionStatus();
  }, [fetchSubscriptionStatus]);

  return {
    status,
    isLoading,
    isBlocked: status.blocked,
    isTrialing: status.status === 'trial',
    isActive: status.status === 'active' || status.status === 'trial',
    daysRemaining: status.days_remaining || 0,
    reason: status.reason,
    refetch: fetchSubscriptionStatus,
  };
}
