import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, Clock, ShoppingBag, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function DeliveryDashboard() {
  const { profile } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['delivery-stats', profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return null;

      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

      // Fetch all delivery orders from last 30 days
      const { data: pedidos, error } = await supabase
        .from('pedidos_delivery')
        .select('*, itens_delivery(*)')
        .eq('empresa_id', profile.empresa_id)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate stats
      const totalVendido = pedidos?.reduce((acc, p) => acc + (p.total || 0), 0) || 0;
      const totalPedidos = pedidos?.length || 0;
      const pedidosEntregues = pedidos?.filter(p => p.status === 'entregue') || [];
      
      // Calculate average delivery time (from confirmed to delivered)
      let tempoMedio = 0;
      const pedidosComTempo = pedidosEntregues.filter(p => p.updated_at && p.created_at);
      if (pedidosComTempo.length > 0) {
        const totalMinutos = pedidosComTempo.reduce((acc, p) => {
          const inicio = new Date(p.created_at);
          const fim = new Date(p.updated_at);
          return acc + (fim.getTime() - inicio.getTime()) / 60000;
        }, 0);
        tempoMedio = Math.round(totalMinutos / pedidosComTempo.length);
      }

      // Group by day for chart
      const pedidosPorDia: { [key: string]: { total: number; count: number } } = {};
      for (let i = 29; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        pedidosPorDia[date] = { total: 0, count: 0 };
      }
      
      pedidos?.forEach(p => {
        const date = format(new Date(p.created_at), 'yyyy-MM-dd');
        if (pedidosPorDia[date]) {
          pedidosPorDia[date].total += p.total || 0;
          pedidosPorDia[date].count += 1;
        }
      });

      const chartData = Object.entries(pedidosPorDia).map(([date, data]) => ({
        date: format(new Date(date), 'dd/MM', { locale: ptBR }),
        total: data.total,
        pedidos: data.count,
      }));

      // Status distribution
      const statusCount: { [key: string]: number } = {};
      pedidos?.forEach(p => {
        statusCount[p.status] = (statusCount[p.status] || 0) + 1;
      });

      const statusData = Object.entries(statusCount).map(([status, count]) => ({
        status: status === 'pendente' ? 'Pendente' :
                status === 'confirmado' ? 'Confirmado' :
                status === 'em_preparo' ? 'Em Preparo' :
                status === 'saiu_entrega' ? 'Saiu p/ Entrega' :
                status === 'entregue' ? 'Entregue' :
                status === 'cancelado' ? 'Cancelado' : status,
        count,
      }));

      return {
        totalVendido,
        totalPedidos,
        tempoMedio,
        ticketMedio: totalPedidos > 0 ? totalVendido / totalPedidos : 0,
        chartData,
        statusData,
      };
    },
    enabled: !!profile?.empresa_id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard Delivery</h1>
        <p className="text-muted-foreground">Estatísticas dos últimos 30 dias</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vendido</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              R$ {(stats?.totalVendido || 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalPedidos || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.tempoMedio || 0} min</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {(stats?.ticketMedio || 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vendas por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats?.chartData || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    tickFormatter={(value) => `R$${value}`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Total']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pedidos por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.chartData || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip 
                    formatter={(value: number) => [value, 'Pedidos']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar 
                    dataKey="pedidos" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição por Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.statusData || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" />
                <YAxis 
                  dataKey="status" 
                  type="category" 
                  width={100}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  formatter={(value: number) => [value, 'Pedidos']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="count" 
                  fill="hsl(var(--secondary))" 
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
