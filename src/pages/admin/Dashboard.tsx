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
  FileSpreadsheet,
  RefreshCw,
  Receipt
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { db, sincronizarTudo } from '@/lib/db';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import WaiterNotifications from '@/components/admin/WaiterNotifications';
import OnboardingChecklist from '@/components/admin/OnboardingChecklist';
import TrialValueBanner from '@/components/admin/TrialValueBanner';
import ValueMetrics from '@/components/admin/ValueMetrics';
import { exportSalesReport, exportSalesReportPDF, exportToCSV } from '@/utils/exportReports';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

type DailySales = {
  date: string;
  total: number;
  pedidos: number;
};

export default function Dashboard() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  // Hidratação inicial: Carregar dados do IndexedDB para o cache IMEDIATAMENTE
  useEffect(() => {
    if (!empresaId) return;
    
    const hidratarCache = async () => {
      try {
        // Hidratar mesas
        const mesasLocais = await db.mesas.where('empresa_id').equals(empresaId).toArray();
        if (mesasLocais.length > 0) {
          const dadosFormatados = mesasLocais.map((m: any) => ({
            id: m.id,
            numero_mesa: m.numero_mesa ?? m.numero,
            status: m.status || 'disponivel',
            mesa_juncao_id: m.mesa_juncao_id || null,
          })).sort((a, b) => a.numero_mesa - b.numero_mesa);
          
          const cacheAtual = queryClient.getQueryData<any[]>(['mesas', empresaId]);
          if (!cacheAtual || cacheAtual.length === 0) {
            queryClient.setQueryData(['mesas', empresaId], dadosFormatados);
            console.log('[Dashboard Hidratação] Mesas carregadas:', dadosFormatados.length);
          }
        }
      } catch (err) {
        console.warn('[Dashboard Hidratação] Erro:', err);
      }
    };
    
    hidratarCache();
  }, [empresaId, queryClient]);

  // Realtime: auto-refresh when comandas change
  useRealtimeSubscription(
    `dashboard-comandas-${empresaId}`,
    {
      table: 'comandas',
      onChange: () => {
        queryClient.invalidateQueries({ queryKey: ['comandas-hoje'] });
        queryClient.invalidateQueries({ queryKey: ['vendas-concluidas-hoje'] });
        queryClient.invalidateQueries({ queryKey: ['daily-sales'] });
        queryClient.invalidateQueries({ queryKey: ['recent-orders'] });
        queryClient.invalidateQueries({ queryKey: ['pedidos-count-hoje'] });
      },
    },
    !!empresaId
  );

  // Realtime: auto-refresh when pedidos change
  useRealtimeSubscription(
    `dashboard-pedidos-${empresaId}`,
    {
      table: 'pedidos',
      onChange: () => {
        queryClient.invalidateQueries({ queryKey: ['pedidos-count-hoje'] });
        queryClient.invalidateQueries({ queryKey: ['recent-orders'] });
      },
    },
    !!empresaId
  );

  // Realtime: auto-refresh when delivery orders change
  useRealtimeSubscription(
    `dashboard-delivery-${empresaId}`,
    {
      table: 'pedidos_delivery',
      filter: `empresa_id=eq.${empresaId}`,
      onChange: () => {
        queryClient.invalidateQueries({ queryKey: ['daily-sales'] });
      },
    },
    !!empresaId
  );

  // Fetch empresa data - Offline-First
  const { data: empresa } = useQuery({
    queryKey: ['empresa', empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      
      // 1. Buscar dados locais primeiro
      let empresaLocal = null;
      try {
        empresaLocal = await db.empresa.where('id').equals(empresaId).first();
      } catch (err) {
        console.warn('[Offline-First] Erro ao ler empresa do IndexedDB:', err);
      }
      
      // 2. Se online, buscar do Supabase
      if (navigator.onLine) {
        try {
          const { data } = await supabase
            .from('empresas')
            .select('nome_fantasia')
            .eq('id', empresaId)
            .single();
          if (data) {
            // Salvar localmente
            await db.empresa.put({ id: empresaId, ...data, sincronizado: 1 }).catch(() => {});
            return data;
          }
        } catch (err) {
          console.warn('[Offline-First] Supabase inacessível para empresa:', err);
        }
      }
      
      return empresaLocal ? { nome_fantasia: empresaLocal.nome_fantasia } : null;
    },
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch mesas - Offline-First
  const { data: mesas = [] } = useQuery({
    queryKey: ['mesas', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      
      // 1. Buscar do local primeiro
      let dadosLocais: any[] = [];
      try {
        const locais = await db.mesas.where('empresa_id').equals(empresaId).toArray();
        dadosLocais = locais.map((m: any) => ({
          id: m.id,
          numero_mesa: m.numero_mesa ?? m.numero,
          status: m.status || 'disponivel',
          mesa_juncao_id: m.mesa_juncao_id || null,
        }));
      } catch (err) {
        console.warn('[Offline-First] Erro ao ler mesas do IndexedDB:', err);
      }
      
      // 2. Se online, buscar do Supabase
      if (navigator.onLine) {
        try {
          const { data } = await supabase
            .from('mesas')
            .select('id, numero_mesa, status, mesa_juncao_id')
            .eq('empresa_id', empresaId)
            .order('numero_mesa');
          
          if (data) {
            const dadosComSync = data.map((item: any) => ({ ...item, numero: item.numero_mesa, sincronizado: 1 }));
            await db.mesas.bulkPut(dadosComSync);
            return data || [];
          }
        } catch (err) {
          console.warn('[Offline-First] Supabase inacessível para mesas:', err);
        }
      }
      
      return dadosLocais.sort((a, b) => a.numero_mesa - b.numero_mesa);
    },
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Fetch today's comandas and calculate stats - Offline-First
  const { data: comandasHoje = [], isLoading: isLoadingComandas } = useQuery({
    queryKey: ['comandas-hoje', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const today = new Date();
      const startOfToday = startOfDay(today).toISOString();
      const endOfToday = endOfDay(today).toISOString();
      
      // 1. Buscar dados locais primeiro
      let dadosLocais: any[] = [];
      try {
        const locais = await db.comandas.where('empresa_id').equals(empresaId).toArray();
        dadosLocais = locais.filter((c: any) => {
          const createdAt = new Date(c.created_at).toISOString();
          return createdAt >= startOfToday && createdAt <= endOfToday;
        }).map((c: any) => ({
          id: c.id,
          total: c.total || 0,
          status: c.status,
          created_at: c.created_at,
        }));
      } catch (err) {
        console.warn('[Offline-First] Erro ao ler comandas do IndexedDB:', err);
      }
      
      // 2. Se online, buscar do Supabase
      if (navigator.onLine) {
        try {
          const { data } = await supabase
            .from('comandas')
            .select('id, total, status, created_at')
            .eq('empresa_id', empresaId)
            .gte('created_at', startOfToday)
            .lte('created_at', endOfToday);
          if (data) return data;
        } catch (err) {
          console.warn('[Offline-First] Supabase inacessível para comandas:', err);
        }
      }
      
      return dadosLocais;
    },
    enabled: !!empresaId,
    staleTime: 30 * 1000,
    refetchInterval: navigator.onLine ? 30000 : false,
  });

  // Fetch today's vendas_concluidas (standalone sales) - Offline-First
  const { data: vendasHoje = [] } = useQuery({
    queryKey: ['vendas-concluidas-hoje', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const today = new Date();
      const startOfToday = startOfDay(today).toISOString();
      const endOfToday = endOfDay(today).toISOString();
      
      // 1. Buscar dados locais primeiro
      let dadosLocais: any[] = [];
      try {
        const locais = await db.vendas_concluidas.where('empresa_id').equals(empresaId).toArray();
        dadosLocais = locais.filter((v: any) => {
          const createdAt = new Date(v.created_at).toISOString();
          return !v.comanda_id && createdAt >= startOfToday && createdAt <= endOfToday;
        }).map((v: any) => ({
          valor_total: v.valor_total || 0,
          created_at: v.created_at,
        }));
      } catch (err) {
        console.warn('[Offline-First] Erro ao ler vendas_concluidas do IndexedDB:', err);
      }
      
      // 2. Se online, buscar do Supabase
      if (navigator.onLine) {
        try {
          const { data } = await (supabase as any)
            .from('vendas_concluidas')
            .select('valor_total, created_at')
            .eq('empresa_id', empresaId)
            .is('comanda_id', null)
            .gte('created_at', startOfToday)
            .lte('created_at', endOfToday);
          if (data) return data;
        } catch (err) {
          console.warn('[Offline-First] Supabase inacessível para vendas_concluidas:', err);
        }
      }
      
      return dadosLocais;
    },
    enabled: !!empresaId,
    staleTime: 30 * 1000,
    refetchInterval: navigator.onLine ? 30000 : false,
  });

  // Fetch today's pedidos count - Offline-First
  const { data: pedidosHoje = 0 } = useQuery({
    queryKey: ['pedidos-count-hoje', empresaId],
    queryFn: async () => {
      if (!empresaId) return 0;
      const today = new Date();
      const startOfToday = startOfDay(today).toISOString();
      const endOfToday = endOfDay(today).toISOString();
      
      // 1. Buscar dados locais primeiro
      let countLocal = 0;
      try {
        const comandasLocais = await db.comandas.where('empresa_id').equals(empresaId).toArray();
        const comandaIds = comandasLocais.map((c: any) => c.id);
        if (comandaIds.length > 0) {
          const pedidosLocais = await db.pedidos.toArray();
          countLocal = pedidosLocais.filter((p: any) => {
            if (!comandaIds.includes(p.comanda_id)) return false;
            const createdAt = new Date(p.created_at || p.criado_em).toISOString();
            return createdAt >= startOfToday && createdAt <= endOfToday;
          }).length;
        }
      } catch (err) {
        console.warn('[Offline-First] Erro ao contar pedidos do IndexedDB:', err);
      }
      
      // 2. Se online, buscar do Supabase
      if (navigator.onLine) {
        try {
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
            .gte('created_at', startOfToday)
            .lte('created_at', endOfToday);
          
          if (count !== null) return count;
        } catch (err) {
          console.warn('[Offline-First] Supabase inacessível para pedidos count:', err);
        }
      }
      
      return countLocal;
    },
    enabled: !!empresaId,
    staleTime: 30 * 1000,
    refetchInterval: navigator.onLine ? 30000 : false,
  });

  // Fetch recent orders - Offline-First
  const { data: recentOrders = [] } = useQuery({
    queryKey: ['recent-orders', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      
      // 1. Buscar dados locais primeiro
      let dadosLocais: any[] = [];
      try {
        const [pedidos, produtos, comandas, mesas]: any[] = await Promise.all([
          db.pedidos.toArray(),
          db.produtos.toArray(),
          db.comandas.where('empresa_id').equals(empresaId).toArray(),
          db.mesas.where('empresa_id').equals(empresaId).toArray()
        ]);
        
        const comandaIds = comandas.map((c: any) => c.id);
        const produtosMap = new Map(produtos.map((p: any) => [p.id, p]));
        const comandasMap = new Map(comandas.map((c: any) => [c.id, c]));
        const mesasMap = new Map(mesas.map((m: any) => [m.id, m]));
        
        dadosLocais = pedidos
          .filter((p: any) => comandaIds.includes(p.comanda_id))
          .sort((a: any, b: any) => new Date(b.created_at || b.criado_em).getTime() - new Date(a.created_at || a.criado_em).getTime())
          .slice(0, 5)
          .map((p: any) => {
            const produto: any = produtosMap.get(p.produto_id);
            const comanda: any = comandasMap.get(p.comanda_id);
            const mesa: any = comanda ? mesasMap.get(comanda.mesa_id) : null;
            return {
              id: p.id,
              quantidade: p.quantidade,
              subtotal: p.subtotal || (p.quantidade * (p.preco_unitario || produto?.preco || 0)),
              status_cozinha: p.status_cozinha,
              created_at: p.created_at || p.criado_em,
              produto: produto ? { nome: produto.nome } : null,
              comanda: comanda ? { mesa: mesa ? { numero_mesa: mesa.numero_mesa || mesa.numero } : null } : null
            };
          });
      } catch (err) {
        console.warn('[Offline-First] Erro ao ler pedidos recentes do IndexedDB:', err);
      }
      
      // 2. Se online, buscar do Supabase
      if (navigator.onLine) {
        try {
          // Get comandas for this empresa
          const { data: comandas } = await supabase
            .from('comandas')
            .select('id')
            .eq('empresa_id', empresaId);
          
          if (!comandas || comandas.length === 0) return dadosLocais;
          
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
          
          if (data) return data;
        } catch (err) {
          console.warn('[Offline-First] Supabase inacessível para pedidos recentes:', err);
        }
      }
      
      return dadosLocais;
    },
    enabled: !!empresaId,
    staleTime: 30 * 1000,
    refetchInterval: navigator.onLine ? 30000 : false,
  });

  // Fetch last 7 days sales - Offline-First
  const { data: dailySales = [] } = useQuery({
    queryKey: ['daily-sales', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const today = new Date();
      const weekStart = startOfDay(subDays(today, 6)).toISOString();
      const weekEnd = endOfDay(today).toISOString();
      
      // 1. Buscar dados locais primeiro
      let dadosLocais: { date: string; faturamento: number; pedidos: number }[] = [];
      try {
        const [comandas, pedidos] = await Promise.all([
          db.comandas.where('empresa_id').equals(empresaId).toArray(),
          db.pedidos.toArray()
        ]);
        
        const comandasFechadas = comandas.filter((c: any) => {
          const createdAt = new Date(c.created_at).toISOString();
          return c.status === 'fechada' && createdAt >= weekStart && createdAt <= weekEnd;
        });
        
        const comandaIds = comandasFechadas.map((c: any) => c.id);
        const pedidosFiltrados = pedidos.filter((p: any) => {
          const createdAt = new Date(p.created_at || p.criado_em).toISOString();
          return createdAt >= weekStart && createdAt <= weekEnd && comandaIds.includes(p.comanda_id);
        });
        
        // Agrupar por dia
        const salesByDay = new Map<string, { faturamento: number; pedidos: number }>();
        for (let i = 6; i >= 0; i--) {
          const date = subDays(today, i);
          const dateStr = date.toISOString().split('T')[0];
          salesByDay.set(dateStr, { faturamento: 0, pedidos: 0 });
        }
        
        comandasFechadas.forEach((c: any) => {
          const dateStr = new Date(c.created_at).toISOString().split('T')[0];
          const existing = salesByDay.get(dateStr);
          if (existing) {
            existing.faturamento += c.total || 0;
          }
        });
        
        pedidosFiltrados.forEach((p: any) => {
          const dateStr = new Date(p.created_at || p.criado_em).toISOString().split('T')[0];
          const existing = salesByDay.get(dateStr);
          if (existing) {
            existing.pedidos += 1;
          }
        });
        
        dadosLocais = Array.from(salesByDay.entries()).map(([date, data]) => ({
          date,
          ...data
        }));
      } catch (err) {
        console.warn('[Offline-First] Erro ao calcular vendas diárias do IndexedDB:', err);
      }
      
      // 2. Se online, buscar do Supabase
      if (navigator.onLine) {
        try {
          const [comandasRes, pedidosRes, vendasRes] = await Promise.all([
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
            (supabase as any)
              .from('vendas_concluidas')
              .select('valor_total, created_at')
              .eq('empresa_id', empresaId)
              .is('comanda_id', null)
              .gte('created_at', weekStart)
              .lte('created_at', weekEnd),
          ]);

          const weekComandas = comandasRes.data || [];
          const weekPedidos = pedidosRes.data || [];
          const weekVendas = vendasRes.data || [];

          const salesData: DailySales[] = [];
          for (let i = 6; i >= 0; i--) {
            const date = subDays(today, i);
            const dayStart = startOfDay(date);
            const dayEnd = endOfDay(date);

            const dayTotalComandas = weekComandas
              .filter(c => {
                const createdAt = new Date(c.created_at);
                return createdAt >= dayStart && createdAt <= dayEnd;
              })
              .reduce((sum, c) => sum + (c.total || 0), 0);

            const dayTotalVendas = weekVendas
              .filter((v: any) => {
                const createdAt = new Date(v.created_at);
                return createdAt >= dayStart && createdAt <= dayEnd;
              })
              .reduce((sum: number, v: any) => sum + (v.valor_total || 0), 0);

            const dayTotal = dayTotalComandas + dayTotalVendas;

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
        } catch (err) {
          console.warn('[Offline-First] Supabase inacessível para vendas diárias:', err);
        }
      }
      
      // Retornar dados locais formatados
      return dadosLocais.map(d => ({
        date: format(new Date(d.date), 'EEE', { locale: ptBR }),
        total: d.faturamento,
        pedidos: d.pedidos,
      }));
    },
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    refetchInterval: navigator.onLine ? 60000 : false,
  });

  // Calculate derived stats
  const stats = useMemo(() => {
    const mesasOcupadas = mesas.filter(m => m.status === 'ocupada').length;
    const totalMesas = mesas.filter(m => m.status !== 'juncao').length;
    const faturamentoComandas = comandasHoje
      .filter(c => c.status === 'fechada')
      .reduce((sum, c) => sum + (c.total || 0), 0);
    const faturamentoVendas = vendasHoje.reduce((sum: number, v: any) => sum + (v.valor_total || 0), 0);
    const faturamentoHoje = faturamentoComandas + faturamentoVendas;
    const comandasAbertas = comandasHoje.filter(c => c.status === 'aberta').length;

    return {
      mesasOcupadas,
      totalMesas,
      pedidosHoje,
      faturamentoHoje,
      comandasAbertas,
    };
  }, [mesas, comandasHoje, pedidosHoje, vendasHoje]);

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

  const handleRefresh = () => {
    queryClient.invalidateQueries();
    toast.success('Dados atualizados!');
  };

  const handleExportVendasAvulsas = async () => {
    if (!empresaId) return;
    try {
      const today = new Date();
      const weekStart = startOfDay(subDays(today, 6)).toISOString();
      const { data } = await (supabase as any)
        .from('vendas_concluidas')
        .select('valor_total, forma_pagamento, created_at')
        .eq('empresa_id', empresaId)
        .is('comanda_id', null)
        .gte('created_at', weekStart);

      if (!data || data.length === 0) {
        toast.error('Nenhuma venda avulsa nos últimos 7 dias');
        return;
      }

      const reportData = data.map((v: any) => ({
        'Data': format(new Date(v.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
        'Valor (R$)': v.valor_total || 0,
        'Forma de Pagamento': v.forma_pagamento || '-',
      }));

      exportToCSV(reportData, `vendas_avulsas_${format(today, 'yyyy-MM-dd')}`);
      toast.success('Relatório de vendas avulsas exportado!');
    } catch (e) {
      toast.error('Erro ao exportar vendas avulsas');
    }
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
      {/* Trial Value Banner */}
      <TrialValueBanner />

      {/* Onboarding Checklist */}
      <OnboardingChecklist />

      {/* Value Metrics */}
      <ValueMetrics />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do seu restaurante</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} title="Atualizar">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportVendasAvulsas}>
            <Receipt className="w-4 h-4 mr-2" />
            Vendas Avulsas
          </Button>
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
                        Mesa {(order.comanda as any)?.mesa?.numero_mesa || '-'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {(order.produto as any)?.nome} • {formatCurrency(order.subtotal)}
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
