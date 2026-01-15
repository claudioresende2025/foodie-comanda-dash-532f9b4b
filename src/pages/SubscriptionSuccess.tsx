import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, AlertCircle, Building2, User, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function SubscriptionSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const sessionId = searchParams.get('session_id');
  const planoId = searchParams.get('planoId');
  const periodo = searchParams.get('periodo') || 'mensal';
  
  const [step, setStep] = useState<'loading' | 'register' | 'creating' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  
  // Estados do Formulário
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
      const { data, error } = await supabase.functions.invoke('verify-subscription-payment', {
        body: { sessionId },
      });
      if (error) throw error;

      if (data?.success) {
        if (data.empresaId) {
          navigate('/admin?subscription=active');
          return;
        }
        setStep('register');
      } else {
        setError(data?.error || 'Pagamento pendente');
        setStep('error');
      }
    } catch (err: any) {
      setError(err.message);
      setStep('error');
    }
  };

  // Máscara de CNPJ
  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    const masked = val
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 18);
    setCnpj(masked);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !email || !password || !nomeFantasia) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    setIsSubmitting(true);
    setStep('creating');

    try {
      // 1. Auth SignUp
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nome } }
      });
      if (authError) throw authError;

      // 2. Criar Empresa
      const { data: empresa, error: empError } = await supabase
        .from('empresas')
        .insert({
          nome_fantasia: nomeFantasia,
          cnpj: cnpj.replace(/\D/g, '') || null,
          usuario_proprietario_id: authData.user?.id
        })
        .select().single();
      if (empError) throw empError;

      // 3. Vincular Assinatura (ISSO LIBERA O MENU)
      // Esta função deve atualizar a tabela 'assinaturas' ou 'empresas' com o planoId
      await supabase.functions.invoke('process-subscription', {
        body: { 
          sessionId, 
          empresaId: empresa.id, 
          planoId, 
          periodo 
        },
      });

      setStep('success');
      toast.success('Plano ativado com sucesso!');
      
      // Delay para o Supabase processar a sessão e o usuário ser logado automaticamente
      setTimeout(() => {
        window.location.href = '/admin?first_login=true';
      }, 2000);

    } catch (err: any) {
      toast.error(err.message);
      setStep('register');
      setIsSubmitting(false);
    }
  };

  if (step === 'loading') return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-xl w-full border-t-4 border-t-green-500 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="text-green-600 w-8 h-8" />
          </div>
          <CardTitle className="text-2xl">Pagamento Confirmado!</CardTitle>
          <CardDescription>Finalize seu cadastro para liberar o acesso ao sistema.</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wider">
                <User className="w-4 h-4" /> Dados do Responsável
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome Completo *</Label>
                  <Input value={nome} onChange={e => setNome(e.target.value)} required placeholder="Seu nome" />
                </div>
                <div className="space-y-2">
                  <Label>E-mail *</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="email@exemplo.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Senha de Acesso *</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="******" />
              </div>
            </div>

            <div className="pt-4 space-y-4 border-t">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wider">
                <Building2 className="w-4 h-4" /> Dados do Restaurante
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Restaurante *</Label>
                  <Input value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} required placeholder="Ex: Nome da sua Loja" />
                </div>
                <div className="space-y-2">
                  <Label>CNPJ (Opcional)</Label>
                  <Input value={cnpj} onChange={handleCnpjChange} placeholder="00.000.000/0000-00" />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <ShieldCheck className="mr-2" />}
              Concluir e Acessar Painel
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
