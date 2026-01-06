import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Users, Loader2, Merge, X, QrCode, RefreshCw, CheckCircle, Clock, CalendarCheck, Link2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { MesaQRCodeDialog } from '@/components/admin/MesaQRCodeDialog';

type MesaStatus = 'disponivel' | 'ocupada' | 'reservada' | 'juncao';

type Mesa = {
  id: string;
  numero_mesa: number;
  status: MesaStatus;
  capacidade: number;
  mesa_juncao_id: string | null;
};

const statusConfig: Record<MesaStatus, { label: string; color: string; borderColor: string; icon: React.ElementType }> = {
  disponivel: { label: 'Disponível', color: 'bg-green-500', borderColor: 'border-green-500', icon: CheckCircle },
  ocupada: { label: 'Ocupada', color: 'bg-orange-500', borderColor: 'border-orange-500', icon: Clock },
  reservada: { label: 'Reservada', color: 'bg-yellow-500', borderColor: 'border-yellow-500', icon: CalendarCheck },
  juncao: { label: 'Junção', color: 'bg-blue-500', borderColor: 'border-blue-500', icon: Link2 },
};

export default function Mesas() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<MesaStatus | 'todas'>('todas');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [newMesa, setNewMesa] = useState({ numero_mesa: '', capacidade: '4' });
  const [selectedMesas, setSelectedMesas] = useState<string[]>([]);
  
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedMesaForQR, setSelectedMesaForQR] = useState<Mesa | null>(null);

  const empresaId = profile?.empresa_id;

  const { data: mesas = [], isLoading, refetch } = useQuery({
    queryKey: ['mesas', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from('mesas')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('numero_mesa');
      if (error) throw error;
      return data as Mesa[];
    },
    enabled: !!empresaId,
  });

  // --- SINCRONIZAÇÃO EM TEMPO REAL CORRIGIDA ---
  useEffect(() => {
    if (!empresaId) return;

    // Monitora mudanças nas comandas e atualiza a mesa
    const channel = supabase
      .channel('sync-comandas-mesas')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comandas', filter: `empresa_id=eq.${empresaId}` },
        async (payload) => {
          if (payload.eventType === 'INSERT' && payload.new.mesa_id) {
            await supabase.from('mesas').update({ status: 'ocupada' }).eq('id', payload.new.mesa_id);
            queryClient.invalidateQueries({ queryKey: ['mesas'] });
          } else if (payload.eventType === 'UPDATE') {
            const { status, mesa_id } = payload.new;
            if ((status === 'fechada' || status === 'cancelada') && mesa_id) {
              const { data: open } = await supabase.from('comandas').select('id').eq('mesa_id', mesa_id).eq('status', 'aberta');
              if (!open || open.length === 0) {
                await supabase.from('mesas').update({ status: 'disponivel' }).eq('id', mesa_id);
                queryClient.invalidateQueries({ queryKey: ['mesas'] });
              }
            }
          }
        }
      ).subscribe();

    // Monitora mudanças DIRETAS na tabela de mesas (Essencial para o Menu.tsx refletir aqui)
    const mesasChannel = supabase
      .channel('sync-status-direto')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mesas', filter: `empresa_id=eq.${empresaId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['mesas'] });
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(mesasChannel);
    };
  }, [empresaId, queryClient]);

  const countByStatus = (status: MesaStatus) => mesas.filter(m => m.status === status).length;
  
  const filteredMesas = useMemo(() => {
    if (activeTab === 'todas') return mesas;
    return mesas.filter(m => m.status === activeTab);
  }, [mesas, activeTab]);

  const availableMesas = mesas.filter(m => m.status === 'disponivel');

  const getMesasJuntasText = (mesa: Mesa): string | null => {
    if (mesa.status !== 'juncao' || !mesa.mesa_juncao_id) return null;
    const mesaPrincipal = mesas.find(m => m.id === mesa.mesa_juncao_id);
    if (!mesaPrincipal) return null;
    const mesasFilhas = mesas.filter(m => m.mesa_juncao_id === mesaPrincipal.id);
    const numeros = [mesaPrincipal.numero_mesa, ...mesasFilhas.map(m => m.numero_mesa)].sort((a, b) => a - b);
    return numeros.join('+');
  };

  const handleCreateMesa = async () => {
    if (!empresaId) return;
    const numero = parseInt(newMesa.numero_mesa);
    try {
      const { error } = await supabase.from('mesas').insert({
        empresa_id: empresaId,
        numero_mesa: numero,
        capacidade: parseInt(newMesa.capacidade),
      });
      if (error) throw error;
      toast.success('Mesa criada!');
      setIsDialogOpen(false);
      setNewMesa({ numero_mesa: '', capacidade: '4' });
      queryClient.invalidateQueries({ queryKey: ['mesas'] });
    } catch (error) {
      toast.error('Erro ao criar mesa');
    }
  };

  const handleMergeMesas = async () => {
    if (selectedMesas.length < 2) return;
    try {
      const master = selectedMesas[0];
      const others = selectedMesas.slice(1);
      for (const id of others) {
        await supabase.from('mesas').update({ status: 'juncao', mesa_juncao_id: master }).eq('id', id);
      }
      await supabase.from('mesas').update({ status: 'ocupada' }).eq('id', master);
      toast.success('Mesas unidas!');
      setSelectedMesas([]);
      setIsMergeDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['mesas'] });
    } catch (error) {
      toast.error('Erro na junção');
    }
  };

  const handleUnmergeMesa = async (mesaId: string) => {
    await supabase.from('mesas').update({ status: 'disponivel', mesa_juncao_id: null }).eq('id', mesaId);
    toast.success('Junção desfeita');
    queryClient.invalidateQueries({ queryKey: ['mesas'] });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gerenciamento de Mesas</h1>
          <p className="text-muted-foreground">Status em tempo real das mesas</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-2" /> Atualizar</Button>
          
          <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
            <DialogTrigger asChild><Button variant="outline"><Merge className="w-4 h-4 mr-2" /> Juntar</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Juntar Mesas</DialogTitle></DialogHeader>
              <div className="grid grid-cols-4 gap-2 my-4">
                {availableMesas.map((m) => (
                  <button key={m.id} onClick={() => setSelectedMesas(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                    className={`p-4 rounded-lg border-2 ${selectedMesas.includes(m.id) ? 'border-primary bg-primary/10' : 'border-border'}`}>{m.numero_mesa}</button>
                ))}
              </div>
              <Button onClick={handleMergeMesas} disabled={selectedMesas.length < 2} className="w-full">Confirmar Junção</Button>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> Nova Mesa</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Mesa</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Input type="number" placeholder="Número" value={newMesa.numero_mesa} onChange={e => setNewMesa({...newMesa, numero_mesa: e.target.value})} />
                <Input type="number" placeholder="Capacidade" value={newMesa.capacidade} onChange={e => setNewMesa({...newMesa, capacidade: e.target.value})} />
                <Button onClick={handleCreateMesa} className="w-full">Criar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-5 h-auto">
          <TabsTrigger value="todas">Todas <Badge className="ml-1" variant="secondary">{mesas.length}</Badge></TabsTrigger>
          {Object.entries(statusConfig).map(([key, config]) => (
            <TabsTrigger key={key} value={key} className="hidden sm:flex">
               <config.icon className="w-4 h-4 mr-1" /> {config.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredMesas.map((mesa) => {
              const config = statusConfig[mesa.status];
              const StatusIcon = config.icon;
              return (
                <Card key={mesa.id} className={`relative transition-all hover:scale-105 border-2 bg-white ${config.borderColor}`} onClick={() => { setSelectedMesaForQR(mesa); setQrDialogOpen(true); }}>
                  <div className={`absolute top-0 left-0 right-0 h-1 ${config.color}`} />
                  <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-2xl font-bold">{mesa.numero_mesa}</CardTitle>
                    <QrCode className="w-5 h-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-2">
                    <div className="text-xs text-muted-foreground flex items-center"><Users className="w-3 h-3 mr-1" /> {mesa.capacidade} lugares</div>
                    <Badge variant="outline" className="w-full justify-center text-[10px]">
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {mesa.status === 'juncao' ? `Unida ao nº ${mesas.find(m => m.id === mesa.mesa_juncao_id)?.numero_mesa}` : config.label}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {selectedMesaForQR && empresaId && (
        <MesaQRCodeDialog open={qrDialogOpen} onOpenChange={setQrDialogOpen} mesaNumero={selectedMesaForQR.numero_mesa} mesaId={selectedMesaForQR.id} empresaId={empresaId} />
      )}
    </div>
  );
}
