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

      setStats({
        totalEmpresas: totalEmpresas || 0,
        empresasAtivas: empresasAtivas || 0,
        empresasTrial: empresasTrial || 0,
        empresasBloqueadas: empresasBloqueadas || 0,
        receitaMensal,
        reembolsosPendentes: reembolsosPendentes || 0,
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

  const getPlanDisplayName = (plano: any) => {
    if (!plano) return 'Sem plano';
    const slug = plano.slug?.toLowerCase();
    if (slug === 'bronze') return 'Bronze (Iniciante)';
    if (slug === 'prata') return 'Prata (Intermediário)';
    if (slug === 'ouro') return 'Ouro (Enterprise)';
    return plano.nome || 'Sem plano';
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

            {/* Grid com 2 colunas */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Empresas Recentes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="w-5 h-5 text-blue-500" />
                    Empresas Recentes
                  </CardTitle>
                  <CardDescription>Últimas empresas cadastradas</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {empresas.slice(0, 5).map((empresa) => (
                      <div key={empresa.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{empresa.nome_fantasia}</p>
                            <p className="text-xs text-muted-foreground">
                              {getPlanDisplayName(empresa.assinatura?.plano)} • {format(new Date(empresa.created_at), 'dd/MM', { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(empresa)}
                      </div>
                    ))}
                    {empresas.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhuma empresa cadastrada</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Distribuição por Plano */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="w-5 h-5 text-emerald-500" />
                    Distribuição por Plano
                  </CardTitle>
                  <CardDescription>Quantidade de empresas por plano</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(() => {
                      const planoStats = empresas.reduce((acc, emp) => {
                        const plano = getPlanDisplayName(emp.assinatura?.plano);
                        acc[plano] = (acc[plano] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>);
                      
                      const total = Object.values(planoStats).reduce((a, b) => a + b, 0) || 1;
                      const colors: Record<string, string> = {
                        'Bronze': 'bg-orange-500',
                        'Prata': 'bg-slate-400',
                        'Ouro': 'bg-amber-500',
                        'Sem plano': 'bg-gray-300',
                      };
                      
                      return Object.entries(planoStats).map(([plano, count]) => (
                        <div key={plano} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{plano}</span>
                            <span className="text-muted-foreground">{count} ({Math.round((count / total) * 100)}%)</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${colors[plano] || 'bg-primary'} transition-all`} 
                              style={{ width: `${(count / total) * 100}%` }}
                            />
                          </div>
                        </div>
                      ));
                    })()}
                    {empresas.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

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
            {/* Stats resumidas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                <CardContent className="p-4 flex items-center gap-3">
                  <Building2 className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold text-blue-700">{stats.totalEmpresas}</p>
                    <p className="text-xs text-blue-600">Total Empresas</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
                <CardContent className="p-4 flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold text-green-700">{stats.empresasAtivas}</p>
                    <p className="text-xs text-green-600">Ativas</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900">
                <CardContent className="p-4 flex items-center gap-3">
                  <Clock className="w-8 h-8 text-purple-600" />
                  <div>
                    <p className="text-2xl font-bold text-purple-700">{stats.empresasTrial}</p>
                    <p className="text-xs text-purple-600">Em Trial</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
                <CardContent className="p-4 flex items-center gap-3">
                  <Ban className="w-8 h-8 text-red-600" />
                  <div>
                    <p className="text-2xl font-bold text-red-700">{stats.empresasBloqueadas}</p>
                    <p className="text-xs text-red-600">Bloqueadas</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Empresas Cadastradas</CardTitle>
                    <CardDescription>{filteredEmpresas.length} empresas encontradas</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
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
                      <SelectTrigger className="w-36">
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
                <ScrollArea className="h-[450px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[250px]">Empresa</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Trial Termina</TableHead>
                        <TableHead>Criado em</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmpresas.map((empresa) => {
                        const trialEnd = empresa.assinatura?.trial_end ? new Date(empresa.assinatura.trial_end) : null;
                        const isTrialExpired = trialEnd && trialEnd < new Date();
                        
                        return (
                          <TableRow key={empresa.id} className="hover:bg-muted/50">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {empresa.logo_url ? (
                                  <img src={empresa.logo_url} alt="" className="w-8 h-8 rounded object-cover" />
                                ) : (
                                  <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                                    <Building2 className="w-4 h-4 text-primary" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium">{empresa.nome_fantasia}</p>
                                  <p className="text-xs text-muted-foreground">{empresa.cnpj || 'CNPJ não informado'}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-normal">
                                {getPlanDisplayName(empresa.assinatura?.plano)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {empresa.assinatura?.periodo === 'anual' ? 'Anual' : 'Mensal'}
                            </TableCell>
                            <TableCell>{getStatusBadge(empresa)}</TableCell>
                            <TableCell className="text-sm">
                              {trialEnd ? (
                                <span className={isTrialExpired ? 'text-destructive' : ''}>
                                  {format(trialEnd, 'dd/MM/yyyy', { locale: ptBR })}
                                </span>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(empresa.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setSelectedEmpresa(empresa);
                                    setEmpresaDialogOpen(true);
                                  }}
                                  title="Ver detalhes"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredEmpresas.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            Nenhuma empresa encontrada
                          </TableCell>
                        </TableRow>
                      )}
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

      {/* Dialog Detalhes Empresa - Compacto */}
      <Dialog open={empresaDialogOpen} onOpenChange={setEmpresaDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-4 pt-4 pb-2 border-b">
            <div className="flex items-center gap-3">
              {selectedEmpresa?.logo_url ? (
                <img src={selectedEmpresa.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
              )}
              <div>
                <DialogTitle className="text-base">{selectedEmpresa?.nome_fantasia}</DialogTitle>
                <p className="text-xs text-muted-foreground">{selectedEmpresa?.cnpj || 'CNPJ não informado'}</p>
              </div>
            </div>
          </DialogHeader>
          
          {selectedEmpresa && (
            <ScrollArea className="flex-1 px-4">
              <div className="py-3 space-y-4">
                {/* Info Básica */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-[10px] uppercase text-muted-foreground font-medium">Plano</p>
                    <p className="font-medium text-sm">{getPlanDisplayName(selectedEmpresa.assinatura?.plano)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-[10px] uppercase text-muted-foreground font-medium">Status</p>
                    <div className="mt-0.5">{getStatusBadge(selectedEmpresa)}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-[10px] uppercase text-muted-foreground font-medium">Criado em</p>
                    <p className="font-medium text-sm">
                      {format(new Date(selectedEmpresa.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-[10px] uppercase text-muted-foreground font-medium">Chave PIX</p>
                    <p className="font-medium text-sm truncate">{selectedEmpresa.chave_pix || '-'}</p>
                  </div>
                </div>

                {selectedEmpresa.endereco_completo && (
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-[10px] uppercase text-muted-foreground font-medium">Endereço</p>
                    <p className="text-sm">{selectedEmpresa.endereco_completo}</p>
                  </div>
                )}

                <Separator />

                {/* Overrides Compacto */}
                <div>
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Overrides / Controles
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">Sobrescreve configurações do plano para esta empresa.</p>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
                    {[
                      { key: 'mesas', label: 'Mesas' },
                      { key: 'delivery', label: 'Delivery' },
                      { key: 'kds', label: 'KDS' },
                      { key: 'marketing', label: 'Marketing' },
                      { key: 'cardapio', label: 'Cardápio' },
                      { key: 'dashboard', label: 'Dashboard' },
                      { key: 'garcom', label: 'Garçom (App)' },
                      { key: 'equipe', label: 'Equipe' },
                      { key: 'estatisticas', label: 'Estatísticas' },
                      { key: 'caixa', label: 'Caixa' },
                    ].map(item => (
                      <div key={item.key} className="flex items-center justify-between py-1">
                        <Label className="text-sm font-normal">{item.label}</Label>
                        <Switch 
                          checked={empresaOverrides?.[item.key] || false} 
                          onCheckedChange={(v) => setEmpresaOverrides({ ...empresaOverrides, [item.key]: v })} 
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div>
                      <Label className="text-xs">Limite Mesas</Label>
                      <Input 
                        type="number"
                        placeholder="Ilimitado"
                        className="h-8 text-sm"
                        value={empresaOverrides?.mesas_limit ?? ''} 
                        onChange={(e) => setEmpresaOverrides({ ...empresaOverrides, mesas_limit: e.target.value ? parseInt(e.target.value) : null })} 
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Limite Garçom</Label>
                      <Input 
                        type="number"
                        placeholder="Ilimitado"
                        className="h-8 text-sm"
                        value={empresaOverrides?.garcom_limit ?? ''} 
                        onChange={(e) => setEmpresaOverrides({ ...empresaOverrides, garcom_limit: e.target.value ? parseInt(e.target.value) : null })} 
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Limite Telas KDS</Label>
                      <Input 
                        type="number"
                        placeholder="Ilimitado"
                        className="h-8 text-sm"
                        value={empresaOverrides?.kds_screens_limit ?? ''} 
                        onChange={(e) => setEmpresaOverrides({ ...empresaOverrides, kds_screens_limit: e.target.value ? parseInt(e.target.value) : null })} 
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Limite Funcionários</Label>
                      <Input 
                        type="number"
                        placeholder="Ilimitado"
                        className="h-8 text-sm"
                        value={empresaOverrides?.staff_limit ?? ''} 
                        onChange={(e) => setEmpresaOverrides({ ...empresaOverrides, staff_limit: e.target.value ? parseInt(e.target.value) : null })} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
          
          <div className="px-4 py-3 border-t flex gap-2 bg-muted/30">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setEmpresaDialogOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" className="flex-1" onClick={async () => {
              setSavingOverrides(true);
              try {
                const overridesPayload = empresaOverrides || {};

                // Prefer calling RPC upsert_empresa_overrides (runs as security definer)
                try {
                  const { error: rpcError } = await supabase.rpc('upsert_empresa_overrides', {
                    p_empresa_id: selectedEmpresa!.id,
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
                }

                // Fallback: attempt select -> insert/update (may fail if RLS blocks)
                const payload = {
                  empresa_id: selectedEmpresa!.id,
                  overrides: overridesPayload,
                  kds_screens_limit: empresaOverrides?.kds_screens_limit ?? null,
                  staff_limit: empresaOverrides?.staff_limit ?? null,
                  mesas_limit: empresaOverrides?.mesas_limit ?? null,
                  garcom_limit: empresaOverrides?.garcom_limit ?? null,
                };

                const { data: existing, error: selError } = await (supabase as any)
                  .from('empresa_overrides')
                  .select('id')
                  .eq('empresa_id', selectedEmpresa!.id)
                  .maybeSingle();

                if (selError) throw selError;

                let res;
                if (existing && existing.id) {
                  res = await (supabase as any).from('empresa_overrides').update(payload).eq('empresa_id', selectedEmpresa!.id);
                } else {
                  res = await (supabase as any).from('empresa_overrides').insert(payload);
                }

                if (res.error) throw res.error;

                toast.success('Overrides salvos');
                setEmpresaDialogOpen(false);
                await loadEmpresas();
              } catch (err: any) {
                console.error('Erro salvando overrides', err);
                const msg = String(err?.message || err);
                if (msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('violates row-level security') || msg.includes('403')) {
                  toast.error('Erro ao salvar overrides: privilégios insuficientes.');
                } else {
                  toast.error('Erro ao salvar overrides');
                }
              } finally {
                setSavingOverrides(false);
              }
            }} disabled={savingOverrides}>
              {savingOverrides ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              {savingOverrides ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
