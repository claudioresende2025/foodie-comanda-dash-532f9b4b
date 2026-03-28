import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { db, sincronizarTudo } from '@/lib/db';
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
import { Plus, Loader2, Upload, Pencil, Trash2, ChefHat, FolderOpen, RefreshCw, X, Search, ScanLine } from 'lucide-react';
import { ImageSearchModal } from '@/components/admin/ImageSearchModal';
import { MenuScannerModal } from '@/components/admin/MenuScannerModal';

// Tipo para variações de tamanho
export interface VariacaoTamanho {
  nome: string;
  preco: number;
}

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
  variacoes?: VariacaoTamanho[] | null;
  ncm?: string | null;
};

import { Button } from '@/components/ui/button';

export default function Cardapio() {
  const { profile } = useAuth();
  const { canEditCardapio } = useUserRole();
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
    ncm: '',
  });
  const [prodImage, setProdImage] = useState<File | null>(null);
  const [prodImagePreview, setProdImagePreview] = useState<string | null>(null);
  const [prodImageUrl, setProdImageUrl] = useState<string | null>(null); // URL da imagem buscada
  const [isImageSearchOpen, setIsImageSearchOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Estados para variações de tamanho
  const [possuiVariacoes, setPossuiVariacoes] = useState(false);
  const [variacoes, setVariacoes] = useState<VariacaoTamanho[]>([]);
  
  // Scanner de cardápio
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Fetch categorias - Offline-First Híbrido
  const { data: categorias = [], isLoading: isLoadingCat, refetch: refetchCat } = useQuery({
    queryKey: ['categorias', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      
      // 1. Buscar do banco local primeiro
      let dadosLocais: Categoria[] = [];
      try {
        const locais = await db.categorias.where('empresa_id').equals(empresaId).toArray();
        dadosLocais = locais.map((c: any) => ({
          id: c.id,
          nome: c.nome,
          descricao: c.descricao || null,
          ordem: c.ordem || 0,
          ativo: c.ativo !== false,
        })) as Categoria[];
      } catch (err) {
        console.warn('[Offline-First] Erro ao ler categorias do IndexedDB:', err);
      }
      
      // 2. Se online, buscar do Supabase e atualizar local
      if (navigator.onLine) {
        try {
          const { data, error } = await supabase
            .from('categorias')
            .select('*')
            .eq('empresa_id', empresaId)
            .order('ordem');
          
          if (!error && data) {
            const dadosComSync = data.map((item: any) => ({ ...item, sincronizado: 1 }));
            await db.categorias.bulkPut(dadosComSync);
            return data as Categoria[];
          }
        } catch (err) {
          console.warn('[Offline-First] Supabase inacessível para categorias:', err);
        }
      }
      
      return dadosLocais.sort((a, b) => a.ordem - b.ordem);
    },
    enabled: !!empresaId,
    staleTime: 60000,
  });

  // Fetch produtos - Offline-First Híbrido
  const { data: produtos = [], isLoading: isLoadingProd, refetch: refetchProd } = useQuery({
    queryKey: ['produtos', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      
      // 1. Buscar do banco local primeiro
      let dadosLocais: Produto[] = [];
      try {
        const locais = await db.produtos.where('empresa_id').equals(empresaId).toArray();
        dadosLocais = locais.map((p: any) => ({
          id: p.id,
          nome: p.nome,
          descricao: p.descricao || null,
          preco: p.preco || 0,
          imagem_url: p.imagem_url || null,
          categoria_id: p.categoria_id || null,
          ativo: p.ativo !== false,
          variacoes: p.variacoes || null,
          ncm: p.ncm || null,
        })) as Produto[];
      } catch (err) {
        console.warn('[Offline-First] Erro ao ler produtos do IndexedDB:', err);
      }
      
      // 2. Se online, buscar do Supabase e atualizar local
      if (navigator.onLine) {
        try {
          const { data, error } = await supabase
            .from('produtos')
            .select('*')
            .eq('empresa_id', empresaId)
            .order('nome');
          
          if (!error && data) {
            const dadosComSync = data.map((item: any) => ({ ...item, sincronizado: 1 }));
            await db.produtos.bulkPut(dadosComSync);
            return data as Produto[];
          }
        } catch (err) {
          console.warn('[Offline-First] Supabase inacessível para produtos:', err);
        }
      }
      
      return dadosLocais.sort((a, b) => a.nome.localeCompare(b.nome));
    },
    enabled: !!empresaId,
    staleTime: 60000,
  });

  const isLoading = isLoadingCat || isLoadingProd;

  // Category handlers - Offline-First
  const handleSaveCategoria = async () => {
    if (!empresaId || !catForm.nome.trim()) {
      toast.error('Nome da categoria é obrigatório');
      return;
    }

    setIsSaving(true);
    try {
      if (editingCat) {
        // EDIÇÃO: Salvar local primeiro
        const dadosAtualizados = {
          ...editingCat,
          nome: catForm.nome,
          descricao: catForm.descricao || null,
          sincronizado: 0,
        };
        await db.categorias.put(dadosAtualizados);
        toast.success('Categoria atualizada!');
        
        // Sincronizar em background se online
        if (navigator.onLine) {
          try {
            const { error } = await supabase
              .from('categorias')
              .update({ nome: catForm.nome, descricao: catForm.descricao || null })
              .eq('id', editingCat.id);
            if (!error) {
              await db.categorias.update(editingCat.id, { sincronizado: 1 });
            }
            sincronizarTudo(supabase).catch(console.warn);
          } catch (syncErr) {
            console.warn('[Offline-First] Erro na sincronização:', syncErr);
          }
        }
      } else {
        // CRIAÇÃO: Gerar UUID e salvar local primeiro
        const localId = crypto.randomUUID();
        const novaCategoria = {
          id: localId,
          empresa_id: empresaId,
          nome: catForm.nome,
          descricao: catForm.descricao || null,
          ordem: categorias.length,
          ativo: true,
          sincronizado: 0,
        };
        await db.categorias.put(novaCategoria);
        toast.success('Categoria criada!');
        
        // Sincronizar em background se online
        if (navigator.onLine) {
          try {
                const { error } = await supabase.from('categorias').insert({
              id: localId,
              empresa_id: empresaId,
              nome: catForm.nome,
              descricao: catForm.descricao || null,
              ordem: categorias.length,
            });
            if (!error) {
              await db.categorias.update(localId, { sincronizado: 1 });
            }
            sincronizarTudo(supabase).catch(console.warn);
          } catch (syncErr) {
            console.warn('[Offline-First] Erro na sincronização:', syncErr);
          }
        }
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
      // Excluir do local primeiro
      await db.categorias.delete(id);
      toast.success('Categoria excluída!');
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      
      // Sincronizar com Supabase se online
      if (navigator.onLine) {
        try {
          await supabase.from('categorias').delete().eq('id', id);
          sincronizarTudo(supabase).catch(console.warn);
        } catch (syncErr) {
          console.warn('[Offline-First] Erro ao sincronizar exclusão:', syncErr);
        }
      }
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

  // Funções para gerenciar variações
  const adicionarVariacao = () => {
    setVariacoes([...variacoes, { nome: '', preco: 0 }]);
  };

  const removerVariacao = (index: number) => {
    setVariacoes(variacoes.filter((_, i) => i !== index));
  };

  const atualizarVariacao = (index: number, campo: keyof VariacaoTamanho, valor: string | number) => {
    const novasVariacoes = [...variacoes];
    novasVariacoes[index] = {
      ...novasVariacoes[index],
      [campo]: campo === 'preco' ? parseFloat(valor as string) || 0 : valor
    };
    setVariacoes(novasVariacoes);
  };

  const handleSaveProduto = async () => {
    // Validar campos obrigatórios
    if (!empresaId || !prodForm.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    // Se tem variações, validar variações; senão, validar preço único
    if (possuiVariacoes) {
      if (variacoes.length === 0) {
        toast.error('Adicione pelo menos uma variação de tamanho');
        return;
      }
      const variacoesInvalidas = variacoes.some(v => !v.nome.trim() || v.preco <= 0);
      if (variacoesInvalidas) {
        toast.error('Preencha nome e preço de todas as variações');
        return;
      }
    } else {
      if (!prodForm.preco) {
        toast.error('Preço é obrigatório');
        return;
      }
    }

    setIsSaving(true);
    try {
      let imagem_url = editingProd?.imagem_url || null;

      // Upload de imagem só funciona online
      if (navigator.onLine) {
        // Prioridade: 1) Arquivo uploadado, 2) URL de imagem buscada online
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
        } else if (prodImageUrl) {
          // Usar URL da imagem buscada online
          imagem_url = prodImageUrl;
        }
      } else if (prodImage || prodImageUrl) {
        toast.info('Upload de imagem será feito quando houver conexão');
      }

      const produtoData = {
        nome: prodForm.nome,
        descricao: prodForm.descricao || null,
        preco: possuiVariacoes && variacoes.length > 0
          ? Math.min(...variacoes.map(v => v.preco))
          : parseFloat(prodForm.preco),
        categoria_id: prodForm.categoria_id || null,
        ativo: prodForm.ativo,
        imagem_url,
        variacoes: possuiVariacoes && variacoes.length > 0 ? variacoes : null,
        ncm: prodForm.ncm || null,
      };

      if (editingProd) {
        // EDIÇÃO: Salvar local primeiro
        const dadosAtualizados = {
          ...editingProd,
          ...produtoData,
          sincronizado: 0,
        };
        await db.produtos.put(dadosAtualizados);
        toast.success('Produto atualizado!');
        
        // Sincronizar em background se online
        if (navigator.onLine) {
          try {
            const { error } = await supabase
              .from('produtos')
              .update(produtoData)
              .eq('id', editingProd.id);
            if (!error) {
              await db.produtos.update(editingProd.id, { sincronizado: 1 });
            }
            sincronizarTudo(supabase).catch(console.warn);
          } catch (syncErr) {
            console.warn('[Offline-First] Erro na sincronização:', syncErr);
          }
        }
      } else {
        // CRIAÇÃO: Gerar UUID e salvar local primeiro
        const localId = crypto.randomUUID();
        const novoProduto = {
          id: localId,
          empresa_id: empresaId,
          ...produtoData,
          sincronizado: 0,
        };
        await db.produtos.put(novoProduto);
        toast.success('Produto criado!');
        
        // Sincronizar em background se online
        if (navigator.onLine) {
          try {
            const { error } = await supabase.from('produtos').insert({
              id: localId,
              empresa_id: empresaId,
              ...produtoData,
            });
            if (!error) {
              await db.produtos.update(localId, { sincronizado: 1 });
            }
            sincronizarTudo(supabase).catch(console.warn);
          } catch (syncErr) {
            console.warn('[Offline-First] Erro na sincronização:', syncErr);
          }
        }
      }

      setIsProdDialogOpen(false);
      setEditingProd(null);
      setProdForm({ nome: '', descricao: '', preco: '', categoria_id: '', ativo: true, ncm: '' });
      setProdImage(null);
      setProdImagePreview(null);
      setProdImageUrl(null);
      setPossuiVariacoes(false);
      setVariacoes([]);
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
      // Excluir do local primeiro
      await db.produtos.delete(id);
      toast.success('Produto excluído!');
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      
      // Sincronizar com Supabase se online
      if (navigator.onLine) {
        try {
          await supabase.from('produtos').delete().eq('id', id);
          sincronizarTudo(supabase).catch(console.warn);
        } catch (syncErr) {
          console.warn('[Offline-First] Erro ao sincronizar exclusão:', syncErr);
        }
      }
    } catch (error) {
      console.error('Error deleting produto:', error);
      toast.error('Erro ao excluir produto');
    }
  };

  // Importar produtos do scanner de cardápio
  const handleImportProducts = async (produtos: Array<{ nome: string; descricao: string; preco: number; imagemUrl?: string }>) => {
    if (!empresaId || produtos.length === 0) return;
    
    setIsImporting(true);
    let sucessos = 0;
    let falhas = 0;
    
    try {
      for (const produto of produtos) {
        try {
          let imagem_url: string | null = null;
          
          // Se tem imagem em base64, fazer upload para o storage
          if (produto.imagemUrl && produto.imagemUrl.startsWith('data:image/')) {
            try {
              // Converter base64 para blob
              const response = await fetch(produto.imagemUrl);
              const blob = await response.blob();
              
              // Gerar nome único para o arquivo
              const fileExt = produto.imagemUrl.includes('image/png') ? 'png' : 'jpg';
              const fileName = `${empresaId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
              
              // Upload para o storage
              const { error: uploadError } = await supabase.storage
                .from('produtos')
                .upload(fileName, blob, {
                  contentType: blob.type,
                  cacheControl: '3600',
                });
              
              if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage
                  .from('produtos')
                  .getPublicUrl(fileName);
                imagem_url = publicUrl;
              }
            } catch (uploadErr) {
              console.error('Erro ao fazer upload da imagem:', uploadErr);
              // Continua sem imagem se o upload falhar
            }
          }
          
          const { error } = await supabase.from('produtos').insert({
            empresa_id: empresaId,
            nome: produto.nome,
            descricao: produto.descricao || null,
            preco: produto.preco,
            imagem_url,
            ativo: true,
          });
          
          if (error) {
            console.error('Erro ao cadastrar produto:', produto.nome, error);
            falhas++;
          } else {
            sucessos++;
          }
        } catch (err) {
          console.error('Erro ao cadastrar produto:', produto.nome, err);
          falhas++;
        }
      }
      
      // Atualizar lista de produtos
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      
      if (falhas === 0) {
        toast.success(`${sucessos} produto(s) cadastrado(s) com sucesso!`);
      } else if (sucessos > 0) {
        toast.warning(`${sucessos} produto(s) cadastrado(s), ${falhas} falha(s)`);
      } else {
        toast.error('Não foi possível cadastrar os produtos');
      }
    } catch (error) {
      console.error('Erro na importação:', error);
      toast.error('Erro ao importar produtos');
    } finally {
      setIsImporting(false);
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
      ncm: produto.ncm || '',
    });
    setProdImagePreview(produto.imagem_url);
    
    // Carregar variações se existirem
    if (produto.variacoes && Array.isArray(produto.variacoes) && produto.variacoes.length > 0) {
      setPossuiVariacoes(true);
      setVariacoes(produto.variacoes);
    } else {
      setPossuiVariacoes(false);
      setVariacoes([]);
    }
    
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
        <Button 
          variant="outline" 
          disabled={isRefreshing}
          onClick={async () => { 
            setIsRefreshing(true);
            try {
              await Promise.all([refetchCat(), refetchProd()]);
              toast.success('Cardápio atualizado!');
            } finally {
              setIsRefreshing(false);
            }
          }}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
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
          {canEditCardapio && (
            <div className="flex flex-wrap gap-2 justify-end">
              {/* Botão Escanear Cardápio - ideal para celular */}
              <Button 
                variant="outline"
                onClick={() => setIsScannerOpen(true)}
                disabled={isImporting}
                className="gap-2"
              >
                {isImporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ScanLine className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Escanear Cardápio</span>
                <span className="sm:hidden">Escanear</span>
              </Button>
              
              <Dialog open={isProdDialogOpen} onOpenChange={(open) => {
                setIsProdDialogOpen(open);
                if (!open) {
                  setEditingProd(null);
                  setProdForm({ nome: '', descricao: '', preco: '', categoria_id: '', ativo: true, ncm: '' });
                  setProdImage(null);
                  setProdImagePreview(null);
                  setProdImageUrl(null);
                  setPossuiVariacoes(false);
                  setVariacoes([]);
                }
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Produto
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl sm:max-h-[85vh] flex flex-col">
                <DialogHeader className="flex-shrink-0 pb-2">
                  <DialogTitle>{editingProd ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
                  <DialogDescription>Preencha os dados do produto</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 sm:overflow-y-auto flex-1 pr-1 -mr-1">
                  {/* Image Upload */}
                  <div className="space-y-2">
                    <Label>Imagem do Produto</Label>
                    <div className="flex items-center gap-4">
                      <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-border bg-muted/50 flex items-center justify-center overflow-hidden">
                        {prodImagePreview ? (
                          <>
                            <img src={prodImagePreview} alt="Preview" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => {
                                setProdImagePreview(null);
                                setProdImage(null);
                                setProdImageUrl(null);
                              }}
                              className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <Upload className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex gap-2">
                          <Input type="file" accept="image/*" onChange={handleImageChange} className="flex-1" />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setIsImageSearchOpen(true)}
                            title="Buscar imagem online"
                          >
                            <Search className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">PNG, JPG (máx 2MB) ou busque uma imagem online</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Nome *</Label>
                      {prodForm.nome.length >= 3 && !prodImagePreview && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsImageSearchOpen(true)}
                          className="text-primary hover:text-primary/80 h-6 text-xs"
                        >
                          <Search className="w-3 h-3 mr-1" />
                          Buscar imagem
                        </Button>
                      )}
                    </div>
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

                  {/* Switch para múltiplos tamanhos */}
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="space-y-0.5">
                      <Label className="text-base">Possui múltiplos tamanhos?</Label>
                      <p className="text-xs text-muted-foreground">
                        Ex: Pequena, Média, Grande com preços diferentes
                      </p>
                    </div>
                    <Switch
                      checked={possuiVariacoes}
                      onCheckedChange={(checked) => {
                        setPossuiVariacoes(checked);
                        if (checked && variacoes.length === 0) {
                          setVariacoes([{ nome: '', preco: 0 }]);
                        }
                      }}
                    />
                  </div>

                  {/* Preço único ou Variações */}
                  {!possuiVariacoes ? (
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
                  ) : (
                    <>
                      {/* Variações de Tamanho */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Variações de Tamanho *</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={adicionarVariacao}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Adicionar
                          </Button>
                        </div>
                        
                        <div className="space-y-2">
                          {variacoes.map((variacao, index) => (
                            <div key={index} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                              <Input
                                placeholder="Nome (ex: Pequena)"
                                value={variacao.nome}
                                onChange={(e) => atualizarVariacao(index, 'nome', e.target.value)}
                                className="flex-1"
                              />
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Preço"
                                value={variacao.preco || ''}
                                onChange={(e) => atualizarVariacao(index, 'preco', e.target.value)}
                                className="w-28"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removerVariacao(index)}
                                className="text-destructive hover:text-destructive"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        
                        {variacoes.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Clique em "Adicionar" para criar variações de tamanho
                          </p>
                        )}
                      </div>

                      {/* Categoria (quando tem variações) */}
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
                    </>
                  )}

                  <div className="flex items-center justify-between">
                    <Label>Produto Ativo</Label>
                    <Switch
                      checked={prodForm.ativo}
                      onCheckedChange={(checked) => setProdForm({ ...prodForm, ativo: checked })}
                    />
                  </div>

                  {/* NCM */}
                  <div className="space-y-2">
                    <Label>NCM (Código Fiscal)</Label>
                    <Input
                      placeholder="Ex: 16025000"
                      value={prodForm.ncm}
                      onChange={(e) => setProdForm({ ...prodForm, ncm: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                      maxLength={8}
                    />
                    <div className="flex flex-wrap gap-1">
                      {[
                        { label: 'Lanches', ncm: '16025000' },
                        { label: 'Bebidas', ncm: '22021000' },
                        { label: 'Cervejas', ncm: '22030000' },
                        { label: 'Pizzas', ncm: '19012090' },
                        { label: 'Sobremesas', ncm: '21069090' },
                      ].map((item) => (
                        <button
                          key={item.ncm}
                          type="button"
                          className="text-xs px-2 py-1 rounded border bg-muted hover:bg-muted/80 transition-colors"
                          onClick={() => setProdForm({ ...prodForm, ncm: item.ncm })}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Botão fixo no final do dialog */}
                <div className="flex-shrink-0 pt-4 border-t mt-2 pb-4 sm:pb-0 sticky bottom-0 bg-background">
                  <Button onClick={handleSaveProduto} className="w-full h-12 text-base font-semibold" disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {editingProd ? 'Salvar Alterações' : 'Criar Produto'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Modal de Busca de Imagem */}
            <ImageSearchModal
              isOpen={isImageSearchOpen}
              onClose={() => setIsImageSearchOpen(false)}
              initialQuery={prodForm.nome}
              onSelectImage={(imageUrl) => {
                setProdImageUrl(imageUrl);
                setProdImagePreview(imageUrl);
                setProdImage(null); // Limpar arquivo se tiver
              }}
            />
          </div>
          )}

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
                      <div>
                        {produto.variacoes && Array.isArray(produto.variacoes) && produto.variacoes.length > 0 ? (
                          <span className="text-lg font-bold text-primary">
                            A partir de R$ {produto.preco.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-lg font-bold text-primary">
                            R$ {produto.preco.toFixed(2)}
                          </span>
                        )}
                        {produto.variacoes && produto.variacoes.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {produto.variacoes.length} tamanho{produto.variacoes.length > 1 ? 's' : ''}
                          </p>
                        )}
                        {produto.ncm && (
                          <p className="text-xs text-muted-foreground">NCM: {produto.ncm}</p>
                        )}
                      </div>
                      {canEditCardapio && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditProduto(produto)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteProduto(produto.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="categorias" className="space-y-4">
          {canEditCardapio && (
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
                        {canEditCardapio && (
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
      
      {/* Modal Scanner de Cardápio */}
      <MenuScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onImportProducts={handleImportProducts}
      />
    </div>
  );
}
