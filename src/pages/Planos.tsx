import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const PLAN_CONFIG: Record<string, any> = {
  'basico': { nome: 'Plano Iniciante (Bronze)', configKey: 'basico' },
  'profissional': { nome: 'Plano Profissional (Prata)', configKey: 'profissional' },
  'enterprise': { nome: 'Plano Enterprise (Ouro)', configKey: 'enterprise' }
};

const RECURSOS_MAP: Record<string, any[]> = {
  'basico': [
    { label: 'Dashboard (Básico)', included: true },
    { label: 'Cardápio', included: true },
    { label: 'Mesas (Limite 10)', included: true },
    { label: 'Pedidos (KDS) (1 Tela)', included: true },
    { label: 'Delivery (WhatsApp)', included: true },
    { label: 'App Garçom (1 usuário)', included: true },
    { label: 'Equipe', included: false },
  ],
  'profissional': [
    { label: 'Dashboard (Completo)', included: true },
    { label: 'Cardápio', included: true },
    { label: 'Mesas (Ilimitado)', included: true },
    { label: 'Pedidos (KDS) (1 Tela)', included: true },
    { label: 'Delivery (Integrado)', included: true },
    { label: 'App Garçom (Até 3 usuários)', included: true },
    { label: 'Equipe (Até 5 colaboradores)', included: true },
  ],
  'enterprise': [
    { label: 'Dashboard (Avançado)', included: true },
    { label: 'Cardápio', included: true },
    { label: 'Mesas (Ilimitado)', included: true },
    { label: 'Pedidos (KDS) (Ilimitado)', included: true },
    { label: 'Delivery (Integrado)', included: true },
    { label: 'App Garçom (Ilimitado)', included: true },
    { label: 'Equipe (Ilimitado)', included: true },
  ]
};

export default function Planos() {
  const [planos, setPlanos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnual, setIsAnual] = useState(false);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  useEffect(() => {
    fetchPlanos();
  }, []);

  const fetchPlanos = async () => {
    try {
      const { data, error } = await supabase
        .from('planos')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });

      if (error) throw error;

      // --- LÓGICA ANTI-DUPLICAÇÃO ---
      const uniquePlansMap = new Map();

      (data || []).forEach(p => {
        const slug = p.slug?.toLowerCase() || '';
        let key = 'basico';
        if (slug.includes('profissional') || slug.includes('prata')) key = 'profissional';
        if (slug.includes('enterprise') || slug.includes('ouro')) key = 'enterprise';

        // Se já adicionamos um plano desta categoria, ignoramos os outros (antigos)
        if (!uniquePlansMap.has(key)) {
          uniquePlansMap.set(key, {
            ...p,
            nome: PLAN_CONFIG[key].nome,
            recursos: RECURSOS_MAP[key]
          });
        }
      });

      setPlanos(Array.from(uniquePlansMap.values()));
    } catch (err) {
      toast.error('Erro ao carregar planos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlan = async (plano: any) => {
    setProcessingPlan(plano.id);
    try {
      // URL para onde o Stripe redireciona após sucesso
      const successUrl = `${window.location.origin}/subscription-success?session_id={CHECKOUT_SESSION_ID}&planoId=${plano.id}&periodo=${isAnual ? 'anual' : 'mensal'}`;
      
      const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
        body: {
          planoId: plano.id,
          periodo: isAnual ? 'anual' : 'mensal',
          successUrl: successUrl,
          cancelUrl: window.location.href,
        }
      });

      if (error) throw error;
      
      if (data?.url) {
        window.location.href = data.url; // REDIRECIONAMENTO PARA O STRIPE
      } else {
        throw new Error("Não foi possível gerar o link de pagamento");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao contactar o Stripe');
    } finally {
      setProcessingPlan(null);
    }
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="container mx-auto px-4 pt-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 italic">Escolha o seu Plano</h1>
          <div className="flex items-center justify-center gap-4 mt-8">
            <Label className={!isAnual ? "font-bold" : ""}>Mensal</Label>
            <Switch checked={isAnual} onCheckedChange={setIsAnual} />
            <Label className={isAnual ? "font-bold" : ""}>Anual <Badge className="bg-green-500 ml-1">Economize</Badge></Label>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {planos.map((plano) => (
            <Card key={plano.id} className={plano.destaque ? 'border-primary shadow-xl scale-105' : ''}>
              <CardHeader className="text-center">
                <CardTitle className="text-xl font-bold">{plano.nome}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
                      .format(isAnual ? plano.preco_anual / 12 : plano.preco_mensal)}
                  </span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {plano.recursos.map((r: any, i: number) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      {r.included ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-slate-300" />}
                      <span className={r.included ? 'text-slate-700' : 'text-slate-400'}>{r.label}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full font-bold" 
                  disabled={processingPlan === plano.id}
                  onClick={() => handleSelectPlan(plano)}
                >
                  {processingPlan === plano.id ? <Loader2 className="animate-spin mr-2" /> : 'Começar Agora'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
