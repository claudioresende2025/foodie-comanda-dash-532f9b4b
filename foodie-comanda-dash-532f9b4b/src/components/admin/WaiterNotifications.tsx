import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, Clock, User } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ChamadaGarcom = {
  id: string;
  mesa_id: string;
  status: string;
  created_at: string;
  mesa?: {
    numero_mesa: number;
  };
};

export default function WaiterNotifications() {
  const { profile } = useAuth();
  const [chamadas, setChamadas] = useState<ChamadaGarcom[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchChamadas = async () => {
    if (!profile?.empresa_id) return;

    const { data, error } = await supabase
      .from('chamadas_garcom')
      .select(`
        id,
        mesa_id,
        status,
        created_at,
        mesa:mesas(numero_mesa)
      `)
      .eq('empresa_id', profile.empresa_id)
      .eq('status', 'pendente')
      .order('created_at', { ascending: true });

    if (!error && data) {
      setChamadas(data as unknown as ChamadaGarcom[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchChamadas();
  }, [profile?.empresa_id]);

  // Realtime subscription
  useEffect(() => {
    if (!profile?.empresa_id) return;

    const channel = supabase
      .channel('chamadas-garcom-admin')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chamadas_garcom',
        },
        (payload) => {
          console.log('Chamada update:', payload);
          if (payload.eventType === 'INSERT') {
            // Play notification sound
            playNotificationSound();
            toast.info('Nova chamada de mesa!', {
              duration: 5000,
            });
            fetchChamadas();
          } else if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
            fetchChamadas();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.empresa_id]);

  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 600;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      
      setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.frequency.value = 800;
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        osc2.start(audioContext.currentTime);
        osc2.stop(audioContext.currentTime + 0.3);
      }, 150);
    } catch (e) {
      console.log('Audio not supported');
    }
  };

  const handleAtender = async (chamadaId: string) => {
    const { error } = await supabase
      .from('chamadas_garcom')
      .update({ 
        status: 'atendida',
        atendida_at: new Date().toISOString()
      })
      .eq('id', chamadaId);

    if (error) {
      toast.error('Erro ao atender chamada');
    } else {
      toast.success('Chamada atendida!');
      setChamadas(prev => prev.filter(c => c.id !== chamadaId));
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-fcd border-0">
        <CardContent className="flex items-center justify-center py-8">
          <Clock className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-fcd border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-accent" />
          Chamadas de Garçom
          {chamadas.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {chamadas.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chamadas.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>Nenhuma chamada pendente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {chamadas.map((chamada) => (
              <div
                key={chamada.id}
                className="flex items-center justify-between p-4 rounded-lg bg-destructive/10 border border-destructive/20 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      Mesa {chamada.mesa?.numero_mesa || '-'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(chamada.created_at), {
                        addSuffix: true,
                        locale: ptBR
                      })}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => handleAtender(chamada.id)}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Atender
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
