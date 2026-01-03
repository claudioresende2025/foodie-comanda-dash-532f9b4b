import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Ticket, Star, Gift, Percent, Plus, Trash2, Package, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function Marketing() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const queryClient = useQueryClient();

  // Estados para Cupons
  const [cupomCodigo, setCupomCodigo] = useState('');
  const [cupomValor, setCupomValor] = useState('');
  const [cupomTipo, setCupomTipo] = useState<'valor_fixo' | 'percentual'>('valor_fixo');

  // Estados para Fidelidade
  const [pontosPorReal, setPontosPorReal] = useState('1');
  const [metaPontos, setMetaPontos] = useState('100');
  const [valorRecompensa, setValorRecompensa] = useState('15');

  // Estados para Combo
  const [dialogComboOpen, setDialogComboOpen] = useState(false);
  const [comboNome, setComboNome] = useState('');
  const [comboDescricao, setComboDescricao] = useState('');
  const [comboPreco, setComboPreco] = useState('');
  const [produtosSelecionados, setProdutosSelecionados] = useState<string[]>([]);

  // Estados para Promoção
  const [dialogPromocaoOpen, setDialogPromocaoOpen] = useState(false);
  const [promocaoNome, setPromocaoNome] = useState('');
  const [promocaoDescricao, setPromocaoDescricao] = useState('');
  const [promocaoPreco, setPromocaoPreco] = useState('');
  const [promocaoDataInicio, setPromocaoDataInicio] = useState('');
  const [promocaoDataFim, setPromocaoDataFim] = useState('');

  // Buscar cupons
  const { data: cupons, isLoading: loadingCupons } = useQuery({
    queryKey: ['cupons', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from('cupons')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  // Buscar config de fidelidade
  const { data: fidelidadeConfig } = useQuery({
    queryKey: ['fidelidade_config', empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      const { data, error } = await supabase
        .from('fidelidade_config')
        .select('*')
        .eq('empresa_id', empresaId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  // Buscar combos
  const { data: combos } = useQuery({
    queryKey: ['combos', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from('combos')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  // Buscar promoções
  const { data: promocoes } = useQuery({
    queryKey: ['promocoes', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from('promocoes')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  // Buscar produtos para montar combos
  const { data: produtos } = useQuery({
    queryKey: ['produtos', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  // Preencher formulário de fidelidade quando carregar os dados
  useEffect(() => {
    if (fidelidadeConfig) {
      setPontosPorReal(fidelidadeConfig.pontos_por_real?.toString() || '1');
      setMetaPontos(fidelidadeConfig.pontos_necessarios?.toString() || '100');
      setValorRecompensa(fidelidadeConfig.valor_recompensa?.toString() || '15');
    }
  }, [fidelidadeConfig]);

  // Criar cupom
  const criarCupom = useMutation({
    mutationFn: async () => {
      if (!empresaId || !cupomCodigo || !cupomValor) {
        throw new Error('Preencha todos os campos');
      }

      const { error } = await supabase.from('cupons').insert({
        empresa_id: empresaId,
        codigo: cupomCodigo.toUpperCase(),
        tipo: cupomTipo,
        valor: parseFloat(cupomValor),
        ativo: true,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cupons', empresaId] });
      setCupomCodigo('');
      setCupomValor('');
      toast.success('Cupom criado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao criar cupom');
    },
  });

  // Deletar cupom
  const deletarCupom = useMutation({
    mutationFn: async (cupomId: string) => {
      const { error } = await supabase.from('cupons').delete().eq('id', cupomId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cupons', empresaId] });
      toast.success('Cupom deletado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao deletar cupom');
    },
  });

  // Atualizar programa de fidelidade
  const atualizarFidelidade = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error('Empresa não identificada');

      const dadosFidelidade = {
        empresa_id: empresaId,
        pontos_por_real: parseFloat(pontosPorReal),
        pontos_necessarios: parseInt(metaPontos),
        valor_recompensa: parseFloat(valorRecompensa),
        ativo: true,
      };

      if (fidelidadeConfig) {
        // Atualizar
        const { error } = await supabase
          .from('fidelidade_config')
          .update(dadosFidelidade)
          .eq('id', fidelidadeConfig.id);
        if (error) throw error;
      } else {
        // Criar
        const { error } = await supabase.from('fidelidade_config').insert(dadosFidelidade);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fidelidade_config', empresaId] });
      toast.success('Programa de fidelidade atualizado!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar programa de fidelidade');
    },
  });

  // Criar combo
  const criarCombo = useMutation({
    mutationFn: async () => {
      if (!empresaId || !comboNome || !comboPreco || produtosSelecionados.length === 0) {
        throw new Error('Preencha todos os campos e selecione pelo menos um produto');
      }

      const { error } = await supabase.from('combos').insert({
        empresa_id: empresaId,
        nome: comboNome,
        descricao: comboDescricao,
        preco_combo: parseFloat(comboPreco),
        ativo: true,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combos', empresaId] });
      setDialogComboOpen(false);
      setComboNome('');
      setComboDescricao('');
      setComboPreco('');
      setProdutosSelecionados([]);
      toast.success('Combo criado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao criar combo');
    },
  });

  // Criar promoção
  const criarPromocao = useMutation({
    mutationFn: async () => {
      if (!empresaId || !promocaoNome || !promocaoPreco) {
        throw new Error('Preencha todos os campos obrigatórios');
      }

      const { error } = await supabase.from('promocoes').insert({
        empresa_id: empresaId,
        nome: promocaoNome,
        descricao: promocaoDescricao || null,
        preco_promocional: parseFloat(promocaoPreco),
        data_inicio: promocaoDataInicio || null,
        data_fim: promocaoDataFim || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promocoes', empresaId] });
      setDialogPromocaoOpen(false);
      setPromocaoNome('');
      setPromocaoDescricao('');
      setPromocaoPreco('');
      setPromocaoDataInicio('');
      setPromocaoDataFim('');
      toast.success('Promoção criada com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao criar promoção');
    },
  });

  const toggleProduto = (produtoId: string) => {
    setProdutosSelecionados((prev) =>
      prev.includes(produtoId)
        ? prev.filter((id) => id !== produtoId)
        : [...prev, produtoId]
    );
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Marketing e Crescimento</h2>
          <p className="text-muted-foreground">
            Gerencie campanhas, fidelize clientes e aumente seu ticket médio.
          </p>
        </div>
      </div>

      <Tabs defaultValue="cupons" className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="cupons" className="gap-2">
            <Ticket className="h-4 w-4" />
            Cupons
          </TabsTrigger>
          <TabsTrigger value="fidelidade" className="gap-2">
            <Star className="h-4 w-4" />
            Fidelidade
          </TabsTrigger>
          <TabsTrigger value="combos" className="gap-2">
            <Gift className="h-4 w-4" />
            Combos
          </TabsTrigger>
          <TabsTrigger value="ofertas" className="gap-2">
            <Percent className="h-4 w-4" />
            Ofertas
          </TabsTrigger>
        </TabsList>

        {/* ABA CUPONS */}
        <TabsContent value="cupons" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Criar Novo Cupom de Desconto</CardTitle>
              <CardDescription>
                Clientes poderão inserir este código no checkout.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código do Cupom</Label>
                  <Input
                    id="codigo"
                    placeholder="EX: PRIMEIRACOMPRA"
                    value={cupomCodigo}
                    onChange={(e) => setCupomCodigo(e.target.value.toUpperCase())}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valor">Valor do Desconto (R$)</Label>
                  <Input
                    id="valor"
                    type="number"
                    step="0.01"
                    placeholder="10.00"
                    value={cupomValor}
                    onChange={(e) => setCupomValor(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select
                    value={cupomTipo}
                    onValueChange={(value: 'valor_fixo' | 'percentual') => setCupomTipo(value)}
                  >
                    <SelectTrigger id="tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="valor_fixo">R$ Fixo</SelectItem>
                      <SelectItem value="percentual">% Percentual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                className="mt-4"
                onClick={() => criarCupom.mutate()}
                disabled={criarCupom.isPending || !cupomCodigo || !cupomValor}
              >
                <Plus className="mr-2 h-4 w-4" />
                Ativar Cupom
              </Button>
            </CardContent>
          </Card>

          {/* Lista de cupons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {loadingCupons ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : cupons && cupons.length > 0 ? (
              cupons.map((cupom) => (
                <Card key={cupom.id} className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => deletarCupom.mutate(cupom.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <CardHeader>
                    <div className="inline-block bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded mb-2 w-fit">
                      {cupom.tipo === 'valor_fixo' ? 'VALOR FIXO' : 'PERCENTUAL'}
                    </div>
                    <CardTitle className="text-2xl">{cupom.codigo}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-green-600">
                      R$ {cupom.valor.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-muted-foreground col-span-3">Nenhum cupom criado ainda.</p>
            )}
          </div>
        </TabsContent>

        {/* ABA FIDELIDADE */}
        <TabsContent value="fidelidade" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Star className="h-6 w-6 text-yellow-500" />
                <CardTitle>Programa de Pontos</CardTitle>
              </div>
              <CardDescription>
                Configure como seus clientes ganham recompensas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="pontos-real">Pontos por Real Gasto</Label>
                  <Input
                    id="pontos-real"
                    type="number"
                    value={pontosPorReal}
                    onChange={(e) => setPontosPorReal(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Ex: R$ 1,00 = 1 ponto</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta-pontos">Meta de Pontos</Label>
                  <Input
                    id="meta-pontos"
                    type="number"
                    value={metaPontos}
                    onChange={(e) => setMetaPontos(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Quanto precisa para ganhar o prêmio.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valor-recompensa">Valor da Recompensa (R$)</Label>
                  <Input
                    id="valor-recompensa"
                    type="number"
                    step="0.01"
                    value={valorRecompensa}
                    onChange={(e) => setValorRecompensa(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Valor do cupom gerado automaticamente.</p>
                </div>
              </div>
              <Button onClick={() => atualizarFidelidade.mutate()} disabled={atualizarFidelidade.isPending}>
                <Save className="mr-2 h-4 w-4" />
                Atualizar Programa de Fidelidade
              </Button>
            </CardContent>
          </Card>

          {fidelidadeConfig && (
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <Star className="h-12 w-12 text-purple-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-purple-900 mb-2">
                    Programa Configurado!
                  </h3>
                  <p className="text-purple-700">
                    A cada R$ {pontosPorReal},00 seus clientes ganham {pontosPorReal}{' '}
                    {parseInt(pontosPorReal) === 1 ? 'ponto' : 'pontos'}. <br />
                    Ao atingir {metaPontos} pontos, ganham um cupom de R$ {valorRecompensa}.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ABA COMBOS */}
        <TabsContent value="combos" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Seus Combos e Kits</h3>
            <Button onClick={() => setDialogComboOpen(true)}>
              <Package className="mr-2 h-4 w-4" />
              Montar Novo Combo
            </Button>
          </div>

          {combos && combos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {combos.map((combo) => (
                <Card key={combo.id}>
                  <CardHeader>
                    <CardTitle>{combo.nome}</CardTitle>
                    <CardDescription>{combo.descricao}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-primary">
                      R$ {combo.preco_combo.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum combo criado ainda.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ABA OFERTAS */}
        <TabsContent value="ofertas" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Promoções Relâmpago</CardTitle>
                  <CardDescription>
                    Descontos aplicados direto no preço do produto.
                  </CardDescription>
                </div>
                <Button onClick={() => setDialogPromocaoOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Promoção
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {promocoes && promocoes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {promocoes.map((promo) => (
                    <Card key={promo.id}>
                      <CardHeader>
                        <CardTitle>{promo.nome}</CardTitle>
                        <CardDescription>{promo.descricao}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xl font-bold text-green-600">
                          R$ {promo.preco_promocional.toFixed(2)}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Percent className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Agende promoções por data ou horário (Ex: Happy Hour).
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Criar Combo */}
      <Dialog open={dialogComboOpen} onOpenChange={setDialogComboOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Montar Novo Combo</DialogTitle>
            <DialogDescription>
              Selecione os produtos que farão parte do combo e defina o preço promocional.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="combo-nome">Nome do Combo</Label>
              <Input
                id="combo-nome"
                placeholder="Ex: Combo Família"
                value={comboNome}
                onChange={(e) => setComboNome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="combo-descricao">Descrição</Label>
              <Textarea
                id="combo-descricao"
                placeholder="Descreva o combo..."
                value={comboDescricao}
                onChange={(e) => setComboDescricao(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="combo-preco">Preço do Combo (R$)</Label>
              <Input
                id="combo-preco"
                type="number"
                step="0.01"
                placeholder="59.90"
                value={comboPreco}
                onChange={(e) => setComboPreco(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Produtos do Combo</Label>
              <div className="border rounded-lg p-4 space-y-3 max-h-60 overflow-y-auto">
                {produtos && produtos.length > 0 ? (
                  produtos.map((produto) => (
                    <div key={produto.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`produto-${produto.id}`}
                        checked={produtosSelecionados.includes(produto.id)}
                        onCheckedChange={() => toggleProduto(produto.id)}
                      />
                      <label
                        htmlFor={`produto-${produto.id}`}
                        className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {produto.nome} - R$ {produto.preco.toFixed(2)}
                      </label>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum produto cadastrado.</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {produtosSelecionados.length} produto(s) selecionado(s)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogComboOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => criarCombo.mutate()}
              disabled={criarCombo.isPending || !comboNome || !comboPreco || produtosSelecionados.length === 0}
            >
              Criar Combo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Criar Promoção */}
      <Dialog open={dialogPromocaoOpen} onOpenChange={setDialogPromocaoOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nova Promoção Relâmpago</DialogTitle>
            <DialogDescription>
              Configure uma promoção com desconto aplicado direto no preço.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="promo-nome">Nome da Promoção</Label>
              <Input
                id="promo-nome"
                placeholder="Ex: Happy Hour - Pizza"
                value={promocaoNome}
                onChange={(e) => setPromocaoNome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="promo-descricao">Descrição</Label>
              <Textarea
                id="promo-descricao"
                placeholder="Descreva a promoção..."
                value={promocaoDescricao}
                onChange={(e) => setPromocaoDescricao(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="promo-preco">Preço Promocional (R$)</Label>
              <Input
                id="promo-preco"
                type="number"
                step="0.01"
                placeholder="24.90"
                value={promocaoPreco}
                onChange={(e) => setPromocaoPreco(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="promo-inicio">Data Início (opcional)</Label>
                <Input
                  id="promo-inicio"
                  type="datetime-local"
                  value={promocaoDataInicio}
                  onChange={(e) => setPromocaoDataInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promo-fim">Data Fim (opcional)</Label>
                <Input
                  id="promo-fim"
                  type="datetime-local"
                  value={promocaoDataFim}
                  onChange={(e) => setPromocaoDataFim(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogPromocaoOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => criarPromocao.mutate()}
              disabled={criarPromocao.isPending || !promocaoNome || !promocaoPreco}
            >
              Criar Promoção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
