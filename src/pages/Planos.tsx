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
  Check, X, Loader2, Crown, Zap, Building2, 
  ArrowLeft, Star, Shield, Clock, CreditCard, Phone 
} from 'lucide-react';
import { toast } from 'sonner';

interface Plano {
  id: string;
  nome: string;
  descricao: string;
  preco_mensal: number;
  preco_anual: number;
  recursos: any;
  limite_pedidos_mes: number | null;
  limite_mesas: number | null;
  limite_usuarios: number | null;
  destaque: boolean;
  stripe_price_id_mensal: string | null;
  stripe_price_id_anual: string | null;
  trial_days?: number;
  slug?: string;
}

const iconMap: Record<string, any> = {
  'Bronze': Zap,
  'Prata': Crown,
  'Ouro': Building2,
  'Básico': Zap,
  'Profissional': Crown,
  'Enterprise': Building2,
};

const defaultRecursosByPlan: Record<string, string[]> = {
  'Básico': [
    'Cardápio digital responsivo',
    'Comandas eletrônicas por mesa',
    'Gestão de pedidos delivery',
  ],
  'Profissional': [
    'Tudo do Básico',
    'Relatórios avançados',
    'Suporte prioritário',
  ],
  'Enterprise': [
    'Tudo do Profissional',
    'Integrações personalizadas',
    'SLA dedicado',
  ],
};

export default function Planos() {
  const navigate = useNavigate();
  const location = useLocation();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnual, setIsAnual] = useState(false);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    fetchPlanos();
    fetchCurrentUser();
    checkQueryParameters();
  }, []);

  const checkQueryParameters = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('subscription') === 'success') {
      toast.success('Compra realizada com sucesso!');
      navigate('/admin');
    } else if (params.get('canceled') === 'true') {
      toast.error('Assinatura cancelada.');
    }
  };

  const fetchPlanos = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('planos')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });

      if (error) throw error;
      
      const planosFormatted = (data || []).map((p: any) => ({
        ...p,
        recursos: typeof p.recursos === 'string' ? JSON.parse(p.recursos) : p.recursos || [],
      }));

      setPlanos(planosFormatted);
    } catch (err) {
      console.error('Erro ao carregar planos:', err);
      toast.error('Erro ao carregar planos');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setUserEmail(user.email || null);

      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('id', user.id)
        .single();

      if (profile?.empresa_id) {
        setEmpresaId(profile.empresa_id);
        const { data: assinatura } = await (supabase as any)
          .from('assinaturas')
          .select('*, plano:planos(*)')
          .eq('empresa_id', profile.empresa_id)
          .maybeSingle();

        setCurrentSubscription(assinatura);
      }
    } catch (err) {
      console.error('Erro ao buscar usuário:', err);
    }
  };

  const handleSelectPlan = async (plano: Plano) => {
    setProcessingPlan(plano.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        localStorage.setItem('post_login_redirect', '/planos');
        toast.info('Crie sua conta para concluir a assinatura.');
        navigate('/auth');
        return;
      }

      const body = {
        planoId: plano.id,
        priceId: isAnual ? plano.stripe_price_id_anual : plano.stripe_price_id_mensal,
        successUrl: `${window.location.origin}/planos?subscription=success`,
        cancelUrl: `${window.location.origin}/planos?canceled=true`,
        empresaId: empresaId
      };

      const { data, error } = await supabase.functions.invoke('create-subscription-checkout', { body });

      if (error) throw error;
      if (data?.url) window.location.href = data.url;

    } catch (err: any) {
      console.error('Erro ao criar checkout:', err);
      toast.error('Erro ao processar assinatura. Verifique se a Edge Function está configurada.');
    } finally {
      setProcessingPlan(null);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
  };

  const getSavingsPercentage = (mensal: number, anual: number) => {
    const anualEquivalent = anual / 12;
    return Math.round(((mensal - anualEquivalent) / mensal) * 100);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {empresaId && (
                <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <div>
                <h1 className="text-xl font-bold">Foodie Comanda Pro</h1>
              </div>
            </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="mb-12 text-center">
          <Badge variant="outline" className="mb-4 bg-primary/10 text-primary border-primary/20">
            <Clock className="w-3 h-3 mr-1" /> 3 dias grátis em qualquer plano
          </Badge>
          <h2 className="text-4xl font-extrabold mb-4 tracking-tight text-foreground">Escolha o plano ideal para seu negócio</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Gestão completa de mesas, comandas e delivery em um só lugar.
          </p>
        </div>

        <div className="flex items-center justify-center gap-4 mb-12">
          <Label htmlFor="billing-toggle" className={!isAnual ? 'font-bold' : 'text-muted-foreground'}>Mensal</Label>
          <Switch id="billing-toggle" checked={isAnual} onCheckedChange={setIsAnual} />
          <Label htmlFor="billing-toggle" className={isAnual ? 'font-bold' : 'text-muted-foreground'}>Anual</Label>
          {isAnual && <Badge className="bg-green-500">Economize até 17%</Badge>}
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {planos.map((plano) => {
            const Icon = iconMap[plano.nome] || Zap;
            const isCurrentPlan = currentSubscription?.plano_id === plano.id;
            const price = isAnual ? plano.preco_anual : plano.preco_mensal;
            const displayPrice = isAnual ? price / 12 : price;

            return (
              <Card key={plano.id} className={`relative flex flex-col ${plano.destaque ? 'border-primary shadow-xl scale-105' : ''}`}>
                {plano.destaque && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white px-3 py-1 rounded-full text-xs font-bold flex items-center">
                    <Star className="w-3 h-3 mr-1 fill-current" /> MAIS POPULAR
                  </div>
                )}
                <CardHeader className="text-center">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-6 h-6" />
                  </div>
                  <CardTitle>{plano.nome}</CardTitle>
                  <CardDescription>{plano.descricao}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="text-center mb-6">
                    <span className="text-4xl font-bold">{formatPrice(displayPrice)}</span>
                    <span className="text-muted-foreground">/mês</span>
                    {isAnual && <p className="text-xs text-muted-foreground mt-2 font-medium">Cobrado anualmente: {formatPrice(price)}</p>}
                  </div>
                  <Separator className="my-6" />
                  <ul className="space-y-3">
                    {plano.recursos.map((recurso: any, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>{typeof recurso === 'string' ? recurso : recurso.label}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full" 
                    variant={plano.destaque ? 'default' : 'outline'}
                    disabled={processingPlan !== null || isCurrentPlan}
                    onClick={() => handleSelectPlan(plano)}
                  >
                    {processingPlan === plano.id ? <Loader2 className="animate-spin" /> : isCurrentPlan ? 'Plano Atual' : 'Começar Agora'}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </main>
      
      {/* Rodapé e FAQs omitidos aqui para brevidade, mas mantidos no seu código original */}
    </div>
  );
}
