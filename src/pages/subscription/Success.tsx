import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Building2, UserPlus } from 'lucide-react';

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SubscriptionSuccess ${timestamp}] ${step}${detailsStr}`);
};

export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [planoId, setPlanoId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<string | null>('mensal');

  const [userForm, setUserForm] = useState({ nome: '', email: '', password: '' });
  const [empresaForm, setEmpresaForm] = useState({ nome_fantasia: '', cnpj: '' });

  useEffect(() => {
    const sid = params.get('session_id');
    const pid = params.get('planoId');
    const per = params.get('periodo');
    logStep('URL params extracted', { sessionId: sid, planoId: pid, periodo: per });
    setSessionId(sid);
    if (pid) setPlanoId(pid);
    if (per) setPeriodo(per);
  }, [params]);

  // Se já existe session_id e usuário logado com empresa, tenta vincular assinatura automaticamente
  useEffect(() => {
    const tryLinkForExistingUser = async () => {
      if (!sessionId) return;

      try {
        logStep('tryLinkForExistingUser: getting current user');
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) logStep('Error getting user', { error: userError.message });
        if (!user) return;

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('empresa_id')
          .eq('id', user.id)
          .single();

        if (profileError) {
          logStep('Error fetching profile', { error: profileError.message });
          return;
        }

        if (!profile?.empresa_id) return;

        setIsLoading(true);
        logStep('tryLinkForExistingUser: invoking process-subscription', { sessionId, empresaId: profile.empresa_id, planoId, periodo });
        const { data, error } = await supabase.functions.invoke('process-subscription', {
          body: { sessionId, empresaId: profile.empresa_id, planoId, periodo }
        });

        if (error) {
          logStep('process-subscription error for existing user', { error: error.message });
          // salvar para retry e notificar
          localStorage.setItem('pending_subscription', JSON.stringify({ sessionId, empresaId: profile.empresa_id, planoId, periodo, timestamp: Date.now() }));
          toast.warning('Cadastro criado! A assinatura será ativada em breve.');
          setIsLoading(false);
          return;
        }

        logStep('process-subscription success for existing user', { data });
        toast.success('Assinatura ativada com sucesso!');
        navigate('/admin');
      } catch (e: any) {
        logStep('tryLinkForExistingUser exception', { error: e?.message });
      } finally {
        setIsLoading(false);
      }
    };

    if (sessionId) tryLinkForExistingUser();
  }, [sessionId, planoId, periodo, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    logStep('handleSubmit started');

    if (!sessionId) {
      logStep('No sessionId in handleSubmit');
      return toast.error('Sessão do Stripe não encontrada. Abra o link de sucesso novamente.');
    }
    if (!userForm.email || !userForm.password || !userForm.nome) {
      return toast.error('Preencha nome, e-mail e senha.');
    }
    if (!empresaForm.nome_fantasia) {
      return toast.error('Informe o nome fantasia da empresa.');
    }

    setIsLoading(true);
    let userId: string | null = null;
    let empresaId: string | null = null;

    // Etapa 1: Signup
    try {
      logStep('Etapa 1: Iniciando signup...', { email: userForm.email });
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: userForm.email,
        password: userForm.password,
        options: { data: { nome: userForm.nome } },
      });

      if (signUpError) throw new Error(signUpError.message || 'Erro no cadastro');
      userId = signUpData.user?.id || null;
      if (!userId) throw new Error('Usuário não retornado após cadastro.');
      logStep('Etapa 1 OK', { userId });
    } catch (err: any) {
      logStep('Etapa 1 EXCEÇÃO', { error: err.message });
      toast.error(err.message || 'Erro no cadastro de usuário.');
      setIsLoading(false);
      return;
    }

    // Aguarda trigger criar profile
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Etapa 2: Criar empresa
    try {
      logStep('Etapa 2: Criando empresa...', { nome_fantasia: empresaForm.nome_fantasia });
      const { data: empresa, error: empErr } = await supabase
        .from('empresas')
        .insert({ nome_fantasia: empresaForm.nome_fantasia, cnpj: empresaForm.cnpj || null, usuario_proprietario_id: userId })
        .select()
        .single();

      if (empErr) throw new Error(empErr.message || 'Erro ao criar empresa');
      empresaId = (empresa as any)?.id || null;
      logStep('Etapa 2 OK', { empresaId });
    } catch (err: any) {
      logStep('Etapa 2 EXCEÇÃO', { error: err.message });
      toast.error(err.message || 'Erro ao criar empresa.');
      setIsLoading(false);
      return;
    }

    // Etapa 3: (Opcional) criar role  ignoramos erros não fatais
    try {
      logStep('Etapa 3: Criando role (opcional)');
      await supabase.from('user_roles').insert({ user_id: userId, role: 'owner', empresa_id: empresaId });
      logStep('Etapa 3 OK');
    } catch (err: any) {
      logStep('Etapa 3 AVISO: falha ao criar role (não fatal)', { error: err.message });
    }

    // Etapa 4: Vincular assinatura via Edge Function (com fallback)
    try {
      logStep('Etapa 4: Processando assinatura...', { sessionId, empresaId, planoId, periodo });
      const { data: linkRes, error: linkErr } = await supabase.functions.invoke('process-subscription', {
        body: { sessionId, empresaId, planoId, periodo }
      });

      if (linkErr) {
        logStep('Etapa 4 AVISO: Erro ao vincular assinatura', { error: linkErr.message });
        localStorage.setItem('pending_subscription', JSON.stringify({ sessionId, empresaId, planoId, periodo, timestamp: Date.now() }));
        toast.warning('Cadastro criado! A assinatura será ativada em breve.');
      } else {
        logStep('Etapa 4 OK: Assinatura vinculada', { response: linkRes });
        toast.success('Assinatura vinculada com sucesso!');
      }
    } catch (err: any) {
      logStep('Etapa 4 EXCEÇÃO: Erro ao processar assinatura', { error: err.message });
      localStorage.setItem('pending_subscription', JSON.stringify({ sessionId, empresaId, planoId, periodo, timestamp: Date.now() }));
      toast.warning('Cadastro criado! A assinatura será ativada automaticamente.');
    } finally {
      setIsLoading(false);
    }

    // Etapa 5: Enviar e-mail de boas-vindas (não bloqueia)
    try {
      logStep('Etapa 5: Enviando e-mail de boas-vindas...');
      await supabase.functions.invoke('send-email', {
        body: { type: 'welcome', to: userForm.email, data: { nome: userForm.nome, trialDays: 3, loginUrl: `${window.location.origin}/admin` } }
      });
      logStep('Etapa 5 OK: E-mail enviado');
    } catch (emailErr: any) {
      logStep('Etapa 5 AVISO: falha ao enviar e-mail', { error: emailErr.message });
    }

    // Finalizar fluxo
    logStep('Finalizando fluxo: navegando para /admin');
    navigate('/admin');
  };

  if (isLoading && !showForm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Processando assinatura...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground shadow mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold">Pagamento aprovado</h1>
          <p className="text-muted-foreground mt-2">Finalize seu cadastro para ativar a assinatura</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Conta do Usuário
                </CardTitle>
                <CardDescription>Crie sua conta de acesso</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nome</Label>
                  <Input value={userForm.nome} onChange={(e) => setUserForm({ ...userForm, nome: e.target.value })} placeholder="Seu nome" />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="voce@exemplo.com" />
                </div>
                <div>
                  <Label>Senha</Label>
                  <Input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder="********" />
                </div>
              </CardContent>
            </Card>

            <Card className="border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Dados da Empresa
                </CardTitle>
                <CardDescription>Informações do seu estabelecimento</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nome Fantasia</Label>
                  <Input value={empresaForm.nome_fantasia} onChange={(e) => setEmpresaForm({ ...empresaForm, nome_fantasia: e.target.value })} placeholder="Ex: Restaurante Sabor & Arte" />
                </div>
                <div>
                  <Label>CNPJ (opcional)</Label>
                  <Input value={empresaForm.cnpj} onChange={(e) => setEmpresaForm({ ...empresaForm, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 flex items-center justify-end">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Concluir Cadastro
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
