import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, AlertCircle, Building2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SubscriptionSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const sessionId = searchParams.get('session_id');
  const planoId = searchParams.get('planoId');
  const periodo = searchParams.get('periodo') || 'mensal';
  
  const [step, setStep] = useState<'loading' | 'register' | 'creating' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  
  // Form state
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (sessionId) {
      verifyPayment();
    } else {
      setError('Sessão de pagamento não encontrada');
      setStep('error');
    }
  }, [sessionId]);

  const verifyPayment = async () => {
    try {
      console.log('[SubscriptionSuccess] Verificando pagamento:', sessionId);
      
      // Verificar se o pagamento foi confirmado via edge function
      const { data, error } = await supabase.functions.invoke('verify-subscription-payment', {
        body: { sessionId },
      });

      if (error) throw error;

      console.log('[SubscriptionSuccess] Verificação:', data);

      if (data?.success) {
        setSessionData(data);
        
        // Se já tiver empresa vinculada (usuário logado), redireciona direto
        if (data.empresaId) {
          toast.success('Assinatura ativada com sucesso!');
          navigate('/admin/assinatura?subscription=success');
          return;
        }
        
        // Caso contrário, mostra formulário de cadastro
        setStep('register');
      } else {
        setError(data?.error || 'Pagamento não confirmado');
        setStep('error');
      }
    } catch (err: any) {
      console.error('[SubscriptionSuccess] Erro:', err);
      setError(err.message || 'Erro ao verificar pagamento');
      setStep('error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome || !email || !password || !nomeFantasia) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setIsSubmitting(true);
    setStep('creating');

    try {
      console.log('[SubscriptionSuccess] Criando usuário e empresa...');

      // 1. Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nome }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Erro ao criar usuário');

      console.log('[SubscriptionSuccess] Usuário criado:', authData.user.id);

      // 2. Criar empresa
      const { data: empresa, error: empresaError } = await supabase
        .from('empresas')
        .insert({
          nome_fantasia: nomeFantasia,
          cnpj: cnpj || null,
          usuario_proprietario_id: authData.user.id
        })
        .select()
        .single();

      if (empresaError) throw empresaError;

      console.log('[SubscriptionSuccess] Empresa criada:', empresa.id);

      // 3. Atualizar profile com empresa_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ empresa_id: empresa.id })
        .eq('id', authData.user.id);

      if (profileError) {
        console.warn('[SubscriptionSuccess] Erro ao atualizar profile:', profileError);
      }

      // 4. Criar role de proprietário
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          empresa_id: empresa.id,
          role: 'proprietario'
        });

      if (roleError) {
        console.warn('[SubscriptionSuccess] Erro ao criar role:', roleError);
      }

      // 5. Vincular assinatura à empresa via edge function
      const { data: linkData, error: linkError } = await supabase.functions.invoke('process-subscription', {
        body: { 
          sessionId,
          empresaId: empresa.id,
          planoId,
          periodo
        },
      });

      if (linkError) {
        console.warn('[SubscriptionSuccess] Erro ao vincular assinatura:', linkError);
      }

      console.log('[SubscriptionSuccess] Assinatura vinculada:', linkData);

      setStep('success');
      toast.success('Conta criada e assinatura ativada!');

      // Redirecionar após 2 segundos
      setTimeout(() => {
        navigate('/admin?onboarding=true');
      }, 2000);

    } catch (err: any) {
      console.error('[SubscriptionSuccess] Erro:', err);
      setError(err.message || 'Erro ao criar conta');
      setStep('error');
      toast.error(err.message || 'Erro ao criar conta');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 18);
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 p-6">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Verificando pagamento...</p>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Erro</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => navigate('/planos')}>
              Voltar aos Planos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Tudo Pronto!</h1>
            <p className="text-muted-foreground mb-4">
              Sua conta foi criada e sua assinatura está ativa.
            </p>
            <p className="text-sm text-muted-foreground">
              Redirecionando para o painel...
            </p>
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mt-4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // step === 'register' || step === 'creating'
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 p-6">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Pagamento Confirmado!</CardTitle>
          <CardDescription>
            Agora crie sua conta para acessar a plataforma
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome">Seu Nome *</Label>
                <Input
                  id="nome"
                  placeholder="João Silva"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="joao@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha *</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                minLength={6}
                required
              />
            </div>

            <div className="border-t pt-4 mt-4">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Dados da Empresa</h3>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nomeFantasia">Nome Fantasia *</Label>
                  <Input
                    id="nomeFantasia"
                    placeholder="Restaurante do João"
                    value={nomeFantasia}
                    onChange={(e) => setNomeFantasia(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ (opcional)</Label>
                  <Input
                    id="cnpj"
                    placeholder="00.000.000/0000-00"
                    value={cnpj}
                    onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando conta...
                </>
              ) : (
                'Criar Conta e Acessar'
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Ao criar sua conta, você concorda com nossos termos de uso e política de privacidade.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
