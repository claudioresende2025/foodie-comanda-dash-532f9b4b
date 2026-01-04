import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Clock, CreditCard, Sparkles, X } from 'lucide-react';

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
  const { profile } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showTrialBanner, setShowTrialBanner] = useState(true);
  const [showBlockedDialog, setShowBlockedDialog] = useState(false);

  useEffect(() => {
    if (profile?.empresa_id) {
      checkSubscription();
    } else {
      setIsLoading(false);
    }
  }, [profile?.empresa_id]);

  const checkSubscription = async () => {
    if (!profile?.empresa_id) return;

    try {
      // Usar a função do banco para verificar status
      const { data, error } = await supabase.rpc('check_empresa_blocked', {
        p_empresa_id: profile.empresa_id,
      });

      if (error) {
        console.error('Erro ao verificar assinatura:', error);
        // Em caso de erro, permitir acesso
        setSubscriptionStatus({ blocked: false, status: 'unknown' });
      } else {
        setSubscriptionStatus(data);
        if (data?.blocked) {
          setShowBlockedDialog(true);
        }
      }
    } catch (err) {
      console.error('Erro ao verificar assinatura:', err);
      setSubscriptionStatus({ blocked: false, status: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Verificando assinatura...</div>
      </div>
    );
  }

  const daysRemaining = subscriptionStatus?.days_remaining || 0;
  const isTrialing = subscriptionStatus?.status === 'trialing';
  const showUrgentBanner = isTrialing && daysRemaining <= 3 && daysRemaining > 0;

  return (
    <>
      {/* Banner de Trial */}
      {isTrialing && showTrialBanner && !subscriptionStatus?.blocked && (
        <div className={`
          fixed top-0 left-0 right-0 z-[100] px-4 py-2 text-white text-center text-sm
          ${showUrgentBanner 
            ? 'bg-gradient-to-r from-red-500 to-orange-500' 
            : 'bg-gradient-to-r from-purple-500 to-indigo-500'
          }
        `}>
          <div className="container mx-auto flex items-center justify-center gap-3">
            {showUrgentBanner ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>
              {daysRemaining === 1 
                ? 'Seu trial expira amanhã!' 
                : daysRemaining === 0 
                  ? 'Último dia de trial!'
                  : `${daysRemaining} dias restantes no período de teste`
              }
            </span>
            <Button 
              size="sm" 
              variant="secondary" 
              className="h-7 px-3 text-xs"
              onClick={() => navigate('/planos')}
            >
              <CreditCard className="w-3 h-3 mr-1" />
              Ver Planos
            </Button>
            <button 
              onClick={() => setShowTrialBanner(false)}
              className="ml-2 hover:opacity-70"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Dialog de Bloqueio */}
      <AlertDialog open={showBlockedDialog} onOpenChange={() => {}}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <AlertDialogTitle className="text-center text-xl">
              Acesso Bloqueado
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {subscriptionStatus?.reason || 'Sua assinatura expirou ou foi cancelada.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Para continuar usando o sistema, escolha um plano:
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Badge variant="outline">✓ Cardápio Digital</Badge>
                <Badge variant="outline">✓ Pedidos Delivery</Badge>
                <Badge variant="outline">✓ Comandas</Badge>
                <Badge variant="outline">✓ Relatórios</Badge>
              </div>
            </div>

            <Button 
              className="w-full" 
              size="lg"
              onClick={() => navigate('/planos')}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Ver Planos e Preços
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Precisa de ajuda? Entre em contato com nosso suporte.
            </p>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Conteúdo com padding se tiver banner */}
      <div className={isTrialing && showTrialBanner && !subscriptionStatus?.blocked ? 'pt-10' : ''}>
        {children}
      </div>
    </>
  );
}

// Hook para usar em qualquer lugar
export function useSubscription() {
  const { profile } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (profile?.empresa_id) {
      checkSubscription();
    }
  }, [profile?.empresa_id]);

  const checkSubscription = async () => {
    if (!profile?.empresa_id) return;

    try {
      const { data, error } = await supabase.rpc('check_empresa_blocked', {
        p_empresa_id: profile.empresa_id,
      });

      if (!error) {
        setStatus(data);
      }
    } catch (err) {
      console.error('Erro ao verificar assinatura:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    status,
    isLoading,
    isBlocked: status?.blocked || false,
    isTrialing: status?.status === 'trialing',
    isActive: status?.status === 'active',
    daysRemaining: status?.days_remaining || 0,
    refetch: checkSubscription,
  };
}
