import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Loader2, Upload, Pencil, Trash2, ChefHat, FolderOpen, RefreshCw } from 'lucide-react';

type Categoria = {
  id: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
};

type Produto = {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  imagem_url: string | null;
  categoria_id: string | null;
  ativo: boolean;
};

import { Button } from '@/components/ui/button';

export default function Cardapio() {
  const { profile } = useAuth();
  const { canManageCategories } = useUserRole();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;
  
  // Category Dialog
  const [isCatDialogOpen, setIsCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Categoria | null>(null);
  const [catForm, setCatForm] = useState({ nome: '', descricao: '' });
  
  // Product Dialog
  const [isProdDialogOpen, setIsProdDialogOpen] = useState(false);
  const [editingProd, setEditingProd] = useState<Produto | null>(null);
  const [prodForm, setProdForm] = useState({
    nome: '',
    descricao: '',
    preco: '',
    categoria_id: '',
    ativo: true,
  });
  const [prodImage, setProdImage] = useState<File | null>(null);
  const [prodImagePreview, setProdImagePreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch categorias
  const { data: categorias = [], isLoading: isLoadingCat, refetch: refetchCat } = useQuery({
    queryKey: ['categorias', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('ordem');
      if (error) throw error;
      return data as Categoria[];
    },
    enabled: !!empresaId,
    staleTime: 60000,
  });

  // Fetch produtos
  const { data: produtos = [], isLoading: isLoadingProd, refetch: refetchProd } = useQuery({
    queryKey: ['produtos', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nome');
      if (error) throw error;
      return data as Produto[];
    },
    enabled: !!empresaId,
    staleTime: 60000,
  });

  const isLoading = isLoadingCat || isLoadingProd;

  // Category handlers
  const handleSaveCategoria = async () => {
    if (!empresaId || !catForm.nome.trim()) {
      toast.error('Nome da categoria é obrigatório');
      return;
    }

    setIsSaving(true);
    try {
      if (editingCat) {
        const { error } = await supabase
          .from('categorias')
          .update({ nome: catForm.nome, descricao: catForm.descricao || null })
          .eq('id', editingCat.id);
        if (error) throw error;
        toast.success('Categoria atualizada!');
      } else {
        const { error } = await supabase.from('categorias').insert({
          empresa_id: empresaId,
          nome: catForm.nome,
          descricao: catForm.descricao || null,
          ordem: categorias.length,
        });
        if (error) throw error;
        toast.success('Categoria criada!');
      }

      setIsCatDialogOpen(false);
      setEditingCat(null);
      setCatForm({ nome: '', descricao: '' });
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
    } catch (error) {
      console.error('Error saving categoria:', error);
      toast.error('Erro ao salvar categoria');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategoria = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta categoria?')) return;

    try {
      const { error } = await supabase.from('categorias').delete().eq('id', id);
      if (error) throw error;
      toast.success('Categoria excluída!');
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
    } catch (error) {
      console.error('Error deleting categoria:', error);
      toast.error('Erro ao excluir categoria');
    }
  };

  // Product handlers
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProdImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setProdImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProduto = async () => {
    if (!empresaId || !prodForm.nome.trim() || !prodForm.preco) {
      toast.error('Nome e preço são obrigatórios');
      return;
    }

    setIsSaving(true);
    try {
      let imagem_url = editingProd?.imagem_url || null;

      if (prodImage) {
        const fileExt = prodImage.name.split('.').pop();
        const fileName = `${empresaId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('produtos')
          .upload(fileName, prodImage);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('produtos')
          .getPublicUrl(fileName);

        imagem_url = publicUrl;
      }

      const produtoData = {
        nome: prodForm.nome,
        descricao: prodForm.descricao || null,
        preco: parseFloat(prodForm.preco),
        categoria_id: prodForm.categoria_id || null,
        ativo: prodForm.ativo,
        imagem_url,
      };

      if (editingProd) {
        const { error } = await supabase
          .from('produtos')
          .update(produtoData)
          .eq('id', editingProd.id);
        if (error) throw error;
        toast.success('Produto atualizado!');
      } else {
        const { error } = await supabase.from('produtos').insert({
          ...produtoData,
          empresa_id: empresaId,
        });
        if (error) throw error;
        toast.success('Produto criado!');
      }

      setIsProdDialogOpen(false);
      setEditingProd(null);
      setProdForm({ nome: '', descricao: '', preco: '', categoria_id: '', ativo: true });
      setProdImage(null);
      setProdImagePreview(null);
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
    } catch (error) {
      console.error('Error saving produto:', error);
      toast.error('Erro ao salvar produto');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduto = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;

    try {
      const { error } = await supabase.from('produtos').delete().eq('id', id);
      if (error) throw error;
      toast.success('Produto excluído!');
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
    } catch (error) {
      console.error('Error deleting produto:', error);
      toast.error('Erro ao excluir produto');
    }
  };

  const openEditProduto = (produto: Produto) => {
    setEditingProd(produto);
    setProdForm({
      nome: produto.nome,
      descricao: produto.descricao || '',
      preco: produto.preco.toString(),
      categoria_id: produto.categoria_id || '',
      ativo: produto.ativo,
    });
    setProdImagePreview(produto.imagem_url);
    setIsProdDialogOpen(true);
  };

  const openEditCategoria = (categoria: Categoria) => {
    setEditingCat(categoria);
    setCatForm({ nome: categoria.nome, descricao: categoria.descricao || '' });
    setIsCatDialogOpen(true);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão do Cardápio</h1>
          <p className="text-muted-foreground">Gerencie categorias e produtos</p>
        </div>
        <Button variant="outline" onClick={() => { refetchCat(); refetchProd(); }}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <Tabs defaultValue="produtos" className="space-y-6">
        <TabsList>
          <TabsTrigger value="produtos">Produtos ({produtos.length})</TabsTrigger>
          <TabsTrigger value="categorias">Categorias ({categorias.length})</TabsTrigger>
        </TabsList>

        {/* PRODUTOS TAB */}
        <TabsContent value="produtos" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isProdDialogOpen} onOpenChange={(open) => {
              setIsProdDialogOpen(open);
              if (!open) {
                setEditingProd(null);
                setProdForm({ nome: '', descricao: '', preco: '', categoria_id: '', ativo: true });
                setProdImage(null);
                setProdImagePreview(null);
              }
            }}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Produto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingProd ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
                  <DialogDescription>Preencha os dados do produto</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                  {/* Image Upload */}
                  <div className="space-y-2">
                    <Label>Imagem do Produto</Label>
                    <div className="flex items-center gap-4">
                      <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-border bg-muted/50 flex items-center justify-center overflow-hidden">
                        {prodImagePreview ? (
                          <img src={prodImagePreview} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <Upload className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <Input type="file" accept="image/*" onChange={handleImageChange} />
                        <p className="text-xs text-muted-foreground mt-1">PNG, JPG. Máximo 2MB.</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input
                      placeholder="Ex: X-Burguer Especial"
                      value={prodForm.nome}
                      onChange={(e) => setProdForm({ ...prodForm, nome: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea
                      placeholder="Descrição do produto..."
                      value={prodForm.descricao}
                      onChange={(e) => setProdForm({ ...prodForm, descricao: e.target.value })}
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Preço (R$) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={prodForm.preco}
                        onChange={(e) => setProdForm({ ...prodForm, preco: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Select
                        value={prodForm.categoria_id}
                        onValueChange={(value) => setProdForm({ ...prodForm, categoria_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {categorias.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Produto Ativo</Label>
                    <Switch
                      checked={prodForm.ativo}
                      onCheckedChange={(checked) => setProdForm({ ...prodForm, ativo: checked })}
                    />
                  </div>

                  <Button onClick={handleSaveProduto} className="w-full" disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {editingProd ? 'Salvar Alterações' : 'Criar Produto'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {produtos.length === 0 ? (
            <Card className="shadow-fcd border-0">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ChefHat className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum produto cadastrado</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {produtos.map((produto) => (
                <Card key={produto.id} className={`shadow-fcd border-0 ${!produto.ativo ? 'opacity-60' : ''}`}>
                  <div className="aspect-video bg-muted rounded-t-lg overflow-hidden">
                    {produto.imagem_url ? (
                      <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ChefHat className="w-12 h-12 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold">{produto.nome}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{produto.descricao}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-lg font-bold text-primary">
                        R$ {produto.preco.toFixed(2)}
                      </span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditProduto(produto)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteProduto(produto.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="categorias" className="space-y-4">
          {canManageCategories && (
            <div className="flex justify-end">
              <Dialog open={isCatDialogOpen} onOpenChange={(open) => {
                setIsCatDialogOpen(open);
                if (!open) {
                  setEditingCat(null);
                  setCatForm({ nome: '', descricao: '' });
                }
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-accent hover:bg-accent/90">
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Categoria
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingCat ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
                    <DialogDescription>Organize seus produtos por categorias</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nome *</Label>
                      <Input
                        placeholder="Ex: Lanches, Bebidas, Sobremesas"
                        value={catForm.nome}
                        onChange={(e) => setCatForm({ ...catForm, nome: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea
                        placeholder="Descrição opcional..."
                        value={catForm.descricao}
                        onChange={(e) => setCatForm({ ...catForm, descricao: e.target.value })}
                        rows={2}
                      />
                    </div>
                    <Button onClick={handleSaveCategoria} className="w-full" disabled={isSaving}>
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      {editingCat ? 'Salvar Alterações' : 'Criar Categoria'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {categorias.length === 0 ? (
            <Card className="shadow-fcd border-0">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderOpen className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma categoria cadastrada</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categorias.map((categoria) => {
                const prodCount = produtos.filter(p => p.categoria_id === categoria.id).length;
                return (
                  <Card key={categoria.id} className="shadow-fcd border-0">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{categoria.nome}</CardTitle>
                        {canManageCategories && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditCategoria(categoria)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteCategoria(categoria.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {categoria.descricao && (
                        <p className="text-sm text-muted-foreground mb-2">{categoria.descricao}</p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {prodCount} produto{prodCount !== 1 ? 's' : ''}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
