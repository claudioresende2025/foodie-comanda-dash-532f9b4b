
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Users, Bell, BellRing, Check, Loader2, UtensilsCrossed, RefreshCw } from 'lucide-react';

type Mesa = {
  id: string;
  numero_mesa: number;
  status: 'disponivel' | 'ocupada' | 'reservada' | 'juncao';
  capacidade: number;
  mesa_juncao_id: string | null;
  // opcional: se existir no banco, será utilizado
  nome?: string | null;
};

type ChamadaGarcom = {
  id: string;
  mesa_id: string;
  status: string;
  created_at: string;
  // ampliado para tentar trazer nome, se existir
  mesa?: { id?: string; numero_mesa: number; nome?: string | null };
};

const statusColors = {
  disponivel: 'bg-status-available border-status-available text-status-available-foreground',
  ocupada: 'bg-status-occupied border-status-occupied text-white',
  reservada: 'bg-status-reserved border-status-reserved text-white',
  juncao: 'bg-status-merged border-status-merged text-white',
};

const statusLabels = {
  disponivel: 'Disponível',
  ocupada: 'Ocupada',
  reservada: 'Reservada',
  juncao: 'Junção',
};

// Som de notificação
const playNotificationSound = () => {
  try {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    if (audioContext.state === 'suspended') audioContext.resume();

    const beep = (freq: number, durMs: number) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + durMs / 1000);
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + durMs / 1000);
    };

    beep(800, 300);
    setTimeout(() => beep(1000, 300), 150);
  } catch (e) {
    console.log('Audio error:', e);
  }
};

