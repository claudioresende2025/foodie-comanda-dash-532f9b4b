import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Loader2, 
  TrendingUp, 
  Users, 
  ShoppingBag, 
  DollarSign, 
  Star, 
  MapPin,
  Calendar,
  Download,
  Search,
  UserCheck,
  Repeat
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell 
} from 'recharts';
import { format, subDays, startOfWeek, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AvaliacoesList from './AvaliacoesList';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function DesempenhoPanel() {
  const { profile } = useAuth();
  const [periodoVendas, setPeriodoVendas] = useState<'7' | '30' | '90'>('30');
  const [buscaCliente, setBuscaCliente] = useState('');

  // Buscar dados de vendas
  const { data: vendasData, isLoading: loadingVendas } = useQuery({
    queryKey: ['vendas-desempenho', profile?.empresa_id, periodoVendas],
    queryFn: async () => {
      if (!profile?.empresa_id) return null;

      const diasAtras = subDays(new Date(), parseInt(periodoVendas)).toISOString();

      // Buscar pedidos
      const { data: pedidos, error } = await supabase
        .from('pedidos_delivery')
        .select('*, itens_delivery(*), enderecos_cliente(bairro)')
        .eq('empresa_id', profile.empresa_id)
        .gte('created_at', diasAtras)
        .neq('status', 'cancelado')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calcular estatísticas
      const totalVendido = pedidos?.reduce((acc, p) => acc + (p.total || 0), 0) || 0;
      const totalPedidos = pedidos?.length || 0;
      const ticketMedio = totalPedidos > 0 ? totalVendido / totalPedidos : 0;

      // Vendas por dia
      const vendasPorDia: Record<string, { total: number; count: number }> = {};
      for (let i = parseInt(periodoVendas) - 1; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        vendasPorDia[date] = { total: 0, count: 0 };
      }
      
      pedidos?.forEach((p: any) => {
        const date = format(new Date(p.created_at), 'yyyy-MM-dd');
        if (vendasPorDia[date]) {
          vendasPorDia[date].total += p.total || 0;
          vendasPorDia[date].count += 1;
        }
      });

      const chartData = Object.entries(vendasPorDia).map(([date, data]) => ({
        date: format(new Date(date), 'dd/MM', { locale: ptBR }),
        total: data.total,
        pedidos: data.count,
      }));

      // Vendas por bairro
      const vendasPorBairro: Record<string, { total: number; count: number }> = {};
      pedidos?.forEach((p: any) => {
        const bairro = p.enderecos_cliente?.bairro || 'Não informado';
        if (!vendasPorBairro[bairro]) {
          vendasPorBairro[bairro] = { total: 0, count: 0 };
        }
        vendasPorBairro[bairro].total += p.total || 0;
        vendasPorBairro[bairro].count += 1;
      });

      const bairrosData = Object.entries(vendasPorBairro)
        .map(([bairro, data]) => ({
          bairro,
          total: data.total,
          pedidos: data.count,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      // Top produtos
      const produtosCount: Record<string, { nome: string; quantidade: number; total: number }> = {};
      pedidos?.forEach((p: any) => {
        p.itens_delivery?.forEach((item: any) => {
          const id = item.produto_id || item.nome_produto;
          if (!produtosCount[id]) {
            produtosCount[id] = { nome: item.nome_produto, quantidade: 0, total: 0 };
          }
          produtosCount[id].quantidade += item.quantidade;
          produtosCount[id].total += item.subtotal || (item.preco_unitario * item.quantidade);
        });
      });

      const topProdutos = Object.values(produtosCount)
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 10);

      return {
        totalVendido,
        totalPedidos,
        ticketMedio,
        chartData,
        bairrosData,
        topProdutos,
      };
    },
    enabled: !!profile?.empresa_id,
  });

  // Buscar dados de clientes
  const { data: clientesData, isLoading: loadingClientes } = useQuery({
    queryKey: ['clientes-desempenho', profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return null;

      // Usar a view clientes_stats
      const { data: clientes, error } = await supabase
        .from('clientes_stats')
        .select('*')
        .eq('empresa_id', profile.empresa_id)
        .order('valor_total', { ascending: false });

      if (error) throw error;

      const totalClientes = clientes?.length || 0;
      
      // Contar clientes novos (primeiro pedido no último mês)
      const umMesAtras = subDays(new Date(), 30);
      const clientesNovos = clientes?.filter(c => 
        new Date(c.primeiro_pedido) >= umMesAtras
      ).length || 0;

      // Clientes recorrentes (mais de 1 pedido)
      const clientesRecorrentes = clientes?.filter(c => c.total_pedidos > 1).length || 0;

      // Frequência média
      const frequenciaMedia = totalClientes > 0
        ? clientes!.reduce((acc, c) => acc + c.total_pedidos, 0) / totalClientes
        : 0;

      return {
        totalClientes,
        clientesNovos,
        clientesRecorrentes,
        frequenciaMedia,
        listaClientes: clientes || [],
      };
    },
    enabled: !!profile?.empresa_id,
  });

  // Filtrar clientes pela busca
  const clientesFiltrados = clientesData?.listaClientes.filter(c => {
    if (!buscaCliente.trim()) return true;
    const termo = buscaCliente.toLowerCase();
    return (
      c.nome_cliente?.toLowerCase().includes(termo) ||
      c.bairro?.toLowerCase().includes(termo)
    );
  }) || [];

  const isLoading = loadingVendas || loadingClientes;

  if (isLoading && !vendasData && !clientesData) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel de Desempenho</h1>
        <p className="text-muted-foreground">Acompanhe as métricas do seu negócio</p>
      </div>

      <Tabs defaultValue="vendas" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="vendas" className="gap-2">
            <TrendingUp className="h-4 w-4 hidden sm:block" />
            Vendas
          </TabsTrigger>
          <TabsTrigger value="clientes" className="gap-2">
            <Users className="h-4 w-4 hidden sm:block" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="base" className="gap-2">
            <UserCheck className="h-4 w-4 hidden sm:block" />
            Base
          </TabsTrigger>
          <TabsTrigger value="avaliacoes" className="gap-2">
            <Star className="h-4 w-4 hidden sm:block" />
            Avaliações
          </TabsTrigger>
        </TabsList>

        {/* Aba Vendas */}
        <TabsContent value="vendas" className="space-y-6">
          {/* Filtro de período */}
          <div className="flex gap-2">
            <Button 
              variant={periodoVendas === '7' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setPeriodoVendas('7')}
            >
              7 dias
            </Button>
            <Button 
              variant={periodoVendas === '30' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setPeriodoVendas('30')}
            >
              30 dias
            </Button>
            <Button 
              variant={periodoVendas === '90' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setPeriodoVendas('90')}
            >
              90 dias
            </Button>
          </div>

          {/* Cards de estatísticas */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Vendido</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  R$ {(vendasData?.totalVendido || 0).toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pedidos</CardTitle>
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{vendasData?.totalPedidos || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  R$ {(vendasData?.ticketMedio || 0).toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de vendas */}
          <Card>
            <CardHeader>
              <CardTitle>Vendas por Dia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={vendasData?.chartData || []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(value) => `R$${value}`} />
                    <Tooltip
                      formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Total']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
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

          {/* Vendas por Bairro e Top Produtos */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Vendas por Bairro</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={vendasData?.bairrosData || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(value) => `R$${value}`} />
                      <YAxis dataKey="bairro" type="category" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Total']}
                      />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top 10 Produtos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {vendasData?.topProdutos?.map((produto, index) => (
                    <div key={produto.nome} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0">
                          {index + 1}
                        </Badge>
                        <span className="text-sm font-medium truncate max-w-[180px]">
                          {produto.nome}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{produto.quantidade}x</div>
                        <div className="text-xs text-muted-foreground">
                          R$ {produto.total.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Aba Clientes */}
        <TabsContent value="clientes" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{clientesData?.totalClientes || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clientes Novos</CardTitle>
                <UserCheck className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {clientesData?.clientesNovos || 0}
                </div>
                <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recorrentes</CardTitle>
                <Repeat className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {clientesData?.clientesRecorrentes || 0}
                </div>
                <p className="text-xs text-muted-foreground">+1 pedido</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Frequência Média</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(clientesData?.frequenciaMedia || 0).toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground">pedidos/cliente</p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de pizza: Novos vs Recorrentes */}
          <Card>
            <CardHeader>
              <CardTitle>Distribuição de Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Novos', value: clientesData?.clientesNovos || 0 },
                        { name: 'Recorrentes', value: clientesData?.clientesRecorrentes || 0 },
                        { 
                          name: 'Únicos', 
                          value: (clientesData?.totalClientes || 0) - (clientesData?.clientesRecorrentes || 0) - (clientesData?.clientesNovos || 0) 
                        },
                      ].filter(d => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {COLORS.map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Base de Clientes */}
        <TabsContent value="base" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Base de Clientes</CardTitle>
                  <CardDescription>
                    {clientesFiltrados.length} cliente(s) encontrado(s)
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar cliente ou bairro..."
                      value={buscaCliente}
                      onChange={(e) => setBuscaCliente(e.target.value)}
                      className="pl-8 w-64"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Bairro</TableHead>
                      <TableHead className="text-center">Pedidos</TableHead>
                      <TableHead className="text-right">Total Gasto</TableHead>
                      <TableHead>Último Pedido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientesFiltrados.slice(0, 50).map((cliente: any) => (
                      <TableRow key={cliente.user_id}>
                        <TableCell className="font-medium">
                          {cliente.nome_cliente || 'Cliente'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {cliente.bairro || 'Não informado'}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{cliente.total_pedidos}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          R$ {(cliente.valor_total || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {cliente.ultimo_pedido
                            ? format(new Date(cliente.ultimo_pedido), "dd/MM/yyyy", { locale: ptBR })
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {clientesFiltrados.length > 50 && (
                <p className="text-sm text-muted-foreground text-center mt-4">
                  Mostrando 50 de {clientesFiltrados.length} clientes
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Avaliações */}
        <TabsContent value="avaliacoes">
          <AvaliacoesList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
