import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Users, Loader2, Merge, X, QrCode, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { MesaQRCodeDialog } from '@/components/admin/MesaQRCodeDialog';

type Mesa = {
  id: string;
  numero_mesa: number;
  status: 'disponivel' | 'ocupada' | 'reservada' | 'juncao';
  capacidade: number;
  mesa_juncao_id: string | null;
};

const statusColors = {
  disponivel: 'bg-status-available/10 border-status-available/30 text-status-available',
  ocupada: 'bg-status-occupied/10 border-status-occupied/30 text-status-occupied',
  reservada: 'bg-status-reserved/10 border-status-reserved/30 text-status-reserved',
  juncao: 'bg-status-merged/10 border-status-merged/30 text-status-merged',
};

const statusLabels = {
  disponivel: 'Disponível',
  ocupada: 'Ocupada',
  reservada: 'Reservada',
  juncao: 'Junção',
};

export default function Mesas() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [newMesa, setNewMesa] = useState({ numero_mesa: '', capacidade: '4' });
  const [selectedMesas, setSelectedMesas] = useState<string[]>([]);
  
  // QR Code Dialog
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedMesaForQR, setSelectedMesaForQR] = useState<Mesa | null>(null);
  
  // Status change dialog
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedMesaForStatus, setSelectedMesaForStatus] = useState<Mesa | null>(null);

  const empresaId = profile?.empresa_id;

  // Fetch mesas with react-query
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
    staleTime: 30000,
  });

  // Realtime subscription for comandas to auto-update mesa status
  useEffect(() => {
    if (!empresaId) return;

    const channel = supabase
      .channel('comandas-mesas-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comandas',
          filter: `empresa_id=eq.${empresaId}`
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' && payload.new.mesa_id) {
            await supabase
              .from('mesas')
              .update({ status: 'ocupada' })
              .eq('id', payload.new.mesa_id);
            queryClient.invalidateQueries({ queryKey: ['mesas'] });
          } else if (payload.eventType === 'UPDATE') {
            const newStatus = payload.new.status;
            const mesaId = payload.new.mesa_id;
            
            if ((newStatus === 'fechada' || newStatus === 'cancelada') && mesaId) {
              const { data: openComandas } = await supabase
                .from('comandas')
                .select('id')
                .eq('mesa_id', mesaId)
                .eq('status', 'aberta');
              
              if (!openComandas || openComandas.length === 0) {
                await supabase
                  .from('mesas')
                  .update({ status: 'disponivel' })
                  .eq('id', mesaId);
                queryClient.invalidateQueries({ queryKey: ['mesas'] });
              }
            }
          }
        }
      )
      .subscribe();

    // Also subscribe to direct mesa changes
    const mesasChannel = supabase
      .channel('mesas-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mesas',
          filter: `empresa_id=eq.${empresaId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['mesas'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(mesasChannel);
    };
  }, [empresaId, queryClient]);

  const handleCreateMesa = async () => {
    if (!empresaId) {
      toast.error('Configure sua empresa primeiro');
      return;
    }

    const numero = parseInt(newMesa.numero_mesa);
    if (isNaN(numero) || numero <= 0) {
      toast.error('Número da mesa inválido');
      return;
    }

    try {
      const { error } = await supabase.from('mesas').insert({
        empresa_id: empresaId,
        numero_mesa: numero,
        capacidade: parseInt(newMesa.capacidade),
      });

      if (error) {
        if (error.code === '23505') {
          toast.error('Já existe uma mesa com este número');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Mesa criada com sucesso!');
      setNewMesa({ numero_mesa: '', capacidade: '4' });
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['mesas'] });
    } catch (error) {
      console.error('Error creating mesa:', error);
      toast.error('Erro ao criar mesa');
    }
  };

  const handleMergeMesas = async () => {
    if (selectedMesas.length < 2) {
      toast.error('Selecione pelo menos 2 mesas para junção');
      return;
    }

    try {
      const masterMesa = selectedMesas[0];
      const otherMesas = selectedMesas.slice(1);

      for (const mesaId of otherMesas) {
        await supabase
          .from('mesas')
          .update({ 
            status: 'juncao',
            mesa_juncao_id: masterMesa 
          })
          .eq('id', mesaId);
      }

      await supabase
        .from('mesas')
        .update({ status: 'ocupada' })
        .eq('id', masterMesa);

      toast.success('Mesas unidas com sucesso!');
      setSelectedMesas([]);
      setIsMergeDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['mesas'] });
    } catch (error) {
      console.error('Error merging mesas:', error);
      toast.error('Erro ao unir mesas');
    }
  };

  const handleUnmergeMesa = async (mesaId: string) => {
    try {
      await supabase
        .from('mesas')
        .update({ 
          status: 'disponivel',
          mesa_juncao_id: null 
        })
        .eq('id', mesaId);

      toast.success('Junção desfeita!');
      queryClient.invalidateQueries({ queryKey: ['mesas'] });
    } catch (error) {
      console.error('Error unmerging:', error);
      toast.error('Erro ao desfazer junção');
    }
  };

  const handleOpenQRCode = (mesa: Mesa) => {
    setSelectedMesaForQR(mesa);
    setQrDialogOpen(true);
  };

  const handleStatusClick = (mesa: Mesa) => {
    // Only allow status change for non-junction tables
    if (mesa.status !== 'juncao') {
      setSelectedMesaForStatus(mesa);
      setStatusDialogOpen(true);
    }
  };

  const handleChangeStatus = async (newStatus: 'disponivel' | 'ocupada' | 'reservada') => {
    if (!selectedMesaForStatus) return;

    try {
      const { error } = await supabase
        .from('mesas')
        .update({ status: newStatus })
        .eq('id', selectedMesaForStatus.id);

      if (error) throw error;

      toast.success(`Status alterado para ${statusLabels[newStatus]}`);
      setStatusDialogOpen(false);
      setSelectedMesaForStatus(null);
      queryClient.invalidateQueries({ queryKey: ['mesas'] });
    } catch (error) {
      console.error('Error changing status:', error);
      toast.error('Erro ao alterar status');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const availableMesas = mesas.filter(m => m.status === 'disponivel');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gerenciamento de Mesas</h1>
          <p className="text-muted-foreground">Gerencie as mesas do seu estabelecimento</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          
          <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Merge className="w-4 h-4 mr-2" />
                Juntar Mesas
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Juntar Mesas</DialogTitle>
                <DialogDescription>
                  Selecione as mesas que deseja unir. A primeira será a mesa principal.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-4 gap-2 my-4">
                {availableMesas.map((mesa) => (
                  <button
                    key={mesa.id}
                    onClick={() => {
                      if (selectedMesas.includes(mesa.id)) {
                        setSelectedMesas(selectedMesas.filter(id => id !== mesa.id));
                      } else {
                        setSelectedMesas([...selectedMesas, mesa.id]);
                      }
                    }}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      selectedMesas.includes(mesa.id)
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {mesa.numero_mesa}
                  </button>
                ))}
              </div>
              {availableMesas.length < 2 && (
                <p className="text-sm text-muted-foreground text-center">
                  É necessário ter pelo menos 2 mesas disponíveis para junção
                </p>
              )}
              <Button onClick={handleMergeMesas} disabled={selectedMesas.length < 2}>
                Confirmar Junção
              </Button>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Nova Mesa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Nova Mesa</DialogTitle>
                <DialogDescription>
                  Preencha os dados da nova mesa
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="numero">Número da Mesa</Label>
                  <Input
                    id="numero"
                    type="number"
                    placeholder="Ex: 1"
                    value={newMesa.numero_mesa}
                    onChange={(e) => setNewMesa({ ...newMesa, numero_mesa: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capacidade">Capacidade</Label>
                  <Input
                    id="capacidade"
                    type="number"
                    placeholder="Ex: 4"
                    value={newMesa.capacidade}
                    onChange={(e) => setNewMesa({ ...newMesa, capacidade: e.target.value })}
                  />
                </div>
                <Button onClick={handleCreateMesa} className="w-full">
                  Criar Mesa
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Status Legend */}
      <div className="flex flex-wrap gap-4">
        {Object.entries(statusLabels).map(([key, label]) => (
          <div key={key} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded ${statusColors[key as keyof typeof statusColors].split(' ')[0]}`} />
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Info Banner */}
      <div className="bg-muted/50 border border-border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">
          <strong>Status automático:</strong> O status da mesa é atualizado automaticamente quando uma comanda é aberta (ocupada) ou fechada (disponível).
        </p>
      </div>

      {/* Mesas Grid */}
      {mesas.length === 0 ? (
        <Card className="shadow-fcd border-0">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma mesa cadastrada</p>
            <Button 
              className="mt-4"
              onClick={() => setIsDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Primeira Mesa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {mesas.map((mesa) => (
            <Card 
              key={mesa.id} 
              className={`shadow-fcd border-2 transition-all hover:scale-105 ${statusColors[mesa.status]}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl font-bold">
                    {mesa.numero_mesa}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleOpenQRCode(mesa)}
                      className="p-1 rounded hover:bg-primary/20 transition-colors"
                      title="Ver QR Code"
                    >
                      <QrCode className="w-5 h-5" />
                    </button>
                    {mesa.status === 'juncao' && (
                      <button 
                        onClick={() => handleUnmergeMesa(mesa.id)}
                        className="p-1 rounded hover:bg-destructive/20"
                        title="Desfazer junção"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-1 text-sm">
                  <Users className="w-4 h-4" />
                  <span>{mesa.capacidade} lugares</span>
                </div>
                <button
                  onClick={() => handleStatusClick(mesa)}
                  className={`w-full text-xs font-medium px-2 py-1 rounded bg-background/50 hover:bg-background/80 transition-colors ${
                    mesa.status !== 'juncao' ? 'cursor-pointer' : 'cursor-default'
                  }`}
                  title={mesa.status !== 'juncao' ? 'Clique para alterar status' : ''}
                >
                  {statusLabels[mesa.status]}
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* QR Code Dialog */}
      {selectedMesaForQR && empresaId && (
        <MesaQRCodeDialog
          open={qrDialogOpen}
          onOpenChange={setQrDialogOpen}
          mesaNumero={selectedMesaForQR.numero_mesa}
          mesaId={selectedMesaForQR.id}
          empresaId={empresaId}
        />
      )}

      {/* Status Change Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Status da Mesa {selectedMesaForStatus?.numero_mesa}</DialogTitle>
            <DialogDescription>
              Selecione o novo status para a mesa
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <Button
              variant={selectedMesaForStatus?.status === 'disponivel' ? 'default' : 'outline'}
              onClick={() => handleChangeStatus('disponivel')}
              className="flex flex-col gap-2 h-auto py-4"
            >
              <div className="w-4 h-4 rounded bg-status-available" />
              Disponível
            </Button>
            <Button
              variant={selectedMesaForStatus?.status === 'ocupada' ? 'default' : 'outline'}
              onClick={() => handleChangeStatus('ocupada')}
              className="flex flex-col gap-2 h-auto py-4"
            >
              <div className="w-4 h-4 rounded bg-status-occupied" />
              Ocupada
            </Button>
            <Button
              variant={selectedMesaForStatus?.status === 'reservada' ? 'default' : 'outline'}
              onClick={() => handleChangeStatus('reservada')}
              className="flex flex-col gap-2 h-auto py-4"
            >
              <div className="w-4 h-4 rounded bg-status-reserved" />
              Reservada
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
