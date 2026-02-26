import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Loader2, 
  Shield, 
  Building2, 
  CreditCard, 
  Settings, 
  DollarSign,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  Ban,
  Unlock,
  TrendingUp,
  Calendar,
  ArrowLeft,
  Save,
  Key,
  Wallet,
  BarChart3,
  FileText,
  Clock,
  Search
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Empresa {
  id: string;
  nome_fantasia: string;
  cnpj: string | null;
  endereco_completo: string | null;
  logo_url: string | null;
  chave_pix: string | null;
  created_at: string;
  usuario_proprietario_id: string | null;
  assinatura?: any;
}

interface ConfigSistema {
  id: string;
  chave: string;
  valor: string;
  tipo: string;
  descricao: string;
  grupo: string;
  editavel: boolean;
}

interface Reembolso {
  id: string;
  tipo: string;
  valor: number;
  motivo: string;
  status: string;
  metodo_original: string;
  created_at: string;
  empresa?: { nome_fantasia: string };
  pedido_delivery_id?: string;
}

interface DashboardStats {
  totalEmpresas: number;
  empresasAtivas: number;
  empresasTrial: number;
  empresasBloqueadas: number;
  receitaMensal: number;
  reembolsosPendentes: number;
  empresasBronze: number;
  empresasPrata: number;
  empresasOuro: number;
}

