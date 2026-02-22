import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, ShoppingBag, DollarSign, UtensilsCrossed, Users } from 'lucide-react';
import { startOfMonth, subMonths, endOfMonth } from 'date-fns';

export default function ValueMetrics() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data } = useQuery({
    queryKey: ['value-metrics', empresaId],
    queryFn: async () => {
      if (!empresaId) return null;

      const now = new Date();
      const thisMonthStart = startOfMonth(now).toISOString();
      const lastMonthStart = startOfMonth(subMonths(now, 1)).toISOString();
      const lastMonthEnd = endOfMonth(subMonths(now, 1)).toISOString();

      const [thisComandas, lastComandas, thisMesas, thisPedidos] = await Promise.all([
        supabase.from('comandas').select('total, status').eq('empresa_id', empresaId).gte('created_at', thisMonthStart),
        supabase.from('comandas').select('total, status').eq('empresa_id', empresaId).gte('created_at', lastMonthStart).lte('created_at', lastMonthEnd),
        supabase.from('mesas').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId),
        supabase.from('comandas').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).gte('created_at', thisMonthStart),
      ]);

      const thisFaturamento = (thisComandas.data || []).filter(c => c.status === 'fechada').reduce((s, c) => s + (c.total || 0), 0);
      const lastFaturamento = (lastComandas.data || []).filter(c => c.status === 'fechada').reduce((s, c) => s + (c.total || 0), 0);
      const thisPedidosCount = thisPedidos.count || 0;
      const lastPedidosCount = (lastComandas.data || []).length;

      return {
        pedidos: thisPedidosCount,
        pedidosTrend: lastPedidosCount > 0 ? ((thisPedidosCount - lastPedidosCount) / lastPedidosCount) * 100 : 0,
        faturamento: thisFaturamento,
        faturamentoTrend: lastFaturamento > 0 ? ((thisFaturamento - lastFaturamento) / lastFaturamento) * 100 : 0,
        mesas: thisMesas.count || 0,
      };
    },
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
  });

  if (!data) return null;

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const metrics = [
    {
      title: 'Pedidos este mês',
      value: data.pedidos.toString(),
      trend: data.pedidosTrend,
      icon: ShoppingBag,
    },
    {
      title: 'Faturamento',
      value: formatCurrency(data.faturamento),
      trend: data.faturamentoTrend,
      icon: DollarSign,
    },
    {
      title: 'Mesas cadastradas',
      value: data.mesas.toString(),
      trend: null,
      icon: UtensilsCrossed,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {metrics.map((m) => (
        <Card key={m.title} className="shadow-fcd border-0">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{m.title}</span>
              <m.icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{m.value}</div>
            {m.trend !== null && m.trend !== 0 && (
              <div className={`flex items-center gap-1 mt-1 text-xs ${m.trend > 0 ? 'text-primary' : 'text-destructive'}`}>
                {m.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(Math.round(m.trend))}% vs mês anterior
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
