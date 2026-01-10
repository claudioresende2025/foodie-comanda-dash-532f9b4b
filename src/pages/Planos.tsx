import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Check, 
  X,
  Loader2, 
  Crown, 
  Zap, 
  Building2,
  ArrowLeft,
  Star,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

interface Plano {
  id: string;
  nome: string;
  slug: string;
      
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
              'Dashboard (Básico)',
              'Mesas (Limitado — até 10)',
              'Pedidos (KDS) — 1 tela',
              'Delivery (WhatsApp)',
              'Estatísticas Delivery: Não incluso',
              'App Garçom: 1 usuário',
              'Marketing: Não incluso',
              'Equipe: Até 2 colaboradores',
              'Caixa / Gestão: Fluxo de Caixa e Estoque',
            ],
        },
        'Profissional': {
            nome: 'Plano Prata (Crescimento)',
            preco_mensal: 299.90,
            preco_anual: 299.90 * 12,
            trial_days: 3,
            descricao: 'Público Ideal: Restaurantes com Mesas',
            recursos: [
              'Todos os recursos do Bronze',
              'Mesas: Ilimitado',
              'Pedidos (KDS): 1 tela (padrão)',
              'Delivery: Integrado',
              'Estatísticas Delivery: Não incluso',
              'App Garçom: Até 3 usuários',
              'Marketing: Não incluso',
              'Equipe: Até 5 colaboradores',
              'Caixa / Gestão: Completo + Estoque',
            ],
        },
        'Enterprise': {
            nome: 'Plano Ouro (Profissional)',
            preco_mensal: 549.90,
            preco_anual: 549.90 * 12,
            trial_days: 7,
            descricao: 'Público Ideal: Operações de Alto Volume',
            recursos: [
              'ACESSO TOTAL: Todos os recursos desbloqueados',
              'Mesas: Ilimitado',
              'Pedidos (KDS): Telas Ilimitadas',
              'Delivery: Integrado',
              'Estatísticas Delivery: Relatórios de Performance',
              'App Garçom: Usuários Ilimitados',
              'Marketing: Cupons e Fidelidade',
              'Equipe: Colaboradores Ilimitados',
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
            recursos: override.recursos || (p.recursos && p.recursos.length ? p.recursos : []),
          });
        }
      }

      // Se não encontrou nenhum plano canônico, fallback para todos
      setPlanos(planosFormatted.length ? planosFormatted : planosAll);
            recursos: [
              'Dashboard (Básico)',
              'Mesas (Limitado — até 10)',
              'Pedidos (KDS) — 1 tela',
              'Delivery (WhatsApp)',
              'Estatísticas Delivery: Não incluso',
              'App Garçom: 1 usuário',
              'Marketing: Não incluso',
              'Equipe: Até 2 colaboradores',
              'Caixa / Gestão: Fluxo de Caixa e Estoque',
            ],
        },
        'Profissional': {
            nome: 'Plano Prata (Crescimento)',
            preco_mensal: 299.90,
            preco_anual: 299.90 * 12,
            trial_days: 3,
            descricao: 'Público Ideal: Restaurantes com Mesas',
            recursos: [
              'Todos os recursos do Bronze',
              'Mesas: Ilimitado',
              'Pedidos (KDS): 1 tela (padrão)',
              'Delivery: Integrado',
              'Estatísticas Delivery: Não incluso',
              'App Garçom: Até 3 usuários',
              'Marketing: Não incluso',
              'Equipe: Até 5 colaboradores',
              'Caixa / Gestão: Completo + Estoque',
            ],
        },
        'Enterprise': {
            nome: 'Plano Ouro (Profissional)',
            preco_mensal: 549.90,
            preco_anual: 549.90 * 12,
            trial_days: 7,
            descricao: 'Público Ideal: Operações de Alto Volume',
            recursos: [
              'ACESSO TOTAL: Todos os recursos desbloqueados',
              'Mesas: Ilimitado',
              'Pedidos (KDS): Telas Ilimitadas',
              'Delivery: Integrado',
              'Estatísticas Delivery: Relatórios de Performance',
              'App Garçom: Usuários Ilimitados',
              'Marketing: Cupons e Fidelidade',
              'Equipe: Colaboradores Ilimitados',
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
>>>>>>> 15c1ec2 (style(planos): ajustar nomes, preços e descrições dos planos (Bronze, Prata, Ouro) para combinar com o design)
    } catch (err) {
      console.error('Erro ao carregar planos:', err);
      toast.error('Erro ao carregar planos');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);
      
      if (!authUser) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('id', authUser.id)
        .single();

      if (profile?.empresa_id) {
        setEmpresaId(profile.empresa_id);
        
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
    // Se não está logado, redireciona para checkout público
    if (!user) {
      setProcessingPlan(plano.id);
      try {
        // Criar checkout sem autenticação
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-subscription-checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            planoId: plano.id,
            periodo: isAnual ? 'anual' : 'mensal',
            successUrl: `${window.location.origin}/auth?subscription=success&planoId=${plano.id}`,
            cancelUrl: `${window.location.origin}/planos?canceled=true`,
          }),
        });

        const data = await response.json();
        
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error(data.error || 'Erro ao criar checkout');
        }
      } catch (err: any) {
        console.error('Erro ao criar checkout:', err);
        toast.error(err.message || 'Erro ao processar assinatura');
      } finally {
        setProcessingPlan(null);
      }
      return;
    }

    // Usuário logado
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
          successUrl: `${window.location.origin}/admin?subscription=success`,
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

  const getPlanoIcon = (slug: string) => {
    return iconMap[slug.toLowerCase()] || Zap;
  };

  const isCurrentPlan = (planoId: string) => {
    return currentSubscription?.plano_id === planoId;
  };

  const canUpgrade = (plano: Plano) => {
    if (!currentSubscription) return true;
    const currentOrder = planos.findIndex(p => p.id === currentSubscription.plano_id);
    const targetOrder = planos.findIndex(p => p.id === plano.id);
    return targetOrder > currentOrder;
  };

  const canDowngrade = (plano: Plano) => {
    if (!currentSubscription) return false;
    const currentOrder = planos.findIndex(p => p.id === currentSubscription.plano_id);
    const targetOrder = planos.findIndex(p => p.id === plano.id);
    return targetOrder < currentOrder;
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
          {empresaId ? (
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">
                  {mode === 'upgrade' ? 'Fazer Upgrade' : mode === 'downgrade' ? 'Fazer Downgrade' : 'Gerenciar Assinatura'}
                </h1>
                <p className="text-muted-foreground text-sm">Escolha ou altere seu plano</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-2">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                FoodComanda Pro
              </h1>
              <p className="text-muted-foreground text-sm">A plataforma completa para seu restaurante</p>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Trial Banner */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6">
            <Clock className="w-4 h-4" />
            <span className="font-medium">Teste grátis de 3 a 7 dias</span>
          </div>
          
          <h2 className="text-4xl font-bold mb-4">
            Escolha o plano ideal para seu negócio
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Comandas digitais, delivery, controle de mesas e muito mais
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
              const Icon = getPlanoIcon(plano.slug);
              const isCurrent = isCurrentPlan(plano.id);
              const price = isAnual ? plano.preco_anual : plano.preco_mensal;
              const monthlyEquivalent = isAnual ? getMonthlyEquivalent(plano.preco_anual) : plano.preco_mensal;
              const savings = getSavingsPercentage(plano.preco_mensal, plano.preco_anual);
              const slug = plano.slug.toLowerCase();

              // Filtrar por modo
              if (mode === 'upgrade' && !canUpgrade(plano)) return null;
              if (mode === 'downgrade' && !canDowngrade(plano)) return null;

              return (
                <Card 
                  key={plano.id} 
                  className={`relative flex flex-col ${
                    plano.destaque 
                      ? 'border-primary shadow-lg shadow-primary/20 scale-105' 
                      : ''
                  } ${isCurrent ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                >
                  {plano.destaque && !isCurrent && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground px-4 py-1">
                        <Star className="w-3 h-3 mr-1 fill-current" />
                        Mais Popular
                      </Badge>
                    </div>
                  )}

                  {isCurrent && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <Badge variant="outline" className="border-primary text-primary px-4 py-1 bg-background">
                        Seu Plano Atual
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="text-center pb-2">
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                      plano.destaque || isCurrent
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
                      <p className="text-xs text-muted-foreground mt-2">
                        Trial de {plano.trial_days} dias grátis
                      </p>
                    </div>

                    <Separator className="my-6" />

                    <ul className="space-y-3">
                      {recursosDisplay.features.map((recurso, index) => {
                        const value = recurso[slug as keyof typeof recurso] || '❌';
                        const isIncluded = value !== '❌';
                        
                        return (
                          <li key={index} className="flex items-start gap-3">
                            {isIncluded ? (
                              <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                            ) : (
                              <X className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            )}
                            <div>
                              <span className={isIncluded ? '' : 'text-muted-foreground'}>
                                {recurso.nome}
                              </span>
                              {isIncluded && value !== '✅' && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({value})
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>

                  <CardFooter>
                    <Button 
                      className="w-full" 
                      size="lg"
                      variant={isCurrent ? 'outline' : plano.destaque ? 'default' : 'outline'}
                      onClick={() => handleSelectPlan(plano)}
                      disabled={isCurrent || processingPlan === plano.id}
                    >
                      {processingPlan === plano.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processando...
                        </>
                      ) : isCurrent ? (
                        'Plano Atual'
                      ) : mode === 'downgrade' ? (
                        'Fazer Downgrade'
                      ) : (
                        'Contratar'
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        {/* FAQ ou CTA */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground">
            Dúvidas? Entre em contato pelo WhatsApp ou email.
          </p>
        </div>
      </main>
    </div>
  );
}
