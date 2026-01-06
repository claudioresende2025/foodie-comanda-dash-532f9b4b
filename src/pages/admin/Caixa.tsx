import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Search,
  Receipt,
  Printer,
  Loader2,
  Percent,
  DollarSign,
  QrCode,
  Truck,
  RefreshCw,
  Music,
} from 'lucide-react';
import { PixQRCode } from '@/components/pix/PixQRCode';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

type PaymentMethod = 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito';
type CaixaTab = 'mesas' | 'delivery';

type PagamentoItem = {
  metodo: PaymentMethod;
  valor: number;
};

export default function Caixa() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const getSettings = () => {
    const saved = localStorage.getItem('fcd-settings');
    if (saved) return JSON.parse(saved);
    return { taxaServicoAtiva: true, taxaServicoPercentual: 10, couverAtivo: false, couverValor: 0 };
  };

  const savedSettings = getSettings();

  const [activeTab, setActiveTab] = useState<CaixaTab>('mesas');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedComanda, setSelectedComanda] = useState<any>(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [serviceCharge, setServiceCharge] = useState(savedSettings.taxaServicoPercentual || 10);
  const [includeService, setIncludeService] = useState(savedSettings.taxaServicoAtiva !== false);
  const [includeCouver, setIncludeCouver] = useState(false);
  const [couverQuantidade, setCouverQuantidade] = useState(1);
  const [couverValorConfig] = useState(savedSettings.couverValor || 0);
  const [couverAtivo] = useState(savedSettings.couverAtivo || false);
  const [formaPagamento, setFormaPagamento] = useState<PaymentMethod | ''>('');
  const [trocoPara, setTrocoPara] = useState('');
  const [pagamentoMultiplo, setPagamentoMultiplo] = useState(false);
  const [pagamentos, setPagamentos] = useState<PagamentoItem[]>([]);
  const [metodosAtivos, setMetodosAtivos] = useState<PaymentMethod[]>([]);
  const [showPixModal, setShowPixModal] = useState(false);
  const [pixValue, setPixValue] = useState(0);

  const { data: empresa } = useQuery({
    queryKey: ['empresa', profile?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('empresas').select('*').eq('id', profile?.empresa_id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.empresa_id,
  });

  const { data: comandas = [], isLoading: isLoadingComandas } = useQuery({
    queryKey: ['comandas-abertas', profile?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comandas')
        .select(`*, mesa:mesas(numero_mesa), pedidos(id, quantidade, preco_unitario, subtotal, produto:produtos(nome))`)
        .eq('empresa_id', profile?.empresa_id)
        .eq('status', 'aberta')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.empresa_id,
  });

  const closeComandaMutation = useMutation({
    mutationFn: async ({ comandaId, formaPagamento, total, mesaId }: any) => {
      const { error: comandaError } = await supabase
        .from('comandas')
        .update({
          status: 'fechada',
          forma_pagamento: formaPagamento === 'multiplo' ? 'dinheiro' : formaPagamento,
          total,
          data_fechamento: new Date().toISOString(),
        })
        .eq('id', comandaId);

      if (comandaError) throw comandaError;

      if (mesaId) {
        // Libera a mesa e possíveis junções
        const { data: mesaData } = await supabase.from('mesas').select('id, mesa_juncao_id').eq('id', mesaId).single();
        const idsToUpdate = mesaData?.mesa_juncao_id 
            ? [mesaId] 
            : (await supabase.from('mesas').select('id').or(`id.eq.${mesaId},mesa_juncao_id.eq.${mesaId}`)).data?.map(m => m.id) || [mesaId];

        await supabase.from('mesas').update({ status: 'disponivel', mesa_juncao_id: null }).in('id', idsToUpdate);
      }
      return { formaPagamento, total };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['comandas-abertas'] });
      queryClient.invalidateQueries({ queryKey: ['mesas'] });
      
      if (result.formaPagamento === 'pix' || pagamentos.some(p => p.metodo === 'pix')) {
        setPixValue(result.total);
        setShowPixModal(true);
      } else {
        setSelectedComanda(null);
        toast.success('Comanda encerrada com sucesso!');
      }
    }
  });

  const calcularSubtotal = (comanda: any) => comanda.pedidos?.reduce((acc: number, p: any) => acc + (p.subtotal || 0), 0) || 0;

  const calcularTotal = (comanda: any) => {
    const subtotal = calcularSubtotal(comanda);
    const desconto = subtotal * (discountPercent / 100);
    const taxa = includeService ? (subtotal - desconto) * (serviceCharge / 100) : 0;
    const couver = includeCouver ? couverValorConfig * couverQuantidade : 0;
    return subtotal - desconto + taxa + couver;
  };

  const handleFinalizar = () => {
    if (!formaPagamento && !pagamentoMultiplo) return toast.error('Selecione o pagamento');
    closeComandaMutation.mutate({
      comandaId: selectedComanda.id,
      formaPagamento: pagamentoMultiplo ? 'multiplo' : formaPagamento,
      total: calcularTotal(selectedComanda),
      mesaId: selectedComanda.mesa_id
    });
  };

  return (
    <div className="space-y-6 p-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Caixa</h1>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries()}><RefreshCw className="w-4 h-4 mr-2"/> Atualizar</Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar mesa..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {comandas.filter((c:any) => c.mesa?.numero_mesa?.toString().includes(searchTerm)).map((c: any) => (
              <div key={c.id} onClick={() => setSelectedComanda(c)} className={`p-3 border rounded-lg cursor-pointer ${selectedComanda?.id === c.id ? 'bg-primary/10 border-primary' : ''}`}>
                <div className="flex justify-between">
                  <span>Mesa {c.mesa?.numero_mesa}</span>
                  <Badge>R$ {calcularSubtotal(c).toFixed(2)}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          {selectedComanda ? (
            <CardContent className="pt-6 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Detalhes Mesa {selectedComanda.mesa?.numero_mesa}</h2>
                <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2"/> Imprimir</Button>
              </div>

              <div className="border rounded-lg divide-y">
                {selectedComanda.pedidos?.map((p: any) => (
                  <div key={p.id} className="p-3 flex justify-between">
                    <span>{p.quantidade}x {p.produto?.nome}</span>
                    <span>R$ {p.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2"><Switch checked={includeService} onCheckedChange={setIncludeService}/> Taxa {serviceCharge}%</div>
                  <span>R$ {(calcularSubtotal(selectedComanda) * (serviceCharge/100)).toFixed(2)}</span>
                </div>
                {couverAtivo && (
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2"><Switch checked={includeCouver} onCheckedChange={setIncludeCouver}/> Couver</div>
                    <Input type="number" className="w-16 h-8" value={couverQuantidade} onChange={e => setCouverQuantidade(Number(e.target.value))}/>
                  </div>
                )}
              </div>

              <div className="bg-muted p-4 rounded-lg flex justify-between items-center">
                <span className="text-lg font-bold">Total a Pagar</span>
                <span className="text-2xl font-bold text-primary">R$ {calcularTotal(selectedComanda).toFixed(2)}</span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {(['dinheiro', 'pix', 'cartao_credito', 'cartao_debito'] as PaymentMethod[]).map(m => (
                  <Button key={m} variant={formaPagamento === m ? 'default' : 'outline'} onClick={() => setFormaPagamento(m)} className="capitalize">{m.replace('_', ' ')}</Button>
                ))}
              </div>

              <Button className="w-full h-12 text-lg" onClick={handleFinalizar} disabled={closeComandaMutation.isPending}>
                {closeComandaMutation.isPending ? <Loader2 className="animate-spin" /> : 'Finalizar Pagamento'}
              </Button>
            </CardContent>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">Selecione uma comanda para faturar</div>
          )}
        </Card>
      </div>

      <Dialog open={showPixModal} onOpenChange={setShowPixModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pagamento PIX</DialogTitle></DialogHeader>
          {empresa?.chave_pix ? (
            <PixQRCode chavePix={empresa.chave_pix} valor={pixValue} nomeRecebedor={empresa.nome_fantasia} cidade="Brasil" />
          ) : <p>Chave PIX não configurada.</p>}
          <Button onClick={() => { setShowPixModal(false); setSelectedComanda(null); }} className="w-full">Fechar</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
