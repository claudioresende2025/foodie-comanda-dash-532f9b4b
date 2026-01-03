import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  UtensilsCrossed, 
  ShoppingBag, 
  DollarSign, 
  Users,
  TrendingUp,
  Clock,
  Loader2,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import WaiterNotifications from '@/components/admin/WaiterNotifications';
import { exportSalesReport, exportSalesReportPDF } from '@/utils/exportReports';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

type DailySales = {
  date: string;
  total: number;
  pedidos: number;
};

export default function Dashboard() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  // Fetch empresa data
  const { data: empresa } = useQuery({
    queryKey: ['empresa', empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      const { data } = await supabase
        .from('empresas')
        .select('nome_fantasia')
        .eq('id', empresaId)
        .single();
      return data;
    },
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch mesas
  const { data: mesas = [] } = useQuery({
    queryKey: ['mesas', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data } = await supabase
        .from('mesas')
        .select('id, numero_mesa, status, mesa_juncao_id')
        .eq('empresa_id', empresaId)
        .order('numero_mesa');
      return data || [];
    },
    enabled: !!empresaId,
    staleTime: 30 * 1000,
  });

  // Fetch today's comandas and calculate stats
  const { data: comandasHoje = [], isLoading: isLoadingComandas } = useQuery({
    queryKey: ['comandas-hoje', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const today = new Date();
      const { data } = await supabase
        .from('comandas')
        .select('id, total, status, created_at')
        .eq('empresa_id', empresaId)
        .gte('created_at', startOfDay(today).toISOString())
        .lte('created_at', endOfDay(today).toISOString());
      return data || [];
    },
    enabled: !!empresaId,
    staleTime: 30 * 1000,
    refetchInterval: 30000,
  });

  // Fetch today's pedidos count - fix: filter by empresa through comandas
  const { data: pedidosHoje = 0 } = useQuery({
    queryKey: ['pedidos-count-hoje', empresaId],
    queryFn: async () => {
      if (!empresaId) return 0;
      const today = new Date();
      
      // First get comandas IDs for this empresa
      const { data: comandas } = await supabase
        .from('comandas')
        .select('id')
        .eq('empresa_id', empresaId);
      
      if (!comandas || comandas.length === 0) return 0;
      
      const comandaIds = comandas.map(c => c.id);
      
      const { count } = await supabase
        .from('pedidos')
        .select('id', { count: 'exact', head: true })
        .in('comanda_id', comandaIds)
        .gte('created_at', startOfDay(today).toISOString())
        .lte('created_at', endOfDay(today).toISOString());
      
      return count || 0;
    },
    enabled: !!empresaId,
    staleTime: 30 * 1000,
    refetchInterval: 30000,
  });

  // Fetch recent orders - fix: filter by empresa
  const { data: recentOrders = [] } = useQuery({
    queryKey: ['recent-orders', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      
      // Get comandas for this empresa
      const { data: comandas } = await supabase
        .from('comandas')
        .select('id')
        .eq('empresa_id', empresaId);
      
      if (!comandas || comandas.length === 0) return [];
      
      const comandaIds = comandas.map(c => c.id);
      
      const { data } = await supabase
        .from('pedidos')
        .select(`
          id,
          quantidade,
          subtotal,
          status_cozinha,
          created_at,
          produto:produtos(nome),
          comanda:comandas(mesa:mesas(numero_mesa))
        `)
        .in('comanda_id', comandaIds)
        .order('created_at', { ascending: false })
        .limit(5);
      
      return data || [];
    },
    enabled: !!empresaId,
    staleTime: 30 * 1000,
    refetchInterval: 30000,
  });

  // Fetch last 7 days sales
  const { data: dailySales = [] } = useQuery({
    queryKey: ['daily-sales', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const today = new Date();
      const weekStart = startOfDay(subDays(today, 6)).toISOString();
      const weekEnd = endOfDay(today).toISOString();

      const [comandasRes, pedidosRes] = await Promise.all([
        supabase
          .from('comandas')
          .select('total, created_at')
          .eq('empresa_id', empresaId)
          .eq('status', 'fechada')
          .gte('created_at', weekStart)
          .lte('created_at', weekEnd),
        supabase
          .from('pedidos')
          .select('created_at, comanda:comandas!inner(empresa_id)')
          .eq('comanda.empresa_id', empresaId)
          .gte('created_at', weekStart)
          .lte('created_at', weekEnd),
      ]);

      const weekComandas = comandasRes.data || [];
      const weekPedidos = pedidosRes.data || [];

      const salesData: DailySales[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = subDays(today, i);
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);

        const dayTotal = weekComandas
          .filter(c => {
            const createdAt = new Date(c.created_at);
            return createdAt >= dayStart && createdAt <= dayEnd;
          })
          .reduce((sum, c) => sum + (c.total || 0), 0);

        const dayPedidosCount = weekPedidos
          .filter(p => {
            const createdAt = new Date(p.created_at);
            return createdAt >= dayStart && createdAt <= dayEnd;
          }).length;

        salesData.push({
          date: format(date, 'EEE', { locale: ptBR }),
          total: dayTotal,
          pedidos: dayPedidosCount,
        });
      }
      return salesData;
    },
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
  });

  // Calculate derived stats
  const stats = useMemo(() => {
    const mesasOcupadas = mesas.filter(m => m.status === 'ocupada').length;
    const totalMesas = mesas.filter(m => m.status !== 'juncao').length;
    const faturamentoHoje = comandasHoje
      .filter(c => c.status === 'fechada')
      .reduce((sum, c) => sum + (c.total || 0), 0);
    const comandasAbertas = comandasHoje.filter(c => c.status === 'aberta').length;

    return {
      mesasOcupadas,
      totalMesas,
      pedidosHoje,
      faturamentoHoje,
      comandasAbertas,
    };
  }, [mesas, comandasHoje, pedidosHoje]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleExportCSV = () => {
    if (dailySales.length === 0) {
      toast.error('Não há dados para exportar');
      return;
    }
    exportSalesReport(dailySales, (empresa?.nome_fantasia || 'Empresa').replace(/\s+/g, '_'));
    toast.success('Relatório CSV exportado!');
  };

  const handleExportPDF = () => {
    if (dailySales.length === 0) {
      toast.error('Não há dados para exportar');
      return;
    }
    exportSalesReportPDF(dailySales, empresa?.nome_fantasia || 'Empresa');
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    pendente: { label: 'Pendente', color: 'bg-yellow-500/10 text-yellow-600' },
    preparando: { label: 'Preparando', color: 'bg-blue-500/10 text-blue-600' },
    pronto: { label: 'Pronto', color: 'bg-green-500/10 text-green-600' },
    entregue: { label: 'Entregue', color: 'bg-gray-500/10 text-gray-600' },
    cancelado: { label: 'Cancelado', color: 'bg-red-500/10 text-red-600' },
  };

  const getMesaDisplayName = (mesa: any): string => {
    const mergedMesas = mesas.filter(m => m.mesa_juncao_id === mesa.id);
    if (mergedMesas.length > 0) {
      const numbers = [mesa.numero_mesa, ...mergedMesas.map(m => m.numero_mesa)].sort((a, b) => a - b);
      return numbers.join('+');
    }
    return mesa.numero_mesa.toString();
  };

  if (isLoadingComandas) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const statsCards = [
    {
      title: 'Mesas Ocupadas',
      value: `${stats.mesasOcupadas}/${stats.totalMesas}`,
      description: `${stats.totalMesas > 0 ? Math.round((stats.mesasOcupadas / stats.totalMesas) * 100) : 0}% de ocupação`,
      icon: UtensilsCrossed,
      color: 'text-status-occupied',
      bgColor: 'bg-fcd-orange-light',
    },
    {
      title: 'Pedidos Hoje',
      value: stats.pedidosHoje.toString(),
      description: 'Total de pedidos',
      icon: ShoppingBag,
      color: 'text-primary',
      bgColor: 'bg-secondary',
    },
    {
      title: 'Faturamento',
      value: formatCurrency(stats.faturamentoHoje),
      description: 'Hoje (fechadas)',
      icon: DollarSign,
      color: 'text-primary',
      bgColor: 'bg-secondary',
    },
    {
      title: 'Comandas Abertas',
      value: stats.comandasAbertas.toString(),
      description: 'Em atendimento',
      icon: Users,
      color: 'text-accent',
      bgColor: 'bg-fcd-orange-light',
    },
  ];

  const visibleMesas = mesas.filter(m => m.status !== 'juncao');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do seu restaurante</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Excel/CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => (
          <Card key={stat.title} className="shadow-fcd border-0">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3 text-primary" />
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-fcd border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Faturamento - Últimos 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySales}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis 
                    tickFormatter={(value) => `R$${value}`}
                    className="text-xs"
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                    labelClassName="font-medium"
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-fcd border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-accent" />
              Pedidos - Últimos 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailySales}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    formatter={(value: number) => [value, 'Pedidos']}
                    labelClassName="font-medium"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="pedidos" 
                    stroke="hsl(var(--accent))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--accent))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders and Waiter Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-fcd border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-accent" />
              Pedidos Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentOrders.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Nenhum pedido recente</p>
              ) : (
                recentOrders.map((order) => (
                  <div 
                    key={order.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">
                        Mesa {order.comanda?.mesa?.numero_mesa || '-'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {order.produto?.nome} • {formatCurrency(order.subtotal)}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusConfig[order.status_cozinha]?.color || ''}`}>
                      {statusConfig[order.status_cozinha]?.label || order.status_cozinha}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <WaiterNotifications />
      </div>

      {/* Mesa Status */}
      <Card className="shadow-fcd border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-primary" />
            Status das Mesas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {visibleMesas.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Nenhuma mesa cadastrada</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
              {visibleMesas.map((mesa) => {
                const hasMerged = mesas.some(m => m.mesa_juncao_id === mesa.id);
                const statusColors = {
                  disponivel: 'bg-status-available/20 text-status-available border-status-available/30',
                  ocupada: 'bg-status-occupied/20 text-status-occupied border-status-occupied/30',
                  reservada: 'bg-status-reserved/20 text-status-reserved border-status-reserved/30',
                  juncao: 'bg-status-merged/20 text-status-merged border-status-merged/30',
                };
                return (
                  <div
                    key={mesa.id}
                    className={`p-2 rounded-lg border text-center font-medium ${statusColors[mesa.status]}`}
                    title={`Mesa ${getMesaDisplayName(mesa)} - ${mesa.status}`}
                  >
                    {hasMerged ? getMesaDisplayName(mesa) : mesa.numero_mesa}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
