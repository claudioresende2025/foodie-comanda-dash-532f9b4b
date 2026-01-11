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
import { useUserRole } from '@/hooks/useUserRole';
import { MesaQRCodeDialog } from '@/components/admin/MesaQRCodeDialog';

type MesaStatus = 'disponivel' | 'ocupada' | 'reservada' | 'juncao';

type Mesa = {
  id: string;
  numero_mesa: number;
  status: MesaStatus;
  capacidade: number;
  mesa_juncao_id: string | null;
  nome?: string | null;
};

// Config de status para tabs (igual ao KDS)
const statusConfig: Record<MesaStatus, { label: string; color: string; borderColor: string; icon: React.ElementType }> = {
  disponivel: { label: 'Disponível', color: 'bg-green-500', borderColor: 'border-green-500', icon: CheckCircle },
  ocupada: { label: 'Ocupada', color: 'bg-orange-500', borderColor: 'border-orange-500', icon: Clock },
  reservada: { label: 'Reservada', color: 'bg-yellow-500', borderColor: 'border-yellow-500', icon: CalendarCheck },
  juncao: { label: 'Junção', color: 'bg-blue-500', borderColor: 'border-blue-500', icon: Link2 },
};

export default function Mesas() {
  const { profile } = useAuth();
  const { mesasLimit } = useUserRole();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<MesaStatus | 'todas'>('todas');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [isReserveDialogOpen, setIsReserveDialogOpen] = useState(false);
  const [newMesa, setNewMesa] = useState({ numero_mesa: '', capacidade: '4' });
  const [selectedMesas, setSelectedMesas] = useState<string[]>([]);
  const [selectedReserveMesas, setSelectedReserveMesas] = useState<string[]>([]);
  const [reserveName, setReserveName] = useState('');
  const [reserveDate, setReserveDate] = useState('');
  const [reserveTime, setReserveTime] = useState('');
  
  // QR Code Dialog
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedMesaForQR, setSelectedMesaForQR] = useState<Mesa | null>(null);

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

  // Realtime subscription
  // NOTA: A lógica de alteração de status da mesa é feita APENAS pelo trigger no banco de dados (update_mesa_status_on_comanda).
  // Este subscription serve apenas para atualizar a UI quando houver mudanças.
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
        () => {
          // Apenas invalida a query para atualizar a UI
          // O trigger no banco de dados já cuida de alterar o status da mesa
          queryClient.invalidateQueries({ queryKey: ['mesas', empresaId] });
        }
      )
      .subscribe();

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
                queryClient.invalidateQueries({ queryKey: ['mesas', empresaId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(mesasChannel);
    };
  }, [empresaId, queryClient]);

  // Contadores e filtros
  const countByStatus = (status: MesaStatus) => mesas.filter(m => m.status === status).length;
  
  const filteredMesas = useMemo(() => {
    if (activeTab === 'todas') return mesas;
    return mesas.filter(m => m.status === activeTab);
  }, [mesas, activeTab]);

  const availableMesas = mesas.filter(m => m.status === 'disponivel');

  // Helper para mostrar quais mesas estão juntas
  const getMesasJuntasText = (mesa: Mesa): string | null => {
    if (mesa.status !== 'juncao' || !mesa.mesa_juncao_id) return null;
    
    // Encontra a mesa principal
    const mesaPrincipal = mesas.find(m => m.id === mesa.mesa_juncao_id);
    if (!mesaPrincipal) return null;
    
    // Encontra todas as mesas filhas da mesa principal
    const mesasFilhas = mesas.filter(m => m.mesa_juncao_id === mesaPrincipal.id);
    
    // Junta todos os números e ordena
    const numeros = [mesaPrincipal.numero_mesa, ...mesasFilhas.map(m => m.numero_mesa)].sort((a, b) => a - b);
    
    return numeros.join('+');
  };

  // Handlers
  const handleCreateMesa = async () => {
    if (!empresaId) {
      toast.error('Configure sua empresa primeiro');
      return;
    }

    // Checagem de limite de mesas
    if (mesasLimit != null && mesas.length >= mesasLimit) {
      toast.error('Limite de mesas atingido pelo seu plano');
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
      queryClient.invalidateQueries({ queryKey: ['mesas', empresaId] });
    } catch (error: any) {
      console.error('Error creating mesa:', error);
      // Se o backend retornar mensagem amigável, exibe ela
      const msg = error?.message || error?.error_description || error?.msg;
      if (msg && msg.toLowerCase().includes('limite de mesas')) {
        toast.error(msg);
      } else {
        toast.error('Limite de mesa atingido');
      }
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
      queryClient.invalidateQueries({ queryKey: ['mesas', empresaId] });
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
      queryClient.invalidateQueries({ queryKey: ['mesas', empresaId] });
    } catch (error) {
      console.error('Error unmerging:', error);
      toast.error('Erro ao desfazer junção');
    }
  };

  const handleOpenQRCode = (mesa: Mesa, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedMesaForQR(mesa);
    setQrDialogOpen(true);
  };

  const handleMesaClick = (mesa: Mesa) => {
    // Ao clicar na mesa, abre o QR Code para visualização
    // O status é gerenciado automaticamente:
    // - Ao abrir comanda -> mesa fica 'ocupada'
    // - Ao fechar comanda no caixa -> mesa fica 'disponivel'
    if (mesa.status !== 'juncao') {
      setSelectedMesaForQR(mesa);
      setQrDialogOpen(true);
    }
  };



  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Gerenciamento de Mesas</h1>
          <p className="text-muted-foreground">Gerencie as mesas do seu estabelecimento</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          
          <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Merge className="w-4 h-4 mr-2" />
                Juntar
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

          <Dialog open={isReserveDialogOpen} onOpenChange={setIsReserveDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <CalendarCheck className="w-4 h-4 mr-2" />
                Reservar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reservar Mesas</DialogTitle>
                <DialogDescription>Selecione as mesas que deseja reservar e informe o nome do cliente.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-4 gap-2 my-4">
                {availableMesas.map((mesa) => (
                  <button
                    key={mesa.id}
                    onClick={() => {
                      if (selectedReserveMesas.includes(mesa.id)) {
                        setSelectedReserveMesas(selectedReserveMesas.filter(id => id !== mesa.id));
                      } else {
                        setSelectedReserveMesas([...selectedReserveMesas, mesa.id]);
                      }
                    }}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      selectedReserveMesas.includes(mesa.id)
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {mesa.numero_mesa}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Nome do Cliente</Label>
                <Input value={reserveName} onChange={(e) => setReserveName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data da Reserva</Label>
                <Input type="date" value={reserveDate} onChange={(e) => setReserveDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Horário (opcional)</Label>
                <Input type="time" value={reserveTime} onChange={(e) => setReserveTime(e.target.value)} />
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={async () => {
                  if (selectedReserveMesas.length === 0) { toast.error('Selecione pelo menos uma mesa'); return; }
                  if (!reserveName) { toast.error('Informe o nome do cliente'); return; }
                  try {
                    // Criar registros na tabela `reservas` (schema já presente no projeto)
                    for (const id of selectedReserveMesas) {
                      const payload: any = {
                        empresa_id: empresaId,
                        mesa_id: id,
                        nome_cliente: reserveName,
                        data_reserva: reserveDate || new Date().toISOString().slice(0,10),
                        // horario_reserva column is TIME NOT NULL in schema: use a safe default when not provided
                        horario_reserva: reserveTime ? reserveTime : '00:00:00',
                        status: 'confirmada',
                        numero_pessoas: 1,
                      };

                      const { data: inserted, error } = await supabase.from('reservas').insert(payload).select().single();
                      if (error) throw error;

                      // Atualiza também o status da mesa para 'reservada' para refletir imediatamente na UI
                      try {
                        // Tenta atualizar com `nome` (se a coluna existir no banco/schema cache)
                        const { error: mesaErr } = await supabase
                          .from('mesas')
                          .update({ status: 'reservada', nome: reserveName })
                          .eq('id', id);
                        if (mesaErr) throw mesaErr;
                      } catch (mesaUpdateErr) {
                        // Fallback: tenta apenas atualizar o status (caso a coluna `nome` ainda não exista no schema cache)
                        console.warn('Atualização de mesa com nome falhou, tentando atualizar apenas status', mesaUpdateErr);
                        const { error: mesaErr2 } = await supabase
                          .from('mesas')
                          .update({ status: 'reservada' })
                          .eq('id', id);
                        if (mesaErr2) throw mesaErr2;
                      }
                    }

                    toast.success('Mesas reservadas');
                    setSelectedReserveMesas([]);
                    setReserveName('');
                    setReserveDate('');
                    setReserveTime('');
                    setIsReserveDialogOpen(false);
                    // O trigger no banco deve atualizar status da mesa; invalidar queries para atualizar UI
                    queryClient.invalidateQueries({ queryKey: ['mesas', empresaId] });
                    queryClient.invalidateQueries({ queryKey: ['reservas', empresaId] });
                  } catch (e: any) {
                    console.error('Erro reservando mesas', e);
                    toast.error(String(e.message || 'Erro ao reservar mesas'));
                  }
                }}>Confirmar Reserva</Button>
              </div>
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
                <Button onClick={handleCreateMesa} className="w-full" disabled={mesasLimit != null && mesas.length >= mesasLimit}>
                  Criar Mesa
                </Button>
                {(mesasLimit != null && mesas.length >= mesasLimit) && (
                  <span style={{ color: 'red', display: 'block', marginTop: 8 }}>
                    Limite de mesas atingido pelo seu plano
                  </span>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-muted/50 border border-border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">
          <strong>Status 100% automático:</strong> O status da mesa é atualizado automaticamente quando uma comanda é aberta (ocupada) ou fechada no caixa (disponível). Clique em uma mesa para ver o QR Code.
        </p>
      </div>

      {/* Tabs por Status */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MesaStatus | 'todas')}>
        <TabsList className="grid w-full grid-cols-5 h-auto">
          {/* Tab Todas */}
          <TabsTrigger
            value="todas"
            className="relative flex flex-col sm:flex-row items-center gap-1 py-2 px-1 sm:px-3 text-xs sm:text-sm"
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Todas</span>
            <Badge
              variant="secondary"
              className="absolute -top-1 -right-1 sm:relative sm:top-0 sm:right-0 sm:ml-1 h-5 w-5 flex items-center justify-center text-[10px] sm:text-xs"
            >
              {mesas.length}
            </Badge>
          </TabsTrigger>
          
          {/* Tabs por Status */}
          {(['disponivel', 'ocupada', 'reservada', 'juncao'] as MesaStatus[]).map((status) => {
            const config = statusConfig[status];
            const count = countByStatus(status);
            return (
              <TabsTrigger
                key={status}
                value={status}
                className="relative flex flex-col sm:flex-row items-center gap-1 py-2 px-1 sm:px-3 text-xs sm:text-sm"
              >
                <config.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{config.label}</span>
                {count > 0 && (
                  <Badge
                    variant="secondary"
                    className="absolute -top-1 -right-1 sm:relative sm:top-0 sm:right-0 sm:ml-1 h-5 w-5 flex items-center justify-center text-[10px] sm:text-xs"
                  >
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Conteúdo - Grid de Mesas */}
        <TabsContent value={activeTab} className="mt-6">
          {filteredMesas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {activeTab === 'todas' 
                    ? 'Nenhuma mesa cadastrada' 
                    : `Nenhuma mesa ${statusConfig[activeTab as MesaStatus].label.toLowerCase()}`}
                </p>
                {activeTab === 'todas' && (
                  <Button 
                    className="mt-4"
                    onClick={() => setIsDialogOpen(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Primeira Mesa
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredMesas.map((mesa) => {
                const config = statusConfig[mesa.status];
                const StatusIcon = config.icon;
                
                return (
                  <Card 
                    key={mesa.id} 
                    className={`relative overflow-hidden cursor-pointer transition-all hover:scale-105 border-2 bg-white ${config.borderColor}`}
                    onClick={() => handleMesaClick(mesa)}
                  >
                    {/* Barra colorida no topo */}
                    <div className={`absolute top-0 left-0 right-0 h-1 ${config.color}`} />
                    
                    <CardHeader className="pb-2 pt-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-2xl font-bold">
                          {mesa.numero_mesa}
                        </CardTitle>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={(e) => handleOpenQRCode(mesa, e)}
                            className="p-1 rounded hover:bg-primary/20 transition-colors"
                            title="Ver QR Code"
                          >
                            <QrCode className="w-5 h-5" />
                          </button>
                          {mesa.status === 'juncao' && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnmergeMesa(mesa.id);
                              }}
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
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span>{mesa.capacidade} lugares</span>
                      </div>
                      <Badge 
                        variant="outline" 
                        className="w-full justify-center text-xs"
                      >
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {mesa.status === 'juncao' && getMesasJuntasText(mesa) 
                          ? `Junção: ${getMesasJuntasText(mesa)}`
                          : config.label}
                      </Badge>
                      {mesa.status === 'reservada' && (
                        <div className="mt-2 flex gap-2">
                          <Button variant="outline" onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await supabase.from('mesas').update({ status: 'disponivel', nome: null }).eq('id', mesa.id);
                              toast.success('Reserva cancelada');
                              queryClient.invalidateQueries({ queryKey: ['mesas', empresaId] });
                            } catch (err) {
                              console.error('Erro cancelando reserva', err);
                              toast.error('Erro ao cancelar reserva');
                            }
                          }}>Cancelar Reserva</Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* QR Code Dialog */}
      {selectedMesaForQR && empresaId && (
        <MesaQRCodeDialog
          open={qrDialogOpen}
          onOpenChange={setQrDialogOpen}
          mesaNumero={selectedMesaForQR.numero_mesa}
          mesaId={selectedMesaForQR.id}
          empresaId={empresaId}
          mesaStatus={selectedMesaForQR.status}
        />
      )}

    </div>
  );
}