export default function Garcom() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [soundEnabled, setSoundEnabled] = useState(true);

  /** MESAS */
  const { data: mesas = [], isLoading: isLoadingMesas } = useQuery({
    queryKey: ['mesas-garcom', profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return [];
      const { data, error } = await supabase
        .from('mesas')
        .select('*') // se existir 'nome' no schema, virá aqui
        .eq('empresa_id', profile.empresa_id)
        .order('numero_mesa', { ascending: true });
      if (error) throw error;
      return data as Mesa[];
    },
    enabled: !!profile?.empresa_id,
    staleTime: 30000,
  });

  /** CHAMADAS (com info da mesa numa única consulta) */
  const { data: chamadas = [], refetch: refetchChamadas } = useQuery({
    queryKey: ['chamadas-garcom', profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return [];
      const { data, error } = await supabase
        .from('chamadas_garcom')
        .select(`
          *,
          mesa:mesas(id, numero_mesa)
        `)
        .eq('empresa_id', profile.empresa_id)
        .eq('status', 'pendente')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as ChamadaGarcom[];
    },
    enabled: !!profile?.empresa_id,
    staleTime: 5000,
    refetchInterval: 10000,
  });

  /** Helper: nome exibível de uma mesa (considera junções e nome customizado) */
  const getMesaDisplayName = (mesa: Mesa): string => {
    // nome explícito se existir
    const baseName = (mesa.nome && mesa.nome.trim().length > 0) ? mesa.nome!.trim() : `Mesa ${mesa.numero_mesa}`;

    // se esta mesa é a "mãe" da junção (ou seja, outras apontam para ela)
    const mergedChildren = mesas.filter(m => m.mesa_juncao_id === mesa.id);
    if (mergedChildren.length > 0) {
      const numbers = [mesa.numero_mesa, ...mergedChildren.map(m => m.numero_mesa)].sort((a, b) => a - b);
      return `Mesa ${numbers.join(' + ')}`;
    }

    // se esta mesa é filha de uma junção
    if (mesa.mesa_juncao_id) {
      const masterMesa = mesas.find(m => m.id === mesa.mesa_juncao_id);
      if (masterMesa) {
        const allMerged = mesas.filter(m => m.mesa_juncao_id === mesa.mesa_juncao_id);
        const numbers = [masterMesa.numero_mesa, ...allMerged.map(m => m.numero_mesa)].sort((a, b) => a - b);
        return `Mesa ${numbers.join(' + ')}`;
      }
    }

    return baseName;
  };

  /** Helper: obter display name pelo id (usado nas chamadas e toasts) */
  const getMesaDisplayNameById = (mesaId?: string) => {
    if (!mesaId) return 'Mesa ?';
    const mesa = mesas.find(m => m.id === mesaId);
    return mesa ? getMesaDisplayName(mesa) : 'Mesa ?';
  };

  /** Realtime subscriptions */
  useEffect(() => {
    if (!profile?.empresa_id) return;

    const channelChamadas = supabase
      .channel('garcom-chamadas')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chamadas_garcom', filter: `empresa_id=eq.${profile.empresa_id}` },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            if (soundEnabled) playNotificationSound();
            toast.info(`Nova chamada recebida!`, { duration: 5000 });
          }
          queryClient.invalidateQueries({ queryKey: ['chamadas-garcom', profile?.empresa_id] });
        }
      )
      .subscribe();

    const channelMesas = supabase
      .channel('garcom-mesas')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mesas', filter: `empresa_id=eq.${profile.empresa_id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['mesas-garcom', profile?.empresa_id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelChamadas);
      supabase.removeChannel(channelMesas);
    };
    // Removido 'mesas' das dependências para evitar re-subscriptions desnecessárias
  }, [profile?.empresa_id, soundEnabled, queryClient]);

  /** Atender chamada */
  const handleAtenderChamada = async (chamadaId: string) => {
    const { error } = await supabase
      .from('chamadas_garcom')
      .update({ status: 'atendida', atendida_at: new Date().toISOString() })
      .eq('id', chamadaId);

    if (error) {
      toast.error('Erro ao atender chamada');
    } else {
      toast.success('Chamada atendida!');
      // invalidar com chave correta
      queryClient.invalidateQueries({ queryKey: ['chamadas-garcom', profile?.empresa_id] });
      // opcional: refetch imediato
      refetchChamadas();
    }
  };

  // Mesas visíveis (oculta as marcadas como 'juncao')
  const visibleMesas = mesas.filter(mesa => mesa.status !== 'juncao');

  if (isLoadingMesas) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2 md:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Painel do Garçom</h1>
          <p className="text-muted-foreground">Visão otimizada para tablet</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['mesas-garcom', profile?.empresa_id] });
              queryClient.invalidateQueries({ queryKey: ['chamadas-garcom', profile?.empresa_id] });
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button
            variant={soundEnabled ? 'default' : 'outline'}
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? <Bell className="w-4 h-4 mr-2" /> : <Bell className="w-4 h-4 mr-2 opacity-50" />}
            Som {soundEnabled ? 'Ativado' : 'Desativado'}
          </Button>
        </div>
      </div>

      {/* Chamadas Pendentes */}
      {chamadas.length > 0 && (
        <Card className="border-2 border-status-occupied bg-status-occupied/5 animate-pulse">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-status-occupied">
              <BellRing className="w-5 h-5" />
              Chamadas Pendentes ({chamadas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {chamadas.map((chamada) => {
                // nome da mesa preferindo o helper (considera junções e nome customizado)
                const displayName =
                  getMesaDisplayNameById(chamada.mesa_id) ||
                  (chamada.mesa?.nome ? chamada.mesa.nome : `Mesa ${chamada.mesa?.numero_mesa ?? '?'}`);

                return (
                  <Button
                    key={chamada.id}
                    variant="destructive"
                    className="h-20 flex flex-col gap-1"
                    onClick={() => handleAtenderChamada(chamada.id)}
                    title={`Atender ${displayName}`}
                  >
                    <span className="text-lg font-bold">{displayName}</span>
                    <span className="text-xs flex items-center gap-1">
                      <Check className="w-3 h-3" /> Atender
                    </span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legenda de status */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(statusLabels)
          .filter(([key]) => key !== 'juncao')
          .map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${statusColors[key as keyof typeof statusColors].split(' ')[0]}`} />
              <span className="text-sm text-muted-foreground">{label}</span>
            </div>
          ))}
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-status-merged" />
          <span className="text-sm text-muted-foreground">Mesas Juntas</span>
        </div>
      </div>

      {/* Grid de Mesas */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
        {visibleMesas.map((mesa) => {
          const displayName = getMesaDisplayName(mesa); // SEM remover "Mesa "
          const hasMergedChildren = mesas.some(m => m.mesa_juncao_id === mesa.id);

          return (
            <Card
              key={mesa.id}
              className={`transition-all hover:scale-105 cursor-pointer border-2 ${statusColors[mesa.status]}`}
              title={displayName}
            >
              <CardContent className="p-3 text-center">
                <div className="flex flex-col items-center gap-1">
                  <UtensilsCrossed className="w-6 h-6 opacity-70" />
                  <span className="text-lg font-bold">
                    {/* Mostrar sempre o nome completo (incluindo "Mesa X" ou junções) */}
                    {displayName}
                  </span>
                  <span className="text-xs opacity-80">
                    {mesa.capacidade} lug.
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1 py-0 mt-1 bg-background/30"
                  >
                    {hasMergedChildren ? 'Juntas' : statusLabels[mesa.status]}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {visibleMesas.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma mesa cadastrada</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
``
