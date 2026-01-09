import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Check, Clock, Shield, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Plano = {
  id: string;
  nome: string;
  preco_mensal: number;
  preco_anual: number;
  recursos: string[] | string;
  descricao?: string;
  ativo: boolean;
};

export default function Planos() {
  const navigate = useNavigate();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'mensal' | 'anual'>('mensal');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from('planos')
          .select('*')
          .eq('ativo', true)
          .order('ordem', { ascending: true });

        if (!mounted) return;
        setPlanos((data || []) as Plano[]);
      } catch (err) {
        console.error('Erro carregando planos:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  const defaultPlans: Plano[] = [
    {
      id: 'essencial',
      nome: 'Essencial',
      descricao: 'Tudo que você precisa para começar: cardápio digital, comandas e delivery.',
      preco_mensal: 149.9,
      preco_anual: Math.round(149.9 * 12 * 0.9),
      recursos: ['Cardápio digital', 'Comandas', 'Delivery'],
      ativo: true,
    },
    {
      id: 'profissional',
      nome: 'Profissional',
      descricao: 'Relatórios avançados e suporte prioritário para aumentar suas vendas.',
      preco_mensal: 299.9,
      preco_anual: Math.round(299.9 * 12 * 0.9),
      recursos: ['Tudo do Essencial', 'Relatórios', 'Suporte prioritário'],
      ativo: true,
    },
    {
      id: 'premium',
      nome: 'Premium Corporativo',
      descricao: 'Integrações e SLA dedicado para operações maiores e multi-unidade.',
      preco_mensal: 549.9,
      preco_anual: Math.round(549.9 * 12 * 0.9),
      recursos: ['Tudo do Profissional', 'Integrações', 'SLA dedicado'],
      ativo: true,
    },
  ];

  const toRender = planos.length === 0 ? defaultPlans : planos;

  const formatPrice = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-muted/10">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Escolha seu Plano</h1>
              <p className="text-muted-foreground text-sm">Comece grátis por 7 dias, cancele quando quiser</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full mb-6">
            <Clock className="w-4 h-4" />
            <span className="font-medium">7 dias grátis em qualquer plano</span>
          </div>

          <h2 className="text-4xl font-extrabold mb-4">Simplifique a gestão do seu restaurante</h2>
          <p className="text-lg text-muted-foreground mb-8">Comandas digitais, delivery, controle de mesas e muito mais em uma única plataforma</p>

          <div className="inline-flex items-center bg-muted/40 rounded-full p-1 border">
            <button
              className={`px-4 py-2 rounded-full ${period === 'mensal' ? 'bg-white shadow' : 'opacity-70'}`}
              onClick={() => setPeriod('mensal')}
            >Mensal</button>
            <div className="w-8" />
            <button
              className={`px-4 py-2 rounded-full ${period === 'anual' ? 'bg-white shadow' : 'opacity-70'}`}
              onClick={() => setPeriod('anual')}
            >Anual</button>
          </div>
        </div>

        <section className="mt-12 grid gap-6 md:grid-cols-3">
          {toRender.map((pl, idx) => {
            const isFeatured = idx === 1; // destaque no meio
            const price = period === 'mensal' ? pl.preco_mensal : pl.preco_anual;

            return (
              <Card key={pl.id} className={`${isFeatured ? 'transform scale-105 shadow-2xl border-primary' : 'shadow'} p-6`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center ${isFeatured ? 'bg-primary text-white' : 'bg-primary/5 text-primary'}`}>
                      <Star className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{pl.nome}</h3>
                      {isFeatured && <span className="text-sm text-muted-foreground">Mais popular</span>}
                      {pl.descricao && <p className="text-sm text-muted-foreground mt-1">{pl.descricao}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-extrabold">{formatPrice(price)}</div>
                    <div className="text-sm text-muted-foreground">por {period === 'mensal' ? 'mês' : 'ano'}</div>
                  </div>
                </div>

                <CardContent className="py-2">
                  <ul className="space-y-3 mb-4">
                    {(Array.isArray(pl.recursos) ? pl.recursos : String(pl.recursos).split(',')).map((r, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check className="w-4 h-4 text-emerald-600 mt-1 flex-shrink-0" />
                        <span className="text-sm text-foreground">{r}</span>
                      </li>
                    ))}
                  </ul>

                  <p className="text-xs text-muted-foreground">Testemunhos e resultados reais ajudam a decidir. Suporte dedicado incluso.</p>
                </CardContent>

                <CardFooter className="pt-4">
                  <Button className={`w-full ${isFeatured ? 'bg-primary text-white' : ''}`} onClick={() => navigate('/admin/assinatura')}>
                    Começar Grátis
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </section>

        <section className="mt-16 text-center">
          <h4 className="text-xl font-bold mb-4">Por que escolher nossa plataforma?</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <div className="p-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-50 flex items-center justify-center">
                <Shield className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="font-medium">Seguro</p>
              <p className="text-sm text-muted-foreground">Seus dados protegidos com criptografia de ponta</p>
            </div>

            <div className="p-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-50 flex items-center justify-center">
                <Clock className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="font-medium">7 Dias Grátis</p>
              <p className="text-sm text-muted-foreground">Teste todas as funcionalidades sem compromisso</p>
            </div>

            <div className="p-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-50 flex items-center justify-center">
                <Star className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="font-medium">Cancele quando quiser</p>
              <p className="text-sm text-muted-foreground">Sem multas ou taxas de cancelamento</p>
            </div>

            <div className="p-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-50 flex items-center justify-center">
                <Shield className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="font-medium">Suporte Dedicado</p>
              <p className="text-sm text-muted-foreground">Equipe pronta para ajudar você</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