export default function SuperAdmin() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Dashboard stats
  const [stats, setStats] = useState<DashboardStats>({
    totalEmpresas: 0,
    empresasAtivas: 0,
    empresasTrial: 0,
    empresasBloqueadas: 0,
    receitaMensal: 0,
    reembolsosPendentes: 0,
    empresasBronze: 0,
    empresasPrata: 0,
    empresasOuro: 0,
  });
  
  // Empresas
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Configurações
  const [configs, setConfigs] = useState<ConfigSistema[]>([]);
  const [editingConfigs, setEditingConfigs] = useState<Record<string, string>>({});
  const [savingConfigs, setSavingConfigs] = useState(false);
  
  // Reembolsos
  const [reembolsos, setReembolsos] = useState<Reembolso[]>([]);
  const [selectedReembolso, setSelectedReembolso] = useState<Reembolso | null>(null);
  const [reembolsoDialogOpen, setReembolsoDialogOpen] = useState(false);
  
  // Empresa selecionada
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [empresaDialogOpen, setEmpresaDialogOpen] = useState(false);
  const [empresaOverrides, setEmpresaOverrides] = useState<any>(null);
  const [savingOverrides, setSavingOverrides] = useState(false);

  // Função para exibir nome correto do plano
  const getPlanDisplayName = (planoNome: string | null | undefined, planoSlug?: string | null) => {
    const slug = planoSlug?.toLowerCase();
    if (slug === 'bronze') return 'Plano Bronze (Iniciante)';
    if (slug === 'prata') return 'Plano Prata (Intermediário)';
    if (slug === 'ouro') return 'Plano Ouro (Enterprise)';
    if (planoNome) return planoNome;
    return 'Sem plano';
  };

  useEffect(() => {
    if (!selectedEmpresa) return;
    (async () => {
      try {
        const { data } = await (supabase as any).from('empresa_overrides').select('*').eq('empresa_id', selectedEmpresa.id).maybeSingle();
        if (data) {
          setEmpresaOverrides({ ...(data.overrides || {}), kds_screens_limit: data.kds_screens_limit, staff_limit: data.staff_limit });
        } else {
          setEmpresaOverrides({});
        }
      } catch (e) {
        console.warn('Erro carregando overrides', e);
        setEmpresaOverrides({});
      }
    })();
  }, [selectedEmpresa]);

  useEffect(() => {
    checkSuperAdmin();
  }, []);

  const checkSuperAdmin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: superAdmin } = await (supabase as any)
        .from('super_admins')
        .select('*')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .single();

      if (!superAdmin) {
        toast.error('Acesso negado. Você não é um super administrador.');
        // Não navegamos automaticamente — exibiremos mensagem para o usuário
        setIsSuperAdmin(false);
        setIsLoading(false);
        return;
      }

      setIsSuperAdmin(true);
      await loadData();
    } catch (err) {
      console.error('Erro ao verificar super admin:', err);
      toast.error('Erro ao verificar permissões');
      setIsSuperAdmin(false);
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = async () => {
    await Promise.all([
      loadStats(),
      loadEmpresas(),
      loadConfigs(),
      loadReembolsos(),
    ]);
  };

  const loadStats = async () => {
    try {
      // Total empresas
      const { count: totalEmpresas } = await supabase
        .from('empresas')
        .select('*', { count: 'exact', head: true });

      // Empresas com assinatura ativa
      const { count: empresasAtivas } = await (supabase as any)
        .from('assinaturas')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Empresas em trial
      const { count: empresasTrial } = await (supabase as any)
        .from('assinaturas')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'trialing');

      // Empresas bloqueadas
      const { count: empresasBloqueadas } = await supabase
        .from('empresas')
        .select('*', { count: 'exact', head: true })
        .not('blocked_at', 'is', null);

      // Receita mensal (soma dos pagamentos do mês)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: pagamentos } = await (supabase as any)
        .from('pagamentos_assinatura')
        .select('valor')
        .eq('status', 'succeeded')
        .gte('created_at', startOfMonth.toISOString());

      const receitaMensal = (pagamentos || []).reduce((sum: number, p: any) => sum + (p.valor || 0), 0);

      // Reembolsos pendentes
      const { count: reembolsosPendentes } = await (supabase as any)
        .from('reembolsos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Contagem por plano
      const { data: assinaturasPorPlano } = await (supabase as any)
        .from('assinaturas')
        .select('plano:planos(slug)')
        .in('status', ['active', 'trialing']);

      let empresasBronze = 0;
      let empresasPrata = 0;
      let empresasOuro = 0;

      (assinaturasPorPlano || []).forEach((a: any) => {
        const slug = a.plano?.slug?.toLowerCase();
        if (slug === 'bronze') empresasBronze++;
        else if (slug === 'prata') empresasPrata++;
        else if (slug === 'ouro') empresasOuro++;
      });

      setStats({
        totalEmpresas: totalEmpresas || 0,
        empresasAtivas: empresasAtivas || 0,
        empresasTrial: empresasTrial || 0,
        empresasBloqueadas: empresasBloqueadas || 0,
        receitaMensal,
        reembolsosPendentes: reembolsosPendentes || 0,
        empresasBronze,
        empresasPrata,
        empresasOuro,
      });
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err);
    }
  };

  const loadEmpresas = async () => {
    try {
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Carregar assinaturas para cada empresa
      const empresasWithSub = await Promise.all(
        (data || []).map(async (empresa) => {
          const { data: assinatura } = await (supabase as any)
            .from('assinaturas')
            .select('*, plano:planos(*)')
            .eq('empresa_id', empresa.id)
            .single();

          return { ...empresa, assinatura };
        })
      );

      setEmpresas(empresasWithSub);
    } catch (err) {
      console.error('Erro ao carregar empresas:', err);
    }
  };

  const loadConfigs = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('config_sistema')
        .select('*')
        .order('grupo', { ascending: true });

      if (error) throw error;
      setConfigs(data || []);
      
      // Inicializar valores de edição
      const initial: Record<string, string> = {};
      (data || []).forEach((c: ConfigSistema) => {
        initial[c.chave] = c.valor || '';
      });
      setEditingConfigs(initial);
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
    }
  };

  const loadReembolsos = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('reembolsos')
        .select('*, empresa:empresas(nome_fantasia)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setReembolsos(data || []);
    } catch (err) {
      console.error('Erro ao carregar reembolsos:', err);
    }
  };

  const handleSaveConfigs = async () => {
    setSavingConfigs(true);
    try {
      for (const config of configs) {
        if (config.editavel && editingConfigs[config.chave] !== config.valor) {
          await (supabase as any)
            .from('config_sistema')
            .update({ valor: editingConfigs[config.chave], updated_at: new Date().toISOString() })
            .eq('chave', config.chave);
        }
      }
      toast.success('Configurações salvas com sucesso!');
      await loadConfigs();
    } catch (err) {
      console.error('Erro ao salvar configurações:', err);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSavingConfigs(false);
    }
  };

  const handleBlockEmpresa = async (empresa: Empresa, block: boolean) => {
    try {
      // Funcionalidade de bloqueio removida - campo blocked_at não existe
      toast.info('Funcionalidade em desenvolvimento');
      setEmpresaDialogOpen(false);
    } catch (err) {
      console.error('Erro:', err);
      toast.error('Erro ao atualizar empresa');
    }
  };

  const handleProcessReembolso = async (reembolso: Reembolso, status: 'succeeded' | 'failed') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await (supabase as any)
        .from('reembolsos')
        .update({
          status,
          processado_por: user?.id,
          processado_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', reembolso.id);

      toast.success(status === 'succeeded' ? 'Reembolso aprovado' : 'Reembolso rejeitado');
      await loadReembolsos();
      await loadStats();
      setReembolsoDialogOpen(false);
    } catch (err) {
      console.error('Erro ao processar reembolso:', err);
      toast.error('Erro ao processar reembolso');
    }
  };

  const filteredEmpresas = empresas.filter(empresa => {
    const matchesSearch = empresa.nome_fantasia?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'active') return matchesSearch && empresa.assinatura?.status === 'active';
    if (filterStatus === 'trialing') return matchesSearch && empresa.assinatura?.status === 'trialing';
    
    return matchesSearch;
  });

  const getStatusBadge = (empresa: Empresa) => {
    const status = empresa.assinatura?.status;
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Ativa</Badge>;
      case 'trialing':
        const trialEnd = new Date(empresa.assinatura?.trial_end);
        const isExpired = trialEnd < new Date();
        return isExpired 
          ? <Badge variant="destructive">Trial Expirado</Badge>
          : <Badge className="bg-blue-500">Trial</Badge>;
      case 'canceled':
        return <Badge variant="secondary">Cancelada</Badge>;
      case 'past_due':
        return <Badge variant="destructive">Pagamento Atrasado</Badge>;
      default:
        return <Badge variant="outline">Sem Assinatura</Badge>;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-lg w-full bg-white rounded-lg shadow p-8 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">Acesso negado</h2>
          <p className="text-sm text-muted-foreground mb-6">Você não possui permissões de Super Admin para acessar este painel.</p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => navigate('/admin')}>Ir para painél</Button>
            <Button onClick={() => navigate('/')}>Home</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-800 text-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate('/admin')}
                className="text-white hover:bg-white/20"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Super Admin</h1>
                  <p className="text-sm text-white/70">Painel do Desenvolvedor</p>
                </div>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadData}
              className="text-slate-900"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="dashboard" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="empresas" className="gap-2">
              <Building2 className="w-4 h-4" />
              Empresas
            </TabsTrigger>
            <TabsTrigger value="financeiro" className="gap-2">
              <DollarSign className="w-4 h-4" />
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2">
              <Settings className="w-4 h-4" />
              Configurações
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.totalEmpresas}</p>
                      <p className="text-xs text-muted-foreground">Total Empresas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.empresasAtivas}</p>
                      <p className="text-xs text-muted-foreground">Assinaturas Ativas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.empresasTrial}</p>
                      <p className="text-xs text-muted-foreground">Em Trial</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                      <Ban className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.empresasBloqueadas}</p>
                      <p className="text-xs text-muted-foreground">Bloqueadas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{formatCurrency(stats.receitaMensal)}</p>
                      <p className="text-xs text-muted-foreground">Receita Mensal</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.reembolsosPendentes}</p>
                      <p className="text-xs text-muted-foreground">Reembolsos Pendentes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Distribuição por Plano */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-l-4 border-l-amber-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Plano Bronze</p>
                      <p className="text-2xl font-bold">{stats.empresasBronze}</p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">Bronze</Badge>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-slate-400">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Plano Prata</p>
                      <p className="text-2xl font-bold">{stats.empresasPrata}</p>
                    </div>
                    <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-200">Prata</Badge>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-yellow-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Plano Ouro</p>
                      <p className="text-2xl font-bold">{stats.empresasOuro}</p>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Ouro</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Empresas Recentes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-500" />
                  Empresas Recentes
                </CardTitle>
                <CardDescription>Últimas 5 empresas cadastradas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {empresas.slice(0, 5).map((empresa) => (
                    <div key={empresa.id} className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => {
                      setSelectedEmpresa(empresa);
                      setEmpresaDialogOpen(true);
                    }}>
                      <p className="font-medium text-sm truncate">{empresa.nome_fantasia}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(empresa.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                      <Badge variant="outline" className="mt-2 text-xs">
                        {getPlanDisplayName(empresa.assinatura?.plano?.nome, empresa.assinatura?.plano?.slug)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Reembolsos Pendentes */}
            {stats.reembolsosPendentes > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    Reembolsos Pendentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reembolsos.filter(r => r.status === 'pending').slice(0, 5).map((reembolso) => (
                        <TableRow key={reembolso.id}>
                          <TableCell>{reembolso.empresa?.nome_fantasia || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{reembolso.tipo}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">{formatCurrency(reembolso.valor)}</TableCell>
                          <TableCell>
                            {format(new Date(reembolso.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setSelectedReembolso(reembolso);
                                setReembolsoDialogOpen(true);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Empresas Tab */}
          <TabsContent value="empresas" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Empresas Cadastradas</CardTitle>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar empresa..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Filtrar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="active">Ativas</SelectItem>
                        <SelectItem value="trialing">Trial</SelectItem>
                        <SelectItem value="expired">Trial Expirado</SelectItem>
                        <SelectItem value="blocked">Bloqueadas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Criado em</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmpresas.map((empresa) => (
                        <TableRow key={empresa.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{empresa.nome_fantasia}</p>
                              <p className="text-xs text-muted-foreground">{empresa.cnpj || '-'}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getPlanDisplayName(empresa.assinatura?.plano?.nome, empresa.assinatura?.plano?.slug)}
                          </TableCell>
                          <TableCell>{getStatusBadge(empresa)}</TableCell>
                          <TableCell>
                            {format(new Date(empresa.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setSelectedEmpresa(empresa);
                                setEmpresaDialogOpen(true);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Financeiro Tab */}
          <TabsContent value="financeiro" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Reembolsos</CardTitle>
                <CardDescription>
                  Gerencie solicitações de reembolso de pedidos e assinaturas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Método Original</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reembolsos.map((reembolso) => (
                      <TableRow key={reembolso.id}>
                        <TableCell className="font-mono text-xs">
                          {reembolso.id.slice(0, 8)}
                        </TableCell>
                        <TableCell>{reembolso.empresa?.nome_fantasia || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{reembolso.tipo}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(reembolso.valor)}
                        </TableCell>
                        <TableCell>{reembolso.metodo_original || '-'}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              reembolso.status === 'succeeded' ? 'default' :
                              reembolso.status === 'pending' ? 'secondary' :
                              'destructive'
                            }
                          >
                            {reembolso.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(reembolso.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedReembolso(reembolso);
                              setReembolsoDialogOpen(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configurações Tab */}
          <TabsContent value="config" className="space-y-6">
            {/* Stripe Config */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Configurações do Stripe
                </CardTitle>
                <CardDescription>
                  Configure as chaves de API do Stripe para processar pagamentos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {configs.filter(c => c.grupo === 'stripe').map((config) => (
                  <div key={config.id} className="space-y-2">
                    <Label htmlFor={config.chave}>{config.descricao}</Label>
                    <Input
                      id={config.chave}
                      type={config.chave.includes('secret') ? 'password' : 'text'}
                      value={editingConfigs[config.chave] || ''}
                      onChange={(e) => setEditingConfigs({
                        ...editingConfigs,
                        [config.chave]: e.target.value
                      })}
                      disabled={!config.editavel}
                      placeholder={`Digite ${config.descricao.toLowerCase()}`}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* PIX Config */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Dados Bancários / PIX
                </CardTitle>
                <CardDescription>
                  Configure suas informações bancárias para receber pagamentos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {configs.filter(c => c.grupo === 'pix').map((config) => (
                  <div key={config.id} className="space-y-2">
                    <Label htmlFor={config.chave}>{config.descricao}</Label>
                    <Input
                      id={config.chave}
                      value={editingConfigs[config.chave] || ''}
                      onChange={(e) => setEditingConfigs({
                        ...editingConfigs,
                        [config.chave]: e.target.value
                      })}
                      disabled={!config.editavel}
                      placeholder={`Digite ${config.descricao.toLowerCase()}`}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* General Config */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Configurações Gerais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {configs.filter(c => c.grupo === 'geral').map((config) => (
                  <div key={config.id} className="space-y-2">
                    <Label htmlFor={config.chave}>{config.descricao}</Label>
                    <Input
                      id={config.chave}
                      type={config.tipo === 'number' ? 'number' : 'text'}
                      value={editingConfigs[config.chave] || ''}
                      onChange={(e) => setEditingConfigs({
                        ...editingConfigs,
                        [config.chave]: e.target.value
                      })}
                      disabled={!config.editavel}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSaveConfigs} disabled={savingConfigs}>
                {savingConfigs ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar Configurações
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Dialog Detalhes Empresa */}
      <Dialog open={empresaDialogOpen} onOpenChange={setEmpresaDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedEmpresa?.nome_fantasia}</DialogTitle>
            <DialogDescription>Detalhes e ações da empresa</DialogDescription>
          </DialogHeader>
          
          {selectedEmpresa && (
            <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">CNPJ</p>
                  <p className="font-medium">{selectedEmpresa.cnpj || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Endereço</p>
                  <p className="font-medium">{selectedEmpresa.endereco_completo || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Plano</p>
                  <p className="font-medium">{getPlanDisplayName(selectedEmpresa.assinatura?.plano?.nome, selectedEmpresa.assinatura?.plano?.slug)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  {getStatusBadge(selectedEmpresa)}
                </div>
                <div>
                  <p className="text-muted-foreground">Criado em</p>
                  <p className="font-medium">
                    {format(new Date(selectedEmpresa.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Chave PIX</p>
                  <p className="font-medium">{selectedEmpresa.chave_pix || '-'}</p>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold">Overrides / Controles</h3>
                <p className="text-sm text-muted-foreground">Ative ou desative recursos manualmente para esta empresa. Isso tem prioridade sobre o plano contratado.</p>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label>Mesas</Label>
                    <Switch checked={empresaOverrides?.mesas || false} onCheckedChange={(v) => setEmpresaOverrides({ ...empresaOverrides, mesas: v })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Delivery</Label>
                    <Switch checked={empresaOverrides?.delivery || false} onCheckedChange={(v) => setEmpresaOverrides({ ...empresaOverrides, delivery: v })} />
                  </div>
                  <div className="space-y-2">
                    <Label>KDS</Label>
                    <Switch checked={empresaOverrides?.kds || false} onCheckedChange={(v) => setEmpresaOverrides({ ...empresaOverrides, kds: v })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Marketing</Label>
                    <Switch checked={empresaOverrides?.marketing || false} onCheckedChange={(v) => setEmpresaOverrides({ ...empresaOverrides, marketing: v })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cardápio</Label>
                    <Switch checked={empresaOverrides?.cardapio || false} onCheckedChange={(v) => setEmpresaOverrides({ ...empresaOverrides, cardapio: v })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Dashboard</Label>
                    <Switch checked={empresaOverrides?.dashboard || false} onCheckedChange={(v) => setEmpresaOverrides({ ...empresaOverrides, dashboard: v })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Garçom (App)</Label>
                    <Switch checked={empresaOverrides?.garcom || false} onCheckedChange={(v) => setEmpresaOverrides({ ...empresaOverrides, garcom: v })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Equipe</Label>
                    <Switch checked={empresaOverrides?.equipe || false} onCheckedChange={(v) => setEmpresaOverrides({ ...empresaOverrides, equipe: v })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Estatísticas</Label>
                    <Switch checked={empresaOverrides?.estatisticas || false} onCheckedChange={(v) => setEmpresaOverrides({ ...empresaOverrides, estatisticas: v })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Caixa</Label>
                    <Switch checked={empresaOverrides?.caixa || false} onCheckedChange={(v) => setEmpresaOverrides({ ...empresaOverrides, caixa: v })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label>Limite telas KDS</Label>
                    <Input type="number" value={empresaOverrides?.kds_screens_limit ?? ''} onChange={(e) => setEmpresaOverrides({ ...empresaOverrides, kds_screens_limit: e.target.value ? parseInt(e.target.value) : null })} />
                  </div>
                  <div>
                    <Label>Limite funcionários</Label>
                    <Input type="number" value={empresaOverrides?.staff_limit ?? ''} onChange={(e) => setEmpresaOverrides({ ...empresaOverrides, staff_limit: e.target.value ? parseInt(e.target.value) : null })} />
                  </div>
                  <div>
                    <Label>Limite mesas</Label>
                    <Input type="number" value={empresaOverrides?.mesas_limit ?? ''} onChange={(e) => setEmpresaOverrides({ ...empresaOverrides, mesas_limit: e.target.value ? parseInt(e.target.value) : null })} />
                  </div>
                  <div>
                    <Label>Limite garçons</Label>
                    <Input type="number" value={empresaOverrides?.garcom_limit ?? ''} onChange={(e) => setEmpresaOverrides({ ...empresaOverrides, garcom_limit: e.target.value ? parseInt(e.target.value) : null })} />
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button variant="outline" onClick={() => { setEmpresaDialogOpen(false); }}>
                    Fechar
                  </Button>
                  <Button onClick={async () => {
                    setSavingOverrides(true);
                    try {
                      const overridesPayload = empresaOverrides || {};

                      // Prefer calling RPC upsert_empresa_overrides (runs as security definer)
                      try {
                        const { error: rpcError } = await supabase.rpc('upsert_empresa_overrides', {
                          p_empresa_id: selectedEmpresa.id,
                          p_overrides: overridesPayload,
                          p_kds_screens_limit: empresaOverrides?.kds_screens_limit ?? null,
                          p_staff_limit: empresaOverrides?.staff_limit ?? null,
                          p_mesas_limit: empresaOverrides?.mesas_limit ?? null,
                          p_garcom_limit: empresaOverrides?.garcom_limit ?? null,
                        } as any);

                        if (rpcError) throw rpcError;

                        toast.success('Overrides salvos');
                        setEmpresaDialogOpen(false);
                        await loadEmpresas();
                        return;
                      } catch (rpcErr) {
                        console.warn('RPC upsert_empresa_overrides failed, falling back to direct write:', rpcErr);
                        // continue to fallback below
                      }

                      // Fallback: attempt select -> insert/update (may fail if RLS blocks)
                      const payload = {
                        empresa_id: selectedEmpresa.id,
                        overrides: overridesPayload,
                        kds_screens_limit: empresaOverrides?.kds_screens_limit ?? null,
                        staff_limit: empresaOverrides?.staff_limit ?? null,
                        mesas_limit: empresaOverrides?.mesas_limit ?? null,
                        garcom_limit: empresaOverrides?.garcom_limit ?? null,
                      };

                      const { data: existing, error: selError } = await (supabase as any)
                        .from('empresa_overrides')
                        .select('id')
                        .eq('empresa_id', selectedEmpresa.id)
                        .maybeSingle();

                      if (selError) throw selError;

                      let res;
                      if (existing && existing.id) {
                        res = await (supabase as any).from('empresa_overrides').update(payload).eq('empresa_id', selectedEmpresa.id);
                      } else {
                        res = await (supabase as any).from('empresa_overrides').insert(payload);
                      }

                      if (res.error) throw res.error;

                      toast.success('Overrides salvos');
                      setEmpresaDialogOpen(false);
                      await loadEmpresas();
                    } catch (err: any) {
                      console.error('Erro salvando overrides', err);
                      // Detect common RLS error and show actionable hint
                      const msg = String(err?.message || err);
                      if (msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('violates row-level security') || msg.includes('403')) {
                        toast.error('Erro ao salvar overrides: privilégios insuficientes. Execute a função RPC `upsert_empresa_overrides` com a service role ou ajuste as policies no Supabase.');
                      } else {
                        toast.error('Erro ao salvar overrides');
                      }
                    } finally {
                      setSavingOverrides(false);
                    }
                  }} disabled={savingOverrides}>
                    {savingOverrides ? 'Salvando...' : 'Salvar Overrides'}
                  </Button>
                </div>
              </div>
            </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Detalhes Reembolso */}
      <Dialog open={reembolsoDialogOpen} onOpenChange={setReembolsoDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Reembolso</DialogTitle>
            <DialogDescription>Revise e processe a solicitação</DialogDescription>
          </DialogHeader>
          
          {selectedReembolso && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Empresa</p>
                  <p className="font-medium">{selectedReembolso.empresa?.nome_fantasia || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tipo</p>
                  <Badge variant="outline">{selectedReembolso.tipo}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Valor</p>
                  <p className="font-medium text-lg">{formatCurrency(selectedReembolso.valor)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Método Original</p>
                  <p className="font-medium">{selectedReembolso.metodo_original || '-'}</p>
                </div>
                {selectedReembolso.pedido_delivery_id && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">ID do Pedido</p>
                    <p className="font-mono text-xs">{selectedReembolso.pedido_delivery_id}</p>
                  </div>
                )}
              </div>

              {selectedReembolso.motivo && (
                <div>
                  <p className="text-muted-foreground text-sm mb-1">Motivo</p>
                  <p className="text-sm bg-muted p-3 rounded-lg">{selectedReembolso.motivo}</p>
                </div>
              )}

              <Separator />

              {selectedReembolso.status === 'pending' && (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => handleProcessReembolso(selectedReembolso, 'failed')}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Rejeitar
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={() => handleProcessReembolso(selectedReembolso, 'succeeded')}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Aprovar
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
