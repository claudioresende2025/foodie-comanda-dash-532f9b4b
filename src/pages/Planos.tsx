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
  Check, 
  Loader2, 
  Crown, 
  Zap, 
  Building2,
  ArrowLeft,
  Star,
  Shield,
  Clock,
  CreditCard,
  Phone
} from 'lucide-react';
import { toast } from 'sonner';

interface Plano {
  id: string;
  nome: string;
  descricao: string;
  preco_mensal: number;
  preco_anual: number;
  recursos: string[];
  limite_pedidos_mes: number | null;
  limite_mesas: number | null;
  limite_usuarios: number | null;
  destaque: boolean;
  stripe_price_id_mensal: string | null;
  stripe_price_id_anual: string | null;
}

const iconMap: Record<string, any> = {
  'Básico': Zap,
  'Profissional': Crown,
  'Enterprise': Building2,
};

const defaultRecursosByPlan: Record<string, string[]> = {
  'Básico': [
    'Cardápio digital: Cardápio online responsivo com fotos, variações, preços e controle de disponibilidade por item.',
    'Comandas: Comandas eletrônicas por mesa com histórico de pedido, edições rápidas e fechamento simplificado.',
    'Delivery: Gestão de pedidos delivery com cálculo de taxa, confirmação de endereço e status de entrega.',
  ],
  'Profissional': [
    'Tudo do Básico: Todos os recursos do plano Básico já inclusos.',
    'Relatórios: Painel e exportação de relatórios (vendas, ticket médio, itens mais vendidos e períodos).',
    'Suporte prioritário: Atendimento prioritário com tempos de resposta reduzidos e assistência para configuração.',
  ],
  'Enterprise': [
    'Tudo do Profissional: Inclui todos os recursos do plano Profissional.',
    'Integrações: Conectores e integrações personalizadas (ERP, gateways de pagamento, sistemas de PDV).',
    'SLA dedicado: Gerente de conta e SLA customizado com suporte técnico prioritário e onboarding dedicado.',
  ],
};
export default function Planos() {
  const navigate = useNavigate();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnual, setIsAnual] = useState(false);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);

  useEffect(() => {
    fetchPlanos();
    fetchCurrentUser();

    // Se voltamos do checkout com sucesso, desloga o usuário para forçar re-login
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('subscription') === 'success') {
        (async () => {
          try {
            await supabase.auth.signOut();
            toast.success('Compra realizada. Faça login novamente para aplicar o novo plano.');
            navigate('/auth');
          } catch (e) {
            console.warn('Erro ao deslogar após subscribe', e);
          }
        })();
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const fetchPlanos = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('planos')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });

      console.log('Planos data:', data, 'Error:', error);

      if (error) throw error;
      
      // Parse recursos JSON
      const planosAll = (data || []).map((p: any) => ({
        ...p,
        recursos: typeof p.recursos === 'string' ? JSON.parse(p.recursos) : p.recursos || [],
      }));

      // Seleção canônica para exibir apenas 3 cartões (Básico, Profissional, Enterprise)
      const slugCandidates: Record<string, string[]> = {
        'Básico': ['basico', 'b-sico', 'bronze'],
        'Profissional': ['profissional', 'prata'],
        'Enterprise': ['enterprise', 'ouro'],
      };

      const findByCandidates = (candidates: string[]) => {
        for (const s of candidates) {
          const found = planosAll.find((p: any) => (p.slug || '').toLowerCase() === s.toLowerCase());
          if (found) return found;
        }
        // fallback: try by nome matching
        for (const s of candidates) {
          const found = planosAll.find((p: any) => (p.nome || '').toLowerCase().includes(s.toLowerCase()));
          if (found) return found;
        }
        return null;
      };

      const displayOrder = ['Básico', 'Profissional', 'Enterprise'];

      // Overrides visuais conforme tabela fornecida
      const displayOverrides: Record<string, any> = {
        'Básico': {
          nome: 'Plano Bronze (Iniciante)',
          preco_mensal: 149.90,
          preco_anual: 149.90 * 12,
          trial_days: 3,
          descricao: 'Público Ideal: Lanchonetes e MEI',
          recursos: [
            'Dashboard: Básico (Vendas do dia)',
            'Mesas: ❌ Não incluso',
            'Pedidos (KDS): ❌ Não incluso',
            'Delivery: ✅ Básico (WhatsApp)',
            'Estatísticas Delivery: ❌ Não incluso',
            'Garçom (App): ❌ Não incluso',
            'Marketing: ❌ Não incluso',
            'Equipe / Empresa: Apenas Administrador',
            'Caixa / Gestão: Fluxo de Caixa Simples',
          ],
        },
        'Profissional': {
          nome: 'Plano Prata (Crescimento)',
          preco_mensal: 299.90,
          preco_anual: 299.90 * 12,
          trial_days: 3,
          descricao: 'Público Ideal: Restaurantes com Mesas',
          recursos: [
            'Dashboard: Completo',
            'Mesas: ✅ Ilimitado',
            'Pedidos (KDS): ✅ 1 Tela',
            'Delivery: ✅ Integrado',
            'Estatísticas Delivery: ❌ Não incluso',
            'Garçom (App): ✅ Até 3 usuários',
            'Marketing: ❌ Não incluso',
            'Equipe / Empresa: Até 5 Colaboradores',
            'Caixa / Gestão: Completo + Estoque',
          ],
        },
        'Enterprise': {
          nome: 'Plano Ouro (Profissional)',
          preco_mensal: 5498.90,
          preco_anual: 5498.90 * 12,
          trial_days: 7,
          descricao: 'Público Ideal: Operações de Alto Volume',
          recursos: [
            'Dashboard: Avançado + Comparativos',
            'Mesas: ✅ Ilimitado',
            'Pedidos (KDS): ✅ Telas Ilimitadas',
            'Delivery: ✅ Integrado',
            'Estatísticas Delivery: ✅ Relatórios de Performance',
            'Garçom (App): ✅ Usuários Ilimitados',
            'Marketing: ✅ Cupons e Fidelidade',
            'Equipe / Empresa: Colaboradores Ilimitados',
            'Caixa / Gestão: Completo + Auditoria',
          ],
        },
      };

      const planosFormatted: any[] = [];
      for (const displayName of displayOrder) {
        const p = findByCandidates(slugCandidates[displayName]);
        if (p) {
          const override = displayOverrides[displayName] || {};
          planosFormatted.push({
            ...p,
            nome: override.nome || displayName,
            descricao: override.descricao || p.descricao,
            preco_mensal: override.preco_mensal ?? p.preco_mensal,
            preco_anual: override.preco_anual ?? p.preco_anual,
            trial_days: override.trial_days ?? p.trial_days,
            recursos: override.recursos || (p.recursos && p.recursos.length ? p.recursos : (defaultRecursosByPlan[p.nome] || [])),
          });
        }
      }

      // Se não encontrou nenhum plano canônico, fallback para todos
      setPlanos(planosFormatted.length ? planosFormatted : planosAll);
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

      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('id', user.id)
        .single();

      if (profile?.empresa_id) {
        setEmpresaId(profile.empresa_id);
        
        // Buscar assinatura atual
        const { data: assinatura } = await (supabase as any)
          .from('assinaturas')
          .select('*, plano:planos(*)')
          .eq('empresa_id', profile.empresa_id)
          .single();

        setCurrentSubscription(assinatura);
      }
    } catch (err) {
      console.error('Erro ao buscar usuário:', err);
    }
  };

  const handleSelectPlan = async (plano: Plano) => {
    if (!empresaId) {
      toast.error('Faça login para assinar um plano');
      navigate('/auth');
      return;
    }

    setProcessingPlan(plano.id);

    try {
      const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
        body: {
          planoId: plano.id,
          empresaId,
          periodo: isAnual ? 'anual' : 'mensal',
          successUrl: `${window.location.origin}/auth?subscription=success&planoId=${plano.id}&periodo=${isAnual ? 'anual' : 'mensal'}`,
          cancelUrl: `${window.location.origin}/planos?canceled=true`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('URL de checkout não retornada');
      }
    } catch (err: any) {
      console.error('Erro ao criar checkout:', err);
      toast.error(err.message || 'Erro ao processar assinatura');
    } finally {
      setProcessingPlan(null);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const getMonthlyEquivalent = (anualPrice: number) => {
    return anualPrice / 12;
  };

  const getSavingsPercentage = (mensal: number, anual: number) => {
    const anualEquivalent = anual / 12;
    const savings = ((mensal - anualEquivalent) / mensal) * 100;
    return Math.round(savings);
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
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
              {/* Mostrar header mais simples quando acessado pela rota pública /planos */}
              {(() => {
                const loc = useLocation();
                if (loc.pathname === '/planos') {
                  return (
                    <div className="text-center py-2">
                      <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                        Foodie Comanda Pro
                      </h1>
                      <p className="text-muted-foreground text-sm">
                        A plataforma completa para seu restaurante
                      </p>
                    </div>
                  );
                }

                return empresaId ? (
                  <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                      <h1 className="text-2xl font-bold">Gerenciar Assinatura</h1>
                      <p className="text-muted-foreground text-sm">Escolha ou altere seu plano</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                      Comanda Digital Pro
                    </h1>
                    <p className="text-muted-foreground text-sm">A plataforma completa para seu restaurante</p>
                  </div>
                );
              })()}
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Trial Banner */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6">
            <Clock className="w-4 h-4" />
            <span className="font-medium">3 dias grátis em qualquer plano</span>
          </div>
          
          <h2 className="text-4xl font-bold mb-4">
            Simplifique a gestão do seu restaurante
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Comandas digitais, delivery, controle de mesas e muito mais em uma única plataforma
          </p>
        </div>

        {/* Toggle Mensal/Anual */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <Label htmlFor="billing-toggle" className={!isAnual ? 'font-bold' : 'text-muted-foreground'}>
            Mensal
          </Label>
          <Switch
            id="billing-toggle"
            checked={isAnual}
            onCheckedChange={setIsAnual}
          />
          <Label htmlFor="billing-toggle" className={isAnual ? 'font-bold' : 'text-muted-foreground'}>
            Anual
          </Label>
          {isAnual && (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Economize até 17%
            </Badge>
          )}
        </div>

        {/* Planos Grid */}
        {planos.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum plano disponível no momento.</p>
            <Button onClick={() => fetchPlanos()} className="mt-4">
              Tentar novamente
            </Button>
          </div>
        ) : (
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {planos.map((plano) => {
            const Icon = iconMap[plano.nome] || Zap;
            const isCurrentPlan = currentSubscription?.plano_id === plano.id;
            const price = isAnual ? plano.preco_anual : plano.preco_mensal;
            const monthlyEquivalent = isAnual ? getMonthlyEquivalent(plano.preco_anual) : plano.preco_mensal;
            const savings = getSavingsPercentage(plano.preco_mensal, plano.preco_anual);

            return (
              <Card 
                key={plano.id} 
                className={`relative flex flex-col ${
                  plano.destaque 
                    ? 'border-primary shadow-lg shadow-primary/20 scale-105' 
                    : ''
                }`}
              >
                {plano.destaque && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1">
                      <Star className="w-3 h-3 mr-1 fill-current" />
                      Mais Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-2">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                    plano.destaque 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  }`}>
                    <Icon className="w-8 h-8" />
                  </div>
                  <CardTitle className="text-2xl">{plano.nome}</CardTitle>
                  <CardDescription>{plano.descricao}</CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                  <div className="text-center mb-6">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold">
                        {formatPrice(monthlyEquivalent)}
                      </span>
                      <span className="text-muted-foreground">/mês</span>
                    </div>
                    {isAnual && (
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-muted-foreground">
                          Cobrado {formatPrice(price)} anualmente
                        </p>
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          Economia de {savings}%
                        </Badge>
                      </div>
                    )}
                  </div>

                  <Separator className="my-6" />

                  <ul className="space-y-3">
                    {((plano.recursos && plano.recursos.length) ? plano.recursos : (defaultRecursosByPlan[plano.nome] || [])).map((recurso, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{recurso}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="pt-4">
                  <Button 
                    className="w-full" 
                    size="lg"
                    variant={plano.destaque ? 'default' : 'outline'}
                    onClick={() => handleSelectPlan(plano)}
                    disabled={processingPlan !== null || isCurrentPlan}
                  >
                    {processingPlan === plano.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : isCurrentPlan ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Plano Atual
                      </>
                    ) : (
                      <>
                        Começar Trial Grátis
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
        )}

        {/* Features Section */}
        <div className="mt-20 text-center">
          <h3 className="text-2xl font-bold mb-8">Por que escolher nossa plataforma?</h3>
          
          <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <div className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-semibold mb-2">Seguro</h4>
              <p className="text-sm text-muted-foreground">Seus dados protegidos com criptografia de ponta</p>
            </div>
            
            <div className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-semibold mb-2">3 Dias Grátis</h4>
              <p className="text-sm text-muted-foreground">Teste todas as funcionalidades sem compromisso</p>
            </div>
            
            <div className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-semibold mb-2">Cancele Quando Quiser</h4>
              <p className="text-sm text-muted-foreground">Sem multas ou taxas de cancelamento</p>
            </div>
            
            <div className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-semibold mb-2">Suporte Dedicado</h4>
              <p className="text-sm text-muted-foreground">Equipe pronta para ajudar você</p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h3 className="text-2xl font-bold mb-8 text-center">Perguntas Frequentes</h3>
          
          <div className="space-y-6">
            <div className="bg-card rounded-lg p-6 border">
              <h4 className="font-semibold mb-2">Como funciona o período de teste?</h4>
              <p className="text-muted-foreground text-sm">
                Você tem 3 dias para testar todas as funcionalidades do plano escolhido gratuitamente. 
                Não cobramos nada durante esse período e você pode cancelar a qualquer momento.
              </p>
            </div>
            
            <div className="bg-card rounded-lg p-6 border">
              <h4 className="font-semibold mb-2">Posso mudar de plano depois?</h4>
              <p className="text-muted-foreground text-sm">
                Sim! Você pode fazer upgrade ou downgrade do seu plano a qualquer momento. 
                O valor será calculado proporcionalmente.
              </p>
            </div>
            
            <div className="bg-card rounded-lg p-6 border">
              <h4 className="font-semibold mb-2">Como funciona o cancelamento?</h4>
              <p className="text-muted-foreground text-sm">
                Você pode cancelar sua assinatura a qualquer momento pelo painel administrativo. 
                Seu acesso continua até o fim do período pago. Para reembolsos, entre em contato com nosso suporte.
              </p>
            </div>
            
            <div className="bg-card rounded-lg p-6 border">
              <h4 className="font-semibold mb-2">Quais formas de pagamento são aceitas?</h4>
              <p className="text-muted-foreground text-sm">
                Aceitamos cartão de crédito (Visa, Mastercard, Elo, American Express) e PIX. 
                O pagamento é processado de forma segura pelo Stripe.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Final */}
        <div className="mt-20 text-center bg-primary/5 rounded-3xl p-12">
          <h3 className="text-3xl font-bold mb-4">Pronto para começar?</h3>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Junte-se a centenas de restaurantes que já simplificaram sua gestão com nossa plataforma
          </p>
          <Button size="lg" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Escolher Meu Plano
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Foodie Comanda. Todos os direitos reservados.</p>
          <p className="mt-2">
            Dúvidas? Entre em contato: suporte@foodiecomanda.com.br
          </p>
        </div>
      </footer>
    </div>
  );
}
