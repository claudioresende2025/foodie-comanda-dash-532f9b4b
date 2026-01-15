import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Check, X, Loader2, Zap, Crown, Building2, ArrowLeft, Star, Shield, Clock, CreditCard, Phone 
} from 'lucide-react';
import { toast } from 'sonner';

// Configuração visual dos planos (Overrides conforme sua solicitação)
const PLAN_CONFIG: Record<string, any> = {
  'basico': {
    nome: 'Plano Iniciante (Bronze)',
    recursos: [
      { label: 'Dashboard (Básico)', included: true },
      { label: 'Cardápio', included: true },
      { label: 'Mesas (Limite 10)', included: true },
      { label: 'Pedidos (KDS) (1 Tela)', included: true },
      { label: 'Delivery (WhatsApp)', included: true },
      { label: 'Estatísticas Delivery', included: false },
      { label: 'App Garçom (1 usuário)', included: true },
      { label: 'Marketing', included: false },
      { label: 'Equipe (Até 2 colaboradores)', included: false },
    ],
  },
  'profissional': {
    nome: 'Plano Profissional (Prata)',
    recursos: [
      { label: 'Dashboard (Completo)', included: true },
      { label: 'Cardápio', included: true },
      { label: 'Mesas (Ilimitado)', included: true },
      { label: 'Pedidos (KDS) (1 Tela)', included: true },
      { label: 'Delivery (Integrado)', included: true },
      { label: 'Estatísticas Delivery', included: false },
      { label: 'App Garçom (Até 3 usuários)', included: true },
      { label: 'Marketing', included: false },
      { label: 'Equipe (Até 5 colaboradores)', included: true },
    ],
  },
  'enterprise': {
    nome: 'Plano Enterprise (Ouro)',
    recursos: [
      { label: 'Dashboard (Avançado + Comparativos)', included: true },
      { label: 'Cardápio', included: true },
      { label: 'Mesas (Ilimitado)', included: true },
      { label: 'Pedidos (KDS) (Ilimitado)', included: true },
      { label: 'Delivery (Integrado)', included: true },
      { label: 'Estatísticas Delivery', included: true },
      { label: 'App Garçom (Ilimitado)', included: true },
      { label: 'Marketing (Cupons + Fidelidade)', included: true },
      { label: 'Equipe (Ilimitado)', included: true },
    ],
  }
};

export default function Planos() {
  const navigate = useNavigate();
  const [planos, setPlanos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnual, setIsAnual] = useState(false);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  useEffect(() => {
    fetchPlanos();
    checkExistingUser();
  }, []);

  const fetchPlanos = async () => {
    try {
      const { data, error } = await supabase
        .from('planos')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });

      if (error) throw error;

      const formatted = (data || []).map(p => {
        const slug = p.slug?.toLowerCase() || '';
        let config = PLAN_CONFIG['basico'];
        if (slug.includes('profissional') || slug.includes('prata')) config = PLAN_CONFIG['profissional'];
        if (slug.includes('enterprise') || slug.includes('ouro')) config = PLAN_CONFIG['enterprise'];

        return {
          ...p,
          nome: config.nome,
          recursos: config.recursos,
          trial_days: p.trial_days || 3
        };
      });

      setPlanos(formatted);
    } catch (err) {
      toast.error('Erro ao carregar planos');
    } finally {
      setIsLoading(false);
    }
  };

  const checkExistingUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('empresa_id').eq('id', user.id).maybeSingle();
      if (profile?.empresa_id) setEmpresaId(profile.empresa_id);
    }
  };

  const handleSelectPlan = async (plano: any) => {
    setProcessingPlan(plano.id);
    try {
      // 1. Definimos para onde o cliente vai após pagar
      // Se ele NÃO tem empresaId, mandamos para o cadastro/onboarding
      const successUrl = `${window.location.origin}/onboarding?session_id={CHECKOUT_SESSION_ID}&plano_id=${plano.id}`;
      const cancelUrl = `${window.location.origin}/planos?canceled=true`;

      const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
        body: {
          planoId: plano.id,
          periodo: isAnual ? 'anual' : 'mensal',
          successUrl,
          cancelUrl,
          empresaId: empresaId || null, // Se for null, a Function não deve dar erro de "empresa não encontrada"
          trial_days: plano.trial_days
        }
      });

      if (error) throw error;
      if (data?.url) window.location.href = data.url;

    } catch (err: any) {
      console.error('Erro no checkout:', err);
      toast.error('Falha ao iniciar pagamento. Tente novamente.');
    } finally {
      setProcessingPlan(null);
    }
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="container mx-auto px-4 pt-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Escolha seu Plano</h1>
          <p className="text-muted-foreground">Comece hoje e profissionalize seu restaurante</p>
          
          <div className="flex items-center justify-center gap-4 mt-8">
            <Label>Mensal</Label>
            <Switch checked={isAnual} onCheckedChange={setIsAnual} />
            <Label>Anual <Badge className="bg-green-500 ml-2">Economize 17%</Badge></Label>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {planos.map((plano) => (
            <Card key={plano.id} className={plano.destaque ? 'border-primary shadow-lg scale-105' : ''}>
              <CardHeader className="text-center">
                <CardTitle>{plano.nome}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
                      .format(isAnual ? plano.preco_anual / 12 : plano.preco_mensal)}
                  </span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plano.recursos.map((r: any, i: number) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      {r.included ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-slate-300" />}
                      <span className={r.included ? '' : 'text-slate-400'}>{r.label}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  disabled={!!processingPlan}
                  onClick={() => handleSelectPlan(plano)}
                >
                  {processingPlan === plano.id ? <Loader2 className="animate-spin mr-2" /> : 'Selecionar'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
