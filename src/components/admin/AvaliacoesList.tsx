import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Star, MessageSquare, MapPin, Calendar, TrendingUp, Filter } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Avaliacao = {
  id: string;
  nota_restaurante: number;
  nota_produto: number | null;
  comentario: string | null;
  nome_cliente: string;
  bairro: string | null;
  created_at: string;
};

type AvaliacaoStats = {
  total_avaliacoes: number;
  media_restaurante: number;
  media_produto: number;
  cinco_estrelas: number;
  quatro_estrelas: number;
  tres_estrelas: number;
  duas_estrelas: number;
  uma_estrela: number;
};

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };
  
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClass[size]} ${
            star <= rating
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-muted text-muted'
          }`}
        />
      ))}
    </div>
  );
}

function StatsBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const percent = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-20 text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${color}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="w-10 text-right text-muted-foreground">{count}</span>
    </div>
  );
}

export default function AvaliacoesList() {
  const { profile } = useAuth();
  const [filtroNota, setFiltroNota] = useState<string>('todas');
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>('30');
  const [busca, setBusca] = useState('');

  // Buscar estatísticas
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['avaliacoes-stats', profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return null;
      
      // Usar a view de estatísticas
      const { data, error } = await supabase
        .from('avaliacoes_stats')
        .select('*')
        .eq('empresa_id', profile.empresa_id)
        .maybeSingle();

      if (error) throw error;
      return data as AvaliacaoStats | null;
    },
    enabled: !!profile?.empresa_id,
  });

  // Buscar avaliações
  const { data: avaliacoes, isLoading: loadingAvaliacoes } = useQuery({
    queryKey: ['avaliacoes', profile?.empresa_id, filtroNota, filtroPeriodo, busca],
    queryFn: async () => {
      if (!profile?.empresa_id) return [];
      
      let query = supabase
        .from('avaliacoes')
        .select('*')
        .eq('empresa_id', profile.empresa_id)
        .order('created_at', { ascending: false });

      // Filtro por período
      if (filtroPeriodo && filtroPeriodo !== 'todas') {
        const diasAtras = parseInt(filtroPeriodo);
        const dataInicio = subDays(new Date(), diasAtras).toISOString();
        query = query.gte('created_at', dataInicio);
      }

      // Filtro por nota
      if (filtroNota && filtroNota !== 'todas') {
        query = query.eq('nota_restaurante', parseInt(filtroNota));
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Filtro por busca (nome ou bairro)
      let resultado = data as Avaliacao[];
      if (busca.trim()) {
        const termo = busca.toLowerCase().trim();
        resultado = resultado.filter(a => 
          a.nome_cliente.toLowerCase().includes(termo) ||
          a.bairro?.toLowerCase().includes(termo) ||
          a.comentario?.toLowerCase().includes(termo)
        );
      }
      
      return resultado;
    },
    enabled: !!profile?.empresa_id,
  });

  const isLoading = loadingStats || loadingAvaliacoes;

  if (isLoading && !avaliacoes) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Avaliações</h1>
        <p className="text-muted-foreground">Veja o que seus clientes estão dizendo</p>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Avaliações</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_avaliacoes || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média Restaurante</CardTitle>
            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{stats?.media_restaurante?.toFixed(1) || '0.0'}</span>
              <StarRating rating={Math.round(stats?.media_restaurante || 0)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média Produtos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{stats?.media_produto?.toFixed(1) || '0.0'}</span>
              <StarRating rating={Math.round(stats?.media_produto || 0)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Distribuição</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <StatsBar label="5 estrelas" count={stats?.cinco_estrelas || 0} total={stats?.total_avaliacoes || 1} color="bg-green-500" />
            <StatsBar label="4 estrelas" count={stats?.quatro_estrelas || 0} total={stats?.total_avaliacoes || 1} color="bg-lime-500" />
            <StatsBar label="3 estrelas" count={stats?.tres_estrelas || 0} total={stats?.total_avaliacoes || 1} color="bg-yellow-500" />
            <StatsBar label="2 estrelas" count={stats?.duas_estrelas || 0} total={stats?.total_avaliacoes || 1} color="bg-orange-500" />
            <StatsBar label="1 estrela" count={stats?.uma_estrela || 0} total={stats?.total_avaliacoes || 1} color="bg-red-500" />
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <CardTitle className="text-lg">Filtros</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Buscar</Label>
              <Input
                placeholder="Nome, bairro ou comentário..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Nota</Label>
              <Select value={filtroNota} onValueChange={setFiltroNota}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as notas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as notas</SelectItem>
                  <SelectItem value="5">5 estrelas</SelectItem>
                  <SelectItem value="4">4 estrelas</SelectItem>
                  <SelectItem value="3">3 estrelas</SelectItem>
                  <SelectItem value="2">2 estrelas</SelectItem>
                  <SelectItem value="1">1 estrela</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                  <SelectItem value="todas">Todo o período</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de avaliações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Avaliações Recentes</CardTitle>
          <CardDescription>
            {avaliacoes?.length || 0} avaliação(ões) encontrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {avaliacoes && avaliacoes.length > 0 ? (
            <div className="space-y-4">
              {avaliacoes.map((avaliacao) => (
                <div
                  key={avaliacao.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{avaliacao.nome_cliente}</h3>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        {avaliacao.bairro && (
                          <>
                            <MapPin className="h-3 w-3" />
                            <span>{avaliacao.bairro}</span>
                            <span>•</span>
                          </>
                        )}
                        <Calendar className="h-3 w-3" />
                        <span>
                          {format(new Date(avaliacao.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                    <Badge variant={avaliacao.nota_restaurante >= 4 ? 'default' : avaliacao.nota_restaurante >= 3 ? 'secondary' : 'destructive'}>
                      {avaliacao.nota_restaurante} estrelas
                    </Badge>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Restaurante:</span>
                      <StarRating rating={avaliacao.nota_restaurante} />
                    </div>
                    {avaliacao.nota_produto && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Produtos:</span>
                        <StarRating rating={avaliacao.nota_produto} />
                      </div>
                    )}
                  </div>

                  {avaliacao.comentario && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm">{avaliacao.comentario}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Star className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-20" />
              <h3 className="text-lg font-semibold mb-1">Nenhuma avaliação encontrada</h3>
              <p className="text-muted-foreground">
                As avaliações aparecerão aqui quando seus clientes avaliarem os pedidos.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
