import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Check, Clock, Phone, Shield, Star, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Plano = {
  id: string;
  nome: string;
  preco_mensal: number;
  preco_anual: number;
  recursos: string[] | string;
  ativo: boolean;
};

export default function Planos() {
  const navigate = useNavigate();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);

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
        const fetched = (data || []) as Plano[];
        setPlanos(fetched);
      } catch (err) {
        console.error('Erro carregando planos:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Planos</h1>
              <p className="text-muted-foreground text-sm">Escolha o plano ideal</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6">
            <Clock className="w-4 h-4" />
            <span className="font-medium">Sistema em período de teste gratuito</span>
          </div>

          <h2 className="text-4xl font-bold mb-4">Planos disponíveis</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Escolha um plano e gerencie sua assinatura facilmente
          </p>
        </div>

        {loading ? (
          <div className="text-center">Carregando planos...</div>
        ) : (
          (() => {
            const defaultPlans: Plano[] = [
              { id: 'basico', nome: 'Básico', preco_mensal: 149.9, preco_anual: 149.9 * 12 * 0.9, recursos: ['Cardápio digital', 'Comandas', 'Delivery'], ativo: true },
              { id: 'intermediario', nome: 'Intermediário', preco_mensal: 299.9, preco_anual: 299.9 * 12 * 0.9, recursos: ['Tudo do Básico', 'Relatórios', 'Suporte prioritário'], ativo: true },
              { id: 'avancado', nome: 'Avançado', preco_mensal: 549.9, preco_anual: 549.9 * 12 * 0.9, recursos: ['Tudo do Intermediário', 'Integrações', 'SLA dedicado'], ativo: true },
            ];

            const toRender = planos.length === 0 ? defaultPlans : planos;

            return (
              <div className="grid md:grid-cols-3 gap-6">
                {toRender.map((pl) => (
                  <Card key={pl.id} className="border-primary shadow-lg">
                    <CardHeader className="text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
                        <Star className="w-8 h-8 fill-current" />
                      </div>
                      <CardTitle className="text-2xl">{pl.nome}</CardTitle>
                      <CardDescription>
                        {pl.recursos ? (Array.isArray(pl.recursos) ? pl.recursos.join(', ') : String(pl.recursos)) : ''}
                      </CardDescription>
                    </CardHeader>

                    <CardContent>
                      <ul className="space-y-3">
                        <li className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-sm">Acesso completo às funcionalidades</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-sm">Suporte e atualizações</span>
                        </li>
                      </ul>
                    </CardContent>

                    <CardFooter>
                      <div className="w-full">
                        <div className="text-lg font-bold mb-2">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pl.preco_mensal || 0)}</div>
                        <Button className="w-full" onClick={() => navigate('/admin/assinatura')}>Escolher Plano</Button>
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            );
          })()
        )}
      </main>
    </div>
  );
}
