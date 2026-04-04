import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, MapPin, Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type TaxaBairro = {
  id: string;
  empresa_id: string;
  bairro: string;
  taxa: number;
  ativo: boolean;
  created_at: string;
};

export default function TaxasBairroManager() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [novoBairro, setNovoBairro] = useState('');
  const [novaTaxa, setNovaTaxa] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBairro, setEditBairro] = useState('');
  const [editTaxa, setEditTaxa] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: taxas, isLoading } = useQuery({
    queryKey: ['taxas-bairro', profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return [];
      const { data, error } = await supabase
        .from('taxas_bairro')
        .select('*')
        .eq('empresa_id', profile.empresa_id)
        .order('bairro', { ascending: true });

      if (error) throw error;
      return data as TaxaBairro[];
    },
    enabled: !!profile?.empresa_id,
  });

  const addMutation = useMutation({
    mutationFn: async ({ bairro, taxa }: { bairro: string; taxa: number }) => {
      const { error } = await supabase
        .from('taxas_bairro')
        .insert({
          empresa_id: profile?.empresa_id,
          bairro: bairro.trim(),
          taxa,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxas-bairro'] });
      setNovoBairro('');
      setNovaTaxa('');
      toast.success('Taxa adicionada com sucesso!');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Este bairro já está cadastrado.');
      } else {
        toast.error('Erro ao adicionar taxa.');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, bairro, taxa }: { id: string; bairro: string; taxa: number }) => {
      const { error } = await supabase
        .from('taxas_bairro')
        .update({ bairro: bairro.trim(), taxa })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxas-bairro'] });
      setEditingId(null);
      toast.success('Taxa atualizada com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao atualizar taxa.');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('taxas_bairro')
        .update({ ativo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxas-bairro'] });
    },
    onError: () => {
      toast.error('Erro ao alterar status.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('taxas_bairro')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxas-bairro'] });
      setDeleteId(null);
      toast.success('Taxa removida com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao remover taxa.');
    },
  });

  const handleAdd = () => {
    if (!novoBairro.trim()) {
      toast.error('Informe o nome do bairro.');
      return;
    }
    const taxa = parseFloat(novaTaxa) || 0;
    addMutation.mutate({ bairro: novoBairro, taxa });
  };

  const handleEdit = (item: TaxaBairro) => {
    setEditingId(item.id);
    setEditBairro(item.bairro);
    setEditTaxa(item.taxa.toString());
  };

  const handleSaveEdit = () => {
    if (!editBairro.trim() || !editingId) return;
    const taxa = parseFloat(editTaxa) || 0;
    updateMutation.mutate({ id: editingId, bairro: editBairro, taxa });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditBairro('');
    setEditTaxa('');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Taxa por Bairro</CardTitle>
          </div>
          <CardDescription>
            Configure taxas de entrega personalizadas por bairro. Se o bairro não estiver cadastrado, será usada a taxa padrão.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Formulário para adicionar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <Label className="sr-only">Nome do Bairro</Label>
              <Input
                placeholder="Nome do bairro"
                value={novoBairro}
                onChange={(e) => setNovoBairro(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div className="w-full sm:w-32">
              <Label className="sr-only">Taxa (R$)</Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                placeholder="Taxa R$"
                value={novaTaxa}
                onChange={(e) => setNovaTaxa(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <Button onClick={handleAdd} disabled={addMutation.isPending}>
              {addMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span className="ml-2 hidden sm:inline">Adicionar</span>
            </Button>
          </div>

          {/* Tabela de bairros */}
          {taxas && taxas.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bairro</TableHead>
                    <TableHead className="w-24 text-right">Taxa</TableHead>
                    <TableHead className="w-20 text-center">Ativo</TableHead>
                    <TableHead className="w-24 text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taxas.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {editingId === item.id ? (
                          <Input
                            value={editBairro}
                            onChange={(e) => setEditBairro(e.target.value)}
                            className="h-8"
                          />
                        ) : (
                          <span className={!item.ativo ? 'text-muted-foreground line-through' : ''}>
                            {item.bairro}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingId === item.id ? (
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            value={editTaxa}
                            onChange={(e) => setEditTaxa(e.target.value)}
                            className="h-8 w-20"
                          />
                        ) : (
                          <span className={!item.ativo ? 'text-muted-foreground' : 'font-medium'}>
                            R$ {item.taxa.toFixed(2)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={item.ativo}
                          onCheckedChange={(ativo) => toggleMutation.mutate({ id: item.id, ativo })}
                          disabled={toggleMutation.isPending}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {editingId === item.id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleSaveEdit}
                                disabled={updateMutation.isPending}
                              >
                                {updateMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Save className="w-4 h-4 text-green-600" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleCancelEdit}
                              >
                                <X className="w-4 h-4 text-red-600" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(item)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteId(item.id)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>Nenhum bairro cadastrado.</p>
              <p className="text-sm">Adicione bairros para personalizar as taxas de entrega.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Taxa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta taxa de bairro? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
