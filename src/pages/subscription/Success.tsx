import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Building2, UserPlus } from 'lucide-react';

export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [planoId, setPlanoId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<string | null>('mensal');

  const [userForm, setUserForm] = useState({
    nome: '',
    email: '',
    password: '',
  });

  const [empresaForm, setEmpresaForm] = useState({
    nome_fantasia: '',
    cnpj: '',
  });

  useEffect(() => {
    const sid = params.get('session_id');
    const pid = params.get('planoId');
    const per = params.get('periodo');
    setSessionId(sid);
    if (pid) setPlanoId(pid);
    if (per) setPeriodo(per);
  }, [params]);

  // Verificar se usuário já está logado e tem empresa
  useEffect(() => {
    const checkExistingUser = async () => {
      if (!sessionId) {
        setIsLoading(false);
        setShowForm(true);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          // Usuário não logado, mostrar formulário de cadastro
          setIsLoading(false);
          setShowForm(true);
          return;
        }

        // Usuário logado, verificar se tem empresa
        const { data: profile } = await supabase
          .from('profiles')
          .select('empresa_id')
          .eq('id', user.id)
          .single();

        if (!profile?.empresa_id) {
          // Usuário logado mas sem empresa, mostrar formulário
          setIsLoading(false);
          setShowForm(true);
          return;
        }

        // Usuário logado COM empresa - processar assinatura e redirecionar
        console.log('[SubscriptionSuccess] Usuário logado com empresa, processando assinatura...');
        
        const { error } = await supabase.functions.invoke('process-subscription', {
          body: {
            sessionId,
            empresaId: profile.empresa_id,
            planoId,
            periodo,
          },
        });

        if (error) {
          console.error('Erro ao processar assinatura:', error);
          toast.error('Erro ao processar assinatura. Tente novamente.');
          setIsLoading(false);
          setShowForm(true);
          return;
        }

        toast.success('Assinatura atualizada com sucesso!');
        navigate('/admin/assinatura');
      } catch (e: any) {
        console.error('Erro ao verificar usuário:', e);
        setIsLoading(false);
        setShowForm(true);
      }
    };

    if (sessionId) {
      checkExistingUser();
    }
  }, [sessionId, planoId, periodo, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) {
      return toast.error('Sessão do Stripe não encontrada. Abra o link de sucesso novamente.');
    }
    if (!userForm.email || !userForm.password || !userForm.nome) {
      return toast.error('Preencha nome, e-mail e senha.');
    }
    if (!empresaForm.nome_fantasia) {
      return toast.error('Informe o nome fantasia da empresa.');
    }

    setIsLoading(true);
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: userForm.email,
        password: userForm.password,
        options: { data: { nome: userForm.nome } },
      });
      if (signUpError) throw signUpError;

      const userId = signUpData.user?.id;
      if (!userId) throw new Error('Usuário não autenticado após cadastro.');

      const { data: empresa, error: empErr } = await supabase
        .from('empresas')
        .insert({
          nome_fantasia: empresaForm.nome_fantasia,
          cnpj: empresaForm.cnpj || null,
          usuario_proprietario_id: userId,
        })
        .select()
        .single();
      if (empErr || !empresa) throw empErr || new Error('Falha ao criar empresa.');

      const { error: profErr } = await supabase
        .from('profiles')
        .update({ empresa_id: empresa.id })
        .eq('id', userId);
      if (profErr) throw profErr;

      await supabase.from('user_roles').insert({
        user_id: userId,
        empresa_id: empresa.id,
        role: 'proprietario',
      });

      const { data: linkRes, error: linkErr } = await supabase.functions.invoke('process-subscription', {
        body: {
          sessionId,
          empresaId: empresa.id,
          planoId,
          periodo,
        },
      });
      if (linkErr) {
        toast.error(linkErr.message || 'Falha ao vincular assinatura.');
      } else {
        toast.success('Assinatura vinculada com sucesso!');
      }

      navigate('/admin/assinatura');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao concluir cadastro.');
      setIsLoading(false);
    }
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
          <p className="text-muted-foreground mt-2">
            Finalize seu cadastro para ativar a assinatura
          </p>
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
                  <Input
                    value={userForm.nome}
                    onChange={(e) => setUserForm({ ...userForm, nome: e.target.value })}
                    placeholder="Seu nome"
                  />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    placeholder="voce@exemplo.com"
                  />
                </div>
                <div>
                  <Label>Senha</Label>
                  <Input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder="********"
                  />
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
                  <Input
                    value={empresaForm.nome_fantasia}
                    onChange={(e) => setEmpresaForm({ ...empresaForm, nome_fantasia: e.target.value })}
                    placeholder="Ex: Restaurante Sabor & Arte"
                  />
                </div>
                <div>
                  <Label>CNPJ (opcional)</Label>
                  <Input
                    value={empresaForm.cnpj}
                    onChange={(e) => setEmpresaForm({ ...empresaForm, cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                  />
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
